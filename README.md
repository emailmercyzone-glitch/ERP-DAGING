# ERP DAGING (V4.8 — PWA Local-First, Backup & Restore)

**ERP operasional daging impor untuk UMKM: sederhana digunakan, profesional dalam pengolahan data dan laporan.**

Single Source of Truth: `PLAN.md`  
Panduan UI/UX: `UI_UX_GUIDELINE.md`  

---

## 1. Arah Produk

ERP DAGING dirancang agar Owner, Admin, dan Sales dapat menjalankan aktivitas bisnis sehari-hari tanpa harus memahami prosedur ERP atau akuntansi yang rumit. Pengguna berinteraksi dengan istilah operasional; Business Engine menangani validasi, perhitungan, pencatatan, kontrol, dan penyusunan laporan di belakang layar.

**Prinsip produk: UI sederhana, mesin ERP profesional.** Penyederhanaan tidak berarti mengurangi akurasi stok, HPP, transaksi, audit trail, atau kelengkapan laporan.

## 2. Platform dan Arsitektur Aktif

- **Platform aktif:** installable Progressive Web App (PWA), React 18, TypeScript, Vite, Workbox, dan Tailwind CSS. Source Flutter/APK yang tidak dipakai telah dikeluarkan dari repository utama.
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
- **AI Advisor:** menganalisis data ERP, merangkum kondisi usaha, mendeteksi anomali, dan memberi rekomendasi. Endpoint hanya untuk Owner dengan session ERP aktif; angka contoh/fallback tidak boleh ditampilkan sebagai data riil. Jika Gemini belum dikonfigurasi, layanan dinyatakan tidak tersedia.
- **Voice Order:** ucapan diubah menjadi draft pesanan/transaksi. Layanan AI server hanya menerima katalog produk aktual dari ERP dan memerlukan session aktif; jika tidak tersedia, parser lokal deterministic dipakai. Item, berat, jumlah, pelanggan, dan harga harus diperiksa sebelum transaksi final.

Pemrosesan yang memerlukan layanan server dapat tidak tersedia saat offline. Kondisi tersebut tidak boleh memblokir POS atau transaksi inti. AI tidak boleh mengubah transaksi, stok, harga, pembayaran, atau saldo secara otomatis.

## 5. Laporan

ERP DAGING mempertahankan keluaran laporan profesional sesuai kelengkapan data: penjualan, laba rugi, margin, HPP, persediaan, pembelian/landed cost, piutang dan umur piutang, utang dan umur utang, kas/bank, OPEX, pajak, retur, audit, dan rekonsiliasi.

Pengguna tidak diwajibkan membuat jurnal manual atau memahami debit-kredit. Ringkasan laporan harus memiliki periode dan definisi angka serta dapat ditelusuri ke transaksi sumber. Jangan menyatakan laporan lengkap jika fondasi data belum mendukungnya; keterbatasan harus ditampilkan secara jelas.

## 6. Batas Offline Multi-Device

Setiap perangkat dapat mencatat transaksi berdasarkan data lokal terakhir. Karena stok digunakan bersama, angka stok pada perangkat offline bukan jaminan stok global real-time. Penjualan yang terjadi saat offline tetap dipertahankan; setelah sinkronisasi, potensi stok minus/oversell harus dideteksi dan direkonsiliasi tanpa menghapus transaksi.

Restore satu perangkat juga tidak boleh menimpa transaksi lebih baru dari perangkat lain. Restore wajib memeriksa status sinkronisasi dan membuat backup sebelum perubahan.

## 7. Backup & Pemulihan
- **Penyimpanan lokal wajib:** setiap transaksi disimpan langsung ke IndexedDB dan Outbox pada device. Kegagalan server atau Google Drive tidak boleh membatalkan transaksi lokal.
- **Backend utama:** satu backend sinkronisasi yang dipilih dan dikonfigurasi aman menangani data bersama untuk transaksi yang sudah diterima/ACK. GAS, REST API + PostgreSQL, dan Supabase tetap opsi; tidak ada vendor yang otomatis dianggap terpilih.
- **Google Drive opsional:** jika Owner mengaktifkan backup alternatif, device mengirim data backup ke backend/gateway. Backend/gateway memvalidasi, melakukan deduplikasi, lalu mengunggah ke satu folder bersama `ERP DAGING BACKUP` milik Owner. Browser/device tidak mengunggah langsung ke Drive sebagai jalur arsitektur final.
- **Format:** file JSON unik/versioned berisi data/event, Outbox, metadata, dan manifest; lampiran foto disimpan terpisah. Device ID asal tercatat sebagai metadata transaksi, bukan struktur folder.
- **Cadence:** pencatatan lokal selalu langsung. Incremental per transaksi tidak membuat full JSON berulang; snapshot lokal dapat diatur 5/10 menit saat PWA aktif. Upload Drive diantrekan dan dikirim batch saat internet tersedia; background upload saat PWA ditutup tidak dijamin.
- **Restore:** Owner-only; sumber utama server, alternatif Google Drive, atau snapshot lokal. Snapshot file saat ini hanya dapat dipulihkan pada perangkat asal yang sama dan tidak lebih lama dari data aktif; backup lintas perangkat ditolak sampai alur impor event tersedia. State dan lampiran dipulihkan atomik setelah snapshot pengaman tersimpan di IndexedDB. Jangan overwrite transaksi yang lebih baru.
- **Batas penting:** Drive membantu memulihkan backup per-device ketika ZimaOS down, tetapi bukan pengganti backend untuk sinkronisasi real-time antar-device. Status lokal, backend, dan Drive ditampilkan terpisah.

