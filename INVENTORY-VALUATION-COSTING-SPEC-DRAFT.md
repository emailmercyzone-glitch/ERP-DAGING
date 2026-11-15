# ERP DAGING — Spesifikasi Teknis Inventory Valuation & Costing

**Status:** Draft spesifikasi teknis untuk review  
**Target branch:** `plan-consolidation-draft`  
**Ruang lingkup:** Persediaan OWN, Moving Average, COGS, FEFO, Relative NRV, retur, adjustment, landed cost, event ledger, dan sinkronisasi  
**Bukan bagian dari pekerjaan ini:** perubahan source code, migrasi database, perubahan UI, deployment, atau merge ke `main`.

Dokumen ini menjabarkan bagaimana keputusan valuasi ERP DAGING harus diterapkan secara teknis. Dokumen ini tidak menyatakan bahwa implementasi saat ini sudah memenuhi spesifikasi.

---

## 1. Tujuan dan prinsip yang tidak boleh dilanggar

ERP DAGING harus menghasilkan kuantitas, nilai persediaan, HPP, dan COGS yang konsisten di seluruh transaksi dan perangkat.

Prinsip wajib:

1. **Moving Average per SKU** adalah satu-satunya metode HPP keuangan untuk persediaan OWN.
2. **FEFO** menentukan lot fisik yang dikeluarkan; FEFO tidak menentukan COGS.
3. **Relative NRV** mengalokasikan nilai bahan OWN ke semua output konversi yang layak dijual.
4. **Nilai persediaan Rupiah dan kuantitas Gram** adalah sumber data kanonis. HPP rata-rata hanya nilai turunan/tampilan.
5. Semua nilai uang disimpan sebagai integer Rupiah; semua berat disimpan sebagai integer Gram.
6. Histori transaksi yang sudah diposting tidak ditulis ulang. Koreksi menggunakan event baru yang merujuk event asal.
7. Event yang sama hanya boleh berdampak satu kali, termasuk saat retry dan sinkronisasi lintas perangkat.
8. Karantina memisahkan kelayakan jual, bukan otomatis menghapus kepemilikan atau nilai persediaan.
9. Tidak boleh ada fallback HPP/COGS buatan seperti persentase harga jual atau biaya tetap per kg.
10. OWN, CONSIGNMENT, dan AFFILIATE tetap dipisahkan. Aturan valuasi dokumen ini hanya untuk OWN.

## 2. Model data kanonis

### 2.1 Saldo valuasi per SKU

Setiap SKU OWN memerlukan saldo valuasi kanonis, minimal:

| Field konseptual | Tipe | Makna |
|---|---|---|
| `productId` | UUID/string stabil | Identitas SKU |
| `ownedQtyGram` | integer | Total kuantitas OWN yang masih dimiliki dan diakui sebagai persediaan |
| `inventoryValueRupiah` | integer | Total nilai tercatat persediaan SKU |
| `valuationVersion` | integer/string | Versi aturan/perubahan valuasi |
| `lastAppliedEventSeq` | integer/string | Posisi event terakhir yang sudah diterapkan secara berurutan |

Nama field implementasi boleh disesuaikan, tetapi makna dan sifat kanonisnya wajib dipertahankan.

**Dilarang** menjadikan `stockGram × movingAvgHppPerKg` sebagai sumber nilai persediaan. Perkalian itu memakai HPP yang telah dibulatkan dan dapat menciptakan drift kumulatif.

### 2.2 Saldo fisik dan status kelayakan

Saldo valuasi tidak boleh disamakan dengan stok yang tersedia dijual. Sistem perlu dapat membedakan setidaknya:

- Kuantitas fisik OWN yang saleable.
- Kuantitas OWN yang berada di karantina.
- Kuantitas OWN yang sudah direservasi untuk proses operasional, jika fitur reservasi digunakan.
- Kuantitas OWN yang sedang berada dalam posisi negatif/provisional, jika pengecualian stok minus diaktifkan.

