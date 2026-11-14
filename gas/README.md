# ERP DAGING — Google Apps Script Adapter (Optional Backend)

Dokumen ini menjelaskan salah satu opsi backend sinkronisasi ERP DAGING. GAS + Google Sheets bukan backend wajib; fondasi aplikasi tetap PWA + IndexedDB (Local-First). Opsi lain seperti REST API + PostgreSQL atau Supabase dapat dipilih melalui adapter yang sesuai. Gateway GAS menyimpan event ERP sebagai append-only log di Google Sheets dan menyediakan pull per perangkat; server sequence dan idempotency key dipakai untuk rekonsiliasi antar-HP.

## Deploy

1. Buat satu Google Spreadsheet khusus sinkronisasi ERP DAGING.
2. Buka **Extensions → Apps Script**.
3. Salin isi `Code.gs` dari folder ini ke project Apps Script.
4. Buka **Project Settings → Script Properties**, lalu isi:
   - `SPREADSHEET_ID` = ID spreadsheet yang dibuat.
   - `SYNC_SHARED_SECRET` = secret acak panjang. Jangan gunakan PIN Owner.
5. Deploy → New deployment → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Salin URL Web App hasil deployment.
7. Jika GAS dipilih sebagai backend ERP DAGING → Pengaturan Backend:
   - Adapter: **Google Sheets**
   - Web App URL: URL deployment
   - Store ID: ID toko yang sama pada semua perangkat
   - API Key / Token: nilai `SYNC_SHARED_SECRET`
8. Jalankan test koneksi dari perangkat Owner, lalu lakukan test push/pull pada dua perangkat sebelum dipakai operasional.

## Event log

Sheet `ERP_SYNC_EVENTS` dibuat otomatis dengan kolom:
`serverSeq, storeId, deviceId, uuid, idempotencyKey, entityType, createdAt, summary, payloadJson`.

- Push: POST `action=sync_push`; proses dikunci dengan Script Lock, deduplikasi berdasarkan kombinasi store + idempotency key, dan hanya ACK event yang sudah ada/tersimpan.
- Pull: GET `action=sync_pull`; hanya mengambil event untuk Store ID yang sama dan mengecualikan event dari Device ID peminta.
- Pagination: maksimum 500 event per respons; cursor menunjuk event terakhir yang benar-benar dikirim, sehingga event berikutnya tidak terlewati.
- Data event bersifat append-only. Jangan edit atau hapus baris secara manual.

## Batas verifikasi

Kode gateway dan adapter sudah tersedia di repository, tetapi deployment Apps Script memerlukan akses Google milik pemilik ERP. Sampai URL Web App dideploy dan dua HP melakukan sinkronisasi nyata, status multi-device adalah **implementasi kode siap diuji**, bukan bukti operasional produksi.

Reducer PWA menerapkan event SALE, PAYMENT, RETURN, VOID, PURCHASE, OPNAME, dan CONVERSION. Event master produk baru yang belum punya detail master lengkap serta tipe event lain yang belum memiliki reducer akan masuk daftar konflik rekonsiliasi, bukan diterapkan diam-diam.


## Catatan: Google Drive Backup bukan Google Sheets Event Log

- Jika GAS + Google Sheets dipilih sebagai backend utama, sheet `ERP_SYNC_EVENTS` adalah event log untuk sinkronisasi; sheet tersebut **bukan** pengganti file backup eksternal JSON.
- Backup Google Drive ERP DAGING adalah fitur PWA terpisah dan opsional. Semua device dapat mengunggah file backup unik ke satu folder Owner `ERP DAGING BACKUP`; tidak dibuat folder per-device.
- Saat ZimaOS atau backend utama down, upload Drive dapat berjalan langsung dari PWA jika internet dan otorisasi Google tersedia. Ini tidak membuat Google Drive menjadi backend sinkronisasi atau menjamin data antar-device real-time.
- Restore dari Drive tetap mengikuti aturan Owner-only, validasi checksum/schema/lampiran, deduplikasi UUID, dan rekonsiliasi. Jangan mengimpor file backup dengan cara menimpa seluruh event log Google Sheets.
- Keputusan backup/restore lengkap dan batas verifikasinya tercatat di `PLAN.md` Section 8 dan Change Register 13.10.
