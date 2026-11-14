# BLUEPRINT SOLID ERP DAGING IMPORT UMKM (V4.6 - PWA MULTI-DEVICE, LOCAL-FIRST & GAS SYNC)
Project: ERP DAGING
Output Aktif: Installable Progressive Web App (PWA)
Versi: 4.6 (Penyederhanaan Arsitektur & Operasional, Kemampuan Bisnis Tetap Profesional)
Status: SINGLE SOURCE OF TRUTH — Change Register Section 13 menjadi keputusan terbaru dan mengesampingkan detail lama yang bertentangan.
Stack Aktif: React 18 + TypeScript + Vite PWA (`vite-plugin-pwa` + Workbox) + Tailwind CSS + IndexedDB (`karkasia_erp_offline_db`) + satu integrasi sinkronisasi Google Apps Script (GAS).
Platform nonaktif: Flutter/APK dan backend alternatif tidak termasuk scope implementasi aktif.
Prinsip Utama: Local-First, Multi-Device Maksimal 8 Perangkat, GAS sebagai jalur sinkronisasi aktif, UI sederhana, Business Engine dan laporan tetap profesional, Zero-Float Ledger.

---

## DAFTAR ISI
1. Ringkasan Eksekutif & Prinsip Arsitektur Local-First (V4.5)
2. Alur Transaksi Penjualan, Pengiriman, & Void vs Retur
3. Siklus Pembelian Impor, Landed Cost, & AP Payments (Utang Supplier)
4. Manajemen Stok, FEFO, Yield Loss, & Konversi Produk (Tetelan)
5. Konsinyasi, Affiliate, & Penanganan Komisi
6. Arsitektur Database Lokal & Master Entitas
7. Backend Adapter Interface & Protokol Sinkronisasi Outbox (ACK-Only)
8. Keamanan, Otorisasi Perangkat, & Backup Cadangan
9. Aturan Opening Balance & Format CSV Migrasi Awal
10. Daftar 22 Modul ERP & Matriks Fungsional
11. Status Audit Aktual, Celah Terverifikasi, & Roadmap Lanjutan
12. Prinsip Desain UI/UX Mobile-First & Clean Luxury

---

## 1. RINGKASAN EKSEKUTIF & PRINSIP ARSITEKTUR LOCAL-FIRST (V4.6)
- **Keputusan Arsitektur Terbaru (Local-First & Vendor-Agnostic)**:
  - **PWA sebagai satu-satunya platform aktif**: Aplikasi berjalan sebagai installable PWA. Flutter/APK tidak menjadi target implementasi aktif dan tidak boleh menambah beban scope PWA.
  - **Local-First per perangkat**: Setiap perangkat menjalankan transaksi rutin dari IndexedDB lokal. Internet bukan syarat startup atau pencatatan transaksi inti.
  - **Satu backend sinkronisasi aktif**: Google Apps Script Web App (GAS) menjadi gateway sinkronisasi untuk maksimal 8 perangkat; Google Sheets menjadi penyimpanan event log. Tidak ada backend alternatif yang perlu dibangun atau dipelihara pada fase aktif.
  - **Abstraksi secukupnya**: Integrasi GAS boleh memakai satu client/adapter tipis agar kode terpisah dan mudah diuji. Jangan membangun kerangka vendor-agnostic atau plugin adapter multi-backend.
  - **PWA Offline-First**: Menggunakan Workbox Service Worker dan IndexedDB (`karkasia_erp_offline_db`) dengan migrasi aman dari `localStorage` lama (`normalizePersistedState` menjaga kompatibilitas data terdahulu).
- **Skala Operasional**: Maksimal 1 Owner, 2 Admin, 5 Sales (~8 perangkat); <= 500 SKU; <= 200 transaksi/hari.
- **Model Stok**: Sentral di gudang pusat. Sales menjual dari stok pusat tanpa muat barang di kendaraan (*no vehicle stock*). Pengiriman fisik diatur oleh gudang setelah order diverifikasi.
- **Karakter Data (Zero-Float Policy)**:
  - Angka mata uang menggunakan integer utuh Rupiah (`BIGINT` / `INTEGER` / `Math.round` IDR).
  - Berat menggunakan integer utuh Gram (`INTEGER`, misal 1 kg = 1000 gram).
  - Zero float untuk menghindari *rounding error*.
- **Immutable Ledger**: Tabel/log pergerakan stok (`stock_ledger` / `stockLedger`) dan event transaksi bersifat append-only (insert-only). Koreksi wajib melalui transaksi balik (`VOID_REVERSAL`) atau penyesuaian tercatat.

---

## 2. ALUR TRANSAKSI PENJUALAN, PENGIRIMAN, & VOID VS RETUR
- **Sales Order (Draft/Issued)**: Kasir/Sales membuat pesanan secara lokal (tersimpan langsung di IndexedDB / SQLite <50ms). Jika stok lokal cukup, nota langsung terbit. Plafon piutang yang terlampaui hanya memunculkan warning dan tidak memblokir checkout atau meminta approval Owner. Penjualan saat stok minus mengikuti kontrol pengecualian tersendiri: alasan wajib, konfirmasi tanggung jawab Owner, lalu konflik stok ditangani saat sinkronisasi.
- **Alokasi FEFO & Pengiriman Gudang**: Engine otomatis memotong lot dengan umur simpan terdekat (`daysLeft` terkecil). Gudang menyiapkan barang fisik dan mencetak/membagikan surat jalan.
- **Penyelesaian Transaksi**: Status berubah menjadi `COMPLETED` setelah transaksi sah atau pelunasan tempo dicatat.
- **Void vs Retur**:
  - **Void**: Pembatalan dokumen sebelum barang dikirim / diselesaikan (otorisasi PIN Owner). Memicu entri balik otomatis (`stockLedger`, `journals`, `receivables`, `auditTrail`).
  - **Retur**: Penanganan komplain mutu barang setelah diterima pelanggan, wajib disertai foto bukti kamera (MOD-08 / MOD-20). Barang retur masuk ke batch karantina (`isQuarantined = true`) agar tidak ikut terjual, serta mencatat pengurang tagihan/refund.

---

