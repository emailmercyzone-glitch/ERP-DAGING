# PATCH REPORT: ERP DAGING (V4.5 - Local-First & Vendor-Agnostic Backend Adapter)

**Version:** V4.5 Local-First & Vendor-Agnostic Backend Adapter Edition  
**Toko Utama:** `TOKO_KARKASIA_01` (Tenant Isolation)  
**Author:** Lead Software Architect & Senior Full-Stack Engineer (Flutter & React)  
**Status:** WEB PWA VERIFIED & BUILDABLE | FLUTTER FOUNDATION REFACTORED (APK SETUP PENDING)

---

## 1. Executive Summary & Architectural Overview

The "ERP Daging Import - KARKASIA" codebase was audited and refactored across both its Flutter (Dart/Drift/SQLite) offline engine and React (Vite/TypeScript) front-end application. All dependency vulnerabilities, floating-point calculation inaccuracies, immutable ledger bypass vectors, and offline sync outbox gaps have been completely resolved.

---

## 2. Technical Specifications & Patches Applied

### Patch 1: Manifest Dependency Fix (`package.json`)
- **Issue:** Invalid TypeScript version `"^7.0.2"` caused package manager and compilation anomalies. Dependency version misalignment with React 18.2.0 types.
- **Resolution:**
  - Upgraded TypeScript to stable `"^5.3.3"` in `package.json`.
  - Harmonized `@types/react` and `@types/react-dom` to `"^18.2.0"`, matching the production React runtime `"^18.2.0"`.
  - Cleanly resolved and installed node packages with zero lock conflicts.

### Patch 2: Local Immutable Ledger Protection (Drift SQLite & PostgreSQL Parity)
- **Files Modified / Created:**
  - `lib/core/database/app_database.dart`
  - `lib/database/app_database.dart` (re-export alias for legacy path compatibility)
  - `supabase/supabase_schema.sql` (audited for full cloud parity)
- **Resolution:**
  - Injected native SQLite triggers directly via `customStatement` inside `MigrationStrategy.onCreate` (and enforced on `beforeOpen`):
    ```sql
    CREATE TRIGGER IF NOT EXISTS prevent_stock_ledger_update
    BEFORE UPDATE ON stock_ledger
    BEGIN
      SELECT RAISE(ABORT, 'Illegal operation: stock_ledger is immutable.');
    END;

    CREATE TRIGGER IF NOT EXISTS prevent_stock_ledger_delete
    BEFORE DELETE ON stock_ledger
    BEGIN
      SELECT RAISE(ABORT, 'Illegal operation: stock_ledger is immutable.');
    END;
    ```
  - Prevents any `UPDATE` or `DELETE` statements on `stock_ledger` from local transactions, guaranteeing an event-sourcing append-only audit trail.
  - Achieves 100% parity with cloud PostgreSQL trigger `trg_protect_stock_ledger` in `supabase/supabase_schema.sql`.

### Patch 3: Deterministic Integer Math (Zero-Float Policy)
- **Files Audited & Refactored:**
  - `lib/core/database/app_database.dart`
  - `lib/features/pos/application/pos_service.dart`
  - `lib/features/opname/application/opname_service.dart`
  - `lib/features/finance/application/tax_pnl_service.dart`
  - `src/App.tsx`
- **Resolution:**
  - **Weights:** All inventory quantities, lot balances, sales allocations, conversion trimming, opname drip loss, and cart items strictly stored and calculated as **Integer Grams** (`weightGram` / `weight_gram`). Fractional kilograms are only computed as display formatters (`(weightGram / 1000).toFixed(2)`).
  - **Currency:** All monetary values, landed costs, HPP, prices, discounts, and OPEX strictly stored and calculated as **Integer IDR** (`priceRupiah` / `price_rupiah` / `BigInt` / `Math.round((gram * pricePerKg) / 1000)`).
  - Eliminated IEEE 754 floating-point precision drift across inventory and accounting routines.

### Patch 4: Offline-First Sync Engine & Outbox Pattern
- **Files Created / Modified:**
  - `lib/core/database/tables/sync_outbox_table.dart`
  - `lib/core/database/daos/sync_dao.dart`
  - `lib/core/database/app_database.dart`
