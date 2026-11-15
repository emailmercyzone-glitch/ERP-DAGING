# ERP DAGING — Spesifikasi Teknis Inventory Valuation & Costing

**Status:** Draft spesifikasi teknis — revisi audit 15 November 2026  
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

### 2.3 Cost-origin provenance (jejak asal biaya)

Moving Average tetap satu-satunya metode valuasi/COGS. Untuk mengoreksi landed cost atau invoice GRNI yang datang terlambat setelah barang berpindah SKU melalui konversi, sistem juga wajib menyimpan jejak asal komponen biaya. Jejak ini **bukan cost-layer method dan bukan sumber COGS**; fungsinya hanya melacak ke mana nilai dari suatu komponen biaya bergerak dan bagian mana yang masih berada dalam persediaan versus telah dikonsumsi.

Model konseptual minimal:

| Field | Makna |
|---|---|
| `originCostId` | ID stabil komponen biaya asal (harga penerimaan, freight, asuransi, koreksi biaya) |
| `sourceReferenceId` | Penerimaan/dokumen biaya asal |
| `currentSkuId` | SKU tempat bagian nilai asal saat ini berada |
| `currentLotId` | Lot keturunan saat ini, bila dapat ditelusuri |
| `remainingOriginValueRupiah` | Bagian nilai asal yang masih melekat pada persediaan saat ini |
| `lastAppliedEventSeq` | Sequence event terakhir yang mengubah jejak asal biaya |

Aturan:
1. Penerimaan dan setiap komponen landed cost membentuk origin cost component tersendiri.
2. Saat COGS/outbound diposting, nilai COGS tetap dihitung dari MA SKU. Untuk provenance saja, pada awal valuation pool simpan snapshot nilai setiap origin component. Hitung target alokasi provenance kumulatif berdasarkan total COGS kumulatif pool × proporsi nilai origin component pada awal pool; gunakan largest remainder dan tie-break ID stabil. Provenance yang dikonsumsi pada event berjalan adalah selisih target kumulatif sesudah dan sebelum event. Dengan begitu, pemecahan satu penjualan menjadi beberapa transaksi tidak mengubah total atribusi origin component. Jumlah alokasi provenance setiap event harus sama persis dengan COGS event.
3. Saat konversi, setiap origin component pada nilai input dialokasikan ke output dengan rasio Relative NRV yang sama. Total komponen asal pada seluruh output harus sama persis dengan nilai input.
4. Retur memulihkan provenance origin component dari snapshot provenance COGS item asal dengan cumulative allocation terhadap kuantitas dan nilai retur; retur parsial tidak boleh memulihkan komponen melebihi bagian yang pernah dikonsumsi.
5. Write-off mengurangi origin component sesuai nilai tercatat yang dihapus. Transfer quarantine/saleable tidak mengubah provenance.
6. Late landed cost/GRNI correction ditautkan ke `originCostId`. Koreksi dibagi antara origin value yang masih melekat pada semua SKU/lot keturunan dan origin value yang sudah dikonsumsi/terjual. Bagian yang masih ada mengubah inventory value SKU keturunan; bagian yang telah dikonsumsi menjadi koreksi COGS periode berjalan. Jika lineage tidak lengkap, koreksi ditahan sebagai exception; jangan mengasumsikan seluruh barang asal sudah terjual.
7. Untuk setiap SKU, jumlah seluruh `remainingOriginValueRupiah` harus sama dengan `inventoryValueRupiah`. Seluruh perubahan provenance dicatat append-only dan idempoten.

Jejak provenance tidak boleh digunakan untuk menentukan COGS penjualan; hasil COGS tetap ditentukan oleh Moving Average SKU.

### 2.4 HPP turunan

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