## 3. SIKLUS PEMBELIAN IMPOR, LANDED COST, & AP PAYMENTS (UTANG SUPPLIER)
- **Purchase Order (PO)**: Pencatatan pesanan kontainer reefer daging impor ke supplier luar beserta daftar kontak WhatsApp supplier.
- **Goods Receipt (Penerimaan Barang)**: Pencatatan fisik barang datang. Jika berat aktual berbeda dari PO, sistem mencatat berat aktual ke batch lot baru.
- **Landed Cost Allocation (BR-060)**: Biaya tambahan (Freight Laut, Bea Masuk, Cold Storage Handling) dialokasikan otomatis ke HPP efektif per KG dan memperbarui Moving Average HPP.
- **Supplier Invoice (AP)**: Tagihan resmi dari supplier yang membentuk saldo utang usaha (`supplierInvoices`) dengan badge status (`BELUM_LUNAS`, `CICILAN`, `LUNAS`) dan tombol tindak lanjut WhatsApp (**Quick Contact**).
- **AP Payments**: Pembayaran utang (Tunai / Transfer, Parsial, atau Pelunasan), lengkap dengan pembaruan jurnal dan saldo utang otomatis.

---

## 4. MANAJEMEN STOK, FEFO, YIELD LOSS, & KONVERSI PRODUK (TETELAN)
- **FEFO (First Expired, First Out)**: Pengeluaran stok otomatis memilih lot non-karantina dengan tanggal kedaluwarsa terdekat.
- **Yield & Cutting Loss Conversion (BR-051/052)**: Pemotongan daging primal dicatat melalui `OUT_CONVERSION` (mengeluarkan daging asal) dan dialokasikan ke produk turunan baru ber-HPP terhitung (misal "Tetelan / Daging Cincang" via `IN_CONVERSION`), sementara limbah/lemak tak bernilai dicatat terpisah via `OUT_CUTTING_LOSS`.
- **Stock Opname & Susut**: Penyesuaian stok berkala (MOD-07B) untuk mencatat *drip loss* atau susut *thawing* daging beku dengan perhitungan nilai selisih otomatis.

---

## 5. KONSINYASI, AFFILIATE, & PENANGANAN KOMISI
- **Barang Sendiri**: Ada fisik, ada HPP, ledger stok aktif.
- **Konsinyasi (Titipan)**: Ada fisik, tidak ada HPP awal, dicatat sebagai utang konsinyasi. Penyelesaian pembayaran dilakukan setelah barang terjual sesuai kesepakatan pemilik barang.
- **Affiliate / Digital**: Tidak ada fisik, tidak ada ledger stok. Komisi dicatat otomatis berdasarkan konfigurasi (`PERSEN` / `NOMINAL_PER_KG` / `NOMINAL_PER_PCS`) saat penjualan berhasil.

> Catatan: istilah dan mekanisme jurnal pada bagian lama tidak berarti pengguna harus mengoperasikan debit-kredit. Detail status laporan dan akuntansi profesional ditetapkan di Change Register Section 13.

---

## 6. ARSITEKTUR DATABASE LOKAL & MASTER ENTITAS

### A. Penyimpanan Lokal Web PWA — IndexedDB (`karkasia_erp_offline_db`)
- **`kv_state` (`engine_state_v1`)**: Menyimpan snapshot deterministik `BusinessEngineState` (produk, batch lot, pelanggan, piutang, PO, tagihan supplier, transaksi POS, ledger stok, jurnal akuntansi otomatis, jejak audit aktivitas, antrean persetujuan owner, dan `syncOutbox`).
- **`preferences`**: Menyimpan preferensi cepat antar sesi (`supplier_phones`, `last_payment_method`, `last_supplier`, dan `backend_adapter_config_v1`) sehingga konfigurasi tidak hilang saat `localStorage` dibersihkan browser.
- **Migrasi Otomatis & Kompatibilitas Data Lama**: `normalizePersistedState()` di `src/engine/businessEngine.ts` memigrasikan `localStorage` lama ke IndexedDB tanpa kehilangan data dan mempertahankan entitas/status existing.

### B. Flutter/APK — di luar scope aktif
- Kode/fondasi Flutter yang mungkin masih ada di repository diperlakukan sebagai arsip eksperimen, bukan target yang harus diselesaikan atau dipelihara untuk rilis PWA. Tidak ada kewajiban Drift, SQLCipher, FlutterSecureStorage, atau build APK pada roadmap aktif.

### C. Daftar Master Entitas Inti
1. `users` (RBAC: Owner, Admin, Sales + hash PIN 6-digit)
2. `customers` (CRM, Plafon utang, Tempo)
3. `suppliers` (Data supplier impor/lokal + nomor WhatsApp tersimpan)
4. `products` (Master produk, kategori, dual-unit KG/Pcs/Box)
5. `lots` (Batch/Lot daging, NKV, expired_date, landed cost, hpp_per_kg, status karantina)
6. `purchase_orders` & `goods_receipts` (Pembelian kontainer & penerimaan aktual)
7. `supplier_invoices` & `ap_payments` (Tagihan & pelunasan utang supplier)
8. `customer_tiers` & `product_prices` (Harga bertingkat & event bazar berjadwal)
9. `transactions` & `transaction_items` (POS invoice & rincian item)
10. `stock_ledger` (Append-only movement: IN_PURCHASE, OUT_SALE, IN_RETURN, OUT_ADJUST, OUT_CONVERSION, IN_CONVERSION, OUT_CUTTING_LOSS, OUT_QUARANTINE)
11. `stock_summary` (Materialized cache stok per produk/lot)
12. `conflict_cases` / `approvals` (Pencatatan konflik stok minus dan approval tindakan sensitif; plafon piutang tidak menggunakan approval)
13. `sync_outbox` (Antrean sinkronisasi offline dengan `idempotencyKey`, `status`: `PENDING` | `SYNCED` | `FAILED`, dan `serverSeq`)
14. `media_queue` (Antrean foto bukti retur / nota kas kecil max 720p)
15. `journals` & `audit_trail` (Jurnal otomatis dan log aktivitas yang dapat ditelusuri; tidak memakai hash-chain audit)

---

