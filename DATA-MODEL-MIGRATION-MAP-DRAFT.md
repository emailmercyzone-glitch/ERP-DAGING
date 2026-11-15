# ERP DAGING — Data Model & Migration Mapping (Draft)

**Status:** Draft desain; belum menjadi instruksi migrasi produksi.  
**Branch:** `plan-consolidation-draft`  
**Basis audit:** `src/engine/types.ts` dan `src/engine/businessEngine.ts` pada snapshot yang diaudit 15 November 2026.  
**Tujuan:** Menentukan model data target, pemetaan field lama, dan urutan migrasi tanpa menghilangkan histori atau mengubah data aktif.

> Dokumen ini mendeskripsikan target desain. Ini bukan bukti bahwa schema atau migrasi sudah diimplementasikan, diuji, atau aman dijalankan pada data produksi.

---

## 1. Keputusan desain utama

1. **Moving Average per SKU adalah satu-satunya dasar nilai persediaan dan COGS.** Lot tetap menyimpan identitas fisik, tanggal kedaluwarsa, lokasi, dan kuantitas untuk FEFO; HPP lot lama tidak lagi menjadi sumber valuasi aktif.
2. **Nilai persediaan kanonis disimpan per SKU** sebagai integer Rupiah. Kuantitas kanonis dalam integer Gram. HPP MA diturunkan dari nilai dibagi kuantitas, bukan dihitung dengan merata-ratakan HPP lot.
3. **Stock ledger append-only.** Koreksi dilakukan dengan event pembalik/koreksi, bukan mengedit atau menghapus histori.
4. **Cost-origin provenance adalah lapisan penelusuran, bukan metode valuasi.** Ia melacak asal nilai biaya untuk landed cost/GRNI setelah barang dikonversi, dijual, diretur, atau di-write-off. COGS tetap dihitung dari MA SKU.
5. **FEFO menentukan lot fisik yang diambil, bukan HPP/COGS.**
6. **Idempotency harus durable.** Daftar key yang dipangkas menjadi 2.000 item tidak boleh menjadi satu-satunya pengaman replay.
7. Migrasi dilakukan bertahap dengan snapshot, validasi total, dan rollback. Tidak ada penghapusan field lama sebelum masa kompatibilitas dan rekonsiliasi selesai.

## 2. Model data target

Nama tabel di bawah adalah nama konseptual. Implementasi boleh menyesuaikan nama object store IndexedDB atau tabel backend, tetapi relasi dan invariant wajib dipertahankan.

### 2.1 Master dan proyeksi stok

| Entitas | Field inti | Aturan |
|---|---|---|
| `products` | `id`, `sku`, `name`, `basePrice`, `status` | Master SKU. |
| `sku_inventory_balance` | `skuId`, `onHandGram`, `inventoryValueRupiah`, `movingAverageHppPerKg`, `lastAppliedEventSeq` | Satu saldo kanonis per SKU. Nilai Rupiah dan Gram integer. HPP MA adalah proyeksi terhitung. |
| `lots` | `id`, `skuId`, `code`, `expiryDate`, `receivedAt`, `physicalGram`, `location`, `qualityStatus` | Lot mengelola kuantitas/lokasi/kualitas fisik dan urutan FEFO. Bukan sumber nilai persediaan. |
| `lot_quantity_ledger` | `eventId`, `skuId`, `lotId`, `quantityDeltaGram`, `reason`, `serverSeq` | Pergerakan kuantitas per lot; append-only. |
| `stock_ledger` | `eventId`, `skuId`, `lotId?`, `quantityDeltaGram`, `valueDeltaRupiah`, `unitCostSnapshot`, `movementType`, `referenceId`, `idempotencyKey`, `serverSeq` | Ledger kuantitas dan nilai. `valueDeltaRupiah` adalah delta nilai SKU, bukan hasil perkalian HPP lot secara independen. |

**Aturan saldo:**  
- `sku_inventory_balance.onHandGram` harus sama dengan total kuantitas OWN yang eligible pada seluruh lot SKU terkait, setelah memperhitungkan status karantina sesuai kebijakan stok.
- `sku_inventory_balance.inventoryValueRupiah` adalah nilai persediaan OWN yang masih dimiliki bisnis. Nilai barang karantina tetap bagian dari nilai persediaan selama belum di-write-off; status karantina membatasi penjualan, bukan otomatis menghapus nilai.
- `movingAverageHppPerKg = round(inventoryValueRupiah × 1000 / onHandGram)`. Jika kuantitas nol, HPP tampilan bernilai nol/tidak tersedia; nilai sisa harus ditangani melalui event rekonsiliasi eksplisit, bukan dibagi nol.
- Total nilai SKU tidak boleh dijumlahkan dari `lot.hppKgRupiah × lot.weightGram` setelah cutover.
- Nilai persediaan tidak boleh negatif. Kuantitas provisional shortage dicatat terpisah sampai diselesaikan server.

### 2.2 Transaksi dan alokasi fisik

| Entitas | Field inti | Aturan |
|---|---|---|
| `sales_transactions` | `id`, `status`, `fulfillmentStatus`, `paymentStatus`, `grandTotalRupiah`, `totalCogsRupiah`, `postedAt`, `legacyStatus?` | Status transaksi, pemenuhan, dan pembayaran terpisah. |
| `sales_transaction_lines` | `id`, `transactionId`, `skuId`, `weightGram`, `unitPriceRupiah`, `lineTotalRupiah`, `cogsRupiah`, `movingAverageSnapshot` | COGS dihitung per SKU dari MA, setelah seluruh baris SKU yang sama diagregasi dalam transaksi. |
| `sale_lot_allocations` | `id`, `transactionLineId`, `lotId`, `weightGram`, `pickSequence` | Menyimpan lot yang benar-benar diambil berdasarkan FEFO. Tidak menentukan COGS. |
| `inventory_movements` | `eventId`, `skuId`, `lotId?`, `movementType`, `quantityGram`, `valueRupiah`, `sourceTransactionId` | Menghubungkan posting transaksi dengan ledger. |

Satu transaksi dapat memiliki beberapa baris untuk SKU yang sama. Mesin harus mengagregasi total Gram SKU tersebut sebelum menghitung COGS, lalu membagi hasil ke baris dengan largest remainder dan tie-break deterministik.

### 2.3 Cost-origin provenance

| Entitas | Field inti | Aturan |
|---|---|---|
| `origin_cost_components` | `originCostId`, `sourceReferenceId`, `originCostValueRupiah`, `consumedOriginValueRupiah`, `lastAppliedEventSeq` | Identitas dan nilai asal biaya. |
| `origin_cost_balances` | `originCostId`, `currentSkuId`, `currentLotId?`, `remainingOriginValueRupiah` | Sisa nilai asal yang masih melekat pada persediaan turunan. |
| `origin_cost_movements` | `eventId`, `originCostId`, `fromSkuId?`, `toSkuId?`, `fromLotId?`, `toLotId?`, `remainingDeltaRupiah`, `consumedDeltaRupiah`, `referenceId` | Jejak append-only pemindahan/pemakaian provenance. |

Ketentuan:
- Jumlah saldo provenance tersisa untuk suatu SKU harus sama dengan bagian nilai SKU yang dapat ditelusuri ke origin tersebut.
- Untuk setiap `originCostId`: nilai asal = seluruh saldo turunan yang tersisa + nilai asal yang telah dikonsumsi.
- Outbound mengonsumsi provenance secara kumulatif per pool, proporsional terhadap komponen asal pada awal pool, dengan largest remainder dan tie-break stabil. Delta event = target kumulatif sesudah dikurangi target kumulatif sebelumnya; hasil tidak berubah hanya karena transaksi dipecah.
- Conversion memindahkan provenance ke SKU output menggunakan Relative NRV.
- Return memulihkan provenance berdasarkan histori COGS penjualan yang diretur dan tidak boleh melebihi nilai asal yang pernah dikonsumsi.
- Write-off mengonsumsi provenance. Pemindahan karantina ke stok jual atau sebaliknya tidak mengubah nilai provenance.
- Provenance tidak menggantikan MA dan tidak boleh dipakai langsung sebagai HPP penjualan.

