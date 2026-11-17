# ERP DAGING — Fase 0 Execution Gate

Tanggal pembaruan: 2026-11-17  
Sumber keputusan: PLAN.md Section 13.3–13.4, 13.10, 13.44–13.50  
Status: **FASE 0 SIAP DIMULAI — P0 IMPLEMENTATION MASIH BERJALAN**

## 1. Tujuan

Menyelesaikan fondasi keamanan, sinkronisasi, backup/restore, konfigurasi portable, dan build PWA agar tersedia artefak yang dapat dijalankan. Dokumen ini mengatur urutan kerja dan bukti penerimaan; tidak mengubah keputusan bisnis yang sudah dikunci.

## 2. Batas platform dan deployment

- Platform aktif: React + TypeScript + Vite installable PWA.
- Flutter/APK bukan target aktif. Deliverable build adalah PWA production output (dist/) dan container image bila pipeline Docker digunakan.
- Hosting, provider, domain, region, dan deployment live tetap keputusan Owner dan ditunda.
- Tidak perlu HP fisik atau OAuth produksi untuk memulai implementasi, menulis test, menjalankan simulasi, atau membangun PWA.

## 3. Workstream P0

| ID | Workstream | Kondisi awal pada branch | Definition of Done sebelum build |
|---|---|---|---|
| P0-01 | Signed offline authorization | Belum tersedia grant offline bertanda tangan server | Grant terikat user/role/store/device, punya expiry dan version/revocation; client memverifikasi signature dan masa berlaku; test tampering, expiry, salah identitas, revoke, dan clock skew |
| P0-02 | Sales ownership & stock projection | Ada role policy/proyeksi UI lokal; bukan isolasi data server/at-rest | Assignment divalidasi dari data authoritative; response Sales hanya berisi data yang boleh diakses dan stock projection tanpa HPP/margin/keuangan/supplier/secret |
| P0-03 | Sales sync & media authorization | Sales sync masih fail-closed | Push/pull memeriksa ownership transaksi/customer; media download memeriksa parent record dan assignment; cursor/pagination/idempotency tetap konsisten |
| P0-04 | Backup gateway & deduplication | Ada kode Drive client-side awal; belum sesuai arsitektur gateway final | Device mengirim ke gateway; gateway memvalidasi Owner, schema, checksum, backup ID dan idempotency; upload ke satu folder Owner; lampiran terpisah; retry aman |
| P0-05 | Cross-device Drive restore | Ada listing/download/verifikasi dan restore lokal; restore perangkat pengganti masih dibatasi | Import event secara additive berdasarkan UUID/idempotency; Device ID baru dipertahankan; tidak overwrite event/state lebih baru; atomic rollback bila gagal |
| P0-06 | Multi-device acceptance harness | Ada simulasi GAS dua/lebih device pada test tertentu | Harness deterministik 2–8 client dengan role/device berbeda, offline queue, reconnect, retry, reorder, cursor, konflik, dan media; tidak membutuhkan HP fisik |

## 4. Konfigurasi portable

Siapkan tanpa memilih provider:
- Daftar environment variables: nama, fungsi, required/optional, format/validasi, dan contoh placeholder non-secret.
- Pemisahan konfigurasi publik PWA dari secret server.
- Build/start command, configurable port, liveness/readiness, HTTPS/reverse-proxy dan CORS guidance.
- OAuth Client ID/authorized-origin checklist dan membership registry format.
- Backend adapter contract dan konfigurasi endpoint.
- Test/mock configuration untuk menjalankan semua test tanpa secret produksi.

Tidak boleh commit credential/secret, menaruh secret di bundle browser atau Docker image, atau melakukan deployment live tanpa keputusan Owner.

## 5. Backup Google Drive — keputusan terkunci

- Satu akun Google Drive milik Owner.
- Satu folder bersama: ERP DAGING BACKUP.
- Semua device mengirim backup ke backend/gateway; gateway yang menangani validasi, deduplikasi, dan upload ke Drive.
- JSON snapshot unik/versioned; tidak menimpa satu file bersama.
- Lampiran disimpan terpisah dengan manifest dan checksum.
- Device ID hanya metadata asal transaksi; bukan folder atau konfigurasi per-device.
- Drive adalah backup eksternal, bukan backend sync dan bukan syarat transaksi offline.

## 6. Urutan verifikasi