Urutan alokasi dikunci: (1) atribusi langsung ke SKU/lot jika dokumen memungkinkan; (2) jika tidak, gunakan cost driver yang paling relevan — berat untuk freight/handling berbasis berat, volume untuk biaya berbasis volume, nilai barang untuk asuransi/biaya berbasis nilai, dan nilai pabean untuk bea/pajak impor sesuai dokumen; (3) jika biaya logistik bersama tidak memiliki basis khusus, gunakan berat aktual diterima. Simpan dokumen, cost driver, pembagi, versi aturan, dan hasil per SKU/lot. Pembulatan menggunakan largest remainder dengan tie-breaker ID penerimaan/lot stabil; total alokasi harus sama persis dengan biaya sumber.

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

COGS tidak dihitung dari HPP tampilan yang sudah dibulatkan. Gunakan cumulative allocation dalam satu valuation pool:

- Setiap pool valuasi dimulai ulang setelah event yang mengubah basis MA, yaitu penerimaan/retur/konversi output, landed-cost atau GRNI adjustment, adjustment nilai/kuantitas, dan koreksi lain yang mengubah numerator atau denominator. Simpan `poolStartQtyGram = Q0`, `poolStartValueRupiah = V0`, dan `poolOutboundQtyGram = 0`. Outbound biasa yang hanya mengurangi kuantitas/nilai tetap memakai cumulative allocation pada pool berjalan.
- Untuk event outbound, hitung `A_after = roundHalfUp((poolOutboundQtyGram + soldGram) × V0 ÷ Q0)` dan `A_before = roundHalfUp(poolOutboundQtyGram × V0 ÷ Q0)`.
- `COGS_Rp = A_after − A_before`; setelah posting, tambahkan soldGram ke `poolOutboundQtyGram`.
- `roundHalfUp(n/d) = floor((2n + d) ÷ (2d))` untuk integer n ≥ 0 dan d > 0. Semua operasi memakai integer/rational arithmetic, bukan floating-point.
- Jika seluruh Q0 gram telah keluar, akumulasi COGS harus sama persis dengan V0. Dengan demikian sisa Rupiah tidak hilang dan COGS tidak melebihi nilai pool.
- Setiap event yang mengubah basis MA menutup pool sebelumnya dan memulai pool baru dari saldo canonical setelah event. Outbound mencakup penjualan, susut, write-off, dan adjustment pengurangan yang memakai nilai MA. Dalam satu command/transaksi, seluruh baris SKU yang sama diagregasi untuk menghitung satu total COGS SKU; hasil total baru dibagi ke item/lot dengan largest remainder.

Contoh uji: saldo pool Rp2 untuk 3 gram, dijual 1 gram sebanyak tiga event. Alokasi COGS berturut-turut Rp1, Rp0, Rp1; total tepat Rp2. Jika dijual sekaligus 2 gram lalu 1 gram, total hasilnya tetap Rp2.

Jika satu item keluar dari beberapa lot, alokasi COGS per lot hanya untuk rekonsiliasi. COGS total item tetap berasal dari Moving Average SKU; pembagian antarbaris lot menggunakan largest remainder dan tie-breaker ID lot stabil, sehingga jumlahnya persis sama dengan COGS item. HPP lot tidak boleh menggantikan COGS Moving Average.

### 4.2A Late landed cost dan koreksi GRNI

Setiap komponen biaya yang dapat dikapitalisasi memiliki `originCostId`. Jika biaya awal dialokasikan ke beberapa SKU/lot, koreksi mengikuti cost driver dan proporsi alokasi sumber yang sama seperti biaya awal. Gunakan cost-origin provenance Bagian 2.3 untuk menemukan bagian nilai asal yang masih melekat pada SKU/lot keturunan (termasuk output konversi dan barang retur yang masih dimiliki) versus bagian yang telah dikonsumsi/terjual/di-write-off. Bagian yang masih melekat pada persediaan menyesuaikan nilai persediaan SKU keturunan; bagian yang telah dikonsumsi menjadi event koreksi COGS periode koreksi. Pembulatan menggunakan largest remainder. Jangan mengedit event penerimaan, penjualan, konversi, atau laporan periode tertutup. Jika lineage tidak lengkap atau koreksi negatif tidak dapat dialokasikan secara aman, tahan dan buat exception untuk Owner.

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

