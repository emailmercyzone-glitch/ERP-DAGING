# ERP DAGING — Source Costing Path Audit (Draft)

**Tanggal audit:** 15 November 2026  
**Branch dokumen:** `plan-consolidation-draft`  
**File source utama:** `src/engine/businessEngine.ts`  
**Source blob SHA yang diperiksa:** `e4821a7e6494c332ad78f5f662862ac68dd07659`  
**File tipe:** `src/engine/types.ts`  
**Scope:** Pembelian, penjualan, conversion, opname, retur, void, dan reducer sinkronisasi.  
**Perubahan source:** Tidak ada.  
**Test/build:** Tidak dijalankan.

> Audit ini membaca implementasi source pada snapshot di atas. Temuan bukan klaim runtime test. Nomor baris merujuk snapshot tersebut dan dapat bergeser pada commit berikutnya.

## 1. Kesimpulan eksekutif

**Source saat ini belum menerapkan Moving Average per SKU sebagai satu-satunya sumber nilai persediaan dan COGS.**

Fungsi `calculateMovingAverageHppPerKg` memang ada, tetapi:
- Penjualan tetap menghitung COGS dari `BatchLotEntity.hppKgRupiah` melalui FEFO allocation.
- Penerimaan pembelian memperbarui MA produk, tetapi nilai existing dihitung ulang dari `stockGram × movingAvgHppPerKg`; belum ada saldo nilai SKU kanonis.
- Conversion memakai HPP lot sumber dan nilai tetelan tetap Rp65.000/kg, bukan Relative NRV.
- Opname memakai HPP lot.
- Retur lokal mencatat nilai persediaan nol; reducer remote justru memakai MA snapshot dari item penjualan. Keduanya tidak konsisten.
- Proyeksi `ProductEntity.stockGram` menghitung stok lot yang eligible dijual, bukan total barang OWN yang masih dimiliki; ini mencampur stok jual dan basis valuasi.
- Idempotency key dipangkas ke 2.000 item di sejumlah jalur lokal dan reducer remote.

Dengan kondisi ini, perubahan costing tidak aman dilakukan hanya dengan mengganti satu helper. Perlu satu model saldo nilai SKU, satu aturan posting, dan parity local/remote.

## 2. Temuan per jalur

### 2.1 Penerimaan pembelian

**Lokasi:** `businessEngine.ts` sekitar baris 2471–2637.

**Yang dilakukan sekarang**
- Total biaya penerimaan = nilai PO + biaya tambahan bongkar.
- HPP lot baru dihitung dari total landed cost dibagi berat aktual.
- MA produk diperbarui dengan helper `calculateMovingAverageHppPerKg`.
- Ledger mencatat nilai penerimaan dan snapshot MA.

**Temuan**
1. Belum ada `inventoryValueRupiah` kanonis per SKU. Helper membangun nilai existing dari `existingWeightGram × existingHppPerKg`; ini tetap nilai turunan dan dapat melenceng akibat pembulatan atau stok karantina yang dikecualikan dari stockGram.
2. `syncProductsStockFromLots` sekitar baris 638–653 menggunakan `getProductAvailableStockGram`, yang hanya menghitung lot eligible dijual. Akibatnya denominator MA tidak mencakup seluruh barang OWN yang masih dimiliki, jika karantina masih bernilai.
3. `receiveInboundPurchase` memeriksa duplicate lewat status PO dan cache key, tetapi belum menjamin durable idempotency.
4. Jalur remote PURCHASE tidak menghitung ulang MA dari saldo nilai SKU; reducer mengambil `newMovingAvgHppPerKg` dari payload dengan fallback ke MA produk saat ini.

**Severity:** BLOCKER untuk cutover MA kanonis; HIGH untuk durability idempotency.

**Target perbaikan**
- Posting receipt mengubah `ownedOnHandGram` dan `inventoryValueRupiah` dalam satu event atomik.
- HPP lot hanya metadata legacy/trace; nilai receipt masuk ke SKU balance.
- Local dan remote memanggil aturan posting yang sama atau reducer event yang setara secara deterministik.
- Karantina tetap masuk owned balance selama masih dimiliki.

### 2.2 Penjualan / COGS

**Lokasi:** `businessEngine.ts` sekitar baris 1655–2210; FEFO allocator sekitar baris 429–510.

**Yang dilakukan sekarang**
- `commitSaleTransaction` menghitung baris transaksi.
- Untuk setiap baris, `allocateLotsFEFO` mengurangi lot dan menghitung `cogsRupiah = round(takeGram × lot.hppKgRupiah / 1000)`.
- Total COGS transaksi dijumlahkan dari alokasi lot.
- Ledger penjualan memakai `alloc.hppPerKg` dan `alloc.cogsRupiah`.