Perpindahan status saleable ↔ quarantine tidak otomatis mengubah total nilai persediaan. Write-off yang sah mengurangi kuantitas dan nilai persediaan. Reservasi tidak mengurangi nilai atau kuantitas milik bisnis.

Saldo per lot tetap diperlukan untuk FEFO dan traceability. Saldo SKU adalah basis valuasi; saldo lot adalah basis identitas fisik dan pelacakan batch. Keduanya harus direkonsiliasi, bukan dijumlahkan dua kali.

### 2.3 HPP turunan

Moving Average diturunkan dari saldo kanonis:

`MA (Rp/kg) = inventoryValueRupiah × 1.000 ÷ ownedQtyGram`

HPP per kg yang ditampilkan atau disimpan sebagai snapshot harus mengikuti satu aturan pembulatan yang ditetapkan bersama. Perhitungan COGS sebaiknya menggunakan rasio nilai/kuantitas berpresisi penuh dari saldo kanonis, bukan mengalikan berat dengan angka MA tampilan yang sudah dibulatkan.

Jika kuantitas dan nilai sama-sama nol, SKU berada pada keadaan stok nol. Jika kuantitas nol tetapi nilai tidak nol, atau kuantitas positif tetapi nilai tidak masuk akal/negatif tanpa kebijakan khusus, transaksi harus ditahan sebagai pelanggaran invariant dan direkonsiliasi; sistem tidak boleh memperbaikinya diam-diam.

## 3. Invariant wajib

Setiap command/event yang mengubah stok harus menjaga invariant berikut:

1. `ownedQtyGram` dan `inventoryValueRupiah` adalah integer.
2. Dalam keadaan stok normal, kuantitas dan nilai persediaan tidak boleh negatif.
3. Total nilai persediaan SKU setelah event = total nilai sebelum event + delta nilai event.
4. Total kuantitas persediaan SKU setelah event = total kuantitas sebelum event + delta kuantitas event.
5. Jumlah alokasi lot fisik pada penjualan = berat yang benar-benar dikeluarkan.
6. Jumlah COGS alokasi item = COGS item persis, setelah pembagian Rupiah deterministik.
7. Total biaya output konversi = nilai tercatat input yang diproses persis.
8. Event idempoten tidak boleh menghasilkan delta kedua kali.
9. Event koreksi tidak mengubah payload/snapshot event asal.
10. Status karantina tidak boleh ikut ke FEFO penjualan.
11. Perubahan master harga jual tidak mengubah valuasi atau konversi historis.
12. Setiap perubahan nilai harus memiliki referensi, alasan/kategori, aktor, waktu, dan idempotency key.

Jika invariant gagal, command ditolak atau masuk conflict/reconciliation case. Jangan menyimpan state parsial yang membuat ledger, lot, dan saldo SKU berbeda.

## 4. Aturan transaksi valuasi

### 4.1 Penerimaan pembelian OWN

Saat penerimaan barang yang memiliki dasar biaya sah diposting:

- Tambahkan berat aktual yang diterima ke kuantitas SKU.
- Tambahkan biaya perolehan yang dikapitalisasi ke nilai persediaan SKU.
- Buat lot penerimaan dengan kuantitas fisik dan biaya asal untuk traceability.
- Catat event ledger yang memuat delta berat dan delta nilai.
- Hitung ulang MA dari saldo kanonis setelah event.

Formula konseptual:

`Q_after = Q_before + receivedGram`

`V_after = V_before + capitalizedCostRupiah`

`MA_after = V_after × 1.000 ÷ Q_after`

Barang `PENDING_COST` tidak boleh menambah stok OWN saleable atau saldo nilai final sebelum dasar biaya ditetapkan dan diaudit. GRNI dengan harga PO yang telah disetujui dapat menggunakan nilai sementara sesuai kebijakan pembelian di PLAN; rekonsiliasi invoice kemudian menjadi event koreksi nilai.

### 4.2 Landed cost yang diketahui tepat waktu

Biaya yang memenuhi definisi biaya perolehan menambah nilai persediaan dan memengaruhi MA. Setiap alokasi landed cost harus merujuk penerimaan/lot sumber dan menyimpan:

- Dokumen biaya sumber.
- Nilai biaya Rupiah dan mata uang asal jika relevan.
- Kurs snapshot jika ada konversi.
- Dasar dan versi alokasi.
- Nilai yang dialokasikan ke masing-masing penerimaan/SKU.
- Aturan pembulatan dan selisih pembulatan.

Formula pembagian landed cost antarproduk/lot masih merupakan keputusan bisnis/akuntansi terbuka di PLAN. Jangan memilih basis berat/nilai/volume secara sepihak.

### 4.3 Penjualan OWN

Pada saat penjualan diposting:

1. Tentukan urutan lot fisik eligible menggunakan FEFO.
2. Pastikan jumlah lot yang dialokasikan sama dengan berat final yang dijual.
3. Ambil snapshot saldo valuasi SKU tepat sebelum event penjualan diposting.
4. Hitung COGS dari nilai/kuantitas Moving Average SKU tersebut.
5. Kurangi kuantitas dan nilai persediaan SKU sebesar berat terjual dan COGS yang diposting.
6. Kurangi kuantitas lot sesuai alokasi FEFO.
7. Simpan snapshot MA, COGS, lot fisik, dan versi valuasi pada item/transaksi.
8. Catat ledger dan jurnal yang seimbang dalam satu operasi atomik.

Rumus konseptual:

`COGS_Rp = round(soldGram × inventoryValueBefore ÷ ownedQtyBefore)`

Perhitungan harus menggunakan integer/rational arithmetic yang aman. Implementasi tidak boleh memakai floating-point untuk nilai uang. Kebijakan pembulatan final perlu disepakati dan dipakai konsisten.

Jika satu item keluar dari beberapa lot, alokasi COGS per lot hanya untuk rekonsiliasi. COGS total item tetap berasal dari Moving Average SKU; pembagian antarbaris lot harus deterministik dan jumlahnya persis sama dengan COGS item. HPP lot tidak boleh menggantikan COGS Moving Average.

### 4.4 Retur pelanggan

Alur retur:

1. Validasi invoice asal, SKU, dan sisa kuantitas yang masih boleh diretur.
2. Catat retur sebagai event baru yang merujuk item penjualan asal.
3. Barang yang kembali masuk karantina secara fisik.
4. Nilai pemulihan persediaan menggunakan COGS historis yang melekat pada kuantitas yang diretur dari penjualan asal, bukan MA saat retur.
5. Tambahkan nilai dan kuantitas ke saldo persediaan OWN sesuai kebijakan pengakuan barang retur; kuantitasnya tetap berstatus quarantine sampai dilepas.
6. Koreksi revenue/piutang/customer credit/refund mengikuti resolusi retur yang dipilih dan kondisi pembayaran.
7. Jika barang dinyatakan layak jual, perpindahan quarantine → saleable tidak mengubah total nilai persediaan. Jika tidak layak, write-off memakai event terpisah dengan nilai yang dapat ditelusuri.

Untuk retur parsial dari satu item, sistem harus dapat membagi COGS historis secara deterministik sehingga seluruh retur tidak melebihi berat dan nilai COGS asal. Jangan menghitung ulang biaya retur memakai MA terbaru.

### 4.5 Void/reversal setelah posting

Transaksi POSTED tidak dihapus dan tidak dikembalikan menjadi draft. Reversal membuat event kompensasi yang merujuk event asal.

Untuk dampak stok:
- Pulihkan kuantitas lot sesuai kuantitas yang benar-benar dapat dipulihkan secara fisik.
- Pulihkan nilai persediaan berdasarkan COGS historis yang dibalik, bukan MA terbaru.
- Barang yang tidak kembali secara fisik tidak boleh otomatis menambah stok.
- Dampak pembayaran, piutang, kas/bank, revenue, dan COGS harus dibalik melalui event yang relevan.