## 8. Hosting & Deployment — Keputusan Owner, Ditunda

**Belum ada hosting/provider atau domain yang dipilih. Deployment aktual sengaja ditunda sampai Owner menentukan sendiri kapan dan ke mana aplikasi akan dipasang.** Tim engineering tidak boleh mengasumsikan provider, membuat akun/biaya layanan, membeli domain, atau melakukan deployment tanpa instruksi Owner.

Yang dikerjakan sekarang hanya persiapan teknis agar aplikasi siap dipindahkan ke hosting pilihan Owner:
- Dockerfile/image dan build PWA yang portabel.
- Dokumentasi environment variables dan daftar secret server.
- Build/start command, port binding, health/readiness checks.
- Panduan HTTPS/reverse proxy, CORS, serta checklist OAuth authorized origins.
- Smoke-test dan acceptance checklist untuk dijalankan setelah hosting dipilih.

Docker adalah format packaging, **bukan** keputusan hosting. Jangan memasukkan secret ke Git, image, atau bundle browser.

Pisahkan tiga status:
1. **Deployment preparation:** dikerjakan dan diuji sekarang.
2. **Backend/authentication readiness:** kode dan contract test disiapkan sekarang; login dan round-trip nyata menunggu environment yang nanti dipilih Owner.
3. **Hosting selection/live deployment:** keputusan Owner, ditunda, dan bukan blocker untuk pekerjaan coding Fase 0.

## 9. Dokumen Acuan

- `PLAN.md` — keputusan bisnis, arsitektur, modul, risiko, dan Change Register V4.8.
- `UI_UX_GUIDELINE.md` — prinsip dan panduan pengalaman pengguna.
- `gas/README.md` — panduan untuk opsi adapter GAS (bukan backend wajib).

Jika README atau catatan historis bertentangan dengan Change Register pada `PLAN.md`, keputusan terbaru pada Change Register yang berlaku.

## 10. Status Implementasi Backup & Restore

Status berikut membedakan fitur yang sudah ada di source dari keputusan desain yang belum diimplementasikan.

### Sudah diimplementasikan
- Backup lokal berupa file JSON yang dapat diunduh, termasuk data dan lampiran yang dikemas dalam backup.
- Validasi checksum saat file backup dipilih untuk restore.
- Metadata asal perangkat (`originDeviceId`) dan waktu ekspor pada envelope backup.
- Pemeriksaan keamanan restore snapshot: perangkat asal harus sama, waktu ekspor tidak boleh lebih lama dari data aktif, server sequence tidak boleh mundur, dan catatan transaksi append-only yang sudah ada harus tetap tercakup.
- Snapshot pengaman sebelum restore dan pemulihan state/lampiran secara atomik melalui IndexedDB.
- UI Owner untuk memulihkan snapshot pengaman terakhir dengan verifikasi PIN.
- Pengujian browser Chromium untuk alur restore IndexedDB, lampiran, snapshot pengaman, penolakan state stale, kegagalan penulisan, dan persistensi setelah reload.

### Belum diimplementasikan / belum diverifikasi
- Backend/gateway backup yang memvalidasi request, mengelola antrean/retry, melakukan deduplikasi UUID/idempotency, dan mengunggah ke folder bersama Drive Owner.
- Snapshot lokal terjadwal setiap 5/10 menit.
- Restore gabungan lintas perangkat dan rekonsiliasi event berdasarkan UUID/idempotency ke perangkat baru.
- OAuth Google Drive dan integrasi Drive live dengan akun Owner; ini menunggu konfigurasi credential/environment, bukan menahan implementasi atau test mock/contract.
- Uji fisik lintas perangkat/browser setelah production build tersedia; pengujian ini bukan gerbang mulai coding atau build.