**Temuan**
1. COGS aktual masih lot-cost, bukan MA SKU.
2. Bila satu SKU muncul pada beberapa baris cart, loop menjalankan alokasi per baris; belum mengagregasi semua Gram SKU sebelum menghitung satu total COGS.
3. `movingAvgHppPerKg` yang disimpan pada item transaksi hanya snapshot untuk display/audit; tidak menjadi dasar COGS.
4. Jika stok lot FEFO memiliki HPP berbeda, penjualan menghasilkan COGS berbeda tergantung lot yang terambil, padahal keputusan target menyatakan MA per SKU.
5. Reducer remote SALE memakai alokasi lot dan COGS yang dikirim perangkat asal; ledger remote memakai `allocation.hppPerKg` dan `allocation.cogsRupiah`. Ini mereplikasi basis lot-cost, bukan MA.
6. Reducer remote dapat mengurangi stok lot sampai nol lalu tetap menerapkan transaksi sambil mencatat konflik kekurangan. Ini membuat transaksi dan stok lokal berpotensi tidak seimbang sampai rekonsiliasi.

**Severity:** BLOCKER.

**Target perbaikan**
- Agregasi berat per SKU terlebih dahulu.
- Hitung total COGS SKU dari nilai MA SKU pada saat posting.
- Alokasikan COGS ke baris dengan largest remainder dan tie-break deterministik.
- FEFO tetap memilih lot fisik saja.
- Simpan lot allocation sebagai jejak fisik; jangan gunakan HPP lot untuk menentukan COGS.
- Remote reducer harus memvalidasi stok/event secara atomik; jika tidak cukup, simpan conflict tanpa membuat saldo setengah diterapkan.

### 2.3 Conversion / trimming

**Lokasi:** `businessEngine.ts` sekitar baris 2638–2958.

**Yang dilakukan sekarang**
- Biaya input dihitung dari `inputGram × sourceLot.hppKgRupiah`.
- Nilai tetelan dihitung dengan konstanta Rp65.000/kg.
- Sisa biaya diberikan ke output utama.
- HPP output utama dihitung dari nilai residual / berat output utama.
- MA produk tetelan diperbarui dengan helper, tetapi nilai input tetap memakai nilai lot.

**Temuan**
1. Sumber nilai conversion masih HPP lot, bukan nilai MA SKU.
2. Tetelan menggunakan nilai tetap Rp65.000/kg; tidak mengikuti Relative NRV.
3. Untuk SKU output utama yang sama dengan SKU sumber, MA produk tidak direkonsiliasi terhadap perubahan nilai dan kuantitas hasil conversion.
4. Nilai susut saat output masih ada diserap ke nilai output utama/tetelan secara implisit; kebijakan target harus memisahkan alokasi nilai output dan beban susut sesuai aturan costing yang disepakati. Jangan membuat susut bernilai nol tanpa memastikan nilainya sudah dialokasikan secara eksplisit.
5. Reducer remote CONVERSION mengulang formula lot-cost dan fallback Rp65.000/kg, sehingga local/remote memiliki ketergantungan yang sama pada konstanta.
6. Reducer remote memakai `||` fallback untuk beberapa nilai payload. Nilai valid nol dapat dianggap tidak ada lalu dihitung ulang dari fallback; ini berisiko mengubah event yang sah.

**Severity:** BLOCKER.

**Target perbaikan**
- Ambil nilai biaya input dari MA SKU sumber pada saat event.
- Distribusikan nilai ke seluruh output berdasarkan Relative NRV, dengan aturan nilai susut yang eksplisit.
- Perbarui saldo nilai dan Gram untuk SKU sumber/output secara atomik.
- Hasil alokasi Rupiah harus menjaga total nilai; gunakan largest remainder.
- Remote harus mengaplikasikan nilai final event yang tervalidasi, bukan memakai fallback angka bisnis tetap.

### 2.4 Stock opname

**Lokasi:** `businessEngine.ts` sekitar baris 2959–3101; reducer remote sekitar baris 4081–4110.

**Yang dilakukan sekarang**
- Selisih Gram dihitung terhadap lot.
- Selisih nilai dihitung dari `diffGram × lot.hppKgRupiah / 1000`.
- Ledger dan jurnal memakai nilai selisih tersebut.
- Reducer remote mengulang formula yang sama.