1. Implementasi source P0-01 sampai P0-06.
2. Siapkan konfigurasi dan dokumentasi portable.
3. Jalankan unit, integration, authorization, browser/IndexedDB, contract, dan multi-device simulation tests.
4. Jalankan lint/typecheck.
5. Jalankan production PWA build.
6. Jalankan Docker build jika Docker menjadi bagian pipeline branch.
7. Catat commit SHA, command, exit status, jumlah test pass/fail, dan lokasi artefak dalam Build Report.
8. Setelah artefak tersedia, pengujian fisik dan live OAuth/Drive dapat dilakukan sebagai verifikasi terpisah.

## 7. Status pelaporan

- NOT_IMPLEMENTED — belum ada implementasi.
- IMPLEMENTED — source tersedia; belum menyatakan test lulus.
- CONFIG_READY — konfigurasi portable terdokumentasi; belum berarti credential live tersedia.
- AUTOMATED_TEST_PASSED — test lulus pada commit SHA tertentu.
- BUILD_PASSED — build lulus pada commit SHA tertentu.
- LIVE_INTEGRATION_PENDING — hanya untuk tes yang memerlukan environment/credential eksternal.
- PHYSICAL_VERIFICATION_PENDING — menunggu artefak dijalankan pada perangkat; bukan blocker coding/build.

Setiap status lulus wajib mencantumkan commit SHA dan bukti. Jangan mencampur status antar-commit.

## 8. Gerbang masuk Fase 0

**Fase 0 boleh dimulai sekarang.** Hosting belum dipilih, OAuth produksi belum dikonfigurasi, dan pengujian fisik belum dilakukan bukan alasan menahan implementasi.

Gerbang P0 implementation/build baru dinyatakan lulus setelah seluruh source workstream yang wajib selesai, test otomatis relevan lulus, lint/typecheck lulus, dan production PWA build berhasil pada commit yang sama. Docker build dilaporkan terpisah bila toolchain/runner mendukungnya.

Kelulusan Fase 0 bukan klaim production-ready. Live integration dan physical verification tetap dicatat sebagai tahap berikutnya setelah build tersedia.
\n\n## 9. Standar Proporsional untuk ERP Internal\n\nERP DAGING dipakai untuk satu bisnis milik Owner dengan tim terbatas (maksimal 1 Owner, 2 Admin, 5 Sales / sekitar 8 perangkat). Ini bukan SaaS multi-tenant atau ERP korporasi. Fase 0 harus menghindari scope dan kontrol enterprise yang tidak punya manfaat nyata untuk konteks tersebut.\n\n- Bangun satu aplikasi operasional dan satu backend aktif yang dapat diganti melalui adapter; jangan membangun tenant management, billing SaaS, microservices, Kubernetes, service mesh, atau multi-region active-active tanpa kebutuhan terbukti.\n- Tetap wajib: autentikasi, otorisasi server-side, role/assignment data isolation, perlindungan secret, validasi, audit trail tindakan penting, serta backup/restore yang teruji. Kesederhanaan bukan alasan melemahkan kontrol data.\n- Tidak perlu SSO korporasi, MFA wajib pada semua aktivitas, approval berlapis, SIEM/SOC, sertifikasi compliance, SLA 99.99%, atau load test ribuan pengguna kecuali kebutuhan nyata muncul.\n- Aktivitas rutin harus lancar tanpa menunggu Owner; approval hanya untuk pengecualian/tindakan sensitif yang sudah ditetapkan aturan bisnis. Utamakan validasi otomatis, warning, dan pencatatan.\n- Test harus realistis untuk skala maksimal 8 perangkat: role/authorization, transaksi offline, reconnect/retry, konflik, media, backup/restore, dan build. Jangan menambahkan program pengujian korporasi yang tidak meningkatkan risiko yang benar-benar relevan.\n- Hosting tetap keputusan Owner. Siapkan konfigurasi portable; jangan memaksakan multi-environment enterprise pipeline atau deployment live.\n- Kualitas laporan stok, HPP, penjualan, margin, piutang/utang, kas/bank, pajak, laba rugi, dan audit tetap profesional dan akurat.\n\nSetiap usulan teknis harus menjawab kebutuhan/risiko apa yang diselesaikan, mengapa cara paling sederhana tidak cukup, serta apakah biaya operasi dan perawatannya masuk akal tanpa tim IT khusus.\n