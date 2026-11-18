# ERP DAGING — Fase 0 Execution Gate

Tanggal pembaruan: 2026-11-17  
Sumber keputusan: PLAN.md Section 13.3–13.4, 13.10, 13.44–13.50  
Status: **P0 VIRTUAL VERIFICATION BERJALAN — APK DELIVERY TIDAK MENUNGGU TES FISIK**

## 1. Tujuan

Menyelesaikan fondasi keamanan, sinkronisasi, backup/restore, konfigurasi portable, dan build PWA agar tersedia artefak yang dapat dijalankan. Dokumen ini mengatur urutan kerja dan bukti penerimaan; tidak mengubah keputusan bisnis yang sudah dikunci.

## 2. Batas platform dan deployment

- Basis aplikasi: React + TypeScript + Vite installable PWA dengan IndexedDB.
- Deliverable Owner: APK Android yang membungkus PWA. PWA production output tetap menjadi input wrapper; artifact PWA tidak boleh disebut APK.
- Pipeline Android APK sudah ditambahkan melalui Capacitor 8 dan CI. Bukti APK pada head terbaru tetap harus diverifikasi ulang; jangan menyamakan PWA artifact dengan APK.
- Hosting, provider, domain, region, dan deployment live tetap keputusan Owner dan ditunda.
- Semua pengujian yang bisa dijalankan virtual wajib dilakukan sebelum APK diserahkan. Tes fisik dilakukan Owner setelah APK tersedia dan **tidak menjadi gerbang penahan APK**.

## 3. Workstream P0

| ID | Workstream | Kondisi awal pada branch | Kriteria verifikasi virtual dan delivery |
|---|---|---|---|
| P0-01 | Signed offline authorization | Server RSA-signed lease 72 jam, endpoint penerbitan, verifikasi client, penyimpanan IndexedDB, dan fallback role saat session online habis sudah diimplementasikan | Lease terikat user/role/store/device; server memeriksa membership dan allow-list setiap penerbitan/renewal; signature, expiry, future-issued time, dan binding diverifikasi client. Revokasi online menghentikan penerbitan lease baru dan akses server; lease offline yang sudah terbit tetap berlaku maksimal sisa 72 jam. Uji tampering, expiry, identity/device mismatch, membership/device revocation, dan batas clock; dokumentasikan bahwa PWA tidak punya trusted clock anti-tamper saat offline |
| P0-02 | Sales ownership & stock projection | Proyeksi unauthenticated kosong; setelah login/lease Sales, IndexedDB/localStorage dipersist sebagai proyeksi Sales yang hanya memuat pelanggan assigned + UMUM dan data operasional tanpa HPP/keuangan/supplier; detail stock ledger tidak disimpan/ditampilkan. State hanya mempertahankan outbox Sales yang diizinkan dan menghapus field HPP/COGS, outbox lain, serta idempotency key yang tidak terkait. Perubahan Sales ID mereset cursor/snapshot lama. Pembersihan berjalan serial melalui mutation queue. Native Chromium test pada SHA `e79802b9` membuktikan persisted snapshot tetap terisolasi setelah page reload. | **Local persistence isolation: AUTOMATED_TEST_PASSED** pada commit `e79802b9acd815eb6bb0e1c679eab22eade94d58`, CI #44250362547. Server-side projection/ownership dan bootstrap/sync acceptance tetap di P0-03. |
| P0-03 | Sales sync & media authorization | Implementasi server sekarang membangun ownership index dari event log GAS; push memverifikasi assigned customer/invoice; pull memproyeksikan MASTER_DATA/SALE/RETURN/PAYMENT/VOID/stock tanpa HPP/supplier/keuangan toko. Penjualan Sales lain dikirim sebagai delta lot anonim saja agar stok bersama tetap akurat tanpa membuka faktur/pelanggan/harga; void Sales lain dikirim sebagai pemulihan stok anonim. Media upload/download terikat ke return milik Sales; event sale yang diterima menghitung ulang HPP dari lot penerima, bukan payload Sales. Reassignment pelanggan ke Sales lain dikirim ke perangkat lama sebagai tombstone ID-only; remote event log tidak menyimpan ulang nama/kontak pelanggan yang sudah tidak berhak dilihat. | **Belum final:** bootstrap snapshot katalog/stok awal untuk perangkat Sales baru, integrasi route end-to-end, dan uji cursor/pagination/media lintas perangkat masih harus lulus sebelum dinyatakan siap. |
| P0-04 | Backup gateway & deduplication | Browser tidak mengakses Drive langsung. Semua device terdaftar (Owner/Admin/Sales) mengirim snapshot role-scoped melalui session ERP ke gateway; snapshot harian menjadi recovery point, sedangkan perubahan baru yang masih pending di Outbox dibatch minimal per 10 menit saat PWA aktif dan online; gateway memakai satu refresh token akun Owner dan satu folder bersama. Upload hanya memerlukan membership + Device ID terotorisasi; list/download untuk full restore tetap Owner-only dan email harus cocok dengan akun Drive Owner. Snapshot diberi role asal; Sales projection tidak ditawarkan sebagai full restore. Server memverifikasi checksum envelope, manifest, ukuran/SHA-256 JPEG, folder ownership, idempotency backupId, serta dedup lampiran berdasarkan Device ID + mediaId + checksum. Snapshot di atas 5 MB memakai Drive resumable upload per chunk 8 MiB; attachment JPEG maksimal 1 MB tetap multipart. | **Belum final:** credential Drive nyata belum dipasang (hosting belum dipilih); uji route end-to-end terhadap akun/folder Owner dan retry upload/download nyata masih diperlukan. Browser background tidak dijamin ketika PWA ditutup; upload dicoba saat session online dan aplikasi aktif. |
| P0-05 | Backup restore & recovery perangkat pengganti | Snapshot/lampiran diunduh melalui gateway; checksum/manifest diverifikasi. Full snapshot hanya boleh dipulihkan pada perangkat asal yang sama, tidak lebih lama, cursor tidak mundur, dan cakupan record lengkap. Cross-device snapshot ditolak termasuk pada replacement device kosong. Perangkat pengganti wajib bootstrap/pull backend + replay/rekonsiliasi event; Device ID target tetap baru. | **Guard + restore atomicity: AUTOMATED_TEST_PASSED** pada commit `e79802b9acd815eb6bb0e1c679eab22eade94d58`, CI #44250362547: cross-device rejection, same-device/non-stale guard, native IndexedDB restore, attachment cleanup, failed-write rollback, dan safety snapshot recovery. **Belum final:** bootstrap/pull/replay end-to-end replacement device belum dibuktikan. Merge dua database aktif yang divergen tetap fail-closed. |
| P0-06 | Multi-device acceptance harness | Ditambahkan harness deterministik 8 identitas (1 Owner, 2 Admin, 5 Sales) untuk offline queue/reconnect, push ownership, idempotent retry, cross-customer/invoice conflict, return/media ownership, dan pull projection. Harness juga menguji pagination 500+ event ketika seluruh event tersembunyi tetap memajukan cursor tanpa membocorkan data. | **Belum final:** harness source baru harus lulus CI bersama integration route GAS, IndexedDB restore, serta acceptance end-to-end 2–8 device. Simulasi tidak menggantikan uji fisik printer/Bluetooth/kamera. |

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


## 10. Aturan delivery APK — keputusan Owner 2026-11-18

1. APK disiapkan dan diserahkan setelah seluruh tes virtual yang tersedia dijalankan dan bug keamanan/integritas data yang terbukti dari tes tersebut diperbaiki.
2. Tidak ada gerbang tes fisik yang menahan pembuatan atau penyerahan APK.
3. Fitur yang tidak dapat diuji virtual dinilai melalui inspeksi kode, konfigurasi, kompatibilitas, dan analisis risiko; keterbatasannya dicatat sebagai pending physical verification.
4. Setelah APK diterima, Owner melakukan pengujian fisik. Temuan menjadi pekerjaan perbaikan berikutnya, bukan syarat awal build.
5. Build PWA yang lulus tidak sama dengan APK. APK hanya boleh dinyatakan tersedia setelah wrapper Android berhasil dibangun dan file APK dihasilkan sebagai artifact.
6. Tes virtual tetap wajib: lint, seluruh unit/integration tests, simulasi role, offline/reconnect, sync, backup/restore, dan skenario multi-device sampai batas operasional 8 perangkat.


## 11. Handover status — 2026-11-18

Dokumen ini adalah rencana/acceptance gate. Status implementasi terbaru, bukti CI, dan daftar pekerjaan tersisa yang harus dipakai AI penerus berada di `HANDOVER.md`. Jika tabel workstream di atas menyebut status awal yang berbeda dengan handover terbaru, gunakan handover untuk posisi pengerjaan terkini dan `PLAN.md` Change Register untuk keputusan bisnis/arsitektur.

**Aturan Owner:** selesaikan seluruh tes virtual yang tersedia dan perbaiki bug keamanan/integritas yang terbukti. Jangan menunggu tes fisik, hardware, OAuth live, Drive live, atau hosting terpilih untuk menghasilkan/menyerahkan debug APK. Keterbatasan tersebut wajib diberi label pending, bukan disamarkan sebagai fitur selesai.
