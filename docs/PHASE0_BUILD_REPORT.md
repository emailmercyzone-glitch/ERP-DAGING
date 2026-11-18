# ERP DAGING — Phase 0 Build Report

Tanggal: 2026-11-17  
Branch: `fix/p0-role-data-isolation`  
Jenis bukti: GitHub Actions CI (automated; bukan live integration atau physical verification)

## 1. Hasil build terverifikasi

**Commit yang diuji:** `91e1dfa76507effb45bf265cd6c0fb0a14e5d88b`  
**Workflow:** ERP DAGING CI #963  
**Status workflow:** SUCCESS  
**Run:** https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44004110584

| Pemeriksaan | Hasil |
|---|---|
| Dependency install (Bun) | PASS |
| Lint | PASS |
| Full test suite | PASS |
| Production PWA build | PASS |
| Upload PWA artifact | PASS |
| Docker image build | PASS |
| Chromium browser test runner | PASS |
| IndexedDB restore test in Chromium | PASS |

Semua job dan step pada workflow #963 berstatus completed/success pada pemeriksaan 2026-11-17.

## 2. Artefak PWA

- Nama: `erp-daging-pwa-cc68555ab21daf26d74cd02738e24a723243f36f`
- Ukuran: 642,036 bytes
- SHA-256: `b59fe6bb29c66483f28040856df665cacdc05c76cff68fa643d9df501a811704`
- Dibuat: 2026-11-17 02:37:49 UTC
- Kedaluwarsa: 2026-12-01 02:37:48 UTC
- Lokasi unduh: halaman GitHub Actions run #963, bagian Artifacts.

## 3. Batas klaim

Hasil ini membuktikan lint, automated tests, production PWA build, Docker build, dan browser IndexedDB restore test pada commit yang tercantum di atas.

Hasil ini **tidak** membuktikan:
- Signed offline authorization grant sudah tersedia.
- Isolasi data Sales pada storage/server sudah selesai.
- Sales push/pull/media sync sudah aman untuk diaktifkan.
- Backup gateway dan upload Drive live sudah tersedia/teruji.
- Restore lintas perangkat sudah additive dan teruji.
- Acceptance multi-device 2–8 client sudah lengkap.
- Google OAuth/Drive live integration atau physical-device verification sudah dilakukan.

## 4. Perubahan sesudah commit yang diuji

Dokumentasi `PLAN.md` kemudian diselaraskan dengan keputusan backup final: satu akun Drive Owner, satu folder bersama `ERP DAGING BACKUP`, semua device mengirim melalui backend/gateway, dan browser tidak mengunggah langsung ke Drive.

Commit dokumentasi: `bb7ad5bc79da170bc5e255ee607a753b9883f161`  
CI untuk commit tersebut berjalan sebagai workflow #964 dan belum dinyatakan lulus saat laporan ini dibuat.

## 5. Kesimpulan

**PWA BUILD GATE: PASSED** pada commit `91e1dfa76507effb45bf265cd6c0fb0a14e5d88b`.

**P0 FUNCTIONAL GATE: NOT PASSED YET.** P0-01 sampai P0-06 tetap harus diimplementasikan dan diuji sesuai `docs/PHASE0_EXECUTION.md`. PR #10 tetap Draft. Hasil build ini tidak boleh dipakai sebagai klaim production-ready.


## 6. Verifikasi branch head setelah laporan dibuat

**Commit:** `90355f8735f7176c1081d4e7247afa604c4766b7`  
**Workflow:** ERP DAGING CI #965  
**Status:** SUCCESS  
**Run:** https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44011186522

Seluruh step CI kembali lulus: lint, full test suite, PWA build, artifact upload, Docker build, Chromium install, dan IndexedDB restore test.

Artifact untuk commit ini:
- Nama: `erp-daging-pwa-1fb91da6f93c74e32c47c21f5f7aa0e24d84f545`
- Ukuran: 642,036 bytes
- SHA-256: `25d75cc83f2bf647d2588015c336278bd12fc50ac04c46c68fab439e10b84704`
- Kedaluwarsa: 2026-12-01 03:36:31 UTC

Dengan demikian, dokumentasi alignment backup dan Build Report sendiri sudah ikut lolos pipeline. Bukti ini tetap hanya untuk build/test otomatis; P0 functional gate masih belum lulus.

## 7. Verifikasi branch head — 2026-11-18