**Status: aturan teknis sudah ditetapkan; fitur tetap belum production-ready sampai implementasi dan pengujian lintas perangkat lulus.**

Algoritma teknis:

1. Penjualan offline yang melampaui stok lokal hanya dapat dibuat melalui pengecualian yang tercatat: alasan wajib, pengakuan tanggung jawab pengguna, dan otorisasi Owner/PIN sesuai kebijakan. Tanpa otorisasi sah, transaksi disimpan sebagai pending/provisional dan tidak boleh dianggap approved.
2. Jangan membuat lot fiktif dan jangan mengubah saldo kanonis normal menjadi negatif. Simpan kuantitas kekurangan sebagai `provisionalShortageGram` terpisah, beserta base valuation sequence, MA snapshot terakhir, dan idempotency key.
3. Transaksi yang barangnya telah diserahkan tidak dihapus. COGS-nya provisional sampai backend memproses event menurut sequence otoritatif.
4. Backend melakukan serialisasi per SKU. Jika stok authoritative tersedia, backend menetapkan lot FEFO aktual dan COGS final. Jika tidak, event menjadi conflict case dengan `provisionalShortageGram`; tidak boleh memakai last-write-wins.
5. Penerimaan OWN berikutnya untuk SKU yang sama menyelesaikan shortage tertua lebih dahulu menurut server sequence. Kuantitas penerimaan yang dipakai untuk settlement langsung dialokasikan ke sale asal dan tidak menambah saleable balance; hanya kuantitas penerimaan yang tersisa setelah seluruh shortage terlayani yang menambah stok saleable. Settlement menyimpan lot penerimaan aktual, origin cost, COGS final, dan referensi sale asal.
6. Jika penerimaan hanya menutup sebagian shortage, sisanya tetap menjadi conflict case. Penyelesaian alternatif oleh Owner wajib memiliki bukti dan event adjustment yang sah; jangan membuat lot atau nilai fiktif.
7. Buat event `VALUATION_RECONCILIATION` yang merujuk sale asal dan mencatat delta COGS provisional ke final. Snapshot sale asal tetap immutable.
8. Dua perangkat yang menjual stok fisik terakhir saat offline tidak dapat sama-sama mengklaim lot yang sama. Backend menerima urutan pertama yang valid; event berikutnya masuk conflict case. Barang yang sudah diserahkan tidak dihapus, dan settlement/adjustment dilakukan melalui event.

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
- Server menyimpan unique constraint durable untuk pasangan Store ID + idempotency key; key tidak boleh kedaluwarsa hanya karena cache/perangkat membatasi jumlah entri.
- IndexedDB/backend lokal juga memiliki indeks durable pada event/outbox yang sudah diterapkan. Cache RAM boleh dibatasi, tetapi replay event lama tetap harus terdeteksi dari ledger/index persisten atau tombstone terkompaksi.
- Pull event yang telah diterapkan tidak boleh diterapkan ulang, termasuk event yang lebih tua dari 2.000 event terakhir.
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
| Idempotency | `processedIdempotencyKeys` dipotong menjadi 2.000 entri; pull reducer juga menyimpan hanya 2.000 key terakhir | Durable unique index/tombstone; event lama tidak boleh dapat diterapkan ulang setelah cache terpotong |
| Types/status | Tipe source yang diperiksa masih memuat role ADMIN serta status transaksi COMPLETED/VOIDED | Selaraskan model data dengan role Owner + Sales dan status DRAFT/POSTED/CANCELLED dalam PLAN |
| Test coverage | `businessEngine.test.ts` memiliki 45 pemanggilan `test()`; beberapa test masih mengharapkan COGS berbasis HPP lot | Tambahkan dan jalankan seluruh 53 acceptance tests serta migrasi/regression tests; jangan menganggap test lama membuktikan model baru |

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
4. Cumulative allocation membagi COGS dengan benar saat penjualan dipecah menjadi beberapa transaksi.
5. Pool Rp2/3 gram menghasilkan COGS Rp1, Rp0, Rp1 untuk tiga pengeluaran 1 gram.
6. HPP tampilan yang dibulatkan tidak menyebabkan drift pada transaksi berulang.
7. Stok nol dengan nilai nol memulai rata-rata baru pada penerimaan berikutnya.
8. Kuantitas nol dengan nilai nonzero ditolak/ditandai untuk rekonsiliasi.
9. Nilai ledger sama dengan perubahan saldo kanonis.
10. Event perubahan basis MA menutup pool lama dan memulai pool baru dari saldo canonical.

