# ERP DAGING — Google Apps Script Adapter (Optional Backend)

Dokumen ini menjelaskan salah satu opsi backend sinkronisasi ERP DAGING. GAS + Google Sheets bukan backend wajib; fondasi aplikasi tetap PWA + IndexedDB (Local-First). Opsi REST API + PostgreSQL atau Supabase tetap dapat dipilih melalui adapter lain.

## Arsitektur keamanan

PWA **tidak boleh menghubungi URL GAS secara langsung** dan tidak menyimpan `SYNC_SHARED_SECRET` atau HMAC key.

Alur yang diwajibkan:

1. Pengguna login dengan Google Sign-In melalui server ERP DAGING.
2. Server memverifikasi session dan membership aktif; Store ID berasal dari membership server, bukan dari body client.
3. PWA mengirim request ke endpoint same-origin `/api/sync/gas` memakai bearer session ERP.
4. Server menambahkan `SYNC_SHARED_SECRET` dan HMAC signature bertimestamp + nonce.
5. GAS memverifikasi HMAC, batas waktu 5 menit, dan nonce anti-replay sebelum memproses action.
6. GAS menulis/membaca event log di spreadsheet.

## Konfigurasi GAS

1. Buat satu Google Spreadsheet khusus sinkronisasi ERP DAGING.
2. Buka **Extensions → Apps Script**.
3. Salin isi `Code.gs` dari folder ini ke project Apps Script.
4. Buka **Project Settings → Script Properties**, lalu isi:
   - `SPREADSHEET_ID` = ID spreadsheet yang dibuat.
   - `SYNC_SHARED_SECRET` = secret acak panjang, minimal 32 karakter. Jangan gunakan PIN Owner.
   - `GAS_GATEWAY_HMAC_SECRET` = secret acak terpisah minimal 32 karakter. Nilainya harus sama dengan environment server.
5. Deploy → New deployment → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Salin URL Web App hasil deployment. Jangan masukkan URL ini ke browser client atau konfigurasi PWA.

## Konfigurasi server ERP

Atur environment berikut pada server yang menjalankan ERP DAGING:

- `GAS_WEB_APP_URL` = URL Web App GAS HTTPS dari deployment.
- `GAS_SYNC_SHARED_SECRET` = sama dengan Script Property `SYNC_SHARED_SECRET`.
- `GAS_GATEWAY_HMAC_SECRET` = sama dengan Script Property `GAS_GATEWAY_HMAC_SECRET`.
- Autentikasi ERP juga wajib aktif: `GOOGLE_CLIENT_ID`, `ERP_AUTH_SESSION_SECRET` (minimal 32 karakter), dan `ERP_AUTH_MEMBERS_JSON`.

Jangan commit nilai secret ke repository, file .env, source map, atau bundle PWA. Simpan hanya di secret manager/environment server dan Script Properties GAS.

## Konfigurasi PWA

1. Login dengan akun Google yang sudah terdaftar sebagai membership aktif.
2. Buka Pengaturan Backend.
3. Pilih adapter **Google Sheets via GAS Gateway**.
4. Tidak ada input URL GAS, Store ID manual, atau Shared Secret di perangkat. Identitas toko mengikuti membership akun yang diverifikasi server.
5. Jalankan test koneksi, kemudian lakukan push/pull dan upload/download lampiran dari minimal dua perangkat.

## Event log

Sheet `ERP_SYNC_EVENTS` dibuat otomatis dengan kolom:
`serverSeq, storeId, deviceId, uuid, idempotencyKey, entityType, createdAt, summary, payloadJson, serverReceivedAt`.

- Push: POST `action=sync_push`; diproses dengan Script Lock, deduplikasi berdasarkan kombinasi store + idempotency key, dan hanya ACK event yang lolos schema validation.
- Pull: POST `action=sync_pull`; hanya mengambil event untuk Store ID yang sama dan mengecualikan event dari Device ID peminta.
- Pagination: maksimum 500 event per respons; cursor menunjuk event terakhir yang benar-benar dikirim.
- `serverSeq` adalah cursor resmi. `createdAt` berasal dari jam perangkat; `serverReceivedAt` berasal dari server GAS.
- Request gateway memerlukan HMAC timestamp + nonce. Request tanpa signature, signature salah, timestamp di luar toleransi, atau nonce replay ditolak.
- Data event bersifat append-only. Jangan edit atau hapus baris secara manual.

## Batas verifikasi

Kode proxy dan gateway tersedia di repository, tetapi deployment Apps Script, secret server, Google OAuth origin, dan membership harus dikonfigurasi dengan akun Owner. Role gate saat ini mengatur event push; filtering pull berdasarkan assigned_sales_id/role serta device enrollment masih menjadi blocker. Sampai deployment dan uji dua HP nyata lulus, status multi-device adalah **implementasi kode siap diuji**, bukan bukti operasional produksi.

Reducer PWA menerapkan event bisnis yang sudah didukung. Event valid yang belum memiliki reducer tidak boleh dianggap berhasil diterapkan; event tersebut harus masuk konflik rekonsiliasi dengan alasan yang terlihat.

## Catatan: Google Drive Backup bukan Google Sheets Event Log

- Jika GAS + Google Sheets dipilih sebagai backend utama, sheet `ERP_SYNC_EVENTS` adalah event log untuk sinkronisasi; sheet tersebut **bukan** pengganti file backup eksternal JSON.
- Backup Google Drive ERP DAGING adalah fitur PWA terpisah dan opsional. Semua device dapat mengunggah file backup unik ke satu folder Owner `ERP DAGING BACKUP`; tidak dibuat folder per-device.
- Restore dari Drive tetap mengikuti aturan Owner-only, validasi checksum/schema/lampiran, deduplikasi UUID, dan rekonsiliasi. Jangan menimpa seluruh event log Google Sheets dengan file backup.
