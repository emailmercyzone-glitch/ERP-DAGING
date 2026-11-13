# BLUEPRINT SOLID ERP DAGING IMPORT UMKM (V4.5 - LOCAL-FIRST & VENDOR-AGNOSTIC ADAPTER)
Project: ERP DAGING
Output: Progressive Web App (PWA) Installable + Fondasi Arsitektur Flutter Local-First (Menunggu Build Setup Android)
Versi: 4.5 (Refactoring Local-First & Pencabutan Ketergantungan Vendor/Server)
Status: SINGLE SOURCE OF TRUTH - Selaras dengan `README.md` & `README_PATCH.md`
Stack Aktif (Web PWA): React 18 + TypeScript + Vite PWA (`vite-plugin-pwa` + Workbox) + Tailwind CSS + IndexedDB (`karkasia_erp_offline_db`) + `BackendAdapter`
Fondasi Mobile (Flutter `/lib/`): Dart + Riverpod + Drift SQLite/SQLCipher + `BackendAdapter` (Belum siap build APK — lihat Section 11)
Prinsip Utama: Local-First, Server Bukan Syarat Startup, Vendor-Agnostic Adapter, Zero-Float Ledger, Praktis Ala UMKM Lapangan

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

## 1. RINGKASAN EKSEKUTIF & PRINSIP ARSITEKTUR LOCAL-FIRST (V4.5)
- **Keputusan Arsitektur Terbaru (Local-First & Vendor-Agnostic)**:
  - **Server Bukan Keputusan Permanen**: Aplikasi web PWA maupun fondasi kode Flutter wajib beroperasi penuh tanpa internet, tanpa server pusat, dan tanpa autentikasi cloud pada saat startup.
  - **Mode Default `LOCAL_ONLY`**: Saat pertama kali dijalankan (`DEFAULT_BACKEND_CONFIG` di Web maupun `AppConfig.defaultAdapterType` di Flutter), adapter aktif adalah **`LOCAL_ONLY`** (`requiresNetwork = false`). Seluruh transaksi POS, penerimaan barang, stok FEFO, jurnal, dan piutang/utang langsung jalan 100% di penyimpanan lokal perangkat.
  - **Backend Adapter Interface yang Dapat Ditukar**: Seluruh komunikasi sinkronisasi dan parser eksternal diabstraksikan melalui kontrak **`BackendAdapter`** (`src/adapters/backendAdapter.ts` pada Web dan `lib/core/backend/backend_adapter.dart` pada Flutter). Mengganti backend antara `LOCAL_ONLY`, `REST_API`, `ZIMAOS`, `POSTGRES_BRIDGE`, `GOOGLE_SHEETS`, atau `SUPABASE` (opsional) **tidak mengubah UI, Business Engine, maupun aturan akuntansi/stok ERP**.
  - **PWA Offline-First (Web Runtime Aktif)**: Menggunakan **Workbox Service Worker** dan **IndexedDB (`karkasia_erp_offline_db`)** dengan migrasi aman dari `localStorage` lama (`normalizePersistedState` menjaga kompatibilitas data terdahulu).
- **Skala Operasional**: Maksimal 1 Owner, 2 Admin, 5 Sales (~8 perangkat); <= 500 SKU; <= 200 transaksi/hari.
- **Model Stok**: Sentral di gudang pusat. Sales menjual dari stok pusat tanpa muat barang di kendaraan (*no vehicle stock*). Pengiriman fisik diatur oleh gudang setelah order diverifikasi.
- **Karakter Data (Zero-Float Policy)**:
  - Angka mata uang menggunakan integer utuh Rupiah (`BIGINT` / `INTEGER` / `Math.round` IDR).
  - Berat menggunakan integer utuh Gram (`INTEGER`, misal 1 kg = 1000 gram).
  - Zero float untuk menghindari *rounding error*.
- **Immutable Ledger**: Tabel/log pergerakan stok (`stock_ledger` / `stockLedger`) dan event transaksi bersifat append-only (insert-only). Koreksi wajib melalui transaksi balik (`VOID_REVERSAL`) atau penyesuaian tercatat.

---

## 2. ALUR TRANSAKSI PENJUALAN, PENGIRIMAN, & VOID VS RETUR
- **Sales Order (Draft/Issued)**: Kasir/Sales membuat pesanan secara lokal (tersimpan langsung di IndexedDB / SQLite <50ms). Jika stok lokal cukup, nota langsung terbit. Jika stok tidak cukup, transaksi ditolak tanpa stok negatif atau lot virtual. Jika plafon kredit terlewati, transaksi TEMPO tetap dapat dicatat dengan peringatan non-blocking; tidak membutuhkan persetujuan Owner.
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