**Temuan**
1. Penyesuaian nilai menggunakan HPP lot, bukan MA SKU.
2. Opname lot tunggal tidak memperbarui nilai kanonis SKU karena field tersebut belum ada.
3. Penambahan/pengurangan kuantitas lot harus memperbarui owned balance dan nilai SKU dalam satu event; jika lot karantina, aturan saleable balance berbeda.
4. Local dan remote sama-sama menggunakan HPP lot, jadi tidak ada jalur MA kanonis.

**Severity:** BLOCKER.

**Target perbaikan**
- Selisih nilai opname dihitung dengan MA SKU pada saat posting.
- Lot tetap menjadi target koreksi kuantitas fisik.
- Update lot quantity, SKU Gram, SKU value, ledger, dan jurnal harus satu transaksi atomik.

### 2.5 Retur pelanggan

**Lokasi:** `businessEngine.ts` sekitar baris 3102–3423; reducer remote sekitar baris 4199–4265.

**Yang dilakukan sekarang — lokal**
- Membuat lot karantina dengan `hppKgRupiah: 0`.
- Ledger retur menambah Gram tetapi `valueRupiahDelta: 0`.
- Produk disinkronkan dari lot yang eligible dijual; lot karantina tidak masuk `stockGram`.

**Yang dilakukan sekarang — remote**
- Mengambil `soldLine.movingAvgHppPerKg`.
- Membuat lot karantina dengan HPP snapshot tersebut.
- Ledger remote menambah nilai dari `weightGram × returnHpp / 1000`.
- Produk disinkronkan dari lot; karantina tetap tidak masuk stok saleable.

**Temuan**
1. Retur lokal mengembalikan kuantitas tanpa nilai persediaan; ini menghilangkan carrying value.
2. Retur remote memakai MA snapshot item, bukan COGS historis aktual yang benar-benar dibebankan pada penjualan.
3. Local dan remote menghasilkan nilai persediaan berbeda untuk retur yang sama.
4. Retur perlu memulihkan provenance berdasarkan porsi COGS historis yang benar-benar dikonsumsi, dengan batas kumulatif agar tidak over-restore.
5. Untuk barang karantina, owned quantity/value harus tercatat, sementara saleable quantity tetap tidak bertambah sampai hasil inspeksi/keputusan kualitas.

**Severity:** BLOCKER.

**Target perbaikan**
- Ambil histori COGS per SKU/line dan alokasi COGS per gram dari sale event.
- Hitung nilai retur dari historical COGS, bukan MA saat ini dan bukan nol.
- Masukkan kuantitas dan nilai ke owned balance karantina.
- Jangan masukkan ke saleable balance sampai dilepas.
- Local/remote memakai event return yang sama dan menghasilkan angka identik.

### 2.6 Void / reversal

**Lokasi:** `businessEngine.ts` sekitar baris 2211–2431; remote VOID sekitar bagian reducer setelah event RETURN.

**Yang dilakukan sekarang**
- Void lokal mengembalikan kuantitas per lot allocation.
- Nilai reversal ledger memakai COGS yang tersimpan pada lot allocation.
- Jurnal reversal memakai total COGS transaksi.
- Reducer remote membuat ledger reversal dari alokasi lot dan COGS yang dikirim.

**Temuan**
1. Karena COGS sale masih lot-cost, reversal mengembalikan nilai lot-cost lama, bukan perubahan saldo MA SKU yang benar.
2. Reversal harus membalik nilai historis transaksi persis, tetapi dampaknya pada saldo MA setelah reversal harus dihitung ulang berdasarkan saldo SKU saat reversal terjadi; jangan menimpa MA dengan snapshot historis.
3. Jalur remote perlu validasi terhadap status transaksi dan reversal sebelumnya, serta memastikan dampak stok, kas/bank/piutang, jurnal, dan idempotency diterapkan atomik.

**Severity:** BLOCKER untuk transisi ke MA.

**Target perbaikan**
- Reversal mengembalikan kuantitas dan nilai COGS historis ke SKU balance melalui event pembalik.
- MA baru dihitung dari saldo nilai/Gram setelah reversal.
- Simpan referensi ke sale event asal dan void event.

## 3. Temuan lintas jalur

| ID | Temuan | Lokasi | Severity |
|---|---|---|---|
| SC-01 | Tidak ada nilai persediaan kanonis per SKU dalam model source saat ini | `types.ts`, `businessEngine.ts` | BLOCKER |
| SC-02 | `stockGram` adalah stok eligible jual dari lot, bukan total owned quantity | `businessEngine.ts:638–653` | BLOCKER |
| SC-03 | COGS penjualan berasal dari HPP lot | `businessEngine.ts:429–510, 1655–2210` | BLOCKER |
| SC-04 | Penerimaan memakai MA turunan dari Gram × HPP existing, bukan saldo nilai kanonis | `businessEngine.ts:67–84, 2471–2637` | BLOCKER |
| SC-05 | Conversion memakai HPP lot dan konstanta Rp65.000/kg, bukan Relative NRV | `businessEngine.ts:2638–2958` | BLOCKER |
| SC-06 | Opname memakai HPP lot | `businessEngine.ts:2959–3101` | BLOCKER |
| SC-07 | Return lokal bernilai nol; return remote memakai snapshot MA | `businessEngine.ts:3261–3423, reducer RETURN` | BLOCKER |
| SC-08 | Remote reducer memiliki jalur hitung sendiri yang belum setara dengan jalur lokal | `businessEngine.ts:3949–4198+` | BLOCKER |
| SC-09 | Idempotency cache dipangkas menjadi 2.000 key | Berbagai mutation dan akhir reducer | HIGH |
| SC-10 | Seed/opening stock dapat menggunakan estimasi HPP 72% dari harga jual jika input HPP kosong | `businessEngine.ts:1149–1347` | HIGH |
| SC-11 | Seed ledger menghitung nilai per lot dari HPP lot; opening inventory belum berasal dari saldo nilai SKU | `businessEngine.ts:525–637` | HIGH |
| SC-12 | Penjualan belum mengagregasi baris SKU sama sebelum COGS | `businessEngine.ts:1655–2010` | BLOCKER |
| SC-13 | Remote SALE dapat menerapkan transaksi walau lot lokal kurang, lalu hanya menambahkan conflict | `businessEngine.ts:3949–4080` | BLOCKER |

## 4. Prioritas perbaikan yang direkomendasikan

Jangan memperbaiki per modul secara terpisah sebelum model saldo nilai tersedia. Urutan yang aman:

1. **Foundation:** tambah model `sku_inventory_balance` (owned Gram, saleable Gram, inventory value Rupiah, MA snapshot) dan validator invariant.
2. **Posting core:** buat satu fungsi domain untuk mutasi SKU quantity/value dengan event idempotent; jangan biarkan setiap jalur menghitung nilai sendiri.
3. **Receipt/opening balance:** migrasikan pembelian dan saldo awal ke SKU value canonical.
4. **Outbound:** pindahkan penjualan, void, write-off, dan adjustment ke MA SKU; FEFO hanya memilih lot.
5. **Conversion:** implementasikan Relative NRV dan pembagian nilai susut eksplisit.
6. **Return:** pulihkan historical COGS/provenance ke owned quarantine balance; release quarantine menjadi saleable tanpa menggandakan nilai.
7. **Remote parity:** reducer harus menggunakan event hasil posting final atau fungsi domain identik; conflict tidak boleh menghasilkan partial business mutation.
8. **Durable idempotency:** unique registry backend dan durable local key/tombstone sebelum multi-device rollout.
9. **Regression:** update test lama yang mengharapkan lot-based COGS, lalu jalankan seluruh matrix MV-001..MV-055.

## 5. Hal yang jangan dilakukan

- Jangan sekadar mengganti `allocateLotsFEFO` agar memakai MA lalu membiarkan receipt, conversion, opname, return, dan remote reducer menghitung dengan rumus berbeda.
- Jangan menghapus `hppKgRupiah` dari lot sebelum seluruh UI, QR, laporan, backup, dan adapter tidak lagi membacanya. Untuk sementara jadikan legacy snapshot.
- Jangan menghitung ulang COGS historis.
- Jangan mengisi nilai retur dengan MA hari ini jika COGS historis tersedia.
- Jangan menganggap karantina sebagai barang hilang; karantina adalah status kualitas/penjualan, bukan otomatis penghapusan kepemilikan.
- Jangan mengaktifkan multi-device cutover sebelum local/remote parity dan durable idempotency lulus.

## 6. Batas audit

Audit ini memeriksa jalur domain utama di `businessEngine.ts` dan tipe yang digunakan. Belum termasuk audit menyeluruh seluruh komponen UI, laporan, SQL schema, Apps Script gateway, atau pengujian runtime. Nilai akuntansi landed cost/GRNI dan perlakuan susut perlu validasi terhadap kebijakan pembukuan bisnis sebelum implementasi final.

**Status:** temuan source terdokumentasi; source code tidak diubah; test/build tidak dijalankan.
