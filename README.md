# ERP DAGING (V4.6 — PWA Multi-Device, Local-First & GAS Sync)

**ERP operasional daging impor untuk UMKM: sederhana digunakan, profesional dalam pengolahan data dan laporan.**

Single Source of Truth: `PLAN.md`  
Panduan UI/UX: `UI_UX_GUIDELINE.md`  
Riwayat patch dan audit: `README_PATCH.md`

---

## 1. Arah Produk

ERP DAGING dirancang agar Owner, Admin, dan Sales dapat menjalankan aktivitas bisnis sehari-hari tanpa harus memahami prosedur ERP atau akuntansi yang rumit. Pengguna berinteraksi dengan istilah operasional; Business Engine menangani validasi, perhitungan, pencatatan, kontrol, dan penyusunan laporan di belakang layar.

**Prinsip produk: UI sederhana, mesin ERP profesional.** Penyederhanaan tidak berarti mengurangi akurasi stok, HPP, transaksi, audit trail, atau kelengkapan laporan.

## 2. Platform dan Arsitektur Aktif

- **Platform aktif:** installable Progressive Web App (PWA), React 18, TypeScript, Vite, Workbox, dan Tailwind CSS.
- **Penyimpanan lokal:** IndexedDB (`karkasia_erp_offline_db`) pada setiap perangkat. Transaksi inti dapat dicatat tanpa koneksi internet.
- **Sinkronisasi multi-device:** Google Apps Script Web App (GAS) sebagai satu-satunya gateway sinkronisasi aktif untuk maksimal **8 perangkat: 1 Owner, 2 Admin, dan 5 Sales**.
- **Event log:** Google Sheets digunakan oleh GAS sebagai penyimpanan event log. Perangkat tidak melakukan CRUD langsung terhadap tabel bisnis bersama.
- **Protokol:** Outbox, UUID, idempotency, ACK eksplisit, server sequence/cursor, push/pull, dan deteksi konflik.
- **Lampiran:** foto/bukti memiliki alur penyimpanan dan sinkronisasi tersendiri; status kegagalan harus terlihat dan data tidak boleh dianggap berhasil tersimpan/tersinkron bila proses gagal.

Flutter/APK dan backend alternatif (REST API, PostgreSQL Bridge, Supabase, ZimaOS) bukan target implementasi aktif. Jangan menambah beban pemeliharaan untuk platform/provider tersebut pada scope PWA saat ini.

## 3. Fitur Bisnis

- POS toko dan penjualan Sales lapangan.
- Persediaan berbasis lot dan FEFO, penerimaan barang, landed cost, serta HPP per lot.
- Konversi/yield, susut, dan quarantine.
- Skema OWN, CONSIGNMENT, dan AFFILIATE.
- Pembayaran tunai, transfer, tempo/campuran; piutang dan utang termasuk pembayaran parsial.
- Retur tervalidasi terhadap faktur dan kuantitas; void/reversal tanpa menghapus sejarah transaksi.
- Kas, bank, OPEX, audit trail, backup, dan restore termasuk lampiran.

## 4. Fitur Cerdas — Tetap Bagian Produk

- **OCR Nota:** foto nota diekstrak menjadi draft pembelian atau OPEX. Pengguna memeriksa dan mengoreksi hasil sebelum disimpan.
- **AI Advisor:** menganalisis data ERP, merangkum kondisi usaha, mendeteksi anomali, dan memberi rekomendasi. Angka resmi tetap berasal dari Business Engine dan harus dapat ditelusuri ke data sumber.
- **Voice Order:** ucapan diubah menjadi draft pesanan/transaksi. Item, berat, jumlah, pelanggan, dan harga harus diperiksa sebelum transaksi final.

Pemrosesan yang memerlukan layanan server dapat tidak tersedia saat offline. Kondisi tersebut tidak boleh memblokir POS atau transaksi inti. AI tidak boleh mengubah transaksi, stok, harga, pembayaran, atau saldo secara otomatis.

## 5. Laporan

ERP DAGING mempertahankan keluaran laporan profesional sesuai kelengkapan data: penjualan, laba rugi, margin, HPP, persediaan, pembelian/landed cost, piutang dan umur piutang, utang dan umur utang, kas/bank, OPEX, pajak, retur, audit, dan rekonsiliasi.

Pengguna tidak diwajibkan membuat jurnal manual atau memahami debit-kredit. Ringkasan laporan harus memiliki periode dan definisi angka serta dapat ditelusuri ke transaksi sumber. Jangan menyatakan laporan lengkap jika fondasi data belum mendukungnya; keterbatasan harus ditampilkan secara jelas.

## 6. Batas Offline Multi-Device

Setiap perangkat dapat mencatat transaksi berdasarkan data lokal terakhir. Karena stok digunakan bersama, angka stok pada perangkat offline bukan jaminan stok global real-time. Penjualan yang terjadi saat offline tetap dipertahankan; setelah sinkronisasi, potensi stok minus/oversell harus dideteksi dan direkonsiliasi tanpa menghapus transaksi.

Restore satu perangkat juga tidak boleh menimpa transaksi lebih baru dari perangkat lain. Restore wajib memeriksa status sinkronisasi dan membuat backup sebelum perubahan.

## 7. Dokumen Acuan

- `PLAN.md` — keputusan bisnis, arsitektur, modul, risiko, dan Change Register V4.6.
- `UI_UX_GUIDELINE.md` — prinsip dan panduan pengalaman pengguna.
- `README_PATCH.md` — riwayat patch dan catatan audit.
- `gas/README.md` — konfigurasi dan deployment GAS.

Jika README atau dokumen lama bertentangan dengan Change Register pada `PLAN.md`, keputusan terbaru pada Change Register yang berlaku.

## 8. Perintah Pengembangan dan Verifikasi

```bash
npm install
npm run dev
npm run lint
npm run build
```

Perintah di atas adalah langkah verifikasi lokal; keberhasilan CI, deployment GAS, sinkronisasi multi-device, dan pengujian perangkat nyata harus dilaporkan berdasarkan hasil pengujian masing-masing, bukan diasumsikan dari build lokal.