Reversal yang tidak dapat dipenuhi karena kondisi fisik atau saldo kas/bank tidak cukup harus masuk proses penyelesaian; jangan membuat stok atau uang fiktif.

### 4.6 Stock adjustment, susut, dan write-off

- Penambahan stok memerlukan dasar biaya yang dapat diaudit. Hasil hitung fisik saja tidak menciptakan nilai persediaan.
- Pengurangan stok saleable normal menggunakan MA SKU tepat sebelum adjustment.
- Write-off barang karantina menggunakan nilai tercatat barang yang dihapus dan harus merujuk lot/retur/insiden terkait.
- Transfer saleable ↔ quarantine tidak mengubah total nilai persediaan.
- Susut proses yang benar-benar mengurangi kuantitas harus mencatat berat, alasan, dan nilai yang dilepas dari persediaan.
- Ambang otorisasi mengikuti PLAN; otorisasi tidak boleh mengubah formula valuasi.

### 4.7 Konversi daging — Relative NRV

Konversi memindahkan nilai tercatat dari SKU input ke semua SKU output yang dapat dijual.

Untuk setiap output (i):

`NRV_i = outputGram_i × normalSellingValuePerGram_i − relevantCompletionCost_i − relevantSellingCost_i`

`AllocatedCost_i = inputCarryingValue × NRV_i ÷ totalPositiveNRV`

Ketentuan:

- Masukkan produk utama dan produk samping yang memang dijual sebagai SKU, misalnya tetelan, tulang, atau lemak.
- Limbah tanpa NRV positif tidak menjadi persediaan; biaya input diserap oleh output yang dapat dijual.
- Jika total NRV tidak positif, tahan proses untuk pemeriksaan Owner. Jangan posting HPP nol atau fallback.
- Snapshot kuantitas output, estimasi harga normal, biaya penyelesaian/penjualan, NRV, formula/versi, dan hasil alokasi.
- Nilai alokasi semua output harus sama persis dengan nilai input.
- Selisih Rupiah akibat pembulatan dibagikan secara deterministik, misalnya metode largest remainder dengan tie-breaker ID SKU/output yang stabil.
- Rekonsiliasi berat: input = output saleable + limbah/cutting loss + process variance yang terdokumentasi.
- Setelah output masuk, tambahkan kuantitas dan nilai ke saldo SKU output, lalu hitung MA masing-masing SKU.
- HPP lot asal tetap untuk traceability, bukan sumber COGS output.
- Biaya tenaga kerja/biaya proses tambahan tidak dikapitalisasi sampai kebijakan terpisah disetujui.

### 4.8 Stok minus dan transaksi offline

**Status: belum boleh dianggap production-ready sebelum keputusan final dan pengujian lintas perangkat selesai.**

Rekomendasi desain untuk dibahas/ditetapkan:

- Penjualan offline yang menyebabkan stok minus harus ditandai sebagai provisional dan menyimpan MA terakhir yang diketahui beserta versi saldo/event terakhir.
- Posisi minus tidak boleh membuat kuantitas atau nilai persediaan normal menjadi negatif tanpa model khusus.
- Saat koneksi pulih, server harus memeriksa urutan event dan stok authoritative. Event yang tidak dapat dipenuhi masuk conflict case.
- Jika transaksi disahkan setelah rekonsiliasi, sistem membuat event koreksi/revaluasi yang menghubungkan COGS provisional dengan biaya final.
- Jangan mengubah COGS historis tanpa event koreksi dan audit trail.

Detail algoritma pengakuan sementara, urutan prioritas transaksi offline, dan pembagian biaya saat stok masuk masih perlu ditetapkan sebelum implementasi. Jangan menganggap rekomendasi di atas sebagai keputusan bisnis final tanpa menutup bagian keputusan terbuka di PLAN.

## 5. Ledger dan atomisitas

### 5.1 Event ledger

Setiap event stok/valuasi minimal menyimpan:

- UUID event dan idempotency key unik.
- Jenis event dan schema/event version.
- Product/SKU ID.
- Lot ID atau daftar lot allocation jika relevan.
- Delta berat (gram).
- Delta nilai (Rupiah).
- Saldo kuantitas dan nilai sebelum/sesudah, atau referensi snapshot/sequence yang dapat merekonstruksinya.
- MA sebelum/sesudah sebagai data snapshot turunan, bukan sumber kanonis.
- Reference type dan reference ID (purchase, sale, return, conversion, opname, landed cost, reversal).
- Actor, device ID, createdAt, effectiveAt/server sequence, dan alasan.
- Correlation ID untuk menghubungkan event multi-langkah.

Ledger bersifat append-only. Koreksi menggunakan event baru yang merujuk event lama.

### 5.2 Atomicity

Perubahan berikut harus atomik pada satu transaksi penyimpanan lokal:

- Saldo valuasi SKU.
- Saldo kuantitas/status lot.
- Stock ledger.
- Snapshot transaksi/event sumber.
- Jurnal keuangan terkait.
- Outbox sync dan idempotency record.

Jika salah satu bagian gagal, seluruh perubahan lokal harus rollback. Jangan menyimpan saldo SKU baru tanpa ledger atau ledger tanpa saldo yang sesuai.

### 5.3 Idempotency

- Idempotency key unik untuk setiap command bisnis.
- Retry command yang sama mengembalikan hasil event pertama, bukan menerapkan delta lagi.
- Server menyimpan unique constraint untuk event/idempotency key.
- Pull event yang telah diterapkan tidak boleh diterapkan ulang.
- Konflik key dengan payload berbeda harus ditolak dan dicatat sebagai integrity/security conflict.

## 6. Sinkronisasi multi-device

### 6.1 Prinsip

Perangkat boleh membuat draft dan event lokal saat offline. Namun, dua perangkat tidak boleh secara independen menetapkan saldo akhir Moving Average untuk SKU yang sama tanpa mekanisme konsistensi.

**Rekomendasi arsitektur:** server/backend menjadi sequencer otoritatif untuk event yang memengaruhi saldo valuasi SKU. Server menetapkan urutan event per SKU atau melalui sequence global yang konsisten, menerapkan event secara idempoten, dan mengirim hasil canonical balance/sequence ke perangkat.

### 6.2 Proses event

1. Perangkat membuat command/event lokal dengan UUID, idempotency key, device ID, base valuation version/sequence, dan snapshot yang diperlukan.
2. Event masuk Outbox dengan status PENDING.
3. Backend memvalidasi hak akses, schema, referensi, saldo/urutan, dan idempotency.
4. Backend menerima event dan menetapkan server sequence, atau menolaknya sebagai conflict/reconciliation.
5. Event yang diterima diproses dalam urutan otoritatif; saldo SKU diperbarui sekali.
6. Backend mengirim ACK beserta server sequence, canonical balance, dan hasil valuasi.
7. Perangkat menandai event SYNCED hanya setelah ACK valid.
8. Perangkat melakukan pull berdasarkan cursor dan menerapkan event remote secara idempoten.

### 6.3 Konflik

Konflik tidak boleh diselesaikan dengan last-write-wins untuk saldo stok/nilai. Konflik harus menyimpan:

- Event lokal dan event server yang bertabrakan.
- SKU/lot terdampak.
- Base sequence/version.
- Kuantitas/nilai yang diperselisihkan.
- Alasan konflik.
- Status penyelesaian dan event koreksi yang dihasilkan.

Backend vendor-neutral tetap dapat digunakan, tetapi kontrak API harus menyediakan operasi atomik/serialisasi per SKU atau mekanisme setara. Jika backend tidak dapat menjamin hal ini, klaim konsistensi Moving Average multi-device belum terpenuhi.

## 7. Migrasi data lama

Migrasi adalah area berisiko tinggi karena data lama mungkin hanya menyimpan `stockGram`, `movingAvgHppPerKg`, HPP lot, ledger parsial, dan journal lama.

Aturan migrasi:

1. Jangan menganggap `stockGram × movingAvgHppPerKg` sebagai nilai historis yang pasti benar.
2. Jangan langsung membangun nilai kanonis dari HPP lot jika lot dan saldo SKU tidak terbukti rekonsiliasi.
3. Inventarisasi semua sumber: saldo produk, lot, stock ledger, transaksi/COGS, konversi, retur, adjustment, dan backup.
4. Buat laporan rekonsiliasi per SKU: jumlah gram, nilai dari tiap sumber, selisih, data hilang, lot karantina, dan transaksi historis terkait.
5. Klasifikasikan SKU: dapat dimigrasikan otomatis dengan bukti cukup; perlu penyesuaian Owner; atau tidak aman dimigrasikan otomatis.
6. Untuk data ambigu, minta saldo awal hasil verifikasi Owner dengan adjustment/opening event yang jelas. Jangan menyembunyikan selisih dengan fallback.
7. Migrasi harus idempoten, berversi, dapat diuji pada salinan backup, dan memiliki rollback/restore plan.
8. Simpan snapshot sebelum migrasi dan laporan hasil sesudah migrasi.
9. Jangan hapus ledger lama atau mengubah transaksi historis.
10. Jangan menjalankan migrasi produksi sebelum proposal skema, pemetaan data, hasil dry-run, dan risiko disetujui.

## 8. Pemetaan temuan audit source code

Pemeriksaan statis sebelumnya pada branch draft menemukan indikasi berikut. Ini adalah temuan pada snapshot source yang diperiksa, bukan klaim bahwa source tidak pernah berubah setelah snapshot tersebut.

| Area | Indikasi pada source yang diperiksa | Target spesifikasi |
|---|---|---|
| Product valuation | `ProductEntity` memiliki `stockGram` dan `movingAvgHppPerKg`, belum terlihat field nilai persediaan SKU kanonis | Tambahkan saldo nilai kanonis melalui proposal schema |
| Purchase | MA dihitung dari stok/HPP yang ada dan biaya penerimaan | Tambah nilai dan gram ke saldo kanonis |
| Sale | COGS alokasi masih menggunakan `BatchLotEntity.hppKgRupiah` | COGS wajib dari MA SKU; FEFO hanya alokasi fisik |
| Conversion | Jalur lokal/remote masih memiliki referensi HPP lot dan konstanta tetelan Rp65.000/kg | Satu kalkulator Relative NRV, tanpa fallback |
| Stock opname | Nilai adjustment mengacu HPP lot | Nilai adjustment memakai MA SKU |
| Return | Retur masuk quarantine dengan indikasi nilai nol pada jalur lokal yang diperiksa; jalur remote memakai snapshot MA | Pulihkan historical COGS secara konsisten dan pisahkan status quarantine |
| Sync | Payload remote menerima lot allocation/MA; perlu parity dengan aturan canonical value | Backend sequencing, ACK canonical balance, idempotency |
| Types/status | Tipe source yang diperiksa masih memuat role ADMIN serta status transaksi COMPLETED/VOIDED | Selaraskan model data dengan role Owner + Sales dan status DRAFT/POSTED/CANCELLED dalam PLAN |

Blob yang diperiksa pada audit tersebut:
- `src/engine/businessEngine.ts`: `e4821a7e6494c332ad78f5f662862ac68dd07659`
- `src/engine/businessEngine.test.ts`: `a7f80b87da2ba57818baa7a4c118dac45f95d359`
- `src/engine/types.ts` pada pemeriksaan lanjutan: `d4e6aa6402bfd894b2ecefd74be3593f8364ce30`

Hash harus diverifikasi ulang sebelum pekerjaan implementasi karena branch dapat berubah.

## 9. Test acceptance wajib

Tidak ada implementasi yang boleh dinyatakan memenuhi spesifikasi hanya karena UI berjalan. Minimal automated tests berikut harus tersedia.

### 9.1 Moving Average dan saldo kanonis

1. Penerimaan pertama membentuk nilai dan MA yang benar.
2. Penerimaan kedua menggabungkan nilai/gram lama dan baru dengan benar.
3. Penjualan mengurangi nilai persediaan sebesar COGS MA.
4. HPP tampilan yang dibulatkan tidak menyebabkan drift pada transaksi berulang.
5. Stok nol dengan nilai nol memulai rata-rata baru pada penerimaan berikutnya.
6. Kuantitas nol dengan nilai nonzero ditolak/ditandai untuk rekonsiliasi.
7. Nilai ledger sama dengan perubahan saldo kanonis.

### 9.2 FEFO dan COGS

8. FEFO memilih lot eligible dengan urutan tanggal yang benar.
9. Lot quarantine/expired tidak dialokasikan untuk penjualan.
10. Penjualan lintas beberapa lot tetap menghasilkan COGS Moving Average SKU.
11. Jumlah COGS detail lot sama persis dengan COGS item setelah rounding.
12. Perubahan HPP lot tidak mengubah COGS transaksi yang sudah diposting.

### 9.3 Relative NRV

13. Output utama dan by-product saleable menerima alokasi proporsional NRV.
14. Limbah tanpa NRV positif tidak membentuk SKU persediaan.
15. Total alokasi sama persis dengan nilai input.
16. Rounding remainder dibagikan deterministik.
17. Total NRV nol/negatif menolak posting.
18. Perubahan harga jual master setelah konversi tidak mengubah snapshot konversi lama.
19. Berat input direkonsiliasi dengan output, waste, dan variance.

### 9.4 Retur, reversal, dan adjustment

20. Retur memakai COGS historis item asal, bukan MA terbaru.
21. Retur parsial berulang tidak melebihi berat/COGS yang dapat diretur.
22. Barang retur masuk quarantine dan tidak tersedia untuk FEFO.
23. Release dari quarantine tidak mengubah total nilai persediaan.
24. Write-off mengurangi kuantitas dan nilai sesuai carrying value.
25. Reversal memulihkan nilai berdasarkan COGS historis dan hanya untuk kuantitas yang benar-benar kembali.
26. Adjustment penambahan tanpa dasar biaya tidak menciptakan nilai persediaan.

### 9.5 Sync dan integritas

27. Event yang sama dikirim berulang hanya berdampak satu kali.
28. Dua perangkat menjual SKU sama dari base sequence yang sama; backend menghasilkan urutan canonical atau conflict yang eksplisit.
29. Event remote yang sudah diterapkan tidak menggandakan saldo.
30. Payload dengan idempotency key sama tetapi isi berbeda ditolak.
31. Crash di tengah commit tidak meninggalkan saldo, lot, ledger, jurnal, dan outbox yang berbeda.
32. Perangkat setelah pull memiliki saldo kuantitas/nilai dan valuation sequence yang sama dengan backend.
33. Konflik stok minus menghasilkan case yang dapat ditelusuri, bukan penghapusan event.

### 9.6 Migrasi

34. Migrasi dari data lama dapat dijalankan berulang tanpa menggandakan saldo.
35. Data dengan ketidaksesuaian lot/ledger/MA masuk laporan exception, bukan diberi nilai fallback.
36. Snapshot sebelum migrasi dapat dipulihkan melalui prosedur yang diuji.

## 10. Urutan implementasi yang direkomendasikan

Implementasi harus bertahap dan setiap tahap lulus test sebelum lanjut:

1. **Audit & proposal schema:** inventarisasi seluruh read/write stok dan valuasi; rancang canonical SKU balance dan migrasi.
2. **Valuation core:** helper integer/rational arithmetic, pembulatan deterministik, invariant, dan unit tests.
3. **Purchase receipt & landed cost:** tambahkan nilai/gram ke saldo kanonis; landed cost hanya setelah kebijakan alokasinya ditutup.
4. **Sales COGS:** FEFO tetap untuk fisik, Moving Average untuk COGS; snapshot immutable.
5. **Return, reversal, adjustment:** historical COGS, quarantine, write-off, dan reconciliation.
6. **Relative NRV conversion:** satu calculator dipakai local command dan remote reducer; hapus konstanta fallback.
7. **Sync protocol:** server sequencing, canonical ACK, conflict case, dan idempotency.
8. **Migration dry-run:** laporan rekonsiliasi, keputusan exception, backup, rollback.
9. **End-to-end regression:** semua test acceptance dan build/test project.

Jangan mengerjakan schema migration dan perubahan source secara serentak tanpa proposal yang direview terlebih dahulu.

## 11. Keputusan terbuka yang wajib ditutup sebelum production

| Keputusan | Rekomendasi awal | Status |
|---|---|---|
| Formula pembulatan COGS per item | Integer/rational arithmetic; rounding half-up atau metode lain harus satu kebijakan global dan diuji | Terbuka |
| Pembagian COGS antar-lot untuk traceability | Largest remainder dengan tie-breaker ID lot stabil | Rekomendasi |
| Alokasi landed cost ke SKU/lot | Pilih basis sesuai sifat biaya dan dokumen; jangan satu basis otomatis untuk semua jenis biaya | Terbuka |
| Late landed cost | Koreksi nilai stok tersisa dan COGS historis lewat adjustment event; formula split perlu ditetapkan | Terbuka |
| Stok minus offline | Provisional COGS + conflict/revaluation setelah urutan event authoritative tersedia | Terbuka |
| Serialisasi event multi-device | Backend sequencing per SKU atau mekanisme atomik setara | Rekomendasi arsitektur |
| Retur karantina | Masuk saldo OWN pada historical COGS tetapi terpisah dari saleable stock; finalisasi sesuai kebijakan pengakuan barang retur | Perlu validasi akuntansi |
| Biaya tenaga kerja konversi | Tidak dikapitalisasi sampai ada kebijakan terpisah | Dikunci untuk tahap ini |
| Migrasi saldo lama | Rekonsiliasi per SKU; exception perlu verifikasi Owner | Wajib sebelum migrasi |

## 12. Batas pekerjaan Hermes

Hermes boleh:
- Audit ulang seluruh jalur pembelian, penjualan, retur, reversal, konversi, opname, ledger, dan sync.
- Menyusun proposal schema dan migration plan.
- Menyusun diagram alur event dan contoh perhitungan.
- Menambah/menjalankan automated tests pada branch draft setelah proposal disetujui.
- Mengimplementasikan per tahap sesuai spesifikasi yang sudah disetujui.

Hermes tidak boleh tanpa persetujuan eksplisit:
- Mengubah `main`, merge, atau membuat PR untuk merge.
- Menjalankan migrasi pada data produksi.
- Menghapus/mengubah histori transaksi atau ledger.
- Mengisi keputusan terbuka dengan asumsi.
- Mengubah role, pricing, UI, atau scope di luar dokumen ini.
- Menambahkan fallback HPP/COGS atau konstanta biaya.
- Mengklaim fitur selesai tanpa hasil test yang dapat diperiksa.

**Gerbang sebelum coding:** Hermes harus mengirim hasil audit ulang, proposal schema, daftar jalur yang akan diubah, strategi migrasi, daftar risiko, dan test plan. Review dan persetujuan dilakukan sebelum perubahan schema atau migrasi destruktif.

---

**Kesimpulan:** Moving Average dan Relative NRV sudah menjadi keputusan produk. Pekerjaan teknis berikutnya adalah membuat keduanya benar-benar menjadi sumber valuasi yang konsisten di purchase, sale, return, conversion, adjustment, ledger, dan sync. Sampai acceptance tests dan migrasi lulus, fitur valuasi tidak boleh disebut production-ready.
