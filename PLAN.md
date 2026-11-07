# BLUEPRINT SOLID ERP DAGING IMPORT UMKM (V4.3 - PRODUCTION READY & GAP-CLOSED)
Project: ERP KARKASIA (Supplier Daging Import - KARKASIA)
Output: APK Android Personal Usaha - Offline First 100% - Multi HP Sync
Versi: 4.3 (Audited Final - Closed Gaps P01 to P20)
Status: ULTIMATE PRODUCTION BLUEPRINT - Single Source of Truth
Stack: Flutter + Drift (SQLite + SQLCipher) + Supabase (PostgreSQL Cloud & Edge Functions) + Riverpod
Prinsip Utama: Offline is King, UUID Everywhere, Event Sourcing Immutable Ledger, 1 Toko 1 Gudang, Decoupled MVVM Architecture, Praktis Ala UMKM Lapangan

---

## DAFTAR ISI
1. Ringkasan Eksekutif & Keputusan Utama (Locked)
2. Alur Transaksi Penjualan, Pengiriman, & Void vs Retur
3. Siklus Pembelian Impor, Landed Cost, & AP Payments (Utang Supplier)
4. Manajemen Stok, FEFO, Yield Loss, & Konversi Produk (Tetelan)
5. Konsinyasi, Affiliate, & Penanganan Komisi
6. Arsitektur Database & Master Entitas (Drift & Supabase Schema)
7. Protokol Sinkronisasi, Idempotency, ACK, & Pemisahan Conflict Table
8. Keamanan, RLS, RPC Security, & DB Key Recovery (SQLCipher)
9. Aturan Opening Balance & Format CSV Migrasi Awal
10. Daftar 22 Modul ERP & Matriks RBAC Lengkap
11. Roadmap Implementasi Bertahap (Fase 0 s.d Fase 3 & Definition of Done)

---

## 1. RINGKASAN EKSEKUTIF & KEPUTUSAN UTAMA (LOCKED)
- **Skala Operasional**: Maksimal 1 Owner, 2 Admin, 5 Sales (~8 HP); <= 500 SKU; <= 200 transaksi/hari.
- **Model Stok**: Sentral di gudang pusat. Sales menjual dari stok pusat tanpa muat barang di kendaraan (no vehicle stock). Pengiriman fisik diatur oleh gudang setelah order diverifikasi.
- **Karakter Data**:
  - Angka mata uang menggunakan `BIGINT` (Rupiah utuh, zero decimal).
  - Berat menggunakan `INTEGER` (Gram utuh, misal 1 kg = 1000 gram).
  - Zero float untuk menghindari rounding error.
- **Immutable Ledger**: Tabel pergerakan stok (`stock_ledger`) dan event transaksi bersifat append-only (insert-only). Dilarang keras melakukan `UPDATE` atau `DELETE` pada baris event yang sudah tercatat.

---

## 2. ALUR TRANSAKSI PENJUALAN, PENGIRIMAN, & VOID VS RETUR
- **Sales Order (Draft/Issued)**: Sales membuat pesanan di lapangan secara offline. Stok lokal divalidasi (<50ms). Jika stok cukup, status invoice terbit. Jika stok minus, memicu Red Alert Warning dan flag `is_conflict = true` saat sync.
- **Alokasi & Pengiriman Gudang**: Gudang melihat order masuk, menyiapkan barang fisik, lalu mengubah status menjadi `SHIPPED` (Disetujui untuk dikirim / Surat Jalan PDF tercetak).
- **Penyelesaian Transaksi**: Status berubah menjadi `COMPLETED` setelah barang diterima pelanggan.
- **Void vs Retur**:
  - **Void**: Pembatalan dokumen yang dilakukan sebelum barang dikirim atau sebelum setoran kas diterima. Memicu reversal entry otomatis untuk membalikkan ledger, kas, dan piutang.
  - **Retur**: Penanganan komplain mutu barang setelah barang diterima pelanggan. Wajib disertai foto bukti (MOD-20). Barang retur masuk ke karantina (MOD-07B) dan diterbitkan Credit Note sebagai pengurang tagihan/refund.

---