### 9.2 FEFO dan COGS

11. FEFO memilih lot eligible dengan urutan tanggal yang benar.
12. Lot quarantine/expired tidak dialokasikan untuk penjualan.
13. Penjualan lintas beberapa lot tetap menghasilkan COGS Moving Average SKU.
14. Jumlah COGS detail lot sama persis dengan COGS item setelah rounding.
15. Perubahan HPP lot tidak mengubah COGS transaksi yang sudah diposting.

### 9.3 Relative NRV

16. Output utama dan by-product saleable menerima alokasi proporsional NRV.
17. Limbah tanpa NRV positif tidak membentuk SKU persediaan.
18. Total alokasi sama persis dengan nilai input.
19. Rounding remainder dibagikan deterministik.
20. Total NRV nol/negatif menolak posting.
21. Perubahan harga jual master setelah konversi tidak mengubah snapshot konversi lama.
22. Berat input direkonsiliasi dengan output, waste, dan variance.

### 9.4 Retur, reversal, dan adjustment

23. Retur memakai COGS historis item asal, bukan MA terbaru.
24. Retur parsial berulang tidak melebihi berat/COGS yang dapat diretur.
25. Barang retur masuk quarantine dan tidak tersedia untuk FEFO.
26. Release dari quarantine tidak mengubah total nilai persediaan.
27. Write-off mengurangi kuantitas dan nilai sesuai carrying value.
28. Reversal memulihkan nilai berdasarkan COGS historis dan hanya untuk kuantitas yang benar-benar kembali.
29. Adjustment penambahan tanpa dasar biaya tidak menciptakan nilai persediaan.

### 9.5 Sync dan integritas

30. Event yang sama dikirim berulang hanya berdampak satu kali.
31. Dua perangkat menjual SKU sama dari base sequence yang sama; backend menghasilkan urutan canonical atau conflict yang eksplisit.
32. Event remote yang sudah diterapkan tidak menggandakan saldo.
33. Payload dengan idempotency key sama tetapi isi berbeda ditolak.
34. Crash di tengah commit tidak meninggalkan saldo, lot, ledger, jurnal, dan outbox yang berbeda.
35. Perangkat setelah pull memiliki saldo kuantitas/nilai dan valuation sequence yang sama dengan backend.
36. Konflik stok minus menghasilkan case yang dapat ditelusuri, bukan penghapusan event.

### 9.6 Migrasi