## 7. INTEGRASI GAS & PROTOKOL SINKRONISASI OUTBOX + PULL RECONCILIATION
- **Satu integrasi GAS aktif**: PWA menggunakan satu jalur komunikasi ke Google Apps Script Web App. GAS memvalidasi event, menerapkan idempotensi, memberi `serverSeq`, dan menyimpan event ke Google Sheets. Google Sheets bukan tabel bisnis yang boleh diubah langsung oleh tiap perangkat.
- **Tidak membangun multi-backend**: `REST_API`, `POSTGRES_BRIDGE`, `SUPABASE`, dan `ZIMAOS` dikeluarkan dari scope implementasi aktif. Jangan menambah konfigurasi, UI pemilihan backend, test matrix, atau dokumentasi operasional untuk alternatif tersebut. Abstraksi tipis boleh dipertahankan jika sudah dipakai kode, tetapi bukan proyek vendor-agnostic.
- **Operasi lokal dan sinkronisasi**: Saat offline, transaksi inti tetap disimpan ke IndexedDB dan masuk Outbox `PENDING`. Saat online, client melakukan push/pull ke GAS. Status `SYNCED` hanya diberikan setelah ACK eksplisit per UUID. Kegagalan jaringan tidak boleh menghapus transaksi lokal.
- **Kontrak GAS**: `health`, `sync_push`, `sync_pull`, `media_upload`, dan `media_download` memakai POST; shared secret dikirim di body, bukan URL. GAS mengelola event log append-only, idempotensi per Store ID, server sequence, pull per perangkat, lock untuk push bersamaan, dan pagination. Deployment aktual serta uji dua perangkat tetap wajib sebelum go-live.
- **Voice Order dan AI**: Pemrosesan yang memerlukan model AI dilakukan melalui endpoint/server GAS yang terkontrol. Fitur ini tidak menjadi backend sinkronisasi alternatif dan tidak boleh mengubah transaksi final tanpa validasi Business Engine.
- **Aturan Outbox, ACK, dan Pull Reconciliation**:
  - **Local-First Commit**: Semua mutasi engine inti di `src/engine/businessEngine.ts` (penjualan POS, pelunasan piutang, pelunasan utang supplier, pengeluaran/top-up kas kecil, opname, penerimaan barang, retur/karantina, void transaksi, konversi trimming/tetelan, promo bazar) dan DAOs inti Flutter menulis ke storage lokal terlebih dahulu serta membuat entri Outbox berstatus awal **`PENDING`**.
  - **Strict `SYNCED` Rule**: Status `SYNCED` (dan pengisian `serverSeq`) **hanya** diberikan lewat `applyOutboxSyncResults()` (Web) atau `SyncDao.acknowledgeOutboxSuccess()` (Flutter) setelah backend mengembalikan **ACK eksplisit** per UUID item (`acknowledgedIds` / `acks`). Item yang ditolak atau gagal jaringan ditandai `FAILED` dengan pesan galat; pada mode `LOCAL_ONLY`, antrean tetap `PENDING`.
  - **Tidak Ada Auto-Flush Wajib Tanpa Konfigurasi**: Perangkat tetap bekerja aman tanpa memaksa koneksi saat startup.
  - **Pull & Reconciliation (Web PWA)**: Setelah push, adapter menarik event dengan cursor `lastServerSeq`. Reducer menerapkan event berurutan dan idempoten untuk `SALE`, `PAYMENT` (piutang + utang supplier), `RETURN`, `VOID`, `PURCHASE`, `OPNAME` (termasuk produk/lot saldo awal), `CONVERSION`, `APPROVAL`, dan `MASTER_DATA`. Kekurangan stok atau referensi master yang tidak cocok dicatat di `remoteSyncConflicts`, bukan diam-diam diabaikan.
  - **GAS Phase 1**: `gas/Code.gs` menyediakan append-only event log, idempotensi per Store ID, server sequence, pull per perangkat, lock untuk push bersamaan, dan pagination 500 event. Panduan deployment ada di `gas/README.md`. Deployment aktual dan uji dua HP tetap wajib sebelum go-live.
  - **Prefix Device Invoice**: Nomor faktur menggunakan format `INV-{DEVICE_ID}-{YYMMDD}-{SEQ}`. Device ID dibuat per instalasi di localStorage dan tidak ikut diekspor ke backup; restore mempertahankan Device ID lokal agar perangkat berbeda tidak memakai prefix yang sama.

---

## 8. KEAMANAN, OTORISASI PERANGKAT, & BACKUP CADANGAN
- **Isolasi & Otorisasi Perangkat**:
  - IndexedDB diisolasi per origin HTTPS browser; di Flutter menggunakan `AppDatabase` + `FlutterSecureStorage`.
  - PIN Owner Web disimpan sebagai hash PBKDF2-HMAC-SHA256 dengan salt unik (100.000 iterasi); plaintext hanya diterima sementara untuk migrasi dan tidak disimpan kembali. Backup tidak mengekspor hash/salt dan restore mempertahankan kredensial perangkat aktif.
  - PIN bawaan awal ditandai wajib diganti; Void dan persetujuan sensitif ditolak sampai PIN bawaan diganti. Aksi berisiko dilindungi verifikasi PIN Owner 6-digit.
  - Kredensial adapter (endpoint, token, URL Supabase, ID Google Sheet) bersifat opsional dan dikonfigurasi oleh pengguna/admin tanpa hardcoded key di source code.
- **Backup & Restore Lokal**:
  - Ekspor/Impor cadangan lokal `.json` dilengkapi pemeriksaan checksum integritas (`computeIntegrityHash`) dan tetap dapat digunakan tanpa proses membuka kunci tambahan.
  - Ekspor PDF Archive ke Google Drive (`src/services/googleDriveService.ts`) hanya melakukan inisialisasi OAuth client-side secara *lazy on-demand* saat tombol ekspor Drive ditekan — tidak berjalan saat startup.
- **Batas Keamanan PWA (keputusan final UMKM)**:
  - PIN Owner yang sudah ada tetap menjadi satu-satunya PIN untuk otorisasi tindakan sensitif; tidak ada PIN kedua, passphrase, recovery key, atau autentikasi berlapis.
  - Shared Secret tetap dipakai untuk mengamankan komunikasi dengan GAS; bukan PIN Owner dan tidak diminta berulang kali dari pengguna.
  - Enkripsi lokal tambahan bukan prioritas rilis PWA saat ini. Fokus perlindungan data adalah backup/export yang mudah, import/restore yang teruji, migrasi aman, dan error penyimpanan yang terlihat. Jangan menambah passphrase, recovery key, PIN kedua, atau framework keamanan kompleks tanpa kebutuhan bisnis nyata.

---

## 9. ATURAN OPENING BALANCE & FORMAT CSV MIGRASI AWAL
Format standar migrasi awal saat Go-Live:
- **Stok Lot Awal**: `sku, lot_code, expiry_date, total_gram, total_pcs, cost_total_rupiah, supplier_code`
- **Piutang Pelanggan Awal**: `customer_code, invoice_no, amount_due_rupiah, due_date`
- **Utang Supplier Awal**: `supplier_code, reference_no, amount_due_rupiah, due_date`

---

## 10. DAFTAR 24 MODUL ERP & MATRIKS FUNGSIONAL
- **MOD-01**: First Run & Store Setup (`TOKO_ERP DAGING_01`)
- **MOD-02**: Users, PIN 6-digit & RBAC
- **MOD-03**: Master Produk & Dual-Unit (KG/Pcs/Box, Catch Weight)
- **MOD-04**: POS Unified Dual-Mode (Kasir Toko & Sales Lapangan, Struk Coret Ongkir, Uang Pas)
- **MOD-05**: Harga Bertingkat & Promo Bazar Berjadwal
- **MOD-06**: Manajemen Pelanggan & Plafon Utang Fleksibel
- **MOD-07**: Persediaan Gudang, FEFO, & Yield Loss Conversion (Trimming -> Tetelan)
- **MOD-07B**: Stock Opname, Drip Loss, & Karantina Lot
- **MOD-08**: Retur Penjualan & Pembelian (Wajib Foto Kamera via MOD-20)
- **MOD-09**: Pembelian Impor, Landed Cost PO, & Quick Contact WhatsApp Supplier
- **MOD-10**: Piutang Pelanggan, Aging Buckets, & Warning Jatuh Tempo
- **MOD-11**: Setoran Kas Sales, Soft Limit Rp 3jt, & Health Score Warning
- **MOD-12**: Kasir Kecil & OPEX (Foto Struk Terkompres)
- **MOD-13**: Kalkulator Pajak UMKM (0,5%) & Laporan Laba Bersih Sederhana
- **MOD-14**: Dashboard, Store Health Score, dan AI Advisor (ringkasan kondisi usaha berbasis data ERP; fungsi transaksi inti tetap offline-first dan tidak bergantung pada AI)
- **MOD-15**: Persetujuan Owner & Conflict Resolution (`approvals` / `conflict_cases`)
- **MOD-16**: Backup & Restore (JSON mencakup state dan seluruh lampiran, checksum integritas, backup-before-upgrade, serta pemeriksaan aman sebelum restore multi-device)
- **MOD-17**: Perangkat Pendukung (Barcode/QR Scanner Kamera + Undo Scan & Struk Cetak)
- **MOD-18**: Audit Trail & Jurnal Akuntansi Otomatis (Progressive Disclosure)
- **MOD-19**: Ekspor Dokumen PDF & CSV (`jspdf`, `jspdf-autotable`)
- **MOD-20**: Camera Document Capture & Compression (Retur & Nota OPEX)
- **MOD-21**: Voice Order Assistant (ucapan menjadi draft pesanan/transaksi; ekstraksi dapat memerlukan koneksi, validasi item/berat/harga/pelanggan dilakukan Business Engine).
- **MOD-22**: AI Advisor (analisis data ERP, ringkasan kondisi usaha, deteksi anomali, dan rekomendasi yang dapat ditelusuri ke data sumber).
- **MOD-23**: OCR Nota (foto nota → ekstraksi data → draft pembelian/OPEX → verifikasi pengguna sebelum disimpan).

---

## 11. STATUS AUDIT AKTUAL, CELAH TERVERIFIKASI, & ROADMAP LANJUTAN

### Patch yang sudah diterapkan pada Web PWA
1. **PIN Owner**: migrasi dari plaintext ke PBKDF2-HMAC-SHA256 + salt unik; hash/salt dikecualikan dari backup; PIN bawaan wajib diganti sebelum aksi sensitif.
2. **Retur**: wajib menemukan faktur COMPLETED, pelanggan harus cocok, produk harus tercantum pada faktur, dan total kuantitas retur tidak boleh melebihi kuantitas terjual dikurangi retur sebelumnya. Nilai refund dihitung dari nilai aktual baris faktur.
3. **Piutang**: pembayaran parsial didukung; metode Tunai menambah kas, Transfer menambah saldo bank; riwayat pembayaran disimpan dan pembalikan menghitung ulang per kanal pembayaran. Pembayaran ditolak bila saldo piutang agregat pelanggan tidak cukup/tidak valid; pembalikan ditolak bila kas atau bank tidak cukup, metode/nominal riwayat tidak valid, atau hasil pemulihan saldo tidak aman. Tidak ada clamp diam-diam yang membuat jurnal berbeda dari saldo.
4. **Multi-device**: GAS event gateway tersedia (gas/Code.gs), adapter melakukan push + pull, server cursor mencegah replay, dan reducer menggabungkan event transaksi serta master data. Konflik stok/referensi yang tidak cocok disimpan untuk rekonsiliasi.
5. **UI vs Business Engine**: edit harga/foto/galeri/master pelanggan/lokasi lot/PO tidak lagi menulis state langsung; jalur master data melewati mutator updateMasterData, validasi, audit trail, dan Outbox. Checkout tidak lagi memblokir tempo karena plafon; harga tier/promo dihitung ulang oleh Business Engine, dan diskon manual memerlukan PIN Owner aktif.

### Batas yang belum boleh dianggap selesai
- **GAS deployment**: source gateway tersedia, tetapi pemilik ERP harus membuat Spreadsheet, mengatur Script Properties, deploy Web App, dan menguji sinkronisasi minimal dua HP. Tanpa endpoint terdeploy, sinkronisasi multi-device belum terbukti operasional.
- **Validasi upload media server**: endpoint GAS kini menyediakan `media_upload` dan `media_download`, mewajibkan Script Property `SYNC_SHARED_SECRET`, membatasi file ke JPEG maksimal 1 MB, serta memakai nama deterministik per store + media ID. Kode sudah tersedia, tetapi tetap perlu redeploy GAS versi terbaru, memberi izin Google Drive, dan uji foto nyata dua perangkat; file Drive tetap privat mengikuti izin akun Google pemilik deployment.
- **Bukti foto retur Web PWA (LOKAL + SINKRONISASI DUA ARAH)**: foto aktual disimpan sebagai Blob di IndexedDB `media_blobs`. ID foto ikut payload event retur; perangkat pengirim mengunggah foto melalui GAS/Drive, sedangkan perangkat penerima mengunduh foto berdasarkan `storeId + mediaId` saat sinkronisasi. Unduhan yang gagal dicoba ulang pada sinkronisasi berikutnya. `evidenceRemoteFileId` hanya metadata lokal; pengambilan lintas perangkat menggunakan ID media stabil, bukan Drive file ID.
- **Flutter media sync (BELUM TERINTEGRASI END-TO-END)**: worker dan adapter upload ada, tetapi jalur produksi yang memasukkan file nyata ke `media_queue` belum terbukti. Patch ini hanya menutup jalur Web PWA; jangan menganggap Flutter ikut tersinkron.
- **Backup/Restore lampiran Web PWA (SUDAH DIIMPLEMENTASIKAN)**: file backup JSON sekarang menyertakan seluruh Blob pada `media_blobs` sebagai Base64 beserta `attachmentsChecksum`. Restore memvalidasi checksum lampiran, meminta PIN Owner seperti sebelumnya, lalu memulihkan Blob ke IndexedDB dengan `mediaId` asli. Backup lama tanpa lampiran tetap didukung.
- **Jalur pembelian tunai**: pembuatan PO dan supplier invoice masih perlu diselesaikan sebagai mutasi keuangan terpisah agar pembayaran tunai saat PO dibuat memengaruhi kas dan jurnal secara tepat.
- **Flutter APK**: belum dibangun atau diuji; pekerjaan ini hanya memverifikasi jalur Web PWA.
- **Verifikasi UI visual**: audit ini bersifat source/logic audit. Pengujian screenshot, perangkat HP nyata, ukuran layar, aksesibilitas, dan alur offline dua perangkat tetap diperlukan.

### Prioritas PWA berjalan
1. **Backup/Export & Import/Restore JSON beserta seluruh lampiran**: satu alur sederhana; export wajib gagal dengan pesan jelas bila state atau satu lampiran tidak bisa dibaca, dan restore wajib memvalidasi file/PIN sebelum mengganti data.
2. **Migrasi aman dengan backup-before-upgrade + guard versi**: simpan salinan state lama sebelum perubahan struktur; jika migrasi gagal, batalkan perubahan dan pertahankan data lama. Hindari framework migrasi berlapis yang tidak diperlukan.
3. **XSS hygiene**: React harus merender input pengguna sebagai teks; hindari dangerouslySetInnerHTML kecuali ada kebutuhan yang benar-benar terbukti.
4. **Diagnostics sederhana**: console.error dan tampilan error penyimpanan terakhir yang bisa dilihat Owner/Admin; tanpa telemetry atau metrics.
5. **Token GAS di body** tetap dipertahankan karena perubahan kecil dan isolatif, tetapi bukan blocker utama.
6. Pastikan upload/unduh foto, sinkronisasi GAS, dan update PWA punya status yang jelas; fitur yang belum diuji terhadap deployment nyata tidak boleh dinyatakan selesai.
7. Jalankan lint, seluruh test, dan production build pada commit yang sama sebelum menyatakan PWA siap.

### CI
Status CI harus mengikuti hasil GitHub Actions terbaru untuk commit pada main; jangan menyalin hasil test/build dari commit lama sebagai bukti untuk patch baru.

---

## 12. PRINSIP DESAIN UI/UX MOBILE-FIRST & CLEAN LUXURY

### A. Arah Desain Produk
- **Keputusan desain utama: Mobile-First PWA.** Pengalaman HP menjadi acuan utama karena Owner dan Sales sering menggunakan ERP DAGING melalui smartphone. Layout desktop merupakan adaptasi responsif dari pengalaman mobile, bukan sebaliknya.
- **Clean Luxury / Premium Visual.** Antarmuka harus terlihat modern, bersih, elegan, matang, dan profesional. Sederhana yang dimaksud adalah cara penggunaan dan alur kerja, bukan tampilan visual yang polos, murah, atau minim kualitas.
- **Simple Workflow.** Pengguna awam harus dapat menyelesaikan pekerjaan rutin dengan langkah sesedikit mungkin, label yang mudah dipahami, input seperlunya, default yang masuk akal, dan bantuan validasi otomatis dari Business Engine.
- **Professional by Default.** UI operasional tetap ringan dan mudah digunakan, sementara laporan, perhitungan, ledger, audit trail, HPP, dan kontrol bisnis tetap lengkap di belakangnya.
- Prinsip ringkas: **Premium Look. Effortless Experience.**

### B. Karakter Visual
- Gunakan dasar warna putih bersih atau ivory/off-white, dengan navy atau charcoal sebagai warna utama.
- Champagne gold boleh digunakan sebagai aksen premium secara terbatas; jangan menjadikannya warna dominan atau mengurangi keterbacaan.
- Gunakan tipografi modern, jelas, konsisten, dan memiliki hierarki yang tegas untuk judul, label, angka, serta status.
- Gunakan spacing yang lega, alignment rapi, ikon konsisten, radius komponen yang halus, border tipis, dan shadow lembut seperlunya.
- Status penting seperti berhasil, peringatan, gagal, stok menipis, dan mendekati kedaluwarsa harus mudah dibedakan serta tidak hanya mengandalkan warna.
- Hindari ornamen berlebihan, gradient mencolok, terlalu banyak warna, grafik dekoratif, kartu bertumpuk tanpa fungsi, teks terlalu kecil, dan layar yang terasa padat.
- Visual premium tidak boleh mengorbankan performa PWA, aksesibilitas, keterbacaan, atau kenyamanan perangkat kelas menengah.

### C. Pola Interaksi Mobile
- Navigasi utama di HP menggunakan **bottom navigation** untuk akses cepat dengan ibu jari. Menu sekunder dan fungsi yang jarang dipakai ditempatkan di halaman "Lainnya" atau area menu kontekstual.
- Letakkan aksi utama pada area yang mudah dijangkau, dengan ukuran target sentuh yang nyaman dan jarak antartombol yang mencegah salah tekan.
- Form dibuat ringkas, satu kolom bila sesuai, memakai pilihan/default otomatis, pencarian, keypad numerik untuk angka, serta validasi dekat dengan field terkait.
- Hindari tabel lebar di HP. Sajikan daftar atau ringkasan yang mudah dipindai; detail lengkap dibuka pada halaman detail atau bagian yang dapat diperluas.
- Angka operasional penting—berat, harga, total transaksi, stok, piutang, dan utang—harus mudah dibaca dan memiliki format konsisten.
- Berikan feedback yang jelas setelah aksi: loading, berhasil, gagal, perlu tindakan, atau data masih tersimpan lokal dan menunggu sinkronisasi.
- Jangan membuat interaksi bergantung pada hover. Pastikan fungsi penting tetap berjalan dengan sentuhan dan keyboard.
- Perhatikan safe area perangkat, keyboard virtual, orientasi layar, koneksi tidak stabil, serta kondisi PWA terpasang maupun dibuka dari browser.

### D. Pengalaman Berdasarkan Role
- **Sales:** fokus pada aktivitas penjualan. Alur utama yang dituju: pilih pelanggan (atau pelanggan umum) → pilih produk → masukkan berat/jumlah → periksa ringkasan → pilih pembayaran → simpan dan tampilkan bukti transaksi. Opsi tambahan hanya ditampilkan saat relevan. Sales tidak dibebani menu administrasi.
- **Admin:** fokus pada pekerjaan operasional seperti pembelian/penerimaan, persediaan, pelanggan/supplier, piutang/utang, dan OPEX. Aksi rutin dibuat langsung dan jelas; kontrol tambahan hanya muncul ketika kondisi transaksi memang memerlukannya.
- **Owner:** fokus pada ringkasan usaha, laporan, pengaturan kebijakan, pengguna, serta pengecualian yang benar-benar membutuhkan perhatian. Owner tidak dijadikan bottleneck untuk pekerjaan rutin yang dapat divalidasi otomatis.
- Navigasi dan halaman menyesuaikan hak akses masing-masing role. Menyederhanakan tampilan tidak boleh mengurangi otorisasi, validasi, pencatatan, atau audit trail.

### E. Adaptasi Desktop
- Desktop menggunakan ruang layar lebih luas untuk menampilkan navigasi samping, ringkasan multi-kolom, dan tabel yang relevan.
- Struktur informasi, istilah, aturan bisnis, serta hasil transaksi harus konsisten antara HP dan desktop.
- Jangan membuat dua workflow bisnis berbeda hanya karena ukuran layar berbeda. Perbedaan hanya pada penyusunan layout dan cara penyajian informasi.

### F. Batasan Implementasi dan Kriteria Penerimaan
- Bagian ini menetapkan arah dan prinsip UI/UX, bukan mengubah aturan bisnis, skema data, Business Engine, hak akses, atau keputusan arsitektur Local-First yang sudah ada.
- Seluruh aturan bisnis dan validasi tetap bersumber dari Business Engine; komponen UI tidak boleh membuat aturan transaksi tandingan.
- Jangan mengubah keputusan bisnis yang sudah ditetapkan hanya demi menyederhanakan tampilan. Jika ditemukan konflik antara UI dan aturan bisnis, pertahankan aturan bisnis dan laporkan konflik tersebut.
- Implementasi UI harus diuji pada viewport HP yang umum, termasuk layar kecil, serta desktop. Uji alur utama per role, kondisi offline, keyboard terbuka, validasi gagal, dan feedback penyimpanan.
- Kriteria hasil: pengguna dapat menyelesaikan tugas rutin dengan langkah yang ringkas dan jelas; informasi penting mudah ditemukan; tampilan terasa premium dan konsisten; tidak ada fungsi penting yang tersembunyi atau sulit disentuh; serta perilaku bisnis tetap sama dengan engine.
- Detail seperti susunan final bottom navigation, komposisi dashboard, komponen POS, ukuran tipografi, dan token desain ditetapkan saat tahap desain/implementasi setelah diuji pada layar HP nyata. Jangan menganggap contoh mockup sebagai keputusan menu final.


## 2026-11-14 — GAS transport hardening (Web PWA)

- Google Apps Script webhook health checks and event pulls use POST with `text/plain;charset=utf-8`; the shared secret is sent in the JSON request body, never in the URL.
- GAS accepts `health` and `sync_pull` through authenticated POST. GET requests for these actions are rejected, and query-string credentials are explicitly rejected.
- The existing `sync_push`, `media_upload`, and `media_download` request contracts remain unchanged. GAS now requires the configured `SYNC_SHARED_SECRET` for all POST actions, including sync push.
- Adapter tests assert that health/pull URLs contain no token and that the POST body carries the expected shared secret and pull parameters.
- Deployment verification is still required: redeploy `gas/Code.gs`, set Script Property `SYNC_SHARED_SECRET`, then verify health and pull against the live `/exec` URL. Repository CI cannot prove Google Apps Script redirect behavior or deployment configuration.


## 2026-11-14 — IndexedDB migration safety & PWA update guard (Web PWA)

- IndexedDB database version advances from 2 to 3. Existing stores are preserved; the upgrade adds `migration_backups` and `migration_meta`.
- Before the v2-to-v3 upgrade completes, the current `kv_state/engine_state_v1` snapshot is copied into a pre-v3 backup record in the same IndexedDB version-change transaction. If reading the snapshot fails, the upgrade transaction aborts, leaving the prior database version intact.
- A read helper exposes the pre-v3 snapshot for recovery tooling. No business-state fields are transformed in this migration, so `ENGINE_SCHEMA_VERSION` remains 1; IndexedDB database version and engine payload schema version remain separate.
- PWA service-worker updates now use prompt mode. The app asks before activating a new worker and reloading; declining keeps the current app session running.
- Regression tests cover fresh database creation, v2-to-v3 backup planning, and idempotent opening of v3 databases.
- This is a storage-safety foundation, not yet a multi-version business-payload migration framework. Future payload changes must add explicit transforms and recovery tests before changing `ENGINE_SCHEMA_VERSION`.


---

## 13. CHANGE REGISTER — PENYEDERHANAAN TANPA MENGURANGI KEMAMPUAN ERP (V4.6)

Bagian ini adalah keputusan terbaru. Jika ada detail pada Section 1–12 yang masih menyebut platform, backend, workflow, atau kontrol yang bertentangan, Change Register ini yang berlaku. Perubahan ini menyederhanakan pengalaman penggunaan dan beban implementasi; bukan memangkas kemampuan bisnis ERP DAGING.

### 13.1 Prinsip Produk yang Dikunci
- **Misi produk**: pengguna UMKM dapat menjalankan bisnis tanpa harus memahami akuntansi atau prosedur ERP yang rumit. ERP mengolah transaksi, kontrol, perhitungan, dan laporan secara profesional di belakang layar.
- **UI sederhana, mesin ERP profesional**: sederhanakan layar, istilah, input, dan langkah kerja; jangan menyederhanakan akurasi data, aturan bisnis, ledger, validasi, atau keluaran laporan.
- **Fitur pembeda tetap dipertahankan**: OCR Nota, AI Advisor, dan Voice Order tetap bagian dari scope produk. Ketiganya bukan fitur yang dihapus demi penyederhanaan.
- **Laporan tetap lengkap**: penyederhanaan antarmuka tidak mengurangi laporan penjualan, margin, HPP, persediaan, pembelian, landed cost, piutang, utang, kas, bank, OPEX, pajak, laba rugi, audit, dan rekonsiliasi.
- **Bukan aplikasi akuntansi untuk pengguna**: pengguna berinteraksi dengan istilah operasional sehari-hari. Jurnal dan perhitungan akuntansi dibentuk otomatis oleh Business Engine; tidak ada keharusan pengguna membuat jurnal manual atau memahami debit-kredit.

### 13.2 Status Keputusan: KEEP
Hal berikut tetap menjadi kemampuan inti dan tidak boleh dihapus hanya untuk mengecilkan scope:
- Model multi-device maksimal 8 perangkat: 1 Owner, 2 Admin, 5 Sales.
- PWA installable dan Local-First; IndexedDB per perangkat.
- Sinkronisasi GAS, Outbox, ACK, idempotency, UUID, server sequence, pull, dan conflict detection.
- POS, pembelian/penerimaan, FEFO, lot, landed cost, HPP per lot, yield/conversion, susut, dan quarantine.
- OWN, CONSIGNMENT, AFFILIATE beserta perlakuan stok dan kewajiban masing-masing.
- Pembayaran CASH/TRANSFER/TEMPO/campuran, pembayaran piutang parsial, pembayaran utang, kas, bank, dan OPEX.
- Retur tervalidasi terhadap faktur dan kuantitas yang telah diretur; void/reversal tercatat dan tidak menghapus sejarah transaksi.
- Audit trail operasional yang dapat ditelusuri; ledger append-only untuk pergerakan stok dan koreksi melalui reversal/adjustment.
- Backup/export JSON dan import/restore beserta seluruh lampiran; checksum integritas; backup-before-upgrade dan guard migrasi.
- OCR Nota: foto nota menghasilkan draft data pembelian atau OPEX yang dapat diperiksa pengguna.
- AI Advisor: analisis data aktual ERP, ringkasan, deteksi anomali, dan rekomendasi bisnis. Hasil harus menunjukkan periode/data dasar dan dapat ditelusuri; AI bukan sumber angka resmi.
- Voice Order: ucapan menjadi draft pesanan/transaksi. Sistem harus menampilkan hasil pengenalan untuk diperiksa sebelum transaksi final.
- Laporan profesional dan lengkap, termasuk laba rugi, margin, HPP, stok, AR/AP, umur tagihan, kas/bank, OPEX, pajak, dan rekonsiliasi sesuai data yang tersedia.

### 13.3 Status Keputusan: SIMPLIFY
- **Platform aktif**: PWA saja. Flutter/APK tidak menjadi target implementasi aktif.
- **Backend aktif**: satu Google Apps Script Web App (GAS) sebagai gateway sinkronisasi; Google Sheets sebagai event log. Tidak ada backend alternatif aktif.
- **Abstraksi**: gunakan integrasi GAS yang tipis dan mudah diuji. Pertahankan interface yang sudah ada hanya jika membantu struktur kode; jangan membangun framework multi-vendor atau adapter plugin.
- **Database lokal**: IndexedDB sebagai penyimpanan aktif PWA. Tidak perlu menjaga dua implementasi database aktif.
- **Sinkronisasi**: satu protokol push/pull dengan ACK eksplisit, idempotency, cursor/serverSeq, dan status error yang terlihat. Hindari jalur sinkronisasi paralel.
- **Approval**: aktivitas rutin yang lolos validasi otomatis berjalan langsung. Approval/otorisasi hanya untuk tindakan sensitif dan pengecualian yang memiliki risiko nyata.
- **UI per role**: Sales fokus penjualan; Admin fokus operasional; Owner fokus laporan, kebijakan, dan pengecualian. Menu dan input yang tidak relevan tidak ditampilkan.
- **Workflow**: transaksi dibuat sebagai draft hanya ketika memang perlu pemeriksaan; setelah data valid, pengguna dapat menyimpan tanpa approval berulang.
- **AI/OCR/Voice**: satu jalur pemrosesan terkontrol. Hasil OCR dan Voice masuk sebagai draft; AI Advisor membaca data ERP dan tidak menulis transaksi final.
- **Backup**: satu format backup utama yang mencakup state dan lampiran, dengan kegagalan eksplisit jika ada bagian tidak terbaca. Restore multi-device harus memeriksa status sinkronisasi agar tidak menimpa transaksi lebih baru.

### 13.4 Status Keputusan: REMOVE FROM ACTIVE SCOPE
- Flutter/APK, Drift, SQLCipher Flutter, serta pekerjaan build Android.
- Backend alternatif REST API, PostgreSQL Bridge, Supabase, dan ZimaOS sebagai implementasi yang harus dipelihara.
- UI pemilihan backend, konfigurasi multi-provider, dan test matrix untuk provider yang tidak aktif.
- Multi-gudang, multi-cabang, stok kendaraan, payroll, komisi Sales, e-commerce/marketplace, integrasi e-Faktur, GPS, dan full General Ledger workflow.
- Enterprise SSO, PIN kedua, passphrase backup, recovery key, hash-chained audit, serta enkripsi tambahan berlapis tanpa kebutuhan bisnis yang terbukti.
- Approval Owner untuk setiap transaksi rutin, pencatatan jurnal manual oleh pengguna, dan prosedur yang hanya menambah klik tanpa kontrol nyata.

### 13.5 Status Keputusan: DEFER IMPLEMENTATION — FITUR TETAP BAGIAN PRODUK
- Pengembangan lanjutan OCR untuk variasi layout nota, peningkatan akurasi ekstraksi, dan perluasan field.
- Pengembangan lanjutan AI Advisor: analisis tren, margin, stok lambat, piutang, anomali, dan rekomendasi yang lebih kaya.
- Pengembangan lanjutan Voice Order: variasi aksen/bahasa, istilah produk daging, koreksi hasil pengenalan, dan konfirmasi draft.
- Penyempurnaan laporan lanjutan dan visualisasi manajerial.
- Penjadwalan backup otomatis atau retensi arsip tambahan hanya jika kebutuhan operasional dan kapasitas penyimpanan sudah terukur.

### 13.6 Aturan Keamanan Fitur Cerdas
- OCR dan Voice Order tidak boleh langsung memposting transaksi final. Keduanya menghasilkan draft dengan field yang dapat diperiksa dan dikoreksi.
- AI Advisor hanya memberi analisis/rekomendasi. Angka resmi tetap dihitung Business Engine dari transaksi dan ledger, bukan dihasilkan atau ditebak oleh AI.
- AI tidak boleh mengubah stok, harga, pembayaran, jurnal, piutang, atau utang tanpa tindakan eksplisit pengguna melalui workflow normal.
- Jika layanan AI tidak tersedia atau perangkat offline, transaksi inti tetap berjalan. Fitur yang memerlukan pemrosesan server menampilkan status tidak tersedia dan dapat dicoba kembali; tidak boleh memblokir POS atau pencatatan operasional.
- Data yang dikirim untuk pemrosesan AI harus dibatasi sesuai kebutuhan. Akses mengikuti role dan kebijakan server; jangan mengirim kredensial atau data sensitif yang tidak diperlukan.

### 13.7 Risiko Multi-Device yang Wajib Dijelaskan
- Setiap perangkat boleh membuat transaksi offline berdasarkan data lokal terakhir. Karena stok pusat dibagi oleh beberapa perangkat, stok yang terlihat saat offline bukan jaminan stok global real-time.
- Jika dua perangkat menjual stok yang sama saat offline, seluruh transaksi tetap dipertahankan. Setelah sinkronisasi, sistem harus mendeteksi potensi stok minus/oversell, menampilkan konflik, dan menyediakan rekonsiliasi yang tercatat; jangan menghapus atau diam-diam membatalkan penjualan yang sudah terjadi.
- Kebijakan transaksi stok minus yang telah ditetapkan tetap berlaku: alasan wajib dan konfirmasi tanggung jawab Owner; konflik hasil sinkronisasi ditangani melalui proses rekonsiliasi.
- Restore pada satu perangkat tidak boleh diam-diam mengganti data lebih baru yang sudah tersinkron dari perangkat lain. Restore harus Owner-only, membuat backup sebelum tindakan, memeriksa versi/cursor sinkronisasi, dan menghentikan proses bila rekonsiliasi aman tidak dapat dijamin.

### 13.8 Batas Akuntansi dan Laporan
- Pengguna tidak diwajibkan memahami chart of accounts, debit-kredit, atau membuat jurnal manual.
- Business Engine tetap membentuk catatan keuangan yang diperlukan untuk menghasilkan laporan secara konsisten. Penyederhanaan bukan alasan menghilangkan sumber perhitungan atau jejak audit.
- Laporan harus memiliki periode, filter, definisi angka, dan kemampuan menelusuri angka ringkasan ke transaksi sumber.
- Pajak mengikuti konfigurasi dan kebijakan yang telah ditetapkan; laporan pajak bukan klaim bahwa aplikasi menggantikan konsultasi atau pelaporan resmi perpajakan.
- Jangan menyebut laporan “akuntansi lengkap” bila fondasi data atau rekonsiliasinya belum mendukung. Tandai keterbatasan data secara eksplisit.

### 13.9 Kriteria Penerimaan Penyederhanaan
- Pengguna Sales dapat menyelesaikan penjualan rutin dengan alur singkat tanpa membuka menu administrasi.
- Admin dapat menjalankan pembelian, penerimaan, stok, AR/AP, dan OPEX tanpa approval Owner untuk aktivitas rutin yang valid.
- Owner dapat melihat laporan dan pengecualian tanpa harus memproses setiap transaksi.
- Offline tidak memblokir transaksi inti; status pending sync dan konflik terlihat jelas.
- OCR/Voice menghasilkan draft yang dapat diperiksa; AI Advisor menghasilkan analisis yang dapat ditelusuri dan tidak mengubah transaksi.
- Backup/restore mencakup semua lampiran dan tidak memberi pesan sukses bila ada data yang gagal dibaca.
- Tidak ada perubahan aturan bisnis yang sudah dikunci hanya demi menyederhanakan UI. Perubahan aturan harus dicatat terpisah dengan alasan dan bukti.
