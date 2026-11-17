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
| P0-01 | Signed offline authorization | Server RSA-signed lease 72 jam, endpoint penerbitan, verifikasi client, penyimpanan IndexedDB, dan fallback role saat session online habis sudah diimplementasikan | Lease terikat user/role/store/device; server memeriksa membership dan allow-list setiap penerbitan/renewal; signature, expiry, future-issued time, dan binding diverifikasi client. Revokasi online menghentikan penerbitan lease baru dan akses server; lease offline yang sudah terbit tetap berlaku maksimal sisa 72 jam. Uji tampering, expiry, identity/device mismatch, membership/device revocation, dan batas clock; dokumentasikan bahwa PWA tidak punya trusted clock anti-tamper saat offline |
| P0-02 | Sales ownership & stock projection | Proyeksi unauthenticated sekarang kosong; setelah login/lease Sales, UI dan IndexedDB/localStorage dipersist sebagai proyeksi Sales yang hanya memuat pelanggan assigned + UMUM dan data operasional tanpa HPP/keuangan/supplier. State tersimpan mempertahankan hanya outbox milik Sales yang diizinkan dengan seluruh field HPP/COGS dihapus; outbox lain dan idempotency key yang tidak terkait ikut dibuang. Pembersihan storage dijalankan serial melalui mutation queue. | **Masih parsial:** Sales storage isolation sudah ada; proyeksi server-side dan ownership menjadi bagian P0-03. Sales baru boleh dipakai setelah bootstrap katalog/stok awal dan acceptance sync dinyatakan lulus. |
| P0-03 | Sales sync & media authorization | Implementasi server sekarang membangun ownership index dari event log GAS; push memverifikasi assigned customer/invoice; pull memproyeksikan MASTER_DATA/SALE/RETURN/PAYMENT/VOID/stock tanpa HPP/supplier/keuangan toko; media upload/download terikat ke return milik Sales; event sale yang diterima menghitung ulang HPP dari lot penerima, bukan payload Sales. | **Belum final:** bootstrap snapshot katalog/stok awal untuk perangkat Sales baru, integrasi route end-to-end, dan uji cursor/pagination/media lintas perangkat masih harus lulus sebelum dinyatakan siap. |
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


## 9. Standar Proporsional untuk ERP Internal

ERP DAGING dipakai untuk satu bisnis milik Owner dengan tim terbatas (maksimal 1 Owner, 2 Admin, 5 Sales / sekitar 8 perangkat). Ini bukan SaaS multi-tenant atau ERP korporasi. Fase 0 harus menghindari scope dan kontrol enterprise yang tidak punya manfaat nyata untuk konteks tersebut.

- Bangun satu aplikasi operasional dan satu backend aktif yang dapat diganti melalui adapter; jangan membangun tenant management, billing SaaS, microservices, Kubernetes, service mesh, atau multi-region active-active tanpa kebutuhan terbukti.
- Tetap wajib: autentikasi, otorisasi server-side, role/assignment data isolation, perlindungan secret, validasi, audit trail tindakan penting, serta backup/restore yang teruji. Kesederhanaan bukan alasan melemahkan kontrol data.
- Tidak perlu SSO korporasi, MFA wajib pada semua aktivitas, approval berlapis, SIEM/SOC, sertifikasi compliance, SLA 99.99%, atau load test ribuan pengguna kecuali kebutuhan nyata muncul.
- Aktivitas rutin harus lancar tanpa menunggu Owner; approval hanya untuk pengecualian/tindakan sensitif yang sudah ditetapkan aturan bisnis. Utamakan validasi otomatis, warning, dan pencatatan.
- Test harus realistis untuk skala maksimal 8 perangkat: role/authorization, transaksi offline, reconnect/retry, konflik, media, backup/restore, dan build. Jangan menambahkan program pengujian korporasi yang tidak meningkatkan risiko yang benar-benar relevan.
- Hosting tetap keputusan Owner. Siapkan konfigurasi portable; jangan memaksakan multi-environment enterprise pipeline atau deployment live.
- Kualitas laporan stok, HPP, penjualan, margin, piutang/utang, kas/bank, pajak, laba rugi, dan audit tetap profesional dan akurat.

Setiap usulan teknis harus menjawab kebutuhan/risiko apa yang diselesaikan, mengapa cara paling sederhana tidak cukup, serta apakah biaya operasi dan perawatannya masuk akal tanpa tim IT khusus.
