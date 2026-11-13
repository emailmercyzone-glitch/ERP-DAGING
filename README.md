# ERP KARKASIA (V4.5 - Local-First & Vendor-Agnostic Backend Adapter)

**Aplikasi Enterprise Resource Planning (ERP) Daging Impor Cold-Chain untuk UMKM**  
*Single Source of Truth: Selaras dengan `PLAN.md` & `README_PATCH.md`*

---

## 1. Ringkasan Eksekutif & Arsitektur Aktif

Aplikasi ini melayani operasional rantai dingin (cold-chain) daging impor dengan pendekatan **Local-First & Vendor-Agnostic Backend Adapter** — server bukan keputusan permanen dan tidak pernah menjadi syarat startup aplikasi:

- **Tenant Isolation**: `TOKO_KARKASIA_01`
- **Mode Default (`LOCAL_ONLY`)**: Aplikasi langsung berjalan penuh secara offline di perangkat tanpa internet, tanpa server, dan tanpa login cloud.
- **Arsitektur Web PWA Aktif (`src/`)**:
  - **PWA (React 18 + Vite + `vite-plugin-pwa` + Workbox)**: Installable ke HP Android, iOS Safari, maupun desktop (`display: standalone`) dengan precaching aset offline.
  - **IndexedDB (`karkasia_erp_offline_db`)**: Penyimpanan lokal utama untuk transaksi POS, batch lot FEFO, utang-piutang, ledger stok, jurnal akuntansi, audit trail, dan `syncOutbox` (dengan migrasi aman dari `localStorage` via `normalizePersistedState`).
  - **Backend Adapter Interface (`src/adapters/backendAdapter.ts`)**: Memungkinkan pertukaran backend tanpa mengubah UI maupun aturan bisnis ERP (`src/engine/businessEngine.ts`):
    - `LOCAL_ONLY` *(Default — offline penuh tanpa server)*
    - `REST_API` *(Server HTTP/JSON `/health`, `/sync/push`, `/sync/pull`)*
    - `ZIMAOS` *(Opsi server self-hosted lokal/tunnel)*
    - `POSTGRES_BRIDGE` *(Gateway PostgreSQL mandiri)*
    - `GOOGLE_SHEETS` *(Webhook Apps Script / Google Sheets API v4)*
    - `SUPABASE` *(Opsi opsional berbasis URL & Anon Key pengguna)*
  - **AI & Voice Order Offline-First**: MOD-21 Voice Note Parser (`src/adapters/localVoiceParser.ts`) dan MOD-14 Store Health Advisor berjalan lokal tanpa bergantung mutlak ke server `/api/ai/*`, dengan dukungan opsional delegasi ke adapter yang mendukung endpoint eksternal.
- **Arsitektur Mobile Flutter (`/lib/`)**:
  - Direfaktor ke pola **Local-First + `BackendAdapter`** (`lib/core/backend/*`, `SyncEngine`, Drift SQLite/SQLCipher, parser & advisor lokal di `lib/features/ai/application/`).
  - **Catatan Status Build APK**: Source Flutter belum siap kompilasi APK Android karena direktori `android/`, file generator Drift (`*.g.dart`), `test/`, dan aset nyata (`assets/`) belum dibuat, beberapa layar Flutter masih memakai daftar statis, dan SDK Flutter/Dart belum tersedia di container saat ini.

---

## 2. Fitur & Jaminan Arsitektur Utama

1. **Local-First Outbox & Strict ACK**:
   - Semua mutasi bisnis inti disimpan di DB lokal terlebih dahulu dan antre di `syncOutbox` dengan status awal **`PENDING`**.
   - Status **`SYNCED`** hanya diberikan lewat `applyOutboxSyncResults()` (Web) / `SyncDao.acknowledgeOutboxSuccess()` (Flutter) setelah backend mengirim **ACK eksplisit**. Dalam mode `LOCAL_ONLY`, antrean tetap jujur berstatus `PENDING`.
   - Status koneksi real-time (`useOnlineStatus`) + kontrol pemilihan Adapter & sinkronisasi manual tersedia di **Backup & Sinkronisasi** (`SyncQueueStatusIndicator` & `EnterpriseAccountabilityViews`).
   - Ekspor PDF ke Google Drive (`src/services/googleDriveService.ts`) hanya memicu autentikasi OAuth secara *lazy on-demand* saat tombol ekspor ditekan.
2. **Zero-Float Policy (Akurasi Gram & Rupiah)**:
   - Mata uang: Integer Rupiah utuh (zero decimal).
   - Berat daging: Integer Gram utuh (`weightGram`, 1 kg = 1000 gram).
3. **Alur Operasional Ramah Orang Awam (UX Terkunci)**:
   - 5 Tab Utama: **Ringkasan**, **Kasir**, **Beli Stok**, **Stok & Harga**, dan **Tagihan**.
   - Kasir POS cepat dengan default pintar, Voice Order Assistant offline-first, serta Bulk QR Scan dengan tombol **Undo**.
   - Quick Contact WhatsApp pada Tagihan Supplier (`BELUM_LUNAS`) & pelunasan AP/AR terpadu.
4. **FEFO Cold-Chain, Yield Conversion & Immutable Ledger**:
   - Alokasi stok otomatis berbasis FEFO (tanggal kedaluwarsa terdekat) dan segregasi lot karantina retur.
   - Konversi pemotongan primal (`OUT_CONVERSION` → `IN_CONVERSION` Tetelan + `OUT_CUTTING_LOSS`) dengan redistribusi HPP otomatis.
   - Ledger pergerakan stok (`stockLedger`) bersifat append-only dengan jejak audit ber-checksum & pembatalan resmi melalui `VOID_REVERSAL` ber-PIN Owner.

---

## 3. Perintah Pengembangan & Verifikasi

```bash
# Install dependensi
npm install

# Jalankan dev server + PWA dev service worker di port 3000
npm run dev

# Cek tipe TypeScript (0 error)
npm run lint

# Build produksi PWA (menghasilkan dist/sw.js & dist/manifest.webmanifest)
npm run build
```
