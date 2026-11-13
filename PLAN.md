# BLUEPRINT SOLID ERP DAGING IMPORT UMKM (V4.4 - PWA OFFLINE-FIRST + ZIMAOS ROADMAP)
Project: ERP KARKASIA (Supplier Daging Import - KARKASIA)
Output: Progressive Web App (PWA) Installable (HP Kasir/Sales & Tablet/Desktop) - Offline First 100% - Multi Device Sync Ready
Versi: 4.4 (Migrasi Arsitektur PWA + IndexedDB -> ZimaOS Backend)
Status: SINGLE SOURCE OF TRUTH - Selaras dengan `README.md` & `README_PATCH.md`
Stack Aktif (Fase 1): React 18 + TypeScript + Vite PWA (`vite-plugin-pwa` + Workbox) + Tailwind CSS + IndexedDB (`karkasia_erp_offline_db`)
Target Backend (Fase 2): ZimaOS Docker Container (Node.js/Express + SQLite/PostgreSQL) via Cloudflare Tunnel HTTPS
Prinsip Utama: Offline is King, UUID Everywhere, Event Sourcing Immutable Ledger, 1 Toko 1 Gudang, Praktis Ala UMKM Lapangan

---

## DAFTAR ISI
1. Ringkasan Eksekutif & Keputusan Utama (Locked)
2. Alur Transaksi Penjualan, Pengiriman, & Void vs Retur
3. Siklus Pembelian Impor, Landed Cost, & AP Payments (Utang Supplier)
4. Manajemen Stok, FEFO, Yield Loss, & Konversi Produk (Tetelan)
5. Konsinyasi, Affiliate, & Penanganan Komisi
6. Arsitektur Database & Master Entitas (IndexedDB Lokal & ZimaOS Central DB)
7. Protokol Sinkronisasi, Idempotency, ACK, & Cloudflare Tunnel
8. Keamanan, HTTPS Access Control, Device Auth, & Backup Cadangan
9. Aturan Opening Balance & Format CSV Migrasi Awal
10. Daftar 22 Modul ERP & Matriks RBAC Lengkap
11. Roadmap Implementasi Bertahap (Fase 0 s.d Fase 3 & Definition of Done)

---

## 1. RINGKASAN EKSEKUTIF & KEPUTUSAN UTAMA (LOCKED)
- **Keputusan Arsitektur Terbaru (PWA-First + Self-Hosted ZimaOS)**:
  - Aplikasi operasional kasir dan sales lapangan menggunakan **PWA (Progressive Web App)** yang dapat di-install langsung ke Home Screen HP Android & iOS Safari tanpa perlu kompilasi APK berulang.
  - Seluruh aset UI di-cache offline oleh **Workbox Service Worker** sehingga aplikasi tetap terbuka instan walau di dalam ruang pendingin/gudang tanpa sinyal.
  - Database lokal perangkat menggunakan **IndexedDB (`karkasia_erp_offline_db`)** berkapasitas besar (menggantikan keterbatasan ~5 MB `localStorage`, dengan migrasi otomatis zero-data-loss dari `localStorage` lama).
  - Server database pusat disiapkan berjalan mandiri di **ZimaOS (Docker)** milik toko dan diakses aman dari luar jaringan lewat **Cloudflare Tunnel (HTTPS)** tanpa membuka port router publik.
- **Skala Operasional**: Maksimal 1 Owner, 2 Admin, 5 Sales (~8 perangkat); <= 500 SKU; <= 200 transaksi/hari.
- **Model Stok**: Sentral di gudang pusat. Sales menjual dari stok pusat tanpa muat barang di kendaraan (no vehicle stock). Pengiriman fisik diatur oleh gudang setelah order diverifikasi.
- **Karakter Data (Zero-Float Policy)**:
  - Angka mata uang menggunakan integer utuh Rupiah (`BIGINT` di backend / `Math.round` integer IDR di engine TS).
  - Berat menggunakan integer utuh Gram (`INTEGER`, misal 1 kg = 1000 gram).
  - Zero float untuk menghindari rounding error.
- **Immutable Ledger**: Tabel/log pergerakan stok (`stock_ledger`) dan event transaksi bersifat append-only (insert-only). Dilarang keras melakukan `UPDATE` atau `DELETE` pada baris event yang sudah tercatat; koreksi wajib melalui transaksi balik (`VOID_REVERSAL`) atau penyesuaian tercatat.

---

## 2. ALUR TRANSAKSI PENJUALAN, PENGIRIMAN, & VOID VS RETUR
- **Sales Order (Draft/Issued)**: Kasir/Sales membuat pesanan secara offline (tersimpan langsung di IndexedDB <50ms). Jika stok lokal cukup, nota langsung terbit. Jika stok minus, memicu persetujuan/alert owner (`ApprovalRequest` / `is_conflict`).
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
- **Stock Opname & Susut**: Penyesuaian stok berkala (MOD-07B) untuk mencatat drip loss atau susut thawing daging beku dengan perhitungan nilai selisih otomatis.

---

## 5. KONSINYASI, AFFILIATE, & PENANGANAN KOMISI
- **Barang Sendiri**: Ada fisik, ada HPP, ledger stok aktif.
- **Konsinyasi (Titipan)**: Ada fisik, tidak ada HPP awal, dicatat sebagai utang konsinyasi. Penyelesaian pembayaran dilakukan setelah barang terjual sesuai kesepakatan pemilik barang.
- **Affiliate / Digital**: Tidak ada fisik, tidak ada ledger stok. Komisi dicatat otomatis berdasarkan konfigurasi (`PERSEN` / `NOMINAL_PER_KG` / `NOMINAL_PER_PCS`) saat penjualan berhasil.

---

## 6. ARSITEKTUR DATABASE & MASTER ENTITAS (INDEXEDDB LOKAL & ZIMAOS CENTRAL DB)

### A. Penyimpanan Lokal Perangkat — IndexedDB (`karkasia_erp_offline_db`)
- **`kv_state` (`engine_state_v1`)**: Menyimpan snapshot deterministik `BusinessEngineState` (produk, batch lot, pelanggan, piutang, PO, tagihan supplier, transaksi POS, ledger stok, jurnal akuntansi otomatis, jejak audit ber-hash, antrean persetujuan owner, dan `syncOutbox`).
- **`preferences`**: Menyimpan preferensi cepat antar sesi (`supplier_phones`, `last_payment_method`, `last_supplier`) sehingga tidak hilang saat `localStorage` dibersihkan browser.
- **Migrasi Otomatis**: Saat pertama kali dibuka setelah pembaruan PWA, sistem otomatis memindahkan data lama dari `localStorage` ke IndexedDB tanpa kehilangan satu transaksi pun.

### B. Entitas Inti & Target Skema ZimaOS (SQLite WAL / PostgreSQL)
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
11. `stock_summary` (Materialized cache stok per produk/lot untuk kecepatan baca <50ms)
12. `conflict_cases` / `approvals` (Menampung permintaan override limit/stok minus secara terpisah dari event immutable)
13. `sync_outbox` (Antrean sinkronisasi offline ke server ZimaOS dengan `idempotencyKey`)
14. `media_queue` (Antrean foto bukti retur / nota kas kecil max 720p)
15. `journals` & `audit_trail` (Jurnal double-entry otomatis & log aktivitas ber-checksum SHA)

---

## 7. PROTOKOL SINKRONISASI, IDEMPOTENCY, ACK, & CLOUDFLARE TUNNEL
- **Eventual Consistency Offline-First**: Saat perangkat tidak mendapat sinyal (`!navigator.onLine`), transaksi tetap disimpan utuh ke IndexedDB dan antrean `syncOutbox` bertanda `PENDING` ("Belum tersinkron").
- **Auto-Flush saat Online**: Ketika browser mendeteksi sinyal kembali (`online` event) atau tombol sinkronisasi ditekan, outbox dikirim secara idempoten ke endpoint backend.
- **Transport ZimaOS + Cloudflare Tunnel**:
  - PWA di HP kasir/sales terhubung melalui URL HTTPS resmi (`https://erp-api.<domain>.com`) yang diarahkan oleh `cloudflared` tunnel ke kontainer backend di server rumah **ZimaOS**.
  - Tidak perlu IP publik statis atau port forwarding di router toko.
- **Idempotency & Server Sequence (`server_seq`)**: Setiap mutasi membawa `idempotencyKey` (UUID v4) agar pengiriman ulang saat sinyal putus-nyambung tidak pernah menggandakan transaksi atau memotong stok dua kali. Outbox ditandai `SYNCED` hanya setelah server mengembalikan `ACK`.
- **Prefix Device Invoice**: Penomoran invoice menggunakan format `INV-{DEVICE_ID}-{YYMMDD}-{SEQ}` guna mencegah bentrok antar perangkat kasir dan sales lapangan.

---