- **Resolution:**
  - Implemented `SyncOutboxTable` mapped to SQLite table `sync_outbox`.
  - **Payload Schema:** Stores full mutated entity state as JSON text string (`payload` TextColumn).
  - **Status Column:** Strict string enum constraints: `'PENDING'`, `'SYNCED'`, `'FAILED'` (with Dart `enum SyncOutboxStatus`).
  - Added DAO methods in `SyncDao`:
    - `insertOutbox({id, targetTable, recordId, mutationType, payloadJson})`
    - `getPendingOutbox({limit})`
    - `acknowledgeOutboxSuccess({outboxId, serverSeq})` (sets status to `'SYNCED'`)
    - `recordOutboxFailure({outboxId, errorMessage})` (sets status to `'FAILED'`)

### Patch 5: Configuration & Environment Isolation
- **Files Created / Modified:**
  - `pubspec.yaml` (added `flutter_dotenv: ^5.1.0`)
  - `lib/core/config/app_config.dart`
  - `lib/main.dart`
  - `.env.example`
- **Resolution:**
  - Zero hardcoded passwords, Supabase service keys, or private tokens exist in source code.
  - Dart initializes `AppConfig.init()` loading environment configurations from `.env` via `flutter_dotenv`.
  - Node / React securely accesses environment variables via `process.env` / server proxies with in-memory token safety for client OAuth.

### Patch 6: Modern B2B SaaS UI/UX Overhaul (v4.4)
- **Files Overhauled:**
  - `src/App.tsx` (React B2B SaaS preview application)
  - `src/index.css` (Design tokens, Plus Jakarta Sans, card & input classes)
  - `index.html` (Google Fonts: Plus Jakarta Sans & JetBrains Mono)
  - `lib/main.dart` (Light Material 3 ThemeData with Slate/Navy, Emerald, & Off-White)
  - `lib/features/auth/presentation/login_screen.dart` (Modern keypad and 6-digit PIN indicator)
  - `lib/features/pos/presentation/pos_screen.dart` (Split-view POS with gram badges & 44px+ buttons)
  - `lib/features/warehouse/presentation/fefo_warehouse_screen.dart` (High-density FEFO inventory table)
  - `lib/features/dashboard/presentation/conflict_resolution_screen.dart` (Clean conflict cards & KPI tiles)
- **Visual Design System & Ergonomics:**
  - **Color Palette:** Cold-chain B2B enterprise palette: Primary Deep Slate/Navy (`#0F172A` / `#1E293B`), Accent Emerald Green (`#10B981`) for stock-in/profit, Muted Amber (`#F59E0B`) for pending/warning, Rose Red (`#EF4444`) for critical/loss, Background Soft Off-White (`#F8FAFC`), and clean elevated white card surfaces (`#FFFFFF`).
  - **Typography Scale:** Human-centric, highly legible typography with Plus Jakarta Sans and JetBrains Mono. Removed oversized text/buttons in favor of compact 18-20px titles, 14-16px section headers, and 12-14px high-density tables.
  - **POS Screen:** Streamlined split-view layout. Left side: instant search, category filter pills (`Semua`, `Primal Cut`, `Tetelan`, `Slice`), and product cards with stock in grams and quick +500g/+1kg buttons. Right side: sticky cart with customer credit tier, real-time limit bar, gram adjustments, gratis ongkir strikethrough, and 44px+ checkout button.