### 2.4 Event, idempotency, dan sinkronisasi

| Entitas | Field inti | Aturan |
|---|---|---|
| `business_events` | `eventId`, `eventType`, `aggregateType`, `aggregateId`, `deviceId`, `deviceSeq`, `serverSeq?`, `occurredAt`, `payload`, `schemaVersion` | Event bisnis yang immutable. |
| `idempotency_registry` | `idempotencyKey`, `eventId`, `firstSeenAt`, `serverSeq`, `resultStatus` | Unique constraint pada key di backend; indeks lokal durable untuk event yang telah diproses. |
| `sync_outbox` | `eventId`, `idempotencyKey`, `status`, `retryCount`, `lastError` | Outbox dapat retry tanpa menggandakan dampak. |
| `sync_conflicts` | `eventId`, `skuId?`, `conflictType`, `reason`, `status`, `createdAt` | Konflik tersimpan dan dapat direkonsiliasi. |
| `provisional_shortages` | `shortageId`, `skuId`, `sourceEventId`, `requestedGram`, `settledGram`, `serverSeq`, `status` | Kekurangan stok offline tidak menjadi saldo stok negatif yang bisa dijual. |

Aturan idempotency:
- Pemeriksaan key dilakukan sebelum menerapkan event dan dijamin unik oleh backend.
- Lokal menyimpan indeks durable atau tombstone yang tidak dipangkas berdasarkan jumlah item.
- Jika histori event lama diarsipkan, registry key tetap tersedia untuk mencegah replay.
- Event duplikat mengembalikan hasil pemrosesan pertama; tidak menghasilkan ledger, jurnal, stok, atau pembayaran kedua.

### 2.5 Keuangan dan audit

Entitas pembayaran, piutang, utang, OPEX, jurnal, audit, dan lampiran tetap terpisah dari saldo stok. Jurnal merupakan hasil posting yang merujuk event sumber; jurnal tidak boleh menjadi pengganti stock ledger. Setiap koreksi setelah posting membuat event reversal/adjustment baru dan referensi ke event asal.

## 3. Mapping field lama ke model target

Mapping ini berdasarkan tipe yang ditemukan pada `src/engine/types.ts`. Field lama dipertahankan selama kompatibilitas migrasi, tetapi sebagian menjadi legacy atau proyeksi.

