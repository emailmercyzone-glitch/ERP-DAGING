# ERP KARKASIA (V4.3 - Production Ready & Gap-Closed)

**Aplikasi Enterprise Resource Planning (ERP) Daging Impor Cold-Chain untuk UMKM**  
*Single Source of Truth: Selaras dengan `PLAN.md` & `README_PATCH.md`*

---

## 1. Ringkasan Eksekutif & Status Implementasi

Aplikasi ini melayani alur rantai dingin (cold-chain) daging impor:
- **Tenant Isolation**: `TOKO_KARKASIA_01`
- **Arsitektur Stack**:
  - **Flutter & Drift (SQLite + SQLCipher)**: Engine Offline-First 100%, Local Outbox Sync, Catch-Weight Grams.
  - **React (Vite + Tailwind CSS)**: Web & Tablet Backoffice, Live Dashboard, FEFO Alerts, POS Split-View, Scanner Kamera QR & Mutasi Rak.
  - **Supabase (PostgreSQL Cloud)**: Backend sync immutable ledger, Edge Functions, RLS Security.

---

## 2. Status Eksekusi Prioritas A (10 Pekerjaan Selesai 100%)

| No. | Pekerjaan | Tindakan Eksekusi | Status |
|:---:|:---|:---|:---:|
| **1** | **Login & PIN** | Algoritma hash PIN diselaraskan antara `OpeningBalanceSeeder` dan `AuthService` menggunakan SHA-256 salted (`SAMPORA_MEAT_SALT_V4_SECURE_`). PIN default `123456` terverifikasi cocok 100%. | ✅ Selesai |
| **2** | **Inisialisasi Database** | Database Drift dan akun awal (`seedInitialStoreAndUsers`) dipastikan diinisialisasi di `lib/main.dart` sebelum halaman login (`LoginScreen`) dimuat. | ✅ Selesai |
| **3** | **Pemilihan Role** | Selector role di `LoginScreen` diperbaiki untuk `OWNER` (`owner_sampora`), `ADMIN` (`admin_gudang`), dan `SALES` (`sales_banten_01`). Menampilkan username aktif secara dinamis. | ✅ Selesai |
| **4** | **Import Dart** | Mengoreksi import `stock_summary_table.dart` menjadi `stock_ledger_table.dart` di `lib/core/database/daos/stock_dao.dart`. Seluruh import lokal Dart terverifikasi valid tanpa error. | ✅ Selesai |
| **5** | **Konfigurasi Environment** | File `.env.example` diselaraskan penuh dengan seluruh variabel yang dibaca aplikasi (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STORE_ID`, `APP_ENV`, `GEMINI_API_KEY`, `APP_URL`). | ✅ Selesai |
| **6** | **Tipe Data Uang** | Membuat `MoneyUtils` (`toBigInt`, `toInt`, `formatRupiah`, `calculateSubtotal`) untuk menyelaraskan `BigInt` (Drift `Int64Column`) dan `int` (UI) secara konsisten dan aman tanpa floating-point rounding. | ✅ Selesai |
| **7** | **Konversi Stok** | Memperbaiki kalkulasi pemotongan yield di `StockDao.performCuttingConversion`: `OUT_CONVERSION` dicatat sebesar `targetGramProduced` dan `OUT_CUTTING_LOSS` dicatat sebesar `cuttingLossGram`, mencegah pengurangan ganda (*double reduction*). | ✅ Selesai |
| **8** | **Void Transaksi** | `voidTransaction` memvalidasi transaksi tidak di-delete, melainkan menerbitkan entry reversal pada `stock_ledger`, membalikkan piutang pelanggan pada transaksi TEMPO, dan mencatat event `VOID_REVERSAL` pada antrean sinkronisasi. | ✅ Selesai |
| **9** | **Validasi Transaksi** | Menambahkan validasi ketat pada `TransactionDao.createTransaction`: validasi kuantitas item (>0 gram), validasi harga & subtotal (>0), validasi pembayaran tunai (uang cukup & kembalian pas), dan validasi sisa piutang tempo. | ✅ Selesai |
| **10** | **Dokumentasi** | Menyelaraskan `README.md`, `PLAN.md`, dan status implementasi aktual dari fitur-fitur operasional cold-chain. | ✅ Selesai |

---

## 3. Fitur Utama yang Aktif

1. **Dual-Platform Ready**:
   - Web Applet React POS & Warehouse running di Port 3000 dengan Express dev proxy.
   - Flutter/Dart Core Database & Services untuk APK Android Offline-First.
2. **Zero-Float Policy**:
   - Mata uang: `BigInt` / Integer Rupiah utuh.
   - Berat daging: `int` / Integer Gram utuh (1 kg = 1000 gram).
3. **FEFO Inventory & Cold Storage**:
   - Filter **'Batch Kritis'** di modul Gudang (otomatis menyembunyikan batch dengan shelf-life > 30 hari).
   - Banner peringatan FEFO kritis di Dashboard Home (< 7 hari sisa umur).
   - Generator & Scanner QR Code untuk verifikasi lot dan mutasi rak cold storage (`FREEZER-A-01`, dll.).
4. **Keamanan & Ledger Immutable**:
   - Native trigger SQLite & PostgreSQL mencegah UPDATE/DELETE pada `stock_ledger`.
   - Audit trail transaksi dan reversal void terdokumentasi rapi.