---

## 6. ARSITEKTUR DATABASE LOKAL & MASTER ENTITAS

### A. Penyimpanan Lokal Web PWA — IndexedDB (`karkasia_erp_offline_db`)
- **`kv_state` (`engine_state_v1`)**: Menyimpan snapshot deterministik `BusinessEngineState` (produk, batch lot, pelanggan, piutang, PO, tagihan supplier, transaksi POS, ledger stok, jurnal akuntansi otomatis, jejak audit ber-hash, antrean persetujuan owner, dan `syncOutbox`).
- **`preferences`**: Menyimpan preferensi cepat antar sesi (`supplier_phones`, `last_payment_method`, `last_supplier`, dan `backend_adapter_config_v1`) sehingga konfigurasi tidak hilang saat `localStorage` dibersihkan browser.
- **Migrasi Otomatis & Kompatibilitas Data Lama**: `normalizePersistedState()` di `src/engine/businessEngine.ts` memigrasikan `localStorage` lama ke IndexedDB tanpa kehilangan data dan mempertahankan entitas/status existing.

### B. Penyimpanan Lokal Flutter — Drift SQLite/SQLCipher (`lib/core/database/`)
- Menggunakan `AppDatabase` (Drift) dengan proteksi trigger immutable SQLite (`prevent_stock_ledger_update`, `prevent_stock_ledger_delete`), `SyncOutboxTable` (`sync_outbox`), dan `FlutterSecureStorage` untuk kunci enkripsi & konfigurasi adapter.

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
12. `conflict_cases` / `approvals` (Permintaan override limit/stok minus terpisah dari event immutable)
13. `sync_outbox` (Antrean sinkronisasi offline dengan `idempotencyKey`, `status`: `PENDING` | `SYNCED` | `FAILED`, dan `serverSeq`)
14. `media_queue` (Antrean foto bukti retur / nota kas kecil max 720p)
15. `journals` & `audit_trail` (Jurnal double-entry otomatis & log aktivitas ber-checksum SHA)

---

## 7. BACKEND ADAPTER INTERFACE & PROTOKOL SINKRONISASI OUTBOX (ACK-ONLY)
- **Kontrak `BackendAdapter`**:
  - Web: `src/adapters/backendAdapter.ts` (`BackendAdapter`, `executeOutboxSyncWithAdapter` di `src/adapters/adapterRegistry.ts`)
  - Flutter: `lib/core/backend/backend_adapter.dart` (`BackendAdapter`, `backendAdapterProvider` di `lib/core/backend/backend_adapter_provider.dart`)
  - Operasi standar: `checkHealth()`, `pushOutbox(...)`, `pullChanges(...)`, `parseVoiceOrder(...)`, serta `uploadArchiveDocument(...)` opsional.
- **Adapter yang Tersedia**:
  1. `LOCAL_ONLY` (`LocalOnlyBackendAdapter` / `LocalOnlyBackendAdapter` Dart): **Default aktif**. Operasional 100% lokal tanpa panggilan jaringan, tidak memalsukan status `SYNCED`.
  2. `REST_API` (`RestApiBackendAdapter`): Server HTTP/JSON umum (`/health`, `/sync/push`, `/sync/pull`, `/ai/voice-parse`).
  3. `ZIMAOS` (`RestApiBackendAdapter` mode ZimaOS): Opsi server self-hosted lokal/tunnel — setara sebagai adapter yang dapat diganti kapan saja.
  4. `POSTGRES_BRIDGE` (`RestApiBackendAdapter` mode PostgreSQL Bridge): Gateway HTTP mandiri ke PostgreSQL (PostgREST/Node/Go bridge).
  5. `GOOGLE_SHEETS` (`GoogleSheetsBackendAdapter`): Pengiriman payload Outbox ke webhook Google Apps Script atau Google Sheets API v4 (`spreadsheets.values.append`).
  6. `SUPABASE` (`SupabaseBackendAdapter`): Opsi opsional jika pengguna mengisi URL & Anon Key Supabase milik sendiri (RPC `sync_push` / tabel `sync_outbox`).