37. Migrasi dari data lama dapat dijalankan berulang tanpa menggandakan saldo.
38. Data dengan ketidaksesuaian lot/ledger/MA masuk laporan exception, bukan diberi nilai fallback.
39. Snapshot sebelum migrasi dapat dipulihkan melalui prosedur yang diuji.
40. Landed cost langsung diatribusikan ke sumber yang tepat.
41. Freight bersama dialokasikan berdasarkan gram aktual dan total alokasi sama dengan dokumen biaya.
42. Largest remainder menghasilkan pembagian Rupiah deterministik dengan tie-break stabil.
43. Late landed cost membagi koreksi berdasarkan origin value yang masih melekat pada persediaan keturunan versus yang sudah dikonsumsi, tanpa mengubah event historis.
44. Koreksi invoice GRNI memperbarui inventory value dan COGS adjustment sesuai bucket asal.
45. Koreksi negatif yang tidak dapat dialokasikan secara aman menghasilkan exception, bukan nilai negatif tersembunyi.
46. Stok minus offline disimpan sebagai provisional shortage tanpa saldo kanonis negatif atau lot fiktif.
47. Dua perangkat yang menjual stok fisik terakhir menghasilkan satu canonical allocation dan conflict case untuk event berikutnya.
48. Origin cost component tetap dapat ditelusuri saat stok berpindah melalui konversi ke SKU turunan.
49. COGS provenance yang dikonsumsi sama dengan COGS MA event, tetapi tidak digunakan sebagai sumber COGS.
50. Late landed cost pada barang yang sudah dikonversi membagi koreksi ke stok keturunan yang masih dimiliki dan COGS yang sudah dikonsumsi.
51. Retur memulihkan origin provenance historis secara parsial tanpa melebihi komponen COGS asal.
52. Jumlah provenance value tersisa per SKU selalu sama dengan inventoryValueRupiah SKU.
53. Replay event lama setelah lebih dari 2.000 event baru tetap ditolak/didiskip melalui indeks durable; saldo, lot, ledger, dan jurnal tidak berubah.
54. Penerimaan parsial menyelesaikan provisional shortage tertua sesuai server sequence; kuantitas untuk settlement tidak masuk saleable balance, dan sisa penerimaan baru menjadi stok tersedia.

### 9.7 Fixture angka wajib

Fixture berikut menjadi test vector minimum. Semua nilai Rupiah dan berat Gram; tidak boleh menggunakan floating-point.

**A. Moving Average dan FEFO terpisah**
- Terima 3.000 g dengan nilai Rp300.000, lalu 2.000 g dengan nilai Rp320.000.
- Saldo canonical sebelum penjualan: 5.000 g dan Rp620.000; MA turunan Rp124.000/kg.
- Jual 1.500 g. COGS harus Rp186.000, terlepas dari lot FEFO mana yang dipilih secara fisik.
- Saldo sesudah: 3.500 g dan Rp434.000.

**B. Pembulatan cumulative allocation**
- Pool awal 3 g dan Rp2.
- Tiga pengeluaran berurutan masing-masing 1 g menghasilkan COGS Rp1, Rp0, Rp1.
- Total COGS Rp2 dan saldo akhir 0 g/Rp0.

**C. Relative NRV**
- Nilai input 10 g = Rp1.000.
- Output utama NRV Rp750 dan output samping NRV Rp250.
- Alokasi nilai harus Rp750 dan Rp250; total tetap Rp1.000.

**D. Late cost setelah konversi**
- Origin cost Rp1.000 dibawa ke dua output sesuai NRV: Rp750 pada output A dan Rp250 pada output B.
- Output A memiliki 6 g; penjualan 3 g dengan COGS MA Rp375 mengonsumsi provenance Rp375. Sisa provenance origin: Rp375 pada A dan Rp250 pada B, total Rp625.
- Koreksi landed cost +Rp101 dibagi terhadap origin value yang sudah dikonsumsi Rp375 dan masih tersisa Rp625. Dengan largest remainder dan tie-break stabil: koreksi COGS periode berjalan Rp38 dan inventory value SKU keturunan Rp63.
- Jumlah koreksi harus tetap Rp101; event pembelian, konversi, dan penjualan asal tidak berubah.

**E. Retur parsial dan provenance**
- Dari penjualan 3 g dengan COGS Rp375 dan provenance Rp375, retur 1 g harus memulihkan sepertiga komponen provenance secara cumulative; dua retur berikutnya tidak boleh memulihkan lebih dari total Rp375.
- Barang retur masuk quarantine; nilai dan provenance tetap dimiliki sampai dilepas atau di-write-off.

## 10. Urutan implementasi yang direkomendasikan

Implementasi harus bertahap dan setiap tahap lulus test sebelum lanjut:

1. **Audit & proposal schema:** inventarisasi seluruh read/write stok dan valuasi; rancang canonical SKU balance dan migrasi.
2. **Valuation core:** helper integer/rational arithmetic, cumulative allocation per valuation pool, largest remainder, invariant, dan unit tests.
3. **Purchase receipt & landed cost:** tambahkan nilai/gram ke saldo kanonis; implementasikan cost driver, GRNI, dan late-cost correction sesuai aturan yang sudah ditetapkan.
4. **Sales COGS:** FEFO tetap untuk fisik, Moving Average untuk COGS; snapshot immutable.
5. **Return, reversal, adjustment:** historical COGS, quarantine, write-off, dan reconciliation.
6. **Relative NRV conversion:** satu calculator dipakai local command dan remote reducer; hapus konstanta fallback.
7. **Sync protocol:** server sequencing, canonical ACK, conflict case, dan idempotency.
8. **Migration dry-run:** laporan rekonsiliasi, keputusan exception, backup, rollback.
9. **End-to-end regression:** semua test acceptance dan build/test project.

Jangan mengerjakan schema migration dan perubahan source secara serentak tanpa proposal yang direview terlebih dahulu.

## 11. Keputusan teknis yang telah ditetapkan dan batas validasi

| Area | Aturan teknis | Status |
|---|---|---|
| Pembulatan COGS | Cumulative allocation per valuation pool, round-half-up integer, nilai pool habis tepat saat kuantitas habis | Dikunci |
| Alokasi COGS antar-lot | Largest remainder; tie-breaker ID lot stabil | Dikunci |
| Landed cost | Direct attribution; jika tidak, cost driver sesuai sifat biaya; default freight bersama = gram aktual | Dikunci |
| Late landed cost/GRNI | Cost-origin provenance; koreksi mengikuti nilai asal ke stok keturunan versus nilai yang telah dikonsumsi | Dikunci secara teknis; klasifikasi akuntansi perlu validasi |
| Stok minus offline | Provisional shortage terpisah, server sequence, conflict case, valuation reconciliation | Dikunci secara teknis; otorisasi mengikuti PLAN |
| Multi-device | Backend sequencing per SKU, idempotency, canonical ACK; bukan last-write-wins | Persyaratan arsitektur |
| Retur karantina | Masuk saldo OWN dan carrying value pada historical COGS; terpisah dari saleable quantity | Dikunci |
| Biaya tenaga kerja konversi | Tidak dikapitalisasi pada tahap ini | Dikunci |
| Migrasi saldo lama | Rekonsiliasi per SKU; exception wajib verifikasi Owner; dry-run dan rollback | Wajib sebelum migrasi |

Validasi akuntansi tetap diperlukan untuk penyajian GRNI dan koreksi COGS pada laporan periode berjalan. Validasi tersebut tidak mengubah invariant teknis bahwa histori transaksi tidak diedit dan koreksi harus berupa event baru.

## 12. Batas validasi sebelum coding

- Dokumen ini adalah spesifikasi teknis, bukan bukti bahwa source code telah sesuai.
- Sebelum perubahan schema, inventarisasi seluruh jalur read/write stok dan valuasi pada source aktif dan buat proposal schema/migration plan.
- Perubahan source dilakukan bertahap sesuai urutan implementasi pada Bagian 10; jangan menggabungkan perubahan schema, migrasi data, dan refactor transaksi dalam satu langkah tanpa checkpoint.
- Setiap tahap wajib memiliki automated tests dengan input, expected output, saldo sebelum/sesudah, serta verifikasi ledger.
- Migrasi produksi dilarang sebelum dry-run pada salinan data, rekonsiliasi per SKU, backup, rollback, dan persetujuan Owner.
- Tidak ada perubahan ke branch utama, deployment, atau penghapusan histori sebagai bagian dari pekerjaan spesifikasi ini.

---

**Kesimpulan:** Moving Average dan Relative NRV sudah menjadi keputusan produk. Pekerjaan teknis berikutnya adalah membuat keduanya benar-benar menjadi sumber valuasi yang konsisten di purchase, sale, return, conversion, adjustment, ledger, dan sync. Sampai acceptance tests dan migrasi lulus, fitur valuasi tidak boleh disebut production-ready.
