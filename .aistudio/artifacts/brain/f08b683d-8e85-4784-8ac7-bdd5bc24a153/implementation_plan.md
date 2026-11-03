# BLUEPRINT SOLID ERP DAGING IMPORT UMKM (V4.3 - AUDITED FINAL)
**Project**: ERP Supplier Daging Import - Sampora Banten  
**Platform**: Flutter Android (Offline-First 100%) + Supabase Cloud + Full-Stack Web Simulator  
**Status**: **FASE 0 s.d FASE 3 SELESAI PENUH (PRODUCTION READY & VERIFIED)**

---

## 1. Ringkasan Eksekutif & Status Roadmap (Fase 0 s.d Fase 3)

| Fase | Cakupan Blueprint | Status | Bukti File & Implementasi |
|---|---|---|---|
| **Fase 0** | Spike & Fondasi (Clean Architecture, Drift + SQLCipher, Supabase schema) | ✅ Selesai | `pubspec.yaml`, `lib/core/database/`, `supabase/supabase_schema.sql` |
| **Fase 1** | Core Operational MVP (MOD-01 s.d MOD-07, MOD-09, MOD-10, MOD-11, MOD-15, MOD-16, MOD-17, MOD-19, Sync Engine) | ✅ Selesai | 23 Tabel Drift, 3 DAO, POS Dual-Mode, FEFO Greedy, ESC/POS 58mm, Surat Jalan PDF |
| **Fase 2** | Advance Features (MOD-07B Opname & Drip Loss, MOD-08 Retur & Credit Note, MOD-12 Kasir Kecil OPEX, MOD-13 PnL & Pajak PP 23/2018 0.5%) | ✅ Selesai | `opname_service.dart`, `return_service.dart`, `petty_cash_service.dart`, `tax_pnl_service.dart` |
| **Fase 3** | AI & Extensions (MOD-14 Advanced Gemini AI Store Advisor via Server Proxy & MOD-21 Voice Note Input Assistant) | ✅ Selesai | `server.ts` (Gemini 3.8 Flash proxy), `gemini_advisor_service.dart`, `voice_order_parser_service.dart`, `src/App.tsx` |

---

## 2. Arsitektur Fase 3 (Gemini AI & Voice Note Integration)

### A. Server-Side Proxy (`server.ts`)
Mengikuti instruksi ketat skill `gemini-api`:
- **Model**: `gemini-3.8-flash`
- **Telemetry**: `httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }`
- **Keamanan**: API Key hanya diakses di server-side (`process.env.GEMINI_API_KEY`), tidak pernah terekspos ke browser atau client bundle.
- **Dua Endpoint Resmi**:
  1. `POST /api/ai/advisor`:
     - Menerima ringkasan operasional toko (Health score, kas di tangan sales, piutang overdue, lot kritis mendekati expired, kasus stok minus).
     - Menghasilkan evaluasi eksekutif tajam, strategi obral FEFO & konversi potong tetelan, peringatan soft limit kas Rp 3.000.000, dan daftar checklist prioritas harian beserta PIC.
  2. `POST /api/ai/voice-parse`:
     - Menerima rekaman/transkrip pesan suara WhatsApp sales lapangan.
     - Menggunakan `responseSchema` terstruktur untuk mengekstrak data pelanggan, metode pembayaran (Cash / Transfer / Tempo dengan jumlah hari), dan item daging dalam **satuan Gram bulat** (zero float) beserta subtotal Rupiah.
     - Dilengkapi intelligent heuristic fallback bila perangkat offline atau kuota belum aktif.

### B. Flutter Clean Architecture (`lib/features/ai/`)
1. `lib/features/ai/application/gemini_advisor_service.dart`:
   - Agregator metrik lokal Drift SQLite (Stock movement, cash settlement, expiring lots).
   - Menghasilkan `AiStoreAdvisorReport` untuk Owner.
2. `lib/features/ai/application/voice_order_parser_service.dart`:
   - Parser audio/transkrip suara sales lapangan ke `VoiceParsedOrder`.
   - Mengonversi otomatis ke `CartItemRequest` untuk checkout instan di POS.

### C. Web Simulator UI (`src/App.tsx`)
- **Navigasi Tab Baru**: `AI Suite (MOD-14/21)` dengan badge `Fase 3 Active`.
- **Integrasi POS Tab**: Banner input suara cepat dengan simulator rekaman audio, tombol waveform visualizer, dan 1-click apply ke keranjang kasir.
- **Integrasi Owner Dashboard**: Kartu audit kilat AI Gemini 3.8 Flash yang terhubung langsung dengan diagnosis likuiditas kas dan rotasi lot gudang.

---

---

## 3. UI/UX DNA & Fitur Pelengkap Terintegrasi (Qasir Pro + GoPay/Tokopedia DNA)
1. **Komponen Visual Interaktif Recharts (Tab Laporan)**:
   - `BarChart` omzet harian 7 hari terakhir (omzet riil vs target harian) lengkap dengan tooltip interaktif dan margin kotor (%).
   - `PieChart` komposisi kategori daging (Primal Cut, Tetelan Konversi, Slice Shabu) dengan rincian persentase dan bobot kilogram riil.
2. **Sistem Ekspor PDF Dokumen Resmi Siap Cetak (`src/utils/pdfExport.ts`)**:
   - Header kop surat resmi PT Sampora Meat Center Banten (NPWP, Izin Cold Storage, Alamat & Kontak).
   - Ekspor Laporan Laba Rugi Komprehensif (Omzet, HPP, Laba Kotor, OPEX, Laba Operasi, PPh Final PP 23 0.5%, Laba Bersih Setelah Pajak).
   - Ekspor Buku Jurnal Umum Double-Entry audit-ready (Kas, Piutang, Persediaan Daging, Utang, Penjualan, HPP, Beban OPEX) dengan validasi keseimbangan Debit = Kredit.
3. **Sistem Peringatan Proaktif Safety Stock di POS**:
   - Deteksi otomatis produk yang stoknya mencapai atau di bawah batas minimum (`stockGram <= safetyStockGram`).
   - Banner Peringatan Kritis langsung di atas katalog POS dengan rincian sisa kilogram vs batas aman.
   - Tombol Rekomendasi 1-Klik: Sales dapat langsung menawarkan produk substitusi/alternatif (misal: Sirloin Choice USA pengganti Tenderloin AUS) langsung masuk ke keranjang +1kg dengan notifikasi toast reaktif.
   - Tag peringatan visual `Safety Stock` dan chip substitusi cepat pada masing-masing kartu produk di katalog POS.
4. **Kartu Ringkasan Eksekutif Nilai Aset Persediaan Daging (HPP / Landed Cost)**:
   - Menghitung total nilai modal tertanam di freezer cold storage secara real-time berdasarkan harga perolehan (HPP riil per lot).
   - Menampilkan 4 pilar metrik: Total Nilai Aset Daging (Rp 27.780.000), Total Bobot Stok Fisik (172.5 KG), Rata-Rata HPP/KG (Rp 161.043), dan Aset Berisiko FEFO Kadaluwarsa <=14 Hari (Rp 8.730.000).
   - Rincian valuasi per lot daging aktif (Ribeye, Sirloin, Tetelan, Tenderloin) beserta persentase kontribusi aset dan masa simpan.
   - Terintegrasi langsung dengan Quick Chip di Top Status Bar dan tabel dokumen Ekspor PDF resmi.

---

## 4. Matriks Kepatuhan Prinsip Utama (Locked Constraints)
- **Zero Float Integer Math**: Berat selalu dalam Gram bulat (`INTEGER`), uang selalu dalam Rupiah bulat (`BIGINT`).
- **Immutable Ledger**: `stock_ledger` murni insert-only, dilindungi trigger SQL dan Drift transaction.
- **Offline Is King**: Seluruh transaksi dan parsing suara memiliki fallback offline cerdas tanpa pernah memblokir operasional lapangan.
- **Verifikasi**: `compile_applet` build berhasil, `lint_applet` lolos 0 error (`tsc --noEmit`).