- **Aturan Ketat Outbox & ACK**:
  - **Local-First Commit**: Semua mutasi engine inti di `src/engine/businessEngine.ts` (penjualan POS, pelunasan piutang, pelunasan utang supplier, pengeluaran/top-up kas kecil, opname, penerimaan barang, retur/karantina, void transaksi, konversi trimming/tetelan, promo bazar) dan DAOs inti Flutter menulis ke storage lokal terlebih dahulu serta membuat entri Outbox berstatus awal **`PENDING`**.
  - **Strict `SYNCED` Rule**: Status `SYNCED` (dan pengisian `serverSeq`) **hanya** diberikan lewat `applyOutboxSyncResults()` (Web) atau `SyncDao.acknowledgeOutboxSuccess()` (Flutter) setelah backend mengembalikan **ACK eksplisit** per UUID item (`acknowledgedIds` / `acks`). Item yang ditolak atau gagal jaringan ditandai `FAILED` dengan pesan galat; pada mode `LOCAL_ONLY`, antrean tetap `PENDING`.
  - **Tidak Ada Auto-Flush Wajib Tanpa Konfigurasi**: Perangkat tetap bekerja aman tanpa memaksa koneksi saat startup.
  - **Prefix Device Invoice**: Penomoran invoice menggunakan format `INV-{DEVICE_ID}-{YYMMDD}-{SEQ}` guna mencegah bentrok antar perangkat kasir dan sales lapangan.

---

## 8. KEAMANAN, OTORISASI PERANGKAT, & BACKUP CADANGAN
- **Isolasi & Otorisasi Perangkat**:
  - IndexedDB diisolasi per origin HTTPS browser; di Flutter menggunakan `AppDatabase` + `FlutterSecureStorage`.
  - Void transaksi wajib memverifikasi PIN Owner 6-digit di lapisan Business Engine, bukan hanya mengandalkan validasi UI. Plafon kredit hanya warning dan stok tidak cukup ditolak; keduanya bukan jalur override Owner.
  - **Celah keamanan Web yang masih terbuka:** `ownerPin` saat ini masih berupa string plaintext di state lokal dan nilai awal engine masih `123456`. Hashing PIN, penghapusan default PIN bersama, serta penyimpanan verifier yang aman wajib diselesaikan sebelum penggunaan produksi.
  - Kredensial adapter (endpoint, token, URL Supabase, ID Google Sheet) bersifat opsional dan dikonfigurasi oleh pengguna/admin tanpa hardcoded key di source code.
- **Backup & Restore Berlapis**:
  - Ekspor/Impor cadangan lokal `.json` dilengkapi pemeriksaan checksum integritas (`computeIntegrityHash`).
  - Ekspor PDF Archive ke Google Drive (`src/services/googleDriveService.ts`) hanya melakukan inisialisasi OAuth client-side secara *lazy on-demand* saat tombol ekspor Drive ditekan — tidak berjalan saat startup.

---

## 9. ATURAN OPENING BALANCE & FORMAT CSV MIGRASI AWAL
Format standar migrasi awal saat Go-Live:
- **Stok Lot Awal**: `sku, lot_code, expiry_date, total_gram, total_pcs, cost_total_rupiah, supplier_code`
- **Piutang Pelanggan Awal**: `customer_code, invoice_no, amount_due_rupiah, due_date`
- **Utang Supplier Awal**: `supplier_code, reference_no, amount_due_rupiah, due_date`

---

## 10. DAFTAR 22 MODUL ERP & MATRIKS FUNGSIONAL
- **MOD-01**: First Run & Store Setup (`TOKO_KARKASIA_01`)
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
- **MOD-14**: Dashboard & Store Health Score (Rule Engine Lokal Offline-First, tanpa ketergantungan wajib `/api/ai/advisor`)
- **MOD-15**: Persetujuan Owner & Conflict Resolution (`approvals` / `conflict_cases`)
- **MOD-16**: Backup & Restore Berlapis (IndexedDB Lokal, `.json` Checksum, Drive Export On-Demand, & Pengaturan Backend Adapter)
- **MOD-17**: Perangkat Pendukung (Barcode/QR Scanner Kamera + Undo Scan & Struk Cetak)
- **MOD-18**: Audit Trail & Jurnal Akuntansi Otomatis (Progressive Disclosure)
- **MOD-19**: Ekspor Dokumen PDF & CSV (`jspdf`, `jspdf-autotable`)
- **MOD-20**: Camera Document Capture & Compression (Retur & Nota OPEX)
- **MOD-21**: Voice Note Order Assistant (Offline-First via `localVoiceParser.ts` / parser lokal Flutter, dapat didelegasikan ke adapter jika dikonfigurasi)

---

## 11. STATUS AUDIT AKTUAL, CELAH TERVERIFIKASI, & ROADMAP LANJUTAN