| Field/model lama | Target | Perlakuan migrasi |
|---|---|---|
| `ProductEntity.id` | `products.id`, `sku_inventory_balance.skuId` | Pertahankan ID; jangan generate ulang. |
| `ProductEntity.sku/name/category/basePricePerKg` | Master SKU dan harga | Pindahkan tanpa mengubah nilai; harga tetap integer Rupiah/kg. |
| `ProductEntity.stockGram` | `sku_inventory_balance.onHandGram` | Jadikan proyeksi hasil rekonsiliasi lot, bukan sumber kedua. |
| `ProductEntity.movingAvgHppPerKg` | `sku_inventory_balance.movingAverageHppPerKg` | Recompute dari nilai dan kuantitas awal; simpan nilai lama sebagai audit comparison. |
| `BatchLotEntity.weightGram` | `lots.physicalGram` + lot quantity ledger | Pertahankan kuantitas fisik dan ID lot. |
| `BatchLotEntity.hppKgRupiah` | `legacyLotHppSnapshot` | Read-only histori/diagnostik setelah cutover; tidak digunakan menghitung COGS atau nilai aktif. |
| `BatchLotEntity.expiryDate/isFefo/loc/isQuarantined` | `lots.expiryDate/qualityStatus/location` | Pertahankan; derive FEFO dari expiry/receivedAt/status, bukan boolean manual sebagai otoritas tunggal. |
| `StockLedgerEntry.uuid/idempotencyKey` | `business_events.eventId/idempotency_registry` | Pertahankan ID/key yang valid; deduplicate sebelum import. |
| `StockLedgerEntry.weightGramDelta` | `stock_ledger.quantityDeltaGram` | Mapping bertanda; validasi total per SKU dan lot. |
| `StockLedgerEntry.valueRupiahDelta` | `stock_ledger.valueDeltaRupiah` | Pertahankan sebagai histori; jangan menganggap setiap nilai lama sudah memakai MA. Tandai basis valuasi legacy. |
| `StockLedgerEntry.unitCostPerKg/movingAvgHppAfterKg` | Snapshot legacy | Pertahankan sebagai audit; jangan dipakai sebagai sumber kanonis setelah cutover. |
| `SalesTransactionRecord.uuid/idempotencyKey` | `sales_transactions.id/business_events` | Pertahankan ID dan key. |
| `SalesTransactionRecord.items[]` | `sales_transaction_lines` | Pertahankan nilai harga/berat historis; tandai basis COGS legacy. |
| `SalesTransactionRecord.lotAllocations[]` | `sale_lot_allocations` | Pertahankan lot fisik yang diambil. |
| `SalesTransactionRecord.totalCogsRupiah` | `sales_transactions.totalCogsRupiah` | Histori tidak dihitung ulang diam-diam; tandai `cogsBasis=LEGACY_LOT` bila berasal dari HPP lot. |
| `SalesTransactionRecord.status=COMPLETED` | `status=POSTED` | Hanya karena source lama menyimpan transaksi completed. Fulfillment lama tidak cukup membuktikan detail penerima/waktu; gunakan `fulfillmentStatus=UNKNOWN_LEGACY` bila bukti tidak tersedia. |
| `SalesTransactionRecord.status=VOIDED` | `status=POSTED` + `reversalStatus=REVERSED` | Jangan petakan ke CANCELLED. Cari reversal ledger/jurnal yang merujuk transaksi; jika tidak ada, tandai exception dan jangan membuat reversal otomatis tanpa rekonsiliasi. Simpan `legacyStatus=VOIDED`. |
| `processedIdempotencyKeys[]` | `idempotency_registry` | Import seluruh key yang tersedia. Karena list lama bisa dipangkas, kelengkapan histori harus dibandingkan dengan event/outbox/ledger; key yang tidak dapat direkonstruksi menjadi risiko migrasi terbuka. |
| `syncOutbox[]` | `sync_outbox` | Pertahankan event ID, key, status, retry count, server sequence; jangan mengirim ulang item yang sudah diterapkan tanpa dedupe backend. |
| `remoteSyncEvents[]/lastServerSeq` | `business_events/serverSeq` | Pertahankan sequence tertinggi; verifikasi tidak ada gap yang belum direkonsiliasi. |
| `customerReturns[]` | `returns` + return provenance movements | Pertahankan referensi invoice, SKU, Gram, nilai refund, resolusi, bukti. Nilai stok retur harus ditentukan dari histori COGS asal, bukan nol atau HPP lot saat ini. |
| `JournalEntry[]` | `journal_entries/journal_lines` | Pertahankan UUID, key, referensi, debit/kredit; validasi balance dan kaitan dengan event. |
| `AuditTrailEntry[]` | `audit_events` | Pertahankan append-only; role lama ADMIN dipertahankan sebagai `legacyActorRole`, bukan role aktif baru. |
| `ApprovalRequest[]` | `authorization_requests` | Migrasikan request historis; status/role lama tidak otomatis memberi kewenangan baru. |
| `schemaVersion` | `schemaVersion` bertahap | Naikkan hanya setelah migrasi atomik berhasil dan backup/snapshot aman tersedia. |

## 4. Strategi migrasi aman