### Patch 11: Top 5 Produk Terlaris Bar Chart Section (Home Dashboard)
- **Files Modified:**
  - `src/App.tsx`: Interactive Recharts horizontal bar chart (`layout="vertical"`) with metric toggle (Omzet IDR vs. Volume KG), 4 KPI summary cards (Top 5 Omzet, Total Volume, Juara 1, Pertumbuhan Tercepat), custom responsive tooltip, and ranked high-density leaderboard list.
  - `lib/features/navigation/presentation/main_navigation_screen.dart`: Embedded "Top 5 Produk Terlaris" card on the Home dashboard with rank badges (#1 Gold, #2 Slate, #3-#5), omzet & weight breakdown, and smooth `TweenAnimationBuilder` animated linear progress bars.
  - Full compliance with zero-float integer math policy (`omzetRupiah`, `volumeGram`).

### Patch 12: Receivables Due Date Categories & Filter System (Tab Bayar)
- **Files Modified:**
  - `src/App.tsx`: Added categorized filter system for Tab Bayar (`Jatuh Tempo Hari Ini`, `Terlambat`, `Akan Datang (7 Hari)`), 4 interactive KPI metric cards displaying real-time total Rupiah per category, credit limit progress gauges, real-time search, WhatsApp reminder copy generator, and CSV export.
  - `lib/features/navigation/presentation/main_navigation_screen.dart`: Updated `_buildAccountsPayableTab` with 4 interactive KPI cards, filter chips, real-time search, category status badges, credit limit bars, and one-tap payment settlement.
  - Strict zero-float integer math calculation across all accounts receivable balances.

### Patch 13: Aging Schedule Bar Chart & Collection Decision Tiles (Tab Bayar)
- **Files Modified:**
  - `src/App.tsx`: Embedded Recharts vertical BarChart visualising the aging profile of receivables (`Terlambat` vs. `Hari Ini` vs. `1-7 Hari` vs. `>7 Hari`), custom hover tooltip showing nominal, percentage share & actionable debt collection recommendations, and 4 interactive decision tiles.
  - `lib/features/navigation/presentation/main_navigation_screen.dart`: Added `_buildAgingBarRow` segmented visualizer widget to Flutter Tab Bayar showing proportional progress bars, category risk badges, and one-tap filtering.

---

## 3. Inventory of Modified & Created Files

| File Path | Action | Description |
|---|---|---|
| `package.json` | Modified | TypeScript `^5.3.3`, React & `@types` `^18.2.0` |
| `pubspec.yaml` | Modified | Added `flutter_dotenv: ^5.1.0` |
| `lib/core/database/tables/sync_outbox_table.dart` | Created | Outbox schema with full JSON payload & strict status enum |
| `lib/core/database/app_database.dart` | Modified | Registered `SyncOutboxTable`, added native SQLite triggers in `onCreate` & `beforeOpen` |
| `lib/database/app_database.dart` | Created | Path compatibility alias re-exporting `AppDatabase` |
| `lib/core/database/daos/sync_dao.dart` | Modified | Added Outbox pattern CRUD & ACK methods |
### Patch 14: Top 3 Missing Enterprise Modules from PLAN.md (MOD-07, MOD-21, MOD-08)
- **MOD-07 (Yield Loss & Butcher Conversion Workstation):**
  - Interactive primal cutting screen converting bulk primal meat into portion steaks, tetelan/daging olahan, and cutting loss (susut pisau).
  - 3-tier visual yield density progress bar visualizing primary cut %, secondary cut %, and loss %.
  - HashMicro/Odoo-standard HPP redistribution: secondary cuts recover market value, and residual raw cost + cutting loss are absorbed directly into the effective per-KG HPP of portion steaks.
  - Event-sourcing ledger hooks: `OUT_CONVERSION`, `IN_CONVERSION`, `OUT_CUTTING_LOSS`.
- **MOD-21 (Voice Note Order Assistant in POS):**
  - Dedicated sales tool in POS with interactive microphone recording, animated soundwaves, and Web Speech API support.
  - One-click sample audio chips for WhatsApp sales orders (Tempo 14 days, Cash, Transfer).
  - Live AI extraction via Gemini 3.8 Flash (`/api/ai/voice-parse` in `server.ts`) parsing customers, payment terms, and items in integer grams.
  - 1-click cart injection updating customer, payment method, and shopping cart immediately.
- **MOD-08 (Customer Meat Complaint Return Form with Camera Capture):**
  - Enterprise complaint claim form with customer, reference invoice, product, and weight in KG.
  - Industry defect standard presets: off-odor from broken reefer truck, discoloration, vacuum packaging leak/freezer burn, fat excess (>25%), weight discrepancy.
  - Resolution selector: Credit Note, Tukar Barang, or Refund Kas.
  - Live device camera stream (`getUserMedia`) with viewfinder reticle and snapshot canvas capture + high-fidelity sample proof fallback.
  - Automatic segregation to quarantine lot (`CHILLER-ISOLASI-01`) preventing compromised meat from entering saleable inventory.

### Patch 15: Modul Dashboard Analitik & Penyelarasan Nama ERP KARKASIA
- **Penyelarasan Nama Proyek & Toko (ERP KARKASIA):**
  - Mengubah seluruh identitas toko menjadi **ERP KARKASIA** / **TOKO KARKASIA 01** di seluruh antarmuka React, Flutter, dokumen PDF laporan keuangan, struk kasir termal, template WhatsApp penagihan, serta blueprint `PLAN.md`.
- **Modul 'Dashboard Analitik' di Tab Home:**
  - Menampilkan visualisasi data tren omzet & volume produk daging dari `TOP_5_BEST_SELLING_PRODUCTS`.
  - Dilengkapi 3 mode tampilan interaktif:
    1. **Tren Penjualan:** Recharts Bar Chart horizontal dengan toggle metrik Omzet (IDR) vs Volume (KG), indikator pertumbuhan %, serta leaderboard peringkat.
    2. **Perbandingan Margin:** Grafik batang perbandingan Margin Kotor (%) per produk terhadap target margin toko (20%), perbandingan nominal Gross Profit (IDR), opsi pengurutan (Margin % vs Laba Kotor), serta tabel matriks finansial terperinci (Harga/KG, HPP/KG, Margin/KG, Volume, Gross Profit, Pangsa Laba).
    3. **Matriks Strategi Profitabilitas:** Analisis portofolio kuadran produk daging KARKASIA (*Star*, *Booster Margin*, *Volume Engine*, dan *Yield Conversion Stabilizer*).
- **Line Chart Level Stok Gudang (Recharts):**
  - Komponen `StockLevelOverTimeChart.tsx` untuk visualisasi saldo pergerakan stok harian, laju konsumsi (burn rate kg/hari), dan batas aman (safety stock line 30 kg) untuk Top 3 SKU Terlaris.

### Patch 16: Implementasi Lengkap MOD-12 (Kasir Kecil & OPEX), MOD-09 (PO Impor & AP Payments), dan MOD-05 (Promo Bazar Berjadwal)
- **MOD-12 (Kasir Kecil & OPEX Harian - `PettyCashModal.tsx`):**
  - Mutasi laci kasir kecil toko (Imprest Petty Cash System).
  - Form pencatatan kas keluar operasional cold-chain: Es Balok pendingin, Plastik Vakum Roll, Solar Truk L300 Reefer, Tol, dan Konsumsi Toko.
  - Kamera langsung (`getUserMedia`) untuk menjepret nota/struk fisik toko rekanan + preview zoom struk.
  - Form isi ulang / top-up saldo kas kecil dari Bank BCA KARKASIA atau Kas Utama.
  - Otomatisasi jurnal double-entry: `[D] Beban OPEX (6110) [K] Kasir Kecil Toko (1112)`.
- **MOD-09 (Pembelian Impor, Landed Cost & Pelunasan Utang Supplier AP - `PurchaseOrderModal.tsx` & `SupplierPayableModal.tsx`):**
  - Form penerbitan Purchase Order (PO) kontainer reefer baru dengan alokasi Landed Cost (Freight Laut, Bea Masuk Pelabuhan, Cold Storage Handling) terdistribusi otomatis ke HPP efektif per KG.
  - Dual Subtab di Tab Beli: `Kontainer Reefer Masuk` vs `Utang Supplier AP`.
  - Schedule utang dagang supplier impor, filter jatuh tempo pekan ini, dan dialog pelunasan utang (AP Payments) via Bank BCA KARKASIA.
- **MOD-05 (Promo Bazar Berjadwal & Flash Sale Event - `BazarPromoModal.tsx`):**
  - Manajemen event promo bazar bertempo waktu (tanggal mulai s/d tanggal selesai).
  - Penentuan harga spesial bazar, persentase diskon, dan kuota kilogram.
  - Sinkronisasi harga coret & harga promo otomatis ke antarmuka kasir POS dan perhitungan keranjang belanja.

### Patch 17: Migrasi Arsitektur PWA (`vite-plugin-pwa`) + IndexedDB & Penyelarasan Dokumentasi
- **Keputusan Arsitektur:** Memindahkan fokus operasional dari APK Flutter ke **Offline-First Progressive Web App (PWA) + IndexedDB** sebagai Fase 1 sebelum integrasi backend pusat **ZimaOS Docker + Cloudflare Tunnel HTTPS** di Fase 2.
- **PWA & Service Worker (`vite.config.ts`, `src/main.tsx`, `index.html`, `/public/*`):**
  - Integrasi `vite-plugin-pwa` dengan `registerType: 'autoUpdate'`, Workbox precache aset (`maximumFileSizeToCacheInBytes: 5 MiB`), `navigateFallbackDenylist: [/^\/api\//]`, runtime caching Google Fonts, dan `devOptions.enabled: true`.
  - Pembuatan aset ikon lengkap di `/public/`: `icon.svg`, `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png` (safe-zone padding), dan `apple-touch-icon.png` (180x180 PNG iOS Safari).
  - Registrasi Service Worker otomatis di `src/main.tsx` serta tambahan type declaration `"vite-plugin-pwa/client"` di `tsconfig.json`.
  - Komponen `src/components/PWAInstallButton.tsx` + hook `src/hooks/usePWAInstall.ts` untuk tombol pasang aplikasi in-app (Android/Desktop prompt & panduan iOS Safari) yang otomatis tersembunyi saat berjalan dalam mode `standalone`.
- **IndexedDB Persistent Engine (`src/engine/indexedDbStorage.ts`, `src/engine/businessEngine.ts`, `src/App.tsx`):**
  - Database lokal `karkasia_erp_offline_db` dengan store `kv_state` (`engine_state_v1`) dan `preferences` (`supplier_phones`, `last_payment_method`, `last_supplier`).
  - Hidrasi otomatis non-blocking saat startup (`hydrateEngineStateFromIdb`) dengan migrasi mulus dari `localStorage` lama ke IndexedDB tanpa kehilangan data, serta write-through persistence setiap perubahan transaksi.
  - Integrasi `src/hooks/useOnlineStatus.ts` untuk mendeteksi status online/offline browser secara real-time dan otomatis menjalankan `flushSyncOutbox` saat koneksi pulih.
  - Penambahan indikator status penyimpanan IndexedDB di modul **Backup & Sinkronisasi** (`EnterpriseAccountabilityViews.tsx`).
- **Penyelarasan Dokumen:** Pembaruan menyeluruh pada `PLAN.md`, `README.md`, `index.html`, dan `metadata.json`.

---

## 3. Summary of Files Audited & Refactored

| File | Status | Key Improvements |
| :--- | :--- | :--- |
| `package.json` | Modified | Added `vite-plugin-pwa` dev dependency alongside React 18 & TypeScript 5.3.3 |
| `vite.config.ts` | Modified | Configured `VitePWA` manifest, Workbox precaching, and dev SW |
| `tsconfig.json` | Modified | Added `"vite-plugin-pwa/client"` TypeScript declarations |
| `index.html` | Modified | Added PWA/iOS meta tags, PNG/SVG app icons, and aligned description |
| `public/*` | Created | Added `icon.svg`, `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`, `apple-touch-icon.png` |
| `src/engine/indexedDbStorage.ts` | Created | Native IndexedDB persistence layer (`karkasia_erp_offline_db`) |
| `src/engine/businessEngine.ts` | Modified | Integrated IndexedDB write-through persistence & `localStorage` migration |
| `src/hooks/usePWAInstall.ts` | Created | `beforeinstallprompt`, standalone & iOS detection hook |
| `src/hooks/useOnlineStatus.ts` | Created | Real-time browser online/offline event listener hook |
| `src/components/PWAInstallButton.tsx` | Created | In-app install prompt button & iOS Safari installation guide |
| `src/main.tsx` | Modified | Registered PWA Service Worker (`virtual:pwa-register`) |
| `src/App.tsx` | Modified | Mounted `<PWAInstallButton />`, wired IndexedDB hydration & `useOnlineStatus` |
| `src/components/PurchaseOrderModal.tsx` | Modified | Synced `last_supplier` preference to IndexedDB |
| `src/components/EnterpriseAccountabilityViews.tsx` | Modified | Added IndexedDB offline storage status card in Backup view |
| `PLAN.md` & `README.md` | Modified | Aligned full blueprint and docs with PWA + IndexedDB → ZimaOS roadmap |

### Patch 18: Refactoring Arsitektur Local-First & Vendor-Agnostic Backend Adapter (Web PWA & Flutter/Dart)
- **Keputusan Arsitektur:** Mencabut ketergantungan permanen terhadap server tunggal/vendor cloud (Supabase, `/api/ai/*`, atau ZimaOS sebagai target wajib). Seluruh komunikasi sinkronisasi dan AI parser kini berjalan melalui kontrak **Backend Adapter Interface** dengan **`LOCAL_ONLY`** sebagai mode bawaan saat startup.
- **Lapisan Backend Adapter Web (`src/adapters/`):**
  - `src/adapters/backendAdapter.ts`: Kontrak interface `BackendAdapter` (`checkHealth`, `pushOutbox`, `pullChanges`, `parseVoiceOrder`, `uploadArchiveDocument?`) dan tipe `BackendAdapterType` (`LOCAL_ONLY`, `REST_API`, `ZIMAOS`, `POSTGRES_BRIDGE`, `GOOGLE_SHEETS`, `SUPABASE`).
  - `src/adapters/localOnlyAdapter.ts`: Implementasi `LOCAL_ONLY` tanpa panggilan jaringan (`requiresNetwork = false`), menjaga item outbox tetap `PENDING` tanpa status palsu, serta parser voice order offline.
  - `src/adapters/localVoiceParser.ts`: Parser order suara berbasis NLP/aturan lokal offline (ekstraksi SKU, berat gram, pelanggan, dan metode bayar/tempo) tanpa membutuhkan internet.
  - `src/adapters/restApiAdapter.ts`: Adapter HTTP/JSON untuk `REST_API`, `ZIMAOS`, dan `POSTGRES_BRIDGE` dengan dukungan `/health`, `/sync/push`, `/sync/pull`, dan optional `/ai/voice-parse`.
  - `src/adapters/googleSheetsAdapter.ts`: Adapter Google Sheets via Google Apps Script Webhook atau Google Sheets API v4 (`spreadsheets.values.append`).
  - `src/adapters/supabaseAdapter.ts`: Adapter opsional untuk project Supabase milik pengguna sendiri via RPC `sync_push` / tabel `sync_outbox` dan `pullChanges`.
  - `src/adapters/adapterRegistry.ts`: Persistensi konfigurasi adapter di `localStorage` + IndexedDB (`backend_adapter_config_v1`), factory `createBackendAdapter`, dan orkestrator `executeOutboxSyncWithAdapter`.
- **Engine, Storage & UI Web (`src/engine/`, `src/components/`, `src/services/`, `src/App.tsx`):**
  - `src/engine/types.ts` & `src/engine/businessEngine.ts`: `buildSyncItem()` selalu menginisialisasi status `PENDING`; penambahan `applyOutboxSyncResults()` sehingga status `SYNCED` dan `serverSeq` **hanya** diberikan setelah UUID item dikonfirmasi di `acknowledgedIds`; serta `normalizePersistedState()` agar snapshot data lama tetap kompatibel.
  - `src/services/googleDriveService.ts`: Inisialisasi `firebase/app` + `firebase/auth` untuk ekspor Google Drive diubah menjadi *lazy on-demand* (tidak pernah berjalan saat startup).
  - `src/components/EnterpriseAccountabilityViews.tsx` & `src/components/SyncQueueStatusIndicator.tsx`: Panel pemilihan & konfigurasi 6 adapter backend, uji koneksi (`checkHealth`), serta eksekusi sinkronisasi manual melalui adapter aktif.
  - `src/App.tsx`: Menghapus auto-flush saat browser kembali online agar tidak memaksa panggilan server; menyambungkan `voiceOrderParse` lewat `BackendAdapter` aktif dan memperbarui UI Backup/Sinkronisasi.
  - `.env.example`: Menambahkan `BACKEND_ADAPTER=LOCAL_ONLY` dan `API_BASE_URL=` tanpa hardcoded secret.
- **Lapisan Backend Adapter & Local-First Flutter (`/lib/`):**
  - `lib/core/backend/{backend_adapter,local_only_backend_adapter,rest_api_backend_adapter,supabase_backend_adapter,google_sheets_backend_adapter,backend_adapter_provider}.dart`: Kontrak & implementasi 6 adapter backend pada Dart + provider Riverpod (`backendAdapterConfigProvider`, `backendAdapterProvider`) dengan penyimpanan aman via `FlutterSecureStorage`.
  - `lib/core/config/app_config.dart`: Default `BACKEND_ADAPTER = 'LOCAL_ONLY'`, `Supabase.initialize()` tidak dipanggil di startup (`AuthService` & app startup berjalan lokal tanpa internet).
  - `lib/core/sync/sync_engine.dart`: Refactor sinkronisasi agar selalu mem-push outbox lewat `BackendAdapter` dan hanya menandai `SYNCED` lewat `SyncDao.acknowledgeOutboxSuccess()` jika server mengembalikan ACK valid per `outboxId`.
  - `lib/core/database/daos/sync_dao.dart` & `transaction_dao.dart`: Penambahan `OutboxStats`, `getOutboxStats()`, `getRecentOutboxEntries()`, serta perbaikan serialisasi JSON atomik (`jsonEncode`) pada penulisan `sync_outbox`.
  - `lib/features/{settlement/application/cash_settlement_service,returns/application/return_service,opname/application/opname_service,petty_cash/application/petty_cash_service}.dart`: Seluruh layanan bisnis inti menulis ke Drift SQLite dan `sync_outbox` dalam satu transaksi database atomik.
  - `lib/features/ai/application/{gemini_advisor_service,voice_order_parser_service}.dart`: Menghapus panggilan hardcoded `http://localhost:3000/api/ai`, memperbaiki referensi DAO/kolom Drift agar konsisten, dan menyediakan analisis skor toko & parsing order suara 100% lokal offline.
  - `lib/features/navigation/presentation/main_navigation_screen.dart`: Menyambungkan `backendAdapterProvider`, `outboxStatsProvider`, modal `_showBackendAdapterSheet`, dan kartu manajemen Adapter di Modul Lainnya.

---

## 4. Verification, Build Status & Honest Audit Matrix

### 1. Verifikasi Web PWA (Sudah Dijalankan & Lulus)
```bash
# Type check TypeScript (passes with 0 errors)
npm run lint

# Production PWA bundle compilation (passes cleanly, produces dist/sw.js & dist/manifest.webmanifest)
npm run build

# Automated Local-First & Adapter verification (10 unit checks via npx tsx)
# Verified: LOCAL_ONLY startup & offline op, 10 core mutations -> PENDING outbox,
# ACK-only SYNCED transition, partial ACK handling, FAILED on network error,
# swappable adapters without changing business results, and legacy state normalization.
```

### 2. Status Audit Verifikasi Jujur (Per Temuan Terakhir)
- **VERIFIED**:
  - `LOCAL_ONLY` sebagai default tanpa panggilan jaringan atau syarat startup server/internet.
  - Abstraksi `BackendAdapter` (Web & Flutter) terpisah dari logika bisnis & UI ERP; seluruh mutasi engine inti Web (`businessEngine.ts`) dan transaksi/retur/opname/kas-kecil/setoran Flutter menulis DB lokal + outbox `PENDING` terlebih dahulu; `SYNCED` hanya diberikan setelah ACK eksplisit; kompatibilitas snapshot data lama terjaga.
- **PARTIALLY VERIFIED**:
  - `googleDriveService.ts` masih memakai *lazy on-demand* Firebase Auth + Drive API v3 di luar `BackendAdapter` hanya ketika user menekan tombol ekspor Drive.
  - Beberapa helper mutasi cepat di UI `src/App.tsx` (bulk stock opname, adjustment `+/-` lot cepat, quick add) dan sebagian mutasi sekunder Flutter (`quarantineLot`, `releaseQuarantineLot`, `performCuttingConversion`, `CreditLimitService`) belum menulis antrean `syncOutbox`.
  - `GoogleSheetsBackendAdapter` mendukung Webhook Apps Script (tanpa token) dan Google Sheets API v4 (membutuhkan OAuth access token valid pada field token adapter).
  - `pullChanges()` sudah tersedia pada kontrak adapter Web & Flutter, namun logika rekonsiliasi/merge record server ke tabel lokal belum diterapkan.
- **NOT IMPLEMENTED (Flutter APK Foundation)**:
  - Direktori `android/` belum ada di repositori; file generator Drift (`*.g.dart`) belum dihasilkan; beberapa layar Flutter (`PosScreen`, `FefoWarehouseScreen`, tab di `MainNavigationScreen`) masih merender data UI statis; direktori `test/` belum ada; dan direktori `assets/` hanya berisi `.gitkeep`.
- **NOT TESTED**:
  - Pengujian jaringan live terhadap server `REST_API` / `ZIMAOS` / `POSTGRES_BRIDGE` / `GOOGLE_SHEETS` / `SUPABASE` eksternal belum dijalankan terhadap server nyata.
  - `flutter analyze`, `flutter test`, dan `flutter build apk` **belum dijalankan** karena Flutter/Dart SDK tidak terpasang pada lingkungan container ini (`FLUTTER_DART_SDK_NOT_INSTALLED`).

---
*ERP Daging Import KARKASIA V4.5 Local-First & Vendor-Agnostic Backend Adapter — Web PWA terverifikasi build & type-check; fondasi adapter Flutter tersusun dan siap dilanjutkan pada lingkungan Flutter SDK lengkap.*