- Commit: `3fa422d5e3b9ed4e05c13cb0b976dd947c619f11`
- CI run [#1201](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44042580838): **SUCCESS**.
- Semua step yang diperiksa lulus: dependency install, lint, full test suite, production PWA build, upload artifact PWA, Docker image build, Chromium install, dan IndexedDB restore test.
- Ini adalah bukti untuk **PWA**, bukan APK.

## 8. Status APK dan aturan penyerahan — diperbarui 2026-11-18

Catatan historis pada bagian sebelumnya tetap berlaku hanya untuk commit/run yang disebut di sana. Pernyataan lama bahwa repository belum memiliki Capacitor/Android project dan CI hanya menghasilkan PWA **sudah tidak berlaku untuk branch kerja saat ini**.

Fakta branch berdasarkan perubahan yang tercatat di PR #10:
- Capacitor 8 Android wrapper dan konfigurasi app ID `id.erp.daging` sudah ditambahkan.
- Workflow CI sudah memiliki job Android debug APK dan upload artifact.
- Run #442071 pada head lama pernah lulus untuk job `web-pwa` dan `android-apk`; artifact tersebut bukan kandidat final karena mendahului perubahan auth/API origin, CORS, store ID, QR/role-scope, dan hardware honesty cleanup.
- Run #1265 juga pernah membangun APK sebelum koreksi UI hardware terakhir. APK dari run tersebut bukan bukti build pada head terkini.
- Koreksi hardware terakhir menghapus klaim koneksi timbangan Bluetooth dan printer ESC/POS yang belum tersedia; input berat tetap manual dan struk memakai system print/PDF fallback.
- **Status delivery sekarang: APK wrapper/pipeline sudah ada; APK final untuk handoff BELUM DIVERIFIKASI pada head terbaru.** Rerun CI dan periksa artifact `app-debug.apk` pada commit head terbaru sebelum menyatakan APK siap diserahkan.

## 9. Aturan penyerahan APK — keputusan Owner 2026-11-18

1. Semua tes virtual yang tersedia wajib dijalankan pada head yang sama dengan APK kandidat.
2. Bug keamanan atau integritas data yang terbukti dari inspeksi/tes virtual harus diperbaiki sebelum handoff.
3. Tes fisik dilakukan Owner setelah APK tersedia dan **bukan gerbang yang menahan APK**.
4. Fitur yang tidak dapat diuji virtual dinilai lewat inspeksi kode, konfigurasi, kompatibilitas, dan analisis risiko; beri status `PHYSICAL_VERIFICATION_PENDING`.
5. OAuth/Drive live dan hosting pilihan Owner tetap `LIVE_INTEGRATION_PENDING` / deferred, bukan alasan menghentikan coding atau build.
6. Jangan klaim lulus tanpa commit SHA, workflow run, hasil job, dan artifact yang benar-benar tersedia.

Lihat `HANDOVER.md` untuk posisi kerja terbaru dan next actions yang harus dilanjutkan AI berikutnya.


## 10. Verifikasi branch head — 2026-11-18 (P0 role isolation + restore)

- Branch: `fix/p0-role-data-isolation`
- Commit SHA: `e79802b9acd815eb6bb0e1c679eab22eade94d58`
- GitHub Actions run [#44250362547](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44250362547): **SUCCESS**.
- Job `web-pwa`: SUCCESS — lint, full test suite, production PWA build, PWA artifact upload, production container image build, dan native Chromium IndexedDB browser test seluruhnya lulus.
- Job `Build Android debug APK`: SUCCESS — Android wrapper generation, API 26 minimum version check, debug APK build, dan artifact upload lulus.

### Bukti Sales storage isolation (P0-02 local persistence)

Native Chromium browser log membuktikan:
- Sales projection disimpan melalui durable mutation queue ke IndexedDB.
- Snapshot terikat pada authenticated Sales identity.
- Cash/petty cash Owner, PIN credentials, customer/invoice milik Sales lain, outbox yang tidak berhak, HPP/COGS, serta record/secret Owner tidak ada pada persisted Sales snapshot.
- Setelah page reload, identitas Sales tetap tersimpan dan lampiran hasil restore lama tidak muncul.

Status: **AUTOMATED_TEST_PASSED untuk local Sales persistence isolation**. Ini tidak menyelesaikan server-side Sales projection/ownership atau seluruh P0-03.

### Bukti restore (P0-05)

Automated tests pada SHA yang sama membuktikan:
- Full snapshot restore hanya menerima backup dari perangkat asal yang sama dan tidak lebih lama dari data aktif.
- Full snapshot dari perangkat lain ditolak, termasuk pada perangkat pengganti yang kosong; error mengarahkan pemulihan melalui backend sync dan event reconciliation.
- Native IndexedDB restore menyimpan transaksi + Outbox dalam satu snapshot, restore mengganti state, dan lampiran lama yang tidak ada di backup dibersihkan.
- Kegagalan persist/DataCloneError membatalkan restore; database aktif dan lampiran aktif tidak rusak. Snapshot pengaman dapat dipulihkan.

Status: **AUTOMATED_TEST_PASSED untuk guard same-device, cross-device rejection, dan atomic restore/rollback paths yang diuji**. Bootstrap/pull/replay end-to-end untuk perangkat pengganti masih pending; jangan menandai seluruh P0-05 selesai.

### Artifacts pada run #44250362547

- APK: `erp-daging-android-debug-07a72dc9116a7c80c51ca8aae87b4abf781aa26d`
  - Artifact ID: `14402834780`
  - Ukuran ZIP: 4,506,610 bytes
  - SHA-256: `892c8bca14ddfcd4706bf832e9b12798cb7dd915b8d54136ef12c8930ece89e4`
  - [Unduh melalui GitHub Actions](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44250362547)
- PWA: `erp-daging-pwa-07a72dc9116a7c80c51ca8aae87b4abf781aa26d`
  - Artifact ID: `14402849638`
  - Ukuran: 640,595 bytes
  - SHA-256: `1735babc4e7db0fd49a6a6c8aa87f3c7484cc1413e897370056271af3ea50b59`

**Kesimpulan:** CI, PWA, container build, dan Android debug APK berhasil pada SHA yang sama. APK debug tersedia untuk handoff dan pengujian Owner. Ini bukan signed/release APK dan bukan bukti tes fisik, live OAuth/Drive, atau hosting. PR #10 tetap Draft; tidak ada merge, deployment, atau perubahan `main`.