### Tahap 0 — Inventarisasi dan backup
1. Ambil snapshot database lokal dan backup JSON per perangkat.
2. Catat jumlah produk, lot, transaksi, ledger, jurnal, retur, outbox, key idempotency, dan `lastServerSeq`.
3. Hitung checksum dan simpan versi aplikasi/schema asal.
4. Jangan menjalankan migrasi pada data aktif sebelum fixture salinan berhasil diuji.

### Tahap 1 — Validasi legacy
1. Pastikan setiap lot memiliki `productId`; jika hanya nama produk tersedia, lakukan pemetaan manual/aturan deterministik dan simpan exception.
2. Periksa duplikasi SKU, ID lot, transaksi, ledger UUID, dan idempotency key.
3. Cocokkan `ProductEntity.stockGram` dengan total `BatchLotEntity.weightGram` per SKU, pisahkan karantina dan model kepemilikan.
4. Hitung nilai legacy lot sebagai pembanding: jumlah `round(weightGram × hppKgRupiah / 1000)` per SKU. Ini hanya baseline migrasi dari data lama, bukan aturan valuasi baru.
5. Identifikasi transaksi VOIDED yang belum memiliki reversal ledger/jurnal yang cocok.
6. Tandai transaksi dengan COGS nol, nilai lot nol, atau data asal yang tidak lengkap sebagai exception; jangan mengarang nilainya.

### Tahap 2 — Bentuk opening valuation
1. Untuk setiap SKU OWN, buat satu opening valuation event pada waktu cutover.
2. `onHandGram` awal berasal dari rekonsiliasi lot fisik yang eligible; lot karantina tetap tercatat secara fisik dan statusnya dipisah.
3. `inventoryValueRupiah` awal berasal dari jumlah carrying value lot legacy yang lolos validasi, dengan pembulatan Rupiah deterministik.
4. Hitung HPP MA awal dari total nilai SKU dibagi total Gram SKU; jangan mengambil rata-rata HPP lot.
5. Simpan detail perhitungan sumber, daftar lot, nilai legacy per lot, total hasil, dan selisih terhadap nilai dashboard lama.
6. Jika nilai/kuantitas tidak cocok atau ada lot tanpa identitas SKU, SKU tersebut tidak boleh cutover otomatis; masuk daftar rekonsiliasi.

### Tahap 3 — Migrasi provenance awal
1. Buat origin cost component untuk setiap sumber nilai awal yang dapat dibuktikan, dengan referensi ke penerimaan/pembelian atau opening balance.
2. Jika histori asal biaya tidak tersedia, gunakan origin khusus `MIGRATION_OPENING_BALANCE` yang merujuk snapshot dan daftar lot sumber. Jangan mengklaim asal supplier yang tidak diketahui.
3. Jumlah provenance awal harus sama dengan nilai persediaan awal SKU.
4. Jika nilai provenance tidak dapat direkonstruksi, simpan sebagai exception terukur; jangan mengisi nol atau membuat nilai asal fiktif.

### Tahap 4 — Import histori dan idempotency
1. Import transaksi, lot allocation, ledger, jurnal, retur, audit, outbox, dan server sequence dengan ID lama.
2. Simpan COGS historis apa adanya dan beri label basis legacy. Jangan menghitung ulang laba historis memakai MA baru.
3. Rekonstruksi registry idempotency dari seluruh sumber yang tersedia (outbox, event remote, ledger, jurnal, transaksi). Tandai gap yang tidak bisa dipastikan.
4. Backend harus menolak key duplikat dengan unique constraint sebelum perangkat baru mulai mengirim event.
5. Pastikan event lama tidak diterapkan ulang selama import/retry.

### Tahap 5 — Cutover dan verifikasi
Cutover hanya boleh dilakukan jika:
- Total kuantitas per SKU = total kuantitas lot yang direkonsiliasi.
- Total nilai SKU = total nilai provenance awal.
- Nilai SKU dan HPP MA dapat dihitung ulang dari nilai/Gram dengan aturan pembulatan yang sama.
- Semua transaksi VOIDED memiliki reversal yang cocok atau exception yang disetujui.
- Tidak ada idempotency key duplikat dengan dampak ganda.
- Outbox dan server sequence tidak kehilangan event.
- Snapshot sebelum dan sesudah migrasi tersedia dan checksum valid.

Jika salah satu syarat gagal, migrasi dihentikan untuk SKU/perangkat terkait. Jangan melakukan partial cutover diam-diam.

## 5. Invariant rekonsiliasi wajib

1. `SUM(lot_quantity_ledger.quantityDeltaGram)` per lot = saldo fisik lot.
2. Jumlah lot OWN eligible per SKU = `sku_inventory_balance.onHandGram` sesuai definisi stok yang sama.
3. Saldo nilai SKU hanya berubah melalui event penerimaan, penjualan, retur, konversi, landed cost/GRNI, adjustment, atau write-off yang sah.
4. `inventoryValueRupiah` tidak negatif.
5. Total nilai provenance tersisa + nilai provenance terkonsumsi = nilai origin.
6. COGS penjualan dihitung dari MA SKU, bukan dari HPP lot yang dipilih FEFO.
7. Penjumlahan COGS baris SKU dalam satu transaksi = COGS total SKU yang dihitung setelah agregasi.
8. Event dengan idempotency key sama hanya boleh menghasilkan satu dampak bisnis.
9. Setiap reversal/return/adjustment merujuk event asal.
10. Migrasi tidak mengubah angka historis penjualan, pembayaran, refund, jurnal, atau COGS tanpa proses koreksi yang eksplisit.

## 6. Risiko dan keputusan yang belum boleh diasumsikan

| Risiko/pertanyaan | Perlakuan aman |
|---|---|
| Histori ledger lama belum lengkap untuk membangun provenance sejak awal | Mulai provenance dari opening balance cutover; jangan merekonstruksi asal biaya fiktif. |
| Nilai lot legacy berbeda dari nilai dashboard atau nilai SKU | Tahan cutover SKU dan buat rekonsiliasi selisih. |
| Transaksi VOIDED tidak memiliki reversal lengkap | Tahan migrasi status transaksi tersebut sampai ledger/jurnal diperiksa. |
| Key idempotency lama sudah terpangkas dari cache 2.000 | Cari bukti di seluruh event/ledger; jika tidak dapat dipastikan, tandai risiko replay dan lakukan baseline registry sebelum sinkronisasi baru. |
| Stok negatif dari operasi offline lama | Jangan masukkan sebagai stok saleable; bentuk provisional shortage/conflict dan selesaikan berdasarkan urutan server. |
| Status role lama ADMIN | Pertahankan sebagai metadata historis; role aktif tetap Owner dan Sales sesuai PLAN. |
| Field lot HPP masih dipakai UI/laporan lama | Boleh dipertahankan sementara sebagai legacy display, tetapi seluruh jalur perhitungan aktif harus berpindah ke saldo nilai SKU. |

## 7. Urutan implementasi setelah desain disetujui

1. Tambahkan tipe target dan validator schema tanpa mengubah jalur transaksi lama.
2. Buat pure migration function dari schema lama ke schema target; fungsi harus idempotent dan tidak melakukan network call.
3. Buat fixture migrasi dari snapshot anonim/representatif, termasuk data korup, lot tanpa SKU, transaksi VOIDED, retur, dan idempotency gap.
4. Tambahkan rekonsiliasi read-only yang membandingkan nilai lama vs target.
5. Implementasikan SKU balance + MA sebagai jalur perhitungan tunggal.
6. Pindahkan COGS, conversion, opname, return, GRNI, dan sync ke model target secara bertahap.
7. Aktifkan durable idempotency registry di backend sebelum multi-device cutover.
8. Hapus ketergantungan field legacy hanya setelah seluruh layar, laporan, adapter, dan test tidak lagi membacanya.

**Status akhir:** rancangan schema dan mapping tersedia untuk review. Belum ada source code, schema database aktif, atau data pengguna yang diubah. Belum ada test/build/migrasi yang dijalankan.
