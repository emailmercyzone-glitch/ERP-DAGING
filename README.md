# ERP DAGING (V4.8 — PWA Local-First, Backup & Restore)

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
- **Fondasi penyimpanan lokal:** IndexedDB (`karkasia_erp_offline_db`) pada setiap perangkat. Transaksi inti dicatat secara Local-First tanpa bergantung pada koneksi internet.
- **Backend/sinkronisasi:** configurable, tidak dikunci pada satu vendor. Opsi yang dapat dievaluasi mencakup Google Apps Script (GAS), REST API dengan PostgreSQL, Supabase, atau layanan lain yang sesuai kebutuhan.
- **Skala multi-device:** maksimal **8 perangkat: 1 Owner, 2 Admin, dan 5 Sales**. Backend yang dipilih harus mendukung sinkronisasi aman untuk skala ini.
- **Protokol:** Outbox, UUID, idempotency, ACK eksplisit, server sequence/cursor, push/pull, dan deteksi konflik harus konsisten lintas adapter.
- **Lampiran:** foto/bukti memiliki alur penyimpanan dan sinkronisasi tersendiri; status kegagalan harus terlihat dan data tidak boleh dianggap berhasil tersimpan/tersinkron bila proses gagal.

PWA tidak boleh menyimpan password PostgreSQL, service-role key, atau secret server di bundle browser. PostgreSQL diakses melalui API/backend aman atau layanan terkelola dengan kontrol akses yang tepat. Pada satu konfigurasi operasional, gunakan satu backend sinkronisasi terpilih; jangan mengirim event paralel ke beberapa backend tanpa rancangan konsistensi.

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

## 7. Backup & Pemulihan
- **Penyimpanan lokal wajib:** setiap transaksi disimpan langsung ke IndexedDB dan Outbox pada device. Kegagalan server atau Google Drive tidak boleh membatalkan transaksi lokal.
- **Backend utama:** backend yang dipilih (target operasional ZimaOS bila dikonfigurasi) menangani sinkronisasi dan data bersama untuk transaksi yang sudah diterima/ACK.
- **Google Drive opsional:** jika Owner mengaktifkan backup alternatif, semua device mengotorisasi akun Google Owner melalui OAuth dan mengunggah langsung ke satu folder bersama `ERP DAGING BACKUP`. Tidak ada folder atau konfigurasi Drive per-device.
- **Format:** file JSON unik/versioned berisi data/event, Outbox, metadata, dan manifest; lampiran foto disimpan terpisah. Device ID asal tercatat sebagai metadata transaksi, bukan struktur folder.
- **Cadence:** pencatatan lokal selalu langsung. Incremental per transaksi tidak membuat full JSON berulang; snapshot lokal dapat diatur 5/10 menit saat PWA aktif. Upload Drive diantrekan dan dikirim batch saat internet tersedia; background upload saat PWA ditutup tidak dijamin.
- **Restore:** Owner-only; sumber utama server, alternatif Google Drive, atau snapshot lokal. Selalu buat snapshot pengaman, validasi checksum/schema/lampiran, dan rekonsiliasi berdasarkan UUID/idempotency. Jangan overwrite seluruh database atau menimpa transaksi yang lebih baru.
- **Batas penting:** Drive membantu memulihkan backup per-device ketika ZimaOS down, tetapi bukan pengganti backend untuk sinkronisasi real-time antar-device. Status lokal, backend, dan Drive ditampilkan terpisah.

## 8. Dokumen Acuan

- `PLAN.md` — keputusan bisnis, arsitektur, modul, risiko, dan Change Register V4.8.
- `UI_UX_GUIDELINE.md` — prinsip dan panduan pengalaman pengguna.
- `README_PATCH.md` — riwayat patch dan catatan audit.
- `gas/README.md` — panduan untuk opsi adapter GAS (bukan backend wajib).

Jika README atau dokumen lama bertentangan dengan Change Register pada `PLAN.md`, keputusan terbaru pada Change Register yang berlaku.

## 9. Perintah Pengembangan dan Verifikasi

```bash
npm install
npm run dev
npm run lint
npm run build
```

Perintah di atas adalah langkah verifikasi lokal; keberhasilan CI, deployment backend yang dipilih, sinkronisasi multi-device, dan pengujian perangkat nyata harus dilaporkan berdasarkan hasil pengujian masing-masing, bukan diasumsikan dari build lokal.