## 3. SIKLUS PEMBELIAN IMPOR, LANDED COST, & AP PAYMENTS (UTANG SUPPLIER)
- **Purchase Order (PO)**: Pencatatan pesanan daging impor ke supplier luar.
- **Goods Receipt (Penerimaan Barang)**: Pencatatan fisik barang datang. Jika berat aktual berbeda dari PO (misal PO 500 kg, datang 480 kg), sistem mencatat berat aktual.
- **Landed Cost Allocation (BR-060)**: Biaya tambahan (Freight, Bea Masuk, Cold Storage) dialokasikan ke HPP Lot berdasarkan berat aktual yang diterima.
- **Supplier Invoice (AP)**: Tagihan resmi dari supplier yang membentuk saldo utang usaha (`accounts_payable`).
- **AP Payments**: Pembayaran utang (Tunai / Transfer, Pembayaran Parsial, atau Pelunasan), lengkap dengan riwayat alokasi pembayaran per tagihan dan pemotongan Debit Note retur pembelian.

---

## 4. MANAJEMEN STOK, FEFO, YIELD LOSS, & KONVERSI PRODUK (TETELAN)
- **FEFO (First Expired, First Out)**: Pengeluaran stok otomatis memilih lot dengan tanggal kedaluwarsa terdekat.
- **Yield & Cutting Loss Conversion (BR-051/052)**: Pemotongan daging primal (misal 10 kg) dicatat melalui `OUT_CONVERSION` (mengeluarkan daging asal) dan dialokasikan ke produk turunan baru ber-HPP terhitung (misal "Tetelan / Daging Cincang" via `IN_CONVERSION`), sementara limbah/lemak tak bernilai dicatat terpisah via `OUT_CUTTING_LOSS`.
- **Stock Opname & Susut**: Penyesuaian stok berkala (MOD-07B) untuk mencatat drip loss atau susut thawing daging beku.

---

## 5. KONSINYASI, AFFILIATE, & PENANGANAN KOMISI
- **Barang Sendiri**: Ada fisik, ada HPP, ledger stok aktif.
- **Konsinyasi (Titipan)**: Ada fisik, tidak ada HPP awal, dicatat sebagai utang konsinyasi. Penyelesaian pembayaran dilakukan setelah barang terjual sesuai kesepakatan pemilik barang.
- **Affiliate / Digital**: Tidak ada fisik, tidak ada ledger stok. Komisi dicatat otomatis berdasarkan konfigurasi di `product_commissions` (`PERSEN` / `NOMINAL_PER_KG` / `NOMINAL_PER_PCS`) saat transaksi penjualan berhasil.

---

## 6. ARSITEKTUR DATABASE & MASTER ENTITAS (DRIFT & SUPABASE SCHEMA)
Tabel Inti yang wajib ada di Drift SQLite & Supabase PostgreSQL:
1. `users` (RBAC: Owner, Admin, Sales)
2. `customers` (CRM, Plafon utang, Tempo)
3. `suppliers` (Data supplier impor/lokal)
4. `products` (Master produk, kategori, dual-unit KG/Pcs/Box)
5. `lots` (Batch/Lot daging, NKV, expired_date, landed cost, hpp_per_gram)
6. `purchase_orders` & `goods_receipts` (Pembelian & penerimaan)
7. `supplier_invoices` & `ap_payments` (Tagihan & pelunasan utang supplier)
8. `customer_tiers` & `product_prices` (Harga bertingkat & event bazar)
9. `transactions` & `transaction_items` (POS invoice & item rincian)
10. `stock_ledger` (Append-only movement: IN_PURCHASE, OUT_SALE, IN_RETURN, OUT_ADJUST, OUT_CONVERSION, IN_CONVERSION, OUT_QUARANTINE, dll.)
11. `stock_summary` (Materialized cache stok per produk/lot untuk kecepatan baca <50ms)
12. `conflict_cases` (Menampung transaksi yang memicu stok minus saat offline, terpisah dari tabel immutable event)
13. `sync_queue` (Antrean sinkronisasi offline ke Supabase)
14. `media_queue` (Antrean upload foto bukti retur / OPEX max 720p)
15. `product_commissions` & `credit_notes`

---

## 7. PROTOKOL SINKRONISASI, IDEMPOTENCY, ACK, & PEMISAHAN CONFLICT TABLE
- **Server Sequence (`server_seq`)**: Supabase memberikan nomor urut resmi saat event masuk.
- **ACK & Status Queue**: Event di dalam `sync_queue` baru dianggap `DONE` setelah server mengirimkan acknowledgement resmi.
- **Immutability Protection**: Kolom `is_conflict` TIDAK mengubah tabel event transaksi asli, melainkan dicatat sebagai baris referensi baru di tabel `conflict_cases` untuk disetujui Owner di MOD-15.
- **Prefix Device Invoice**: Penomoran invoice offline menggunakan format `INV-{DEVICE_ID}-{YYMMDD}-{SEQ}` guna menghindari bentrok antar HP sales.

---

## 8. KEAMANAN, RLS, RPC SECURITY, & DB KEY RECOVERY (SQLCIPHER)
- **Enkripsi Lokal (SQLCipher)**: Database Drift dienkripsi menggunakan kunci lokal yang dibungkus dengan AES-GCM berbasis passphrase Owner (`flutter_secure_storage`).
- **Backup Key Recovery**: File `.erpbak` menyertakan metadata enkripsi kunci agar dapat dipulihkan mulus saat restore di perangkat baru tanpa kehilangan akses data.
- **Supabase RLS & RPC**: Akses tabel diamankan dengan Row Level Security aktif. Fungsi `sync_push` menggunakan `SECURITY INVOKER` dengan validasi ketat `auth.uid()`, `store_id`, dan RBAC role.

---

## 9. ATURAN OPENING BALANCE & FORMAT CSV MIGRASI AWAL
Format standar migrasi awal saat Go-Live (tersedia dalam template CSV terstruktur):
- **Stok Lot Awal**: `sku, lot_code, expiry_date, total_gram, total_pcs, cost_total_rupiah, supplier_code`
- **Piutang Pelanggan Awal**: `customer_code, invoice_no, amount_due_rupiah, due_date`
- **Utang Supplier Awal**: `supplier_code, reference_no, amount_due_rupiah, due_date`

---

## 10. DAFTAR 22 MODUL ERP & MATRIKS RBAC LENGKAP
- **MOD-01**: First Run & Store Setup (`STORE_ID=TOKO_SAMPORA_01`)
- **MOD-02**: Users, PIN 6-digit & RBAC
- **MOD-03**: Master Produk & Dual-Unit (KG/Pcs/Box, Catch Weight)
- **MOD-04**: POS Unified Dual-Mode (Mode Kasir Toko & Mode Sales Lapangan, Struk Coret Ongkir)
- **MOD-05**: Harga Bertingkat & Promo Bazar Berjadwal
- **MOD-06**: Manajemen Pelanggan & Plafon Utang Fleksibel
- **MOD-07**: Persediaan Gudang, FEFO, & Yield Loss Conversion (Trimming -> Tetelan)
- **MOD-07B**: Stock Opname, Drip Loss, & Karantina Lot
- **MOD-08**: Retur Penjualan & Pembelian (Wajib Foto Kamera via MOD-20)
- **MOD-09**: Pembelian Impor & Landed Cost PO
- **MOD-10**: Piutang Pelanggan, Aging Buckets, & Warning Lampu Kuning
- **MOD-11**: Setoran Kas Sales, Soft Limit Rp 3jt, & Health Score Warning
- **MOD-12**: Kasir Kecil & OPEX (Foto Struk Terkompres)
- **MOD-13**: Kalkulator Pajak Logika & Laporan Laba Bersih Sederhana
- **MOD-14**: Dashboard & Store Health Score (Indikator Sehat 3 Detik + Gemini AI via Edge Proxy)
- **MOD-15**: Conflict Resolution Dashboard (`is_conflict` via `conflict_cases`)
- **MOD-16**: Backup & Restore 3 Lapis (.db, Google Drive, Manual WA)
- **MOD-17**: Perangkat Pendukung (Barcode scanner & Thermal Bluetooth ESC/POS 58mm)
- **MOD-18**: Audit Trail & System Log Aktivitas
- **MOD-19**: Ekspor Dokumen PDF & CSV (`pdf`, `printing`, `share_plus`)
- **MOD-20**: Super Camera OCR & Document Capture (Kompresi max 720p, <300 KB)
- **MOD-21**: Voice Note Input Assistant (Catatan suara transkripsi lokal)

---

## 11. ROADMAP IMPLEMENTASI BERTAHAP (FASE 0 S.D FASE 3)
- **Fase 0 (Spike & PoC)**: Uji coba enkripsi Drift + SQLCipher, inisialisasi struktur folder Clean Architecture, koneksi Supabase Client, & adapter Bluetooth Printer.
- **Fase 1 (Core Operational MVP)**: MOD-01 s.d MOD-07, MOD-09, MOD-10, MOD-11, MOD-15, MOD-16, MOD-17, MOD-19, dan Sync Engine dasar.
- **Fase 2 (Advance Features)**: MOD-07B, MOD-08, MOD-12, MOD-13, Google Drive Backup, & Super Camera OCR (MOD-20A).
- **Fase 3 (AI & Extensions)**: Gemini AI Advisor via Edge Proxy (MOD-14 advanced) & Voice Note Assistant (MOD-21).
