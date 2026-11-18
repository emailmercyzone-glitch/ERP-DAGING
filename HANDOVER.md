# ERP DAGING — HANDOVER / CONTINUATION BRIEF

Tanggal pembaruan: 2026-11-18  
Repository: `emailmercyzone-glitch/ERP-DAGING`  
Branch kerja: `fix/p0-role-data-isolation`  
Pull request: [#10 — P0 strict role-based sync event authorization](https://github.com/emailmercyzone-glitch/ERP-DAGING/pull/10)  
Status PR: Draft — **jangan merge tanpa instruksi Owner**.

> **Dokumen ini adalah titik mulai untuk AI/model/engineer berikutnya.** Baca dokumen ini dahulu, lalu buka hanya file yang relevan dengan pekerjaan yang akan dilanjutkan. Jangan mengulang audit dari nol, jangan mengasumsikan fitur selesai hanya karena disebut di README/PLAN, dan jangan mengubah keputusan LOCKED tanpa persetujuan Owner.

## 1. Instruksi utama Owner — wajib dipatuhi

1. Target deliverable adalah **Android debug APK ERP DAGING yang lengkap dan dapat diserahkan lebih dahulu**. Owner akan melakukan pengujian fisik setelah APK diterima.
2. Jalankan seluruh tes yang bisa dilakukan secara virtual: lint, typecheck, unit/integration, authorization/role isolation, offline/reconnect, sync, backup/restore, simulasi multi-device sampai 8 perangkat, PWA build, container build bila tersedia, dan Android APK build.
3. Perbaiki bug keamanan, otorisasi, atau integritas data yang terbukti melalui inspeksi/tes virtual.
4. Jika fitur tidak bisa dibuktikan tanpa hardware/credential/environment nyata, lakukan penilaian logis dari source, konfigurasi, kompatibilitas, dan risiko. Tandai `PHYSICAL_VERIFICATION_PENDING` atau `LIVE_INTEGRATION_PENDING`; **jangan jadikan itu gerbang yang menahan APK**.
5. Jangan menyatakan APK final tersedia sebelum CI pada head terbaru menghasilkan artifact APK yang dapat diunduh.
6. Hosting, provider, domain, dan region belum dipilih. Siapkan konfigurasi portable saja. Jangan membuat akun, memilih provider, deploy, atau meminta Owner menentukan hosting sekarang.
7. PR #10 tetap Draft dan jangan merge tanpa instruksi Owner.
8. Project ini hanya **ERP DAGING**. Jangan mengaitkan pekerjaan dengan Omah ERP atau project lain.

## 2. Status branch dan bukti yang diketahui

### Implementasi/konfigurasi yang sudah masuk ke branch

- PWA React/TypeScript/Vite tetap source of truth; Android menggunakan Capacitor 8 wrapper, bukan rewrite Flutter.
- Capacitor Android app ID: `id.erp.daging`; minimum Android API 26.
- CI Android debug APK job dan artifact upload sudah ditambahkan.
- `VITE_ERP_API_BASE_URL` mengatur API origin. PWA tanpa nilai memakai same-origin; APK native tanpa nilai memakai local-only Owner mode dan tidak boleh memanggil relative `https://localhost/api`.
- Server CORS allowlist memakai `APP_URL` / `CORS_ORIGINS`; Capacitor origins `https://localhost` dan `capacitor://localhost` didukung. Tidak menggunakan wildcard credentials.
- Default Store ID diselaraskan menjadi `ERP_DAGING`; placeholder lama `TOKO_KARKASIA_01` dinormalisasi. Nama DB IndexedDB lama dan prefix payload QR lama dipertahankan untuk kompatibilitas.
- QR label menggunakan branding ERP DAGING; synthetic SKU fallback dan production-visible scan simulation dihapus. Batch scanner dijelaskan sebagai input manual jika auto detection tidak tersedia.
- Input berat tidak lagi berpura-pura menerima data Bluetooth: berat gross harus dimasukkan manual, tare opsional. Integrasi timbangan Bluetooth belum tersedia.
- Struk memakai system print/PDF fallback dengan layout 58mm; integrasi Bluetooth ESC/POS belum tersedia.
- Export OPEX menggunakan role-scoped state; petty cash audit mencatat role Owner/Admin.
- Google Drive backup dirancang satu akun Owner + satu folder bersama `ERP DAGING BACKUP`; JSON snapshot unik/versioned, attachments terpisah, Device ID metadata, upload/dedup oleh backend/gateway.

### Bukti CI historis — bukan bukti head terbaru

- Run #442071 pernah lulus untuk job `web-pwa` dan `android-apk`, tetapi berasal dari head lama sebelum beberapa perubahan auth/CORS/store ID/QR/role-scope.
- Run #1265 pernah lulus dan membangun APK sebelum koreksi UI hardware honesty terakhir.
- Run #1201 adalah bukti PWA pada commit lama, bukan bukti APK.
- Run #442080/#442081: 203 test lulus, tetapi test modules gagal dimuat karena akses `import.meta.env` pada Node. Optional chaining telah diterapkan sesudah temuan itu.
- Run historis tersebut **tidak boleh dipakai sebagai klaim bahwa head terbaru sudah lulus**.

### Status build/test yang harus dianggap sekarang

- [ ] CI rerun pada head terbaru setelah perubahan dokumentasi ini.
- [ ] Pastikan lint + typecheck lulus.
- [ ] Pastikan seluruh unit/integration tests lulus; catat jumlah pass/fail aktual.
- [ ] Pastikan browser/IndexedDB restore tests lulus.
- [ ] Pastikan PWA production build lulus.
- [ ] Pastikan Docker/container build lulus jika job tersedia.
- [ ] Pastikan Android debug APK job lulus dan artifact `app-debug.apk` benar-benar tersedia.
- [ ] Catat SHA commit yang sama untuk hasil tes dan APK artifact.

Jangan mengisi checklist di atas sebagai selesai sebelum melihat hasil workflow aktual.

## 3. Workstream P0 — status handover

Status di bawah memisahkan source yang sudah ada dari pembuktian virtual. `IMPLEMENTED` tidak otomatis berarti `AUTOMATED_TEST_PASSED`.

| Area | Status handover | Lanjutan yang wajib dilakukan |
|---|---|---|
| P0-01 Signed offline authorization | IMPLEMENTED; server RSA-signed lease 72 jam terikat user/role/store/device sudah dicatat dalam PR | Jalankan test signature valid/tampered, expiry, future-issued time, mismatch identity/device, revoked membership/device, dan clock boundary. Catat batas trusted clock PWA. |
| P0-02 Sales local isolation | PARTIAL / IMPLEMENTED pada proyeksi lokal dan sanitasi persistence | Buktikan storage yang diterima perangkat Sales memang hanya projection yang diizinkan. Jangan klaim local UI projection sebagai data-at-rest isolation bila state lengkap masih tersimpan. |
| P0-03 Sales sync & media authorization | PARTIAL; server ownership/projection/media policy telah ditambahkan, namun acceptance route end-to-end belum dinyatakan final | Uji Sales push/pull, assigned customer, stock-only delta, tombstone reassignment, cursor/pagination, parent-record media authorization, retry/idempotency. Tetap fail-closed untuk jalur yang belum terbukti aman. |
| P0-04 Backup gateway & dedup | IMPLEMENTED/PARTIAL pada gateway dan protokol; live Drive belum dikonfigurasi | Jalankan mock/contract test untuk role authorization, checksum/manifest, duplicate backupId, retry, attachment dedup, partial upload, batas ukuran. Live Drive credential bukan blocker virtual. |
| P0-05 Backup restore & recovery perangkat pengganti | IMPLEMENTED/PARTIAL pada guard, snapshot, manifest, dan restore path; full snapshot lintas perangkat wajib ditolak sesuai PLAN.md | Uji same-device restore, backup stale/incomplete, checksum/manifest, attachments, atomic rollback; uji perangkat pengganti melalui backend bootstrap/pull + replay/rekonsiliasi event, bukan full snapshot restore. |
| P0-06 Multi-device harness | Harness deterministik 8 identitas sudah ditambahkan; hasil keseluruhan belum dinyatakan lulus | Jalankan seluruh skenario 1 Owner + 2 Admin + 5 Sales: offline queue, reconnect, duplicate/reorder/retry, cross-customer conflict, return/media, pagination 500+, role projection, restore. |
| Android APK | Wrapper + CI job sudah ada; artifact pada head terbaru belum diverifikasi | Rerun CI dan ambil artifact dari run yang SHA-nya sama dengan hasil test terakhir. |
| Hardware | Bluetooth scale/printer belum terintegrasi; fallback manual/system print sudah dinyatakan secara jujur | Tandai PHYSICAL_VERIFICATION_PENDING; jangan mengklaim koneksi hardware aktif dan jangan menahan APK debug. |
| OAuth / Drive live / GAS live | Menunggu credential dan environment yang dipilih Owner | Lakukan mock/contract tests sekarang. Tandai LIVE_INTEGRATION_PENDING untuk live checks. |
| Hosting / domain / provider | LOCKED: keputusan ditunda sampai Owner memilih | Hanya siapkan konfigurasi portable. Tidak ada deployment live. |

## 4. Keputusan LOCKED — jangan diubah sepihak

- **Nama resmi:** ERP DAGING. Jangan gunakan nama proyek lama untuk branding aktif.
- **Platform aktif:** React/TypeScript/Vite PWA + IndexedDB sebagai source of truth; Capacitor 8 sebagai Android APK wrapper. Flutter native bukan platform aktif.
- **Skala:** satu bisnis internal, maksimal 1 Owner + 2 Admin + 5 Sales (sekitar 8 perangkat), bukan SaaS multi-tenant/ERP enterprise.
- **Local-first:** transaksi inti tetap berjalan tanpa internet. Jangan membuat backend/live hosting menjadi dependency untuk pencatatan lokal.
- **Backend/provider:** vendor-neutral dan dapat diganti melalui adapter. Belum ada provider, domain, region, atau hosting yang dipilih.
- **APK delivery:** virtual tests wajib; tes fisik setelah APK tersedia dan bukan blocker delivery.
- **Google Drive backup:** satu akun Drive Owner, satu folder bersama `ERP DAGING BACKUP`, file JSON unik/versioned, attachments terpisah, upload/dedup lewat backend/gateway. Tidak ada folder per-device dan tidak ada browser-direct Drive upload sebagai arsitektur final.
- **Device ID:** metadata internal asal transaksi/backup, bukan konfigurasi folder user-facing.
- **Workflow operasional:** sederhana untuk UMKM; minim approval/birokrasi yang tidak memberi kontrol nyata. Gunakan validasi otomatis, warning, audit trail, dan kontrol pengecualian.
- **Data/laporan:** integritas stok, HPP, piutang/utang, kas/bank, pajak, laba rugi, rekonsiliasi dan audit tidak boleh dikorbankan demi UI sederhana.
- **PR:** #10 tetap Draft; jangan merge tanpa instruksi Owner.

## 5. Known limitations — jangan disembunyikan

- APK tanpa `VITE_ERP_API_BASE_URL` hanya local-only Owner mode; Google auth, signed lease online renewal, dan multi-device sync tidak aktif pada mode tersebut.
- Connected mode memerlukan environment server, membership, OAuth Client ID, session secret, offline lease keypair, dan API origin yang cocok.
- Supabase static RLS fallback / tenant context masih perlu hardening; jangan sebut Supabase adapter production-ready sebelum tenant context ditegakkan server-side.
- Bluetooth scale belum terintegrasi; berat input manual.
- Bluetooth ESC/POS printer belum terintegrasi; system print/PDF fallback digunakan.
- Google OAuth, Drive live, GAS live, dan hosting belum diverifikasi di environment Owner.
- PWA offline clock tidak memiliki trusted hardware clock anti-tamper. Jelaskan batas ini; jangan klaim proteksi sempurna.

## 6. Dokumen acuan — baca sesuai kebutuhan

1. `PLAN.md` — Single Source of Truth keputusan bisnis/arsitektur. Change Register terbaru mengesampingkan detail historis yang bertentangan.
2. `HANDOVER.md` — titik mulai AI berikutnya; status dan next action.
3. `docs/PHASE0_EXECUTION.md` — definisi workstream P0 dan acceptance tests.
4. `docs/PHASE0_BUILD_REPORT.md` — bukti CI/build berdasarkan commit tertentu; jangan mencampur bukti antar-SHA.
5. `DEPLOYMENT.md` — environment, API origin, CORS, health probes, secret dan hosting prep netral-provider.
6. `README.md` — ringkasan produk/platform.
7. `gas/README.md` — opsi adapter GAS; bukan backend wajib.

Jika dokumen saling bertentangan: keputusan Owner di Change Register `PLAN.md` yang berlaku untuk scope/aturan bisnis; instruksi delivery terbaru Owner yang dicatat di handover berlaku untuk urutan delivery; kode + hasil CI aktual menjadi bukti implementasi, bukan klaim dokumentasi.

## 7. Instruksi kerja AI berikutnya

1. Mulai dari branch `fix/p0-role-data-isolation` dan PR #10. Periksa working tree/head sebelum edit; jangan bekerja di `main` secara langsung.
2. Baca `HANDOVER.md`, lalu `PLAN.md` Change Register dan section P0 yang relevan. Jangan audit ulang seluruh repo kecuali ada bukti konflik.
3. Periksa CI terbaru pada head branch. Perbaiki failure yang benar-benar muncul, bukan mengarang perbaikan.
4. Lanjutkan checklist P0 di atas dengan urutan: virtual security/data isolation → sync/media → backup/restore → 8-device harness → lint/typecheck/tests → PWA/container/APK build.
5. Setelah setiap perubahan, update status di dokumen ini dan Build Report dengan commit SHA serta bukti aktual. Jangan tandai PASS hanya karena source tersedia.
6. Pertahankan fallback hardware yang jujur; hardware test tetap pending setelah APK.
7. Jangan memilih hosting/provider, jangan deploy, jangan merge PR, dan jangan mengubah keputusan LOCKED tanpa persetujuan Owner.
8. Serahkan APK hanya dari run CI terbaru yang menghasilkan artifact APK dan catat nama artifact, run URL, commit SHA, ukuran/checksum bila tersedia.

**Tujuan AI penerus:** melanjutkan pekerjaan dari status ini, bukan mengulang dari awal atau membuat keputusan baru yang sudah dikunci Owner.


## 8. Update verifikasi terbaru — 2026-11-18

**Head terverifikasi:** `e79802b9acd815eb6bb0e1c679eab22eade94d58`  
**CI:** [Run #44250362547](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44250362547) — seluruh job SUCCESS.

### Delivery
- [x] Lint dan full unit/integration suite.
- [x] Production PWA build dan artifact.
- [x] Production container image build.
- [x] Native Chromium IndexedDB browser test.
- [x] Android debug APK build dan artifact upload.
- [ ] Physical-device verification — dilakukan Owner setelah menerima APK; bukan blocker delivery.
- [ ] Live OAuth/Google Drive/hosting — menunggu environment/keputusan Owner; bukan blocker debug APK.

APK artifact:
- Nama: `erp-daging-android-debug-07a72dc9116a7c80c51ca8aae87b4abf781aa26d`
- Artifact ID: `14402834780`
- Ukuran ZIP: 4,506,610 bytes
- SHA-256: `892c8bca14ddfcd4706bf832e9b12798cb7dd915b8d54136ef12c8930ece89e4`
- Unduh: [GitHub Actions run #44250362547](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44250362547)

### P0 evidence update
- **P0-02 local Sales storage isolation: AUTOMATED_TEST_PASSED** pada SHA ini. Native Chromium membuktikan persisted Sales snapshot hanya berisi identity, customer/invoice, outbox dan data operasional yang diizinkan; data Owner, HPP/COGS dan record Sales lain tidak tersimpan. Identity tetap ada setelah reload. Server-side projection/ownership tetap dicakup P0-03.
- **P0-05 restore guard + atomic paths: AUTOMATED_TEST_PASSED** untuk skenario yang diuji. Same-device/non-stale policy lulus; full snapshot lintas-device ditolak termasuk pada replacement device kosong; native IndexedDB membuktikan transaksi/Outbox satu snapshot, restore, attachment cleanup, kegagalan persist yang fail-closed, dan pemulihan safety snapshot. **P0-05 belum selesai** karena bootstrap/pull/replay dan rekonsiliasi event perangkat pengganti belum dibuktikan end-to-end.
- **P0-01, P0-03, P0-04, P0-06:** tetap mengikuti status dan next action pada tabel workstream di atas; jangan menganggap CI hijau berarti semua acceptance P0 lulus.

Build Report dan PHASE0_EXECUTION.md mencatat rincian bukti per commit. PR #10 tetap Draft. Tidak ada merge, deployment, atau perubahan pada `main`.