Backup lokal yang sudah tersedia **bukan** berarti workflow Google Drive V4.8 sudah selesai. Kegagalan atau belum tersedianya backup eksternal tidak boleh dianggap sebagai bukti bahwa transaksi lokal gagal tersimpan.

## 11. Dokumen Pendukung

- `PLAN.md` — sumber keputusan bisnis, arsitektur, modul, risiko, dan Change Register.
- `UI_UX_GUIDELINE.md` — prinsip dan panduan pengalaman pengguna.
- `gas/README.md` — panduan untuk opsi adapter GAS; GAS bukan backend wajib.

## 12. Perintah Pengembangan dan Verifikasi

```bash
npm install
npm run dev
npm run lint
npm run build
```

Perintah di atas adalah langkah verifikasi lokal; keberhasilan CI, deployment backend yang dipilih, sinkronisasi multi-device, dan pengujian perangkat nyata harus dilaporkan berdasarkan hasil pengujian masing-masing, bukan diasumsikan dari build lokal.


## 13. Gerbang Masuk Fase 0

Platform aktif adalah **PWA**, bukan APK. Fase 0 boleh dimulai tanpa hosting/domain/provider yang dipilih, tanpa OAuth produksi, dan tanpa HP fisik. Urutan wajib adalah implementasi kode → konfigurasi portable → pengujian otomatis/simulasi multi-device → lint/typecheck → production PWA build → Docker build (bila dipakai) → build report → pengujian fisik setelah artefak tersedia.

Status P0 harus dibedakan: belum diimplementasikan, implemented, config-ready, automated-test-passed, build-passed, live-integration-pending, dan physical-verification-pending. Status fisik/live tidak boleh dipakai untuk menahan pekerjaan coding yang bisa dibuktikan otomatis.

Google Drive backup mengikuti keputusan Owner: satu akun Owner, satu folder bersama ERP DAGING BACKUP, file JSON unik/versioned, attachment terpisah, Device ID sebagai metadata, serta upload dan deduplikasi oleh backend/gateway. Tidak ada upload langsung dari browser ke Drive sebagai arsitektur final.

Rincian workstream, acceptance test otomatis, serta definisi gerbang implementasi/build terdapat pada Section 13.50 di PLAN.md.
\n\n## 14. Standar Implementasi: ERP Internal untuk Satu Bisnis\n\nERP DAGING adalah aplikasi internal milik Owner untuk satu bisnis dengan tim terbatas (maksimal 1 Owner, 2 Admin, 5 Sales / sekitar 8 perangkat), bukan SaaS multi-tenant atau ERP korporasi. Karena itu, engineering wajib memilih solusi yang sederhana, aman, akurat, dan mudah dirawat tanpa membangun kompleksitas enterprise yang tidak dibutuhkan.\n\n- Tidak membangun tenant onboarding, billing SaaS, konfigurasi banyak perusahaan, atau isolasi lintas pelanggan. Identitas store/device yang diperlukan untuk sinkronisasi tetap ada.\n- Autentikasi, otorisasi server-side, pembatasan data per role/assignment, perlindungan secret, audit trail, dan backup/restore tetap wajib. Tidak perlu SSO korporasi, MFA wajib untuk semua aktivitas, approval berlapis, SIEM/SOC, atau sertifikasi enterprise tanpa kebutuhan nyata.\n- Hindari microservices, Kubernetes, service mesh, multi-region active-active, dan infrastruktur high-availability kompleks. Pilih arsitektur paling sederhana yang memenuhi kebutuhan maksimal 8 perangkat.\n- Tidak menetapkan SLA korporasi 99.99% atau load test ribuan pengguna. Fokus pada transaksi lokal yang tetap berjalan offline, sinkronisasi aman, pemulihan data, dan pengujian realistis untuk skala operasional.\n- Aktivitas rutin tidak boleh menjadi bottleneck Owner. Approval hanya untuk tindakan berisiko yang memang ditentukan aturan bisnis; gunakan validasi otomatis, warning, dan audit trail.\n- Laporan bisnis tetap harus akurat dan lengkap sesuai kebutuhan ERP DAGING. Sederhana di operasional bukan berarti mengurangi kualitas data dan laporan.\n\nSetiap komponen/prosedur baru harus punya alasan bisnis atau risiko yang jelas, manfaatnya sepadan dengan biaya perawatan, dan bisa dioperasikan tanpa tim IT khusus.\n