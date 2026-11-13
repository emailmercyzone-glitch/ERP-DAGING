# ERP KARKASIA (V4.4 - Offline-First PWA + IndexedDB)

**Aplikasi Enterprise Resource Planning (ERP) Daging Impor Cold-Chain untuk UMKM**  
*Single Source of Truth: Selaras dengan `PLAN.md` & `README_PATCH.md`*

---

## 1. Ringkasan Eksekutif & Arsitektur Aktif

Aplikasi ini melayani operasional rantai dingin (cold-chain) daging impor dengan pendekatan **Offline-First PWA**:
- **Tenant Isolation**: `TOKO_KARKASIA_01`
- **Arsitektur Stack Aktif (Fase 1)**:
  - **PWA (React 18 + Vite + `vite-plugin-pwa` + Workbox)**: Dapat di-install langsung ke layar utama HP Android, iOS Safari, maupun desktop (`display: standalone`), lengkap dengan precaching aset agar tetap terbuka instan tanpa internet.
  - **IndexedDB (`karkasia_erp_offline_db`)**: Penyimpanan lokal utama berkapasitas besar untuk transaksi POS, batch lot FEFO, utang-piutang, ledger stok, jurnal, audit trail, dan preferensi perangkat (dengan migrasi otomatis dari `localStorage`).
  - **Express / Vite Server Proxy (`/api/ai/*`)**: Layanan advisor bisnis & parser voice note order berbasis Gemini AI (server-side key safety).
- **Arsitektur Backend Pusat Berikutnya (Fase 2)**:
  - **ZimaOS (Docker + SQLite/PostgreSQL)** di server toko yang diakses aman melalui **Cloudflare Tunnel (HTTPS)** untuk sinkronisasi real-time antar HP kasir & sales lapangan via `syncOutbox`.

*(Catatan: Direktori `/lib/` berisi referensi arsitektur Flutter/Drift terdahulu yang dipertahankan sebagai arsip dan tidak dipakai oleh runtime web PWA aktif.)*

---

## 2. Fitur Utama yang Aktif

1. **Installable PWA & Ketahanan Offline Penuh**:
   - Tombol pasang aplikasi bawaan (`Pasang Aplikasi` untuk Android/Desktop & panduan `Pasang di iPhone` untuk iOS Safari) di header atas.
   - Deteksi status koneksi otomatis (`useOnlineStatus`) dengan indikator netral **"Belum tersinkron"** saat offline dan pengiriman otomatis `syncOutbox` saat online kembali.
   - Diagnostik penyimpanan IndexedDB + ekspor/impor file cadangan `.json` ber-checksum serta backup ke Google Drive.
2. **Zero-Float Policy (Akurasi Gram & Rupiah)**:
   - Mata uang: Integer Rupiah utuh (zero decimal).
   - Berat daging: Integer Gram utuh (`weightGram`, 1 kg = 1000 gram).
3. **Alur Operasional Ramah Orang Awam (UX Terkunci)**:
   - 5 Tab Utama: **Ringkasan**, **Kasir**, **Beli Stok**, **Stok & Harga**, dan **Tagihan**.
   - Kasir POS ≤3 ketukan dengan default pintar (metode bayar terakhir, uang pas, pelanggan utama, supplier terakhir).
   - Quick Contact WhatsApp pada Tagihan Supplier (`BELUM_LUNAS` dengan badge perhatian berdenyut) & pelunasan AP/AR terpadu.
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