## 8. KEAMANAN, HTTPS ACCESS CONTROL, DEVICE AUTH, & BACKUP CADANGAN
- **Wajib HTTPS (Syarat PWA & Keamanan Transport)**: Cloudflare Tunnel secara otomatis menyediakan sertifikat TLS/HTTPS sehingga Service Worker, Kamera QR/Retur, dan enkripsi transport berjalan aman.
- **Perlindungan Data Perangkat & Otorisasi**:
  - IndexedDB diisolasi per origin HTTPS browser.
  - Aksi berisiko (Void transaksi, Override plafon kredit/stok minus, Reset data) dilindungi verifikasi **PIN Owner 6-digit**.
  - Tahap ZimaOS API menggunakan Device Token / Session JWT tervalidasi RBAC serta Cloudflare Zero Trust Access (opsional pembatasan email/perangkat pegawai).
- **Backup & Restore Berlapis**:
  - Ekspor/Impor cadangan lokal `.json` dilengkapi pemeriksaan checksum integritas (`computeIntegrityHash`).
  - Integrasi Google Drive OAuth client-side sebagai vault cadangan eksternal dari perangkat Owner.

---

## 9. ATURAN OPENING BALANCE & FORMAT CSV MIGRASI AWAL
Format standar migrasi awal saat Go-Live:
- **Stok Lot Awal**: `sku, lot_code, expiry_date, total_gram, total_pcs, cost_total_rupiah, supplier_code`
- **Piutang Pelanggan Awal**: `customer_code, invoice_no, amount_due_rupiah, due_date`
- **Utang Supplier Awal**: `supplier_code, reference_no, amount_due_rupiah, due_date`

---

## 10. DAFTAR 22 MODUL ERP & MATRIKS RBAC LENGKAP
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
- **MOD-14**: Dashboard & Store Health Score (Gemini AI Advisor via `/api/ai/advisor`)
- **MOD-15**: Persetujuan Owner & Conflict Resolution (`approvals` / `conflict_cases`)
- **MOD-16**: Backup & Restore Berlapis (IndexedDB Lokal, `.json` Checksum, Google Drive Vault)
- **MOD-17**: Perangkat Pendukung (Barcode/QR Scanner Kamera & Struk Cetak)
- **MOD-18**: Audit Trail & Jurnal Akuntansi Otomatis (Progressive Disclosure)
- **MOD-19**: Ekspor Dokumen PDF & CSV (`jspdf`, `jspdf-autotable`)
- **MOD-20**: Camera Document Capture & Compression (Retur & Nota OPEX)
- **MOD-21**: Voice Note Order Assistant (`/api/ai/voice-parse`)

---

## 11. ROADMAP IMPLEMENTASI BERTAHAP (FASE 0 S.D FASE 3)
- **Fase 0 (Selesai — Core Engine & UX Foundation)**:
  - Mesin bisnis deterministik zero-float (`businessEngine.ts`), FEFO lot allocation, Moving Average HPP, immutable `stockLedger`, dan 5-tab UI ramah kasir awam tanpa istilah teknis.
- **Fase 1 (Aktif — PWA Offline-First + IndexedDB)**:
  - Registrasi Service Worker (`vite-plugin-pwa` + Workbox precaching), Web App Manifest & ikon Android/iOS, tombol pasang in-app (`PWAInstallButton`), deteksi koneksi real-time (`useOnlineStatus`), dan penyimpanan utama `IndexedDB` (`karkasia_erp_offline_db`) dengan migrasi mulus dari `localStorage`.
  - *Definition of Done Fase 1*: Aplikasi dapat di-install ke Home Screen HP, tetap terbuka dan mampu mencatat POS/stok/tagihan saat mode pesawat, serta tidak kehilangan data saat cache/tab ditutup.
- **Fase 2 (Selanjutnya — ZimaOS Docker Central Backend + Cloudflare Tunnel)**:
  - Menjalankan API sync (`POST /api/sync/push`, `GET /api/sync/pull`) + database pusat (`SQLite WAL` / `PostgreSQL`) di ZimaOS menggunakan Docker Compose.
  - Menghubungkan server ZimaOS via `Cloudflare Tunnel` (HTTPS) agar kasir toko & sales lapangan saling sinkron real-time terhadap stok pusat.
- **Fase 3 (Ekspansi Lanjutan)**:
  - Auto-backup harian database ZimaOS ke Google Drive / penyimpanan sekunder, penguatan OCR faktur kontainer, serta dukungan printer thermal portabel lanjutan.