### Catatan Audit Produksi — 13 November 2026
Perubahan pada branch `fix/production-readiness-phase-1` (belum digabung ke `main`):
- Fresh install Web PWA menggunakan master bisnis kosong; hanya pelanggan sistem `UMUM` dan kategori bawaan non-transaksional yang disediakan. Produk, lot, pelanggan riil, piutang, PO, utang supplier, saldo kas, dan biaya tidak diisi data contoh.
- Baseline omzet, berat, HPP, laba, dan OPEX historis hard-coded di `selectOperationalSummary()` dihapus. Penjualan harian dan mingguan kini dihitung dari transaksi selesai sesuai timestamp lokal. OPEX mingguan dihitung dari jurnal biaya aktual berkode akun 6101 pada minggu berjalan.
- Pencocokan item penerimaan PO yang tidak dikenal ditolak; plafon kredit menjadi warning-only di engine dan UI; void wajib menyertakan PIN Owner di Business Engine.
- Test regresi untuk inisialisasi kosong, ringkasan tanpa baseline, PO tidak cocok, plafon kredit warning-only, void tanpa PIN, pembayaran supplier, dan OPEX telah ditambahkan. **GitHub Actions run #10 lulus:** 37/37 test engine, TypeScript check, dan production build berhasil pada commit `c9fe910` di branch kerja. CI menjalankan `bun install` tanpa `--frozen-lockfile` karena `bun.lock` belum memuat dependency `vite-plugin-pwa`; lockfile masih harus diregenerasi dan dikomit sebelum CI dapat dikunci secara reproducible.
- Pembersihan file belum dilakukan: kandidat file yang tampak sebagai artefak masih memiliki referensi runtime, dokumentasi, atau fondasi Flutter. Tidak ada file yang dihapus tanpa bukti tidak terpakai.
- **Belum layak produksi:** PIN Owner masih plaintext dan memiliki default `123456`; jalur retur, validasi nominal, opname, outbox, sinkronisasi pull/reconciliation, dan durability lintas perangkat masih memerlukan audit/perbaikan serta pengujian.

Berdasarkan audit verifikasi kode aktual setelah refactoring Local-First:
- **Sudah Terverifikasi (Web PWA)**:
  - Build produksi (`npm run build`), pengecekan TypeScript (`tsc --noEmit`), dan 10 unit test adapter/outbox (`npx tsx`) lulus.
  - Startup tanpa server/internet (`LOCAL_ONLY`), perpindahan 6 adapter tanpa mengubah logika ERP, `buildSyncItem` selalu mulai `PENDING`, dan `SYNCED` hanya setelah ACK eksplisit telah berjalan di engine Web.
- **Perlu Diselesaikan Berikutnya (Celah Teridentifikasi dalam Audit)**:
  1. **Sinkronisasi Tarik (`pullChanges` Reconciliation)**: Kontrak `pullChanges` sudah ada di `BackendAdapter` Web & Flutter (`SyncEngine.pullFromCloud()`), namun logika *upsert/merge* perubahan dari server kembali ke tabel/state lokal belum diimplementasikan penuh.
  2. **Kelengkapan Outbox Jalur Sekunder**:
     - Web: beberapa helper cepat langsung pada UI `src/App.tsx` (bulk stock opname, adjustment `+/-` lot cepat, tambah cepat produk/lot/pelanggan) perlu dipindahkan seluruhnya ke fungsi mutator `businessEngine.ts` agar otomatis masuk `syncOutbox`.
     - Flutter: `StockDao.quarantineLot`, `StockDao.releaseQuarantineLot`, `StockDao.performCuttingConversion`, dan `CreditLimitService` perlu dilengkapi penulisan `sync_outbox`.
  3. **Ekspor Google Drive (`src/services/googleDriveService.ts`)**: Saat ini berjalan *lazy on-demand* di luar `BackendAdapter`; dapat dibungkus ke `uploadArchiveDocument` jika ingin diseragamkan penuh.
  4. **Kesiapan Build APK Android Flutter (`/lib/`)**: Fondasi arsitektur Local-First & `BackendAdapter` di Dart sudah diimplementasikan, namun **APK belum bisa dibuild** hingga:
     - Folder proyek Android (`android/` via `flutter create .`) dibuat.
     - Kode generator Drift (`*.g.dart`) dijalankan via `dart run build_runner build`.
     - Tab UI Flutter (`PosScreen`, `FefoWarehouseScreen`, dan tab di `MainNavigationScreen`) disambungkan penuh ke query Drift DB menggantikan data statis.
     - Direktori `test/` dan aset nyata di `assets/` dilengkapi serta diverifikasi dengan Flutter/Dart SDK (`flutter analyze`, `flutter test`, `flutter build apk`).


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
