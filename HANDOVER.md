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


## 9. Replacement-device recovery verification — 2026-11-18

- Commit: `dfa827a336b368e985d94fb66df8c593d0d69a02`
- CI [#44252803610](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44252803610): **both jobs SUCCESS** (web/PWA and Android debug APK).
- Added adapter + reducer integration simulation for replacement device recovery: empty state + new Device ID, backend pull from cursor 0, replay MASTER_DATA/opening bank/SALE, rebuild master/stock/cash/bank/transaction, keep new Device ID, idempotent replay, then catch-up pull returns empty.
- Test uses a fake backend adapter; it does **not** prove live GAS/REST gateway, native IndexedDB persistence/reload of the replacement state, or media attachment recovery. Therefore P0-05 remains partial.
- Operational prerequisites found in current implementation: new Device ID must be listed in membership `deviceIds` in `ERP_AUTH_MEMBERS_JSON` before login; current sync is manually triggered; GAS pull is paginated to 500 events and catch-up requires repeated sync cycles. There is no self-service device-enrollment or automatic catch-up flow claimed.

APK artifact from the same run:
- `erp-daging-android-debug-5d04363d672cf23d0e62a8dbf56dfd4f41a74124`
- Artifact ID: `14404861720`
- ZIP size: 4,506,610 bytes
- SHA-256: `ca30b556a7442a38ea00f3899bedfb171ed0849fbba73dae5c15247a3ad0207f`
- [GitHub Actions run #44252803610](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44252803610)

PR #10 remains Draft. No merge, deployment, or changes to `main`.


## 10. P0 security hardening + verified build — 2026-11-18

**Verified head:** `db92531c7bc6fa77ee79ba952a95fc7d77c0c8cf`  
**CI:** [Run #44265328073](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44265328073) — both jobs **SUCCESS**.

### Changes verified
- Sales invoice pull projection now removes not only the explicit HPP/COGS fields but also newly named nested cost, profit, margin, landed-cost, and supplier fields. This is fail-closed redaction for fields added later.
- Return evidence media IDs are single-use. Reusing an existing ID is rejected before append; duplicate IDs found in event history are marked ambiguous and denied for every Sales identity.
- Added regression tests for unknown nested financial/supplier fields and media-ID reuse/collision.
- Existing Sales pull pagination test confirms cursor progress across hidden events without leaking another Sales' invoice/customer details.
- Native Chromium test now exercises replacement-device backend pull/replay through the real application sync/reducer path, persists reconstructed state to IndexedDB, reloads the page, and verifies Device ID, cursor, stock, customer, invoice, cash/bank and idempotency.

### CI evidence on the exact head
- `web-pwa`: lint PASS; **243 tests passed, 0 failed**; production PWA build PASS; PWA artifact upload PASS; production container build PASS; native Chromium IndexedDB test PASS.
- `Build Android debug APK`: Capacitor wrapper generation, API 26 check, `assembleDebug`, and APK artifact upload all PASS.
- Android artifact: `erp-daging-android-debug-2a7827a900c8fa262e167c9c83ed150110b0f412`; artifact ID `14410545255`; ZIP size 4,506,612 bytes; artifact SHA-256 `153b5951eb1e0db2e4025c931d60e1cae9e1b32eb2beb91c13927387d2664212`.
- PWA artifact: `erp-daging-pwa-2a7827a900c8fa262e167c9c83ed150110b0f412`; artifact ID `14408849640`; ZIP size 640,595 bytes; artifact SHA-256 `7884946ec689f2a2402d9f69171271d5d36abfdcff6df460fe0f8569a73d7c7c`.
- Download both from the Artifacts section of [CI run #44265328073](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44265328073). APK is a debug build, not a signed production release.

### P0 status — do not overstate
- **P0-01:** signed lease policy and boundary tests pass; offline clock still depends on the device clock and is not tamper-proof.
- **P0-02:** Sales local persistence isolation across native IndexedDB reload is verified.
- **P0-03:** Sales ownership, projection, media binding/collision, retry and pagination policy tests pass. **Still PARTIAL:** no dedicated HTTP route-level end-to-end test against a mocked GAS gateway was added; live GAS/media operation remains pending. Keep Sales sync fail-closed until route integration is verified in the chosen backend environment.
- **P0-04:** Drive gateway mock/contract tests pass, including checksum, attachment manifest, attachment dedup, resumable upload and retry. Live Owner OAuth/Drive upload/download remains pending credentials/environment.
- **P0-05:** same-device snapshot restore guard and native IndexedDB replacement-device pull/replay/reload simulation pass. **Still PARTIAL:** fake adapter rather than live GAS/REST, no cross-device attachment recovery proof, and replacement Device ID enrollment remains manual in `ERP_AUTH_MEMBERS_JSON`.
- **P0-06:** 8-identity harness passes role boundaries, Sales isolation, idempotent retry, return/media ownership and 500+ hidden-event pagination. This is deterministic simulation, not simultaneous operation on eight physical phones.
- Physical Android verification remains Owner's next action after APK download. Hardware Bluetooth scale/printer are not implemented; manual weight and system print/PDF fallback remain.
- Live OAuth, GAS, Drive and hosting are pending; provider choice and deployment remain deferred to Owner.

PR #10 remains Draft/open. No merge, deployment, or changes to `main`.

## 11. Quick hardening follow-up — 2026-11-18

Perubahan terarah pada branch PR #10 setelah screening cepat:

- **P0-5 deletion semantics:** PLAN Section 13.49 mempertegas transaksi tersimpan/tersinkron tidak boleh hard-delete; gunakan VOID/reversal. Data master memakai arsip/nonaktif/tombstone sesuai entitas. Ini keputusan dokumentasi, bukan klaim audit seluruh tombol UI.
- **P0-7 PWA persistent storage:** bootstrap PWA meminta `navigator.storage.persist()` bila API tersedia, memeriksa status persistensi lebih dahulu bila didukung, dan menangani penolakan secara non-blocking. Permintaan persistensi tidak menjamin browser menyetujuinya dan tidak menggantikan backup.
- **P1-1 dependency audit:** CI web-pwa menjalankan `bun audit --audit-level=high` setelah `bun install`, menggunakan `bun.lock`. Audit mencakup dependency tree lockfile; advisory high/critical atau kegagalan registry membuat step gagal.
- **P1-2 secret rotation:** `gas/README.md` menjelaskan pasangan secret GAS/server, review kuartalan, rotasi saat insiden/perubahan akses, dan batas koordinasi rotasi. Nilai secret tidak dicatat.
- **P1-3 401 / Outbox:** auth client hanya membersihkan access token dan cached user pada 401/403 dari pemeriksaan session. Regression test menyiapkan transaksi + Outbox durable, memicu 401, lalu memastikan snapshot transaksi/Outbox tidak berubah.

**Status verifikasi dan temuan audit dependency:**
- CI run [#44301269347](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44301269347) (#1316) menjalankan audit sebelum test karena merupakan head sebelum urutan step diperbaiki. Audit menemukan **2 advisory HIGH**: `@grpc/grpc-js@1.9.16` melalui `firebase > @firebase/firestore-compat > @firebase/firestore` (GHSA-m9gg-hp2v-232j; versi perbaikan pada release line 1.13 adalah 1.13.6 atau lebih baru) dan `picomatch@4.0.7` melalui Vite/vite-plugin-pwa (GHSA-fc5q-39xc-vjpf; advisory saat ini menyatakan versi sampai 4.0.7 terdampak, tetapi output audit tidak menyediakan versi perbaikan).
- Jangan mengabaikan advisory atau mengubah lockfile secara manual tanpa regenerasi dan tes. Dependency remediation masih **OPEN** dan harus dilakukan sebagai patch terpisah di environment yang dapat menjalankan Bun.
- Workflow terbaru memindahkan audit ke setelah lint, test, build, container, dan Chromium agar advisory tidak menghentikan verifikasi fungsional lain. CI run [#1318](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44301425150) pada commit `c65ba2cc` telah selesai: Android debug APK **PASS**; web/PWA lint, 243+ test suite, production build, container build, dan native Chromium IndexedDB/replacement-device reload **PASS**; step dependency audit **FAIL** karena dua temuan HIGH di atas. Jadi validasi fungsional lulus pada commit itu, tetapi CI keseluruhan tetap merah sampai dependency ditangani.
- PR #10 tetap Draft; jangan merge, deploy, atau mengubah `main`.


### 2026-11-20 — keputusan PO Supplier CASH

Owner mengunci bahwa PO term CASH dibayar saat barang diterima (Goods Receipt), bukan saat PO diterbitkan. PO tidak boleh membuat invoice LUNAS atau jurnal pembayaran. Setelah Goods Receipt, AP langsung jatuh tempo dan dibayar melalui workflow AP Payment dengan sumber dana aktual: Kas Utama atau Bank. Pembayaran sebelum penerimaan, bila diperlukan di masa depan, harus menjadi uang muka supplier terpisah. TEMPO_30 tidak berubah; LC_AT_SIGHT tetap memerlukan aturan pemicu terpisah.

**Status kode:** PO creation kini hanya menyimpan PO; Supplier Invoice/AP dibuat saat Goods Receipt. Local dan remote PURCHASE reducer membentuk invoice yang sama. Invoice legacy berstatus LUNAS tanpa jurnal pembayaran AP dikoreksi menjadi belum dibayar. Regression tests lokal/remote sudah ditambahkan. CI masih harus diverifikasi sebelum gap dinyatakan selesai.


**Migrasi data lama:** normalisasi state menghapus invoice PO yang masih dalam perjalanan jika tidak ada jurnal pembayaran AP yang mendukungnya. Jika jurnal pembayaran pra-penerimaan benar-benar ada, invoice dipertahankan untuk rekonsiliasi manual/exception; sistem belum memiliki akun dan workflow uang muka supplier. Jangan mengklaim exception ini otomatis terselesaikan.

### Update Accounting Reconciliation — 2026-11-20

- PO CASH: PO tidak membuat invoice/AP. Goods Receipt membentuk invoice dan AP; CASH jatuh tempo pada tanggal penerimaan; TEMPO_30 jatuh tempo 30 hari setelah penerimaan. Pembayaran tetap melalui AP Payment dengan sumber dana aktual. Local/remote reducer dan migrasi invoice lama sudah dites.
- Data lama: invoice PO dalam perjalanan tanpa jurnal pembayaran AP dan tanpa bukti Goods Receipt tidak lagi dihitung sebagai AP. Jika jurnal pembayaran pra-penerimaan atau ledger Goods Receipt nyata ditemukan, bukti dipertahankan agar tidak hilang.
- Bank cut-over: saldo awal ditolak bila ada saldo sementara non-zero atau jurnal akun bank 1102. Remote reducer menahan event serupa sebagai conflict. Jika transaksi transfer sudah terjadi, rekonsiliasi cut-over masih membutuhkan penyelesaian terpisah; tidak ada auto-adjustment.
- CI PO CASH #1450 run `44672386023` lulus seluruh job, 273/273 tests. CI guard bank #1452 run `44672664404` telah lulus lint, test suite, PWA build, dan container build; Chromium/dependency audit/APK masih berjalan saat catatan dibuat.
- Berikutnya: selesaikan verifikasi CI guard bank, lalu lanjutkan audit rekonsiliasi retur/credit note/refund, landed cost, dan Opening Balance CSV/Go-Live. Opening Balance CSV belum memiliki importer end-to-end; format PLAN saja belum cukup untuk membuktikan go-live readiness.
