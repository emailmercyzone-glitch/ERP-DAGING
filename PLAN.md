# BLUEPRINT SOLID ERP DAGING IMPORT UMKM (V4.8 - PWA LOCAL-FIRST, BACKUP & RESTORE)
Project: ERP DAGING
Output Aktif: Installable Progressive Web App (PWA)
Versi: 4.8 (Fondasi PWA + IndexedDB, Backend Fleksibel, Backup Eksternal Opsional & Restore Aman)
Status: SINGLE SOURCE OF TRUTH — Change Register Section 13 menjadi keputusan terbaru dan mengesampingkan detail lama yang bertentangan.
Fondasi Aktif: React 18 + TypeScript + Vite PWA (`vite-plugin-pwa` + Workbox) + Tailwind CSS + IndexedDB (`karkasia_erp_offline_db`).
Backend/Sinkronisasi: configurable dan vendor-neutral; GAS, REST API dengan PostgreSQL, Supabase, atau layanan lain dapat dievaluasi dan dipilih berdasarkan kebutuhan. Tidak ada vendor backend yang dikunci permanen.
Platform nonaktif: Flutter/APK bukan target implementasi aktif.
Prinsip Utama: Local-First, Multi-Device Maksimal 8 Perangkat, PWA + IndexedDB sebagai fondasi, backend fleksibel, UI sederhana, Business Engine dan laporan tetap profesional, Zero-Float Ledger.

---

## DAFTAR ISI
1. Ringkasan Eksekutif & Prinsip Arsitektur Local-First (V4.7)
2. Alur Transaksi Penjualan, Pengiriman, & Void vs Retur
3. Siklus Pembelian Impor, Landed Cost, & AP Payments (Utang Supplier)
4. Manajemen Stok, FEFO, Yield Loss, & Konversi Produk (Tetelan)
5. Konsinyasi, Affiliate, & Penanganan Komisi
6. Arsitektur Database Lokal & Master Entitas
7. Backend Adapter Interface & Protokol Sinkronisasi Outbox (ACK-Only)
8. Keamanan, Otorisasi Perangkat, & Backup Cadangan
9. Aturan Opening Balance & Format CSV Migrasi Awal
10. Daftar 22 Modul ERP & Matriks Fungsional
11. Status Audit Aktual, Celah Terverifikasi, & Roadmap Lanjutan
12. Prinsip Desain UI/UX Mobile-First & Clean Luxury

---

## 1. RINGKASAN EKSEKUTIF & PRINSIP ARSITEKTUR LOCAL-FIRST (V4.7)
- **Keputusan Arsitektur Terbaru (Local-First & Vendor-Agnostic)**:
  - **PWA sebagai satu-satunya platform aktif**: Aplikasi berjalan sebagai installable PWA. Flutter/APK tidak menjadi target implementasi aktif dan tidak boleh menambah beban scope PWA.
  - **Local-First per perangkat**: Setiap perangkat menjalankan transaksi rutin dari IndexedDB lokal. Internet bukan syarat startup atau pencatatan transaksi inti.
  - **Backend tidak dikunci**: GAS, REST API dengan PostgreSQL, Supabase, atau layanan lain tetap menjadi opsi. Pemilihan dilakukan sesuai konfigurasi dan evaluasi kebutuhan, biaya, keamanan, kemudahan operasi, serta hasil uji.
  - **Adapter/kontrak sinkronisasi**: PWA berkomunikasi melalui kontrak yang memisahkan Business Engine dari detail vendor. Implementasi adapter boleh dipilih/diganti tanpa mengubah aturan bisnis dan format event inti.
  - **Batas koneksi database**: PWA tidak boleh menyimpan kredensial database berhak istimewa atau mengakses PostgreSQL langsung dengan secret server. PostgreSQL harus diakses melalui API/backend aman atau layanan terkelola dengan kebijakan akses yang tepat.
  - **PWA Offline-First**: Menggunakan Workbox Service Worker dan IndexedDB (`karkasia_erp_offline_db`) dengan migrasi aman dari `localStorage` lama (`normalizePersistedState` menjaga kompatibilitas data terdahulu).
- **Skala Operasional**: Maksimal 1 Owner, 2 Admin, 5 Sales (~8 perangkat); <= 500 SKU; <= 200 transaksi/hari.
- **Model Stok**: Sentral di gudang pusat. Sales menjual dari stok pusat tanpa muat barang di kendaraan (*no vehicle stock*). Pengiriman fisik diatur oleh gudang setelah order diverifikasi.
- **Karakter Data (Zero-Float Policy)**:
  - Angka mata uang menggunakan integer utuh Rupiah (`BIGINT` / `INTEGER` / `Math.round` IDR).
  - Berat menggunakan integer utuh Gram (`INTEGER`, misal 1 kg = 1000 gram).
  - Zero float untuk menghindari *rounding error*.
- **Immutable Ledger**: Tabel/log pergerakan stok (`stock_ledger` / `stockLedger`) dan event transaksi bersifat append-only (insert-only). Koreksi wajib melalui transaksi balik (`VOID_REVERSAL`) atau penyesuaian tercatat.

---

## 2. ALUR TRANSAKSI PENJUALAN, PENGIRIMAN, & VOID VS RETUR
- **Sales Order (Draft/Issued)**: Kasir/Sales membuat pesanan secara lokal dan menyimpannya ke IndexedDB perangkat sebelum proses sinkronisasi. Jika stok lokal cukup, nota langsung terbit. Plafon piutang yang terlampaui hanya memunculkan warning dan tidak memblokir checkout atau meminta approval Owner. Penjualan saat stok minus mengikuti kontrol pengecualian tersendiri: alasan wajib, konfirmasi tanggung jawab Owner, lalu konflik stok ditangani saat sinkronisasi.
- **Alokasi FEFO & Pengiriman Gudang**: Engine otomatis memotong lot dengan umur simpan terdekat (`daysLeft` terkecil). Gudang menyiapkan barang fisik dan mencetak/membagikan surat jalan.
- **Penyelesaian Transaksi**: Status berubah menjadi `COMPLETED` setelah transaksi sah atau pelunasan tempo dicatat.
- **Void vs Retur**:
  - **Void**: Pembatalan dokumen sebelum barang dikirim / diselesaikan (otorisasi PIN Owner). Memicu entri balik otomatis (`stockLedger`, `journals`, `receivables`, `auditTrail`).
  - **Retur**: Penanganan komplain mutu barang setelah diterima pelanggan, wajib disertai foto bukti kamera (MOD-08 / MOD-20). Barang retur masuk ke batch karantina (`isQuarantined = true`) agar tidak ikut terjual, serta mencatat pengurang tagihan/refund.

---

## 3. SIKLUS PEMBELIAN IMPOR, LANDED COST, & AP PAYMENTS (UTANG SUPPLIER)
- **Purchase Order (PO)**: Pencatatan pesanan kontainer reefer daging impor ke supplier luar beserta daftar kontak WhatsApp supplier.
- **Goods Receipt (Penerimaan Barang)**: Pencatatan fisik barang datang. Jika berat aktual berbeda dari PO, sistem mencatat berat aktual ke batch lot baru.
- **Landed Cost Allocation (BR-060)**: Biaya tambahan (Freight Laut, Bea Masuk, Cold Storage Handling) dialokasikan otomatis ke HPP efektif per KG dan memperbarui Moving Average HPP.
- **Supplier Invoice (AP)**: Tagihan resmi dari supplier yang membentuk saldo utang usaha (`supplierInvoices`) dengan badge status (`BELUM_LUNAS`, `CICILAN`, `LUNAS`) dan tombol tindak lanjut WhatsApp (**Quick Contact**).
- **AP Payments**: Pembayaran utang (Tunai / Transfer, Parsial, atau Pelunasan), lengkap dengan pembaruan jurnal dan saldo utang otomatis.

---

## 4. MANAJEMEN STOK, FEFO, YIELD LOSS, & KONVERSI PRODUK (TETELAN)
- **FEFO (First Expired, First Out)**: Pengeluaran stok otomatis memilih lot non-karantina dengan tanggal kedaluwarsa terdekat.
- **Yield & Cutting Loss Conversion (BR-051/052)**: Pemotongan daging primal dicatat melalui `OUT_CONVERSION` (mengeluarkan daging asal) dan dialokasikan ke produk turunan baru ber-HPP terhitung (misal "Tetelan / Daging Cincang" via `IN_CONVERSION`), sementara limbah/lemak tak bernilai dicatat terpisah via `OUT_CUTTING_LOSS`.
- **Stock Opname & Susut**: Penyesuaian stok berkala (MOD-07B) untuk mencatat *drip loss* atau susut *thawing* daging beku dengan perhitungan nilai selisih otomatis.

---

## 5. KONSINYASI, AFFILIATE, & PENANGANAN KOMISI
- **Barang Sendiri**: Ada fisik, ada HPP, ledger stok aktif.
- **Konsinyasi (Titipan)**: Ada fisik, tidak ada HPP awal, dicatat sebagai utang konsinyasi. Penyelesaian pembayaran dilakukan setelah barang terjual sesuai kesepakatan pemilik barang.
- **Affiliate / Digital**: Tidak ada fisik, tidak ada ledger stok. Komisi dicatat otomatis berdasarkan konfigurasi (`PERSEN` / `NOMINAL_PER_KG` / `NOMINAL_PER_PCS`) saat penjualan berhasil.

> Catatan: istilah dan mekanisme jurnal pada bagian lama tidak berarti pengguna harus mengoperasikan debit-kredit. Detail status laporan dan akuntansi profesional ditetapkan di Change Register Section 13.

---

## 6. ARSITEKTUR DATABASE LOKAL & MASTER ENTITAS

### A. Penyimpanan Lokal Web PWA — IndexedDB (`karkasia_erp_offline_db`)
- **`kv_state` (`engine_state_v1`)**: Menyimpan snapshot deterministik `BusinessEngineState` (produk, batch lot, pelanggan, piutang, PO, tagihan supplier, transaksi POS, ledger stok, jurnal akuntansi otomatis, jejak audit aktivitas, antrean persetujuan owner, dan `syncOutbox`).
- **`preferences`**: Menyimpan preferensi cepat antar sesi (`supplier_phones`, `last_payment_method`, `last_supplier`, dan `backend_adapter_config_v1`) sehingga konfigurasi tidak hilang saat `localStorage` dibersihkan browser.
- **Migrasi Otomatis & Kompatibilitas Data Lama**: `normalizePersistedState()` di `src/engine/businessEngine.ts` memigrasikan `localStorage` lama ke IndexedDB tanpa kehilangan data dan mempertahankan entitas/status existing.

### B. Flutter/APK — di luar scope aktif
- Kode/fondasi Flutter yang mungkin masih ada di repository diperlakukan sebagai arsip eksperimen, bukan target yang harus diselesaikan atau dipelihara untuk rilis PWA. Tidak ada kewajiban Drift, SQLCipher, FlutterSecureStorage, atau build APK pada roadmap aktif.

### C. Daftar Master Entitas Inti
1. `users` (RBAC: Owner, Admin, Sales + hash PIN 6-digit)
2. `customers` (CRM, Plafon utang, Tempo)
3. `suppliers` (Data supplier impor/lokal + nomor WhatsApp tersimpan)
4. `products` (Master produk, kategori, dual-unit KG/Pcs/Box)
5. `lots` (Batch/Lot daging, NKV, expired_date, landed cost, hpp_per_kg, status karantina)
6. `purchase_orders` & `goods_receipts` (Pembelian kontainer & penerimaan aktual)
7. `supplier_invoices` & `ap_payments` (Tagihan & pelunasan utang supplier)
8. `customer_tiers` & `product_prices` (Harga bertingkat & event bazar berjadwal)
9. `transactions` & `transaction_items` (POS invoice & rincian item)
10. `stock_ledger` (Append-only movement: IN_PURCHASE, OUT_SALE, IN_RETURN, OUT_ADJUST, OUT_CONVERSION, IN_CONVERSION, OUT_CUTTING_LOSS, OUT_QUARANTINE)
11. `stock_summary` (Materialized cache stok per produk/lot)
12. `conflict_cases` / `approvals` (Pencatatan konflik stok minus dan approval tindakan sensitif; plafon piutang tidak menggunakan approval)
13. `sync_outbox` (Antrean sinkronisasi offline dengan `idempotencyKey`, `status`: `PENDING` | `SYNCED` | `FAILED`, dan `serverSeq`)
14. `media_queue` (Antrean foto bukti retur / nota kas kecil max 720p)
15. `journals` & `audit_trail` (Jurnal otomatis dan log aktivitas yang dapat ditelusuri; tidak memakai hash-chain audit)

---

## 7. BACKEND CONFIGURABLE & PROTOKOL SINKRONISASI OUTBOX + PULL RECONCILIATION
- **Fondasi tidak berubah**: seluruh transaksi inti disimpan lebih dahulu ke IndexedDB dan masuk Outbox `PENDING`. Operasi lokal tidak bergantung pada backend tertentu.
- **Backend configurable**: pilihan backend dapat mencakup `LOCAL_ONLY`, GAS/Google Sheets, REST API dengan PostgreSQL, Supabase, atau layanan lain yang memenuhi kontrak. Daftar ini adalah opsi evaluasi, bukan kewajiban membangun dan memelihara semuanya sekaligus.
- **Pemilihan berdasarkan konfigurasi**: satu backend menjadi target aktif untuk satu store/device pada satu waktu, tetapi vendor tidak dikunci permanen. GAS, REST/PostgreSQL, Supabase, atau adapter baru dapat dipilih sesuai kebutuhan. Konfigurasi target boleh disiapkan dan diuji tanpa mengaktifkannya. Jangan mengirim event yang sama ke beberapa backend secara paralel sebagai mekanisme failover.
- **Pemisahan switch, migration, dan failover**:
  - *Switch konfigurasi* hanya mengubah adapter aktif. Ini aman langsung hanya bila target baru memang namespace kosong dan tidak ada event yang mungkin sudah diterima server lama.
  - *Migration backend* memindahkan histori event lengkap, master data/proyeksi, lampiran, mapping identitas store/device/user, idempotency registry, dan checkpoint/cursor dengan verifikasi jumlah serta checksum. `serverSeq` milik server lama tidak boleh dipakai sebagai cursor server baru tanpa proses import yang mempertahankan urutan atau membuat checkpoint baru yang tervalidasi.
  - *Failover* adalah perpindahan sementara saat backend utama gagal. Failover tidak boleh otomatis mengirim Outbox ke backend kedua sebelum status penerimaan pada backend pertama direkonsiliasi.
  - Sampai migration workflow tersedia, UI menahan aktivasi target remote berbeda bila perangkat memiliki `lastServerSeq`, event `SYNCED`, atau event `FAILED/retry` yang menandakan kemungkinan penerimaan remote. Peralihan ke `LOCAL_ONLY` tetap diperbolehkan dan tidak menghapus data/Outbox.
- **Profil backend**: rancangan target adalah menyimpan beberapa profil konfigurasi bernama (endpoint, store/tenant, jenis adapter, dan referensi kredensial aman) dengan satu profil aktif. Kredensial server berprivilege tinggi tidak boleh disimpan di browser. Implementasi UI saat ini masih menyimpan satu konfigurasi aktif; pengelolaan multi-profil dan wizard migrasi adalah pekerjaan lanjutan, bukan fitur yang boleh diklaim sudah tersedia.
- **Kontrak adapter tetap tunggal**: adapter harus menormalkan respons menjadi event envelope kanonis (`uuid`, `idempotencyKey`, `entityType`, `payload`, `serverSeq`) sebelum reducer. Validasi integer remote P0-4 dan proteksi tombstone P0-5 berjalan di Business Engine, bukan di adapter vendor tertentu.
- **Kontrak adapter**: adapter menyediakan health check, push Outbox, pull perubahan, ACK eksplisit, dan kemampuan media/AI bila diperlukan. Business Engine tidak boleh bergantung pada SDK atau skema vendor tertentu.
- **Protokol wajib**: UUID, idempotency, ACK per event, server sequence/cursor, pagination, pull idempoten, penanganan konflik, dan status error yang terlihat harus konsisten lintas adapter. Kegagalan jaringan tidak boleh menghapus transaksi lokal.
- **GAS sebagai salah satu opsi**: implementasi `gas/Code.gs` dan `gas/README.md` adalah adapter/gateway yang tersedia untuk dievaluasi atau dipilih, bukan arsitektur wajib. Jika dipilih, shared secret dikirim di body, event log append-only, idempotensi, server sequence, lock, dan pagination tetap diwajibkan.
- **PostgreSQL/Supabase sebagai opsi**: akses dilakukan melalui API/backend aman atau layanan terkelola dengan kontrol akses yang benar. Jangan pernah menaruh password database, service-role key, atau secret server di bundle PWA.
- **Voice Order dan AI**: pemrosesan yang memerlukan model AI dapat memakai layanan server/provider yang dikonfigurasi. Tidak harus melalui GAS. Fitur ini tidak boleh mengubah transaksi final tanpa validasi Business Engine.
- **Aturan Outbox, ACK, dan Pull Reconciliation**:
  - **Local-First Commit**: Semua mutasi engine inti di `src/engine/businessEngine.ts` (penjualan POS, pelunasan piutang, pelunasan utang supplier, pengeluaran/top-up kas kecil, opname, penerimaan barang, retur/karantina, void transaksi, konversi trimming/tetelan, promo bazar) menulis ke IndexedDB terlebih dahulu serta membuat entri Outbox berstatus awal **`PENDING`**.
  - **Strict `SYNCED` Rule**: Status `SYNCED` (dan pengisian `serverSeq`) **hanya** diberikan lewat `applyOutboxSyncResults()` setelah adapter/backend terpilih mengembalikan **ACK eksplisit** per UUID item (`acknowledgedIds` / `acks`). Item yang ditolak atau gagal jaringan ditandai `FAILED` dengan pesan galat; pada mode tanpa backend/`LOCAL_ONLY`, antrean tetap `PENDING`.
  - **Tidak Ada Auto-Flush Wajib Tanpa Konfigurasi**: Perangkat tetap bekerja aman tanpa memaksa koneksi saat startup.
  - **Pull & Reconciliation (Web PWA)**: Setelah push, adapter menarik event dengan cursor `lastServerSeq`. Reducer menerapkan event berurutan dan idempoten untuk `SALE`, `PAYMENT` (piutang + utang supplier), `RETURN`, `VOID`, `PURCHASE`, `OPNAME` (termasuk produk/lot saldo awal), `CONVERSION`, `APPROVAL`, dan `MASTER_DATA`. Kekurangan stok atau referensi master yang tidak cocok dicatat di `remoteSyncConflicts`, bukan diam-diam diabaikan.
  - **Adapter GAS tersedia**: `gas/Code.gs` menyediakan salah satu implementasi gateway dengan append-only event log, idempotensi per Store ID, server sequence, pull per perangkat, lock untuk push bersamaan, dan pagination 500 event. Panduan deployment ada di `gas/README.md`. Deployment dan uji dua HP hanya menjadi prasyarat bila GAS dipilih.
  - **Prefix Device Invoice**: Nomor faktur menggunakan format `INV-{DEVICE_ID}-{YYMMDD}-{SEQ}`. Device ID aktif dibuat per instalasi dan tidak dipindahkan sebagai identitas aktif saat restore. Payload backup tetap menyimpan Device ID asal pada metadata transaksi/audit; perangkat pengganti memperoleh Device ID baru.

---

## 8. KEAMANAN, OTORISASI PERANGKAT, BACKUP & PEMULIHAN
- **Isolasi & Otorisasi Perangkat**:
  - IndexedDB diisolasi per origin HTTPS browser; setiap instalasi PWA memiliki Device ID unik.
  - PIN Owner Web disimpan sebagai hash PBKDF2-HMAC-SHA256 dengan salt unik (100.000 iterasi); plaintext tidak disimpan. Hash/salt PIN dan kredensial aktif perangkat tidak diekspor ke backup.
  - Restore pada perangkat pengganti membuat Device ID baru. Device ID asal transaksi tetap dipertahankan sebagai metadata/audit, tetapi identitas aktif perangkat lama tidak boleh disalin.
  - Aksi restore penuh hanya boleh dilakukan Owner. Backup otomatis per perangkat tidak memerlukan persetujuan Owner setiap kali berjalan.
  - Secret server/database tidak boleh ditanam di bundle PWA. Otorisasi Google Drive menggunakan OAuth per perangkat; gunakan scope/izin minimum yang diperlukan dan jangan menyimpan password Google atau secret server di PWA.
- **Tujuan dan Prioritas Backup**:
  - IndexedDB lokal adalah penyimpanan transaksi aktif dan Outbox; setiap transaksi harus tersimpan lokal secara langsung sebelum proses sinkronisasi atau backup eksternal.
  - Backend yang dipilih (target operasional saat ini ZimaOS, jika dikonfigurasi) adalah sumber data bersama untuk transaksi yang sudah diterima/ACK. Backup backend mengikuti kemampuan dan konfigurasi layanan yang benar-benar dipilih.
  - Google Drive adalah **backup eksternal alternatif**, bukan syarat transaksi, bukan backend sinkronisasi utama, dan bukan komponen wajib agar PWA dapat beroperasi. Jika Owner mengaktifkannya, semua perangkat mengotorisasi akun Google Owner satu kali per perangkat dan mengunggah ke satu folder bersama `ERP DAGING BACKUP`.
  - Tidak ada folder Google Drive per-device dan tidak ada konfigurasi folder/Device ID manual. Device ID dicatat otomatis sebagai metadata asal transaksi.
  - Semua perangkat boleh mengunggah ke folder bersama, tetapi setiap file backup memiliki nama/ID/versi unik. Jangan biarkan perangkat menimpa satu file JSON bersama. Deduplikasi dilakukan berdasarkan UUID/idempotency key transaksi, bukan nama file atau folder.
- **Alur Backup Lokal & Eksternal**:
  - Commit transaksi ke IndexedDB dan Outbox dilakukan langsung/atomik sesuai kemampuan storage; kegagalan upload server atau Drive tidak boleh membatalkan transaksi lokal.
  - Pengaturan cadence dapat menawarkan `setiap transaksi`, `5 menit`, atau `10 menit`. Pilihan setiap transaksi berarti mencatat/mengantrekan perubahan incremental per event, bukan membuat full JSON baru untuk setiap transaksi. Snapshot lokal berkala 5/10 menit hanya dijalankan saat PWA aktif; browser/OS tidak menjamin timer berjalan ketika aplikasi ditutup atau ditangguhkan.
  - Saat Google Drive aktif, PWA mengantrekan perubahan dan mengunggah backup incremental/batch ketika internet tersedia. Snapshot JSON lengkap dibuat sebagai titik pemulihan sesuai kebijakan snapshot. Foto/lampiran disimpan sebagai file terpisah dengan referensi stabil dan checksum; JSON memuat state/event, Outbox, metadata, serta manifest lampiran.
  - Jika internet atau Drive gagal, antrean upload tetap lokal dan dicoba ulang. Status lokal, status backend, dan status Drive ditampilkan terpisah; jangan menampilkan backup eksternal sukses sebelum upload dan verifikasi benar-benar selesai.
  - PWA tidak menjamin upload background ketika browser ditutup. Upload tertunda dilanjutkan ketika aplikasi aktif/koneksi tersedia.
- **Satu Folder Drive Bersama**:
  - Struktur tujuan cukup satu folder `ERP DAGING BACKUP` pada akun Owner. File dari semua device berada di folder yang sama; metadata file/payload memuat `storeId`, `deviceId` asal, `backupId`, waktu, rentang/urutan event, schema version, jumlah transaksi, dan checksum.
  - File JSON dan lampiran dipisah agar file JSON tidak membesar. Nama file unik/versioned; jangan mengandalkan urutan nama file sebagai satu-satunya sumber kebenaran.
  - Google Drive dapat menyelamatkan backup transaksi per-device saat server ZimaOS down selama internet dan otorisasi Drive tersedia. Drive tidak otomatis menjadi database kolaboratif: data antar-device tetap dapat berbeda sampai backend pulih dan rekonsiliasi selesai.
- **Alur Restore & Pemulihan**:
  - Menu PWA menyediakan sumber pemulihan: **Server (utama)**, **Google Drive (alternatif)**, dan **Snapshot Lokal**. Pilihan yang tersedia menyesuaikan konektivitas dan otorisasi.
  - Sebelum restore, buat snapshot pengaman kondisi perangkat. Validasi format, checksum, schema version, manifest/lampiran, dan identitas asal sebelum menerapkan data.
  - Restore penuh memerlukan otorisasi Owner. Pengguna Sales/Admin tidak dapat mengganti database perangkat secara mandiri.
  - Restore tidak boleh menghapus seluruh IndexedDB lalu menimpa dengan satu file backup. Rekonsiliasi berdasarkan UUID transaksi/event dan idempotency key; transaksi yang sudah ada tidak digandakan, transaksi pending yang belum diterima backend tetap pending, dan data lebih baru tidak boleh ditimpa diam-diam.
  - **Perangkat yang sama**: pulihkan data yang hilang dari snapshot lokal/Drive/server, lalu rekonsiliasi dengan data yang masih ada.
  - **Perangkat pengganti**: buat Device ID baru; tarik data yang sudah tersinkron dari backend terlebih dahulu bila tersedia; impor event yang belum ada dari backup Drive; pertahankan Device ID asal pada setiap transaksi; jangan mengkloning identitas aktif perangkat lama.
  - **Server ZimaOS down**: perangkat tetap bekerja dari IndexedDB masing-masing. Jika satu perangkat hilang, Owner dapat memulihkan transaksi device tersebut dari backup Drive terakhir yang berhasil. Data lintas-device belum tentu konsisten/tergabung sampai server pulih; jangan mengklaim Drive menggantikan fungsi sinkronisasi backend.
  - Jika konflik tidak dapat direkonsiliasi dengan aman, hentikan bagian restore yang konflik dan tampilkan kebutuhan tindakan Owner; jangan overwrite atau membuang transaksi.
- **Batasan Operasional & Keamanan PWA**:
  - Google Drive opsional dan kegagalannya tidak boleh memblokir POS, transaksi inti, atau sinkronisasi ke backend utama.
  - PIN Owner yang sudah ada tetap satu-satunya PIN untuk otorisasi tindakan sensitif; tidak ada PIN kedua, passphrase, recovery key, atau autentikasi berlapis.
  - Autentikasi backend mengikuti mekanisme adapter yang dipilih. Shared Secret hanya relevan untuk gateway GAS dan tidak boleh menjadi secret server yang dibundel ke PWA.
  - Enkripsi lokal tambahan bukan prioritas rilis PWA saat ini. Fokus pada backup yang dapat diverifikasi, restore aman, migrasi aman, dan error penyimpanan yang terlihat.

## 9. ATURAN OPENING BALANCE & FORMAT CSV MIGRASI AWAL
Format standar migrasi awal saat Go-Live:
- **Stok Lot Awal**: `sku, lot_code, expiry_date, total_gram, total_pcs, cost_total_rupiah, supplier_code`
- **Piutang Pelanggan Awal**: `customer_code, invoice_no, amount_due_rupiah, due_date`
- **Utang Supplier Awal**: `supplier_code, reference_no, amount_due_rupiah, due_date`

---

## 10. DAFTAR 24 MODUL ERP & MATRIKS FUNGSIONAL
- **MOD-01**: First Run & Store Setup (`TOKO_ERP DAGING_01`)
- **MOD-02**: Users, PIN 6-digit & RBAC
- **MOD-03**: Master Produk & Dual-Unit (KG/Pcs/Box, Catch Weight)
- **MOD-04**: POS Unified Dual-Mode (Kasir Toko & Sales Lapangan, Struk Coret Ongkir, Uang Pas)
- **MOD-05**: Harga Bertingkat & Promo Bazar Berjadwal
- **MOD-06**: Manajemen Pelanggan & Plafon Utang Fleksibel
- **MOD-07**: Persediaan Gudang, FEFO, & Yield Loss Conversion (Trimming -> Tetelan)
- **MOD-07B**: Stock Opname, Drip Loss, & Karantina Lot
- **MOD-08**: Retur Penjualan & Pembelian (Wajib Foto Kamera via MOD-20)
- **MOD-09**: Pembelian Impor, Landed Cost PO, & Quick Contact WhatsApp Supplier
- **MOD-10**: Piutang Pelanggan, Aging Buckets, & Warning Jatuh Tempo
- **MOD-11**: Setoran Kas Sales, Soft Limit Rp 3jt, & Health Score Warning
- **MOD-12**: Kasir Kecil & OPEX (Foto Struk Terkompres)
- **MOD-13**: Kalkulator Pajak UMKM (0,5%) & Laporan Laba Bersih Sederhana
- **MOD-14**: Dashboard, Store Health Score, dan AI Advisor (ringkasan kondisi usaha berbasis data ERP; fungsi transaksi inti tetap offline-first dan tidak bergantung pada AI)
- **MOD-15**: Persetujuan Owner & Conflict Resolution (`approvals` / `conflict_cases`)
- **MOD-16**: Backup & Restore per-device (IndexedDB/Outbox selalu lokal; snapshot lokal 5/10 menit atau incremental per transaksi; Google Drive opsional satu folder Owner bersama untuk semua device; JSON + lampiran terpisah; restore Owner-only dengan rekonsiliasi UUID dan perlindungan data lebih baru)
- **MOD-17**: Perangkat Pendukung (Barcode/QR Scanner Kamera + Undo Scan & Struk Cetak)
- **MOD-18**: Audit Trail & Jurnal Akuntansi Otomatis (Progressive Disclosure)
- **MOD-19**: Ekspor Dokumen PDF & CSV (`jspdf`, `jspdf-autotable`)
- **MOD-20**: Camera Document Capture & Compression (Retur & Nota OPEX)
- **MOD-21**: Voice Order Assistant (ucapan menjadi draft pesanan/transaksi; ekstraksi dapat memerlukan koneksi, validasi item/berat/harga/pelanggan dilakukan Business Engine).
- **MOD-22**: AI Advisor (analisis data ERP, ringkasan kondisi usaha, deteksi anomali, dan rekomendasi yang dapat ditelusuri ke data sumber).
- **MOD-23**: OCR Nota (foto nota → ekstraksi data → draft pembelian/OPEX → verifikasi pengguna sebelum disimpan).

---

## 11. STATUS AUDIT AKTUAL, CELAH TERVERIFIKASI, & ROADMAP LANJUTAN

### Patch yang sudah diterapkan pada Web PWA
1. **PIN Owner**: migrasi dari plaintext ke PBKDF2-HMAC-SHA256 + salt unik; hash/salt dikecualikan dari backup; PIN bawaan wajib diganti sebelum aksi sensitif.
2. **Retur**: wajib menemukan faktur COMPLETED, pelanggan harus cocok, produk harus tercantum pada faktur, dan total kuantitas retur tidak boleh melebihi kuantitas terjual dikurangi retur sebelumnya. Nilai refund dihitung dari nilai aktual baris faktur.
3. **Piutang**: pembayaran parsial didukung; metode Tunai menambah kas, Transfer menambah saldo bank; riwayat pembayaran disimpan dan pembalikan menghitung ulang per kanal pembayaran. Pembayaran ditolak bila saldo piutang agregat pelanggan tidak cukup/tidak valid; pembalikan ditolak bila kas atau bank tidak cukup, metode/nominal riwayat tidak valid, atau hasil pemulihan saldo tidak aman. Tidak ada clamp diam-diam yang membuat jurnal berbeda dari saldo.
4. **Multi-device**: kontrak adapter dan implementasi GAS tersedia; adapter terpilih melakukan push + pull, server cursor mencegah replay, dan reducer menggabungkan event transaksi serta master data. Konflik stok/referensi yang tidak cocok disimpan untuk rekonsiliasi.
5. **UI vs Business Engine**: edit harga/foto/galeri/master pelanggan/lokasi lot/PO tidak lagi menulis state langsung; jalur master data melewati mutator updateMasterData, validasi, audit trail, dan Outbox. Checkout tidak lagi memblokir tempo karena plafon; harga tier/promo dihitung ulang oleh Business Engine, dan diskon manual memerlukan PIN Owner aktif.

### Batas yang belum boleh dianggap selesai
- **Integrasi backend terpilih**: setiap backend yang dipilih untuk operasional harus dikonfigurasi dan diuji nyata minimal dua perangkat. Untuk GAS, pemilik ERP perlu membuat Spreadsheet, mengatur Script Properties, dan deploy Web App. Untuk PostgreSQL/Supabase, backend/API, kebijakan akses, dan database perlu disiapkan. Tanpa deployment dan uji perangkat, sinkronisasi multi-device belum terbukti operasional.
- **Validasi upload media server**: adapter GAS saat ini menyediakan `media_upload` dan `media_download`, mewajibkan Script Property `SYNC_SHARED_SECRET`, membatasi file ke JPEG maksimal 1 MB, serta memakai nama deterministik per store + media ID. Kode sudah tersedia, tetapi tetap perlu redeploy GAS versi terbaru, memberi izin Google Drive, dan uji foto nyata dua perangkat; file Drive tetap privat mengikuti izin akun Google pemilik deployment.
- **Bukti foto retur Web PWA (LOKAL + SINKRONISASI DUA ARAH)**: foto aktual disimpan sebagai Blob di IndexedDB `media_blobs`. ID foto ikut payload event retur; perangkat pengirim mengunggah foto melalui adapter/backend yang dipilih (implementasi GAS saat ini memakai Drive), sedangkan perangkat penerima mengunduh foto berdasarkan `storeId + mediaId` saat sinkronisasi. Unduhan yang gagal dicoba ulang pada sinkronisasi berikutnya. `evidenceRemoteFileId` hanya metadata lokal; pengambilan lintas perangkat menggunakan ID media stabil, bukan Drive file ID.
- **Flutter media sync (BELUM TERINTEGRASI END-TO-END)**: worker dan adapter upload ada, tetapi jalur produksi yang memasukkan file nyata ke `media_queue` belum terbukti. Patch ini hanya menutup jalur Web PWA; jangan menganggap Flutter ikut tersinkron.
- **Backup/Restore lampiran Web PWA (SUDAH DIIMPLEMENTASIKAN)**: file backup JSON sekarang menyertakan seluruh Blob pada `media_blobs` sebagai Base64 beserta `attachmentsChecksum`. Restore memvalidasi checksum lampiran, meminta PIN Owner seperti sebelumnya, lalu memulihkan Blob ke IndexedDB dengan `mediaId` asli. Backup lama tanpa lampiran tetap didukung.
- **Jalur pembelian tunai**: pembuatan PO dan supplier invoice masih perlu diselesaikan sebagai mutasi keuangan terpisah agar pembayaran tunai saat PO dibuat memengaruhi kas dan jurnal secara tepat.
- **Flutter APK**: belum dibangun atau diuji; pekerjaan ini hanya memverifikasi jalur Web PWA.
- **Verifikasi UI visual**: audit ini bersifat source/logic audit. Pengujian screenshot, perangkat HP nyata, ukuran layar, aksesibilitas, dan alur offline dua perangkat tetap diperlukan.

### Prioritas PWA berjalan
1. **Backup/Export & Import/Restore JSON beserta seluruh lampiran**: satu alur sederhana; export wajib gagal dengan pesan jelas bila state atau satu lampiran tidak bisa dibaca, dan restore wajib memvalidasi file/PIN sebelum mengganti data.
2. **Migrasi aman dengan backup-before-upgrade + guard versi**: simpan salinan state lama sebelum perubahan struktur; jika migrasi gagal, batalkan perubahan dan pertahankan data lama. Hindari framework migrasi berlapis yang tidak diperlukan.
3. **XSS hygiene**: React harus merender input pengguna sebagai teks; hindari dangerouslySetInnerHTML kecuali ada kebutuhan yang benar-benar terbukti.
4. **Diagnostics sederhana**: console.error dan tampilan error penyimpanan terakhir yang bisa dilihat Owner/Admin; tanpa telemetry atau metrics.
5. **Kontrak keamanan adapter GAS** (secret di body, bukan URL) tetap berlaku bila GAS dipilih; backend lain mengikuti mekanisme autentikasi masing-masing.
6. Pastikan upload/unduh foto, sinkronisasi melalui backend yang dipilih, dan update PWA punya status yang jelas; fitur yang belum diuji terhadap deployment nyata tidak boleh dinyatakan selesai.
7. Jalankan lint, seluruh test, dan production build pada commit yang sama sebelum menyatakan PWA siap.

### CI
Status CI harus mengikuti hasil GitHub Actions terbaru untuk commit pada main; jangan menyalin hasil test/build dari commit lama sebagai bukti untuk patch baru.

---

## 12. PRINSIP DESAIN UI/UX MOBILE-FIRST & CLEAN LUXURY

### A. Arah Desain Produk
- **Keputusan desain utama: Mobile-First PWA.** Pengalaman HP menjadi acuan utama karena Owner dan Sales sering menggunakan ERP DAGING melalui smartphone. Layout desktop merupakan adaptasi responsif dari pengalaman mobile, bukan sebaliknya.
- **Clean Luxury / Premium Visual.** Antarmuka harus terlihat modern, bersih, elegan, matang, dan profesional. Sederhana yang dimaksud adalah cara penggunaan dan alur kerja, bukan tampilan visual yang polos, murah, atau minim kualitas.
- **Simple Workflow.** Pengguna awam harus dapat menyelesaikan pekerjaan rutin dengan langkah sesedikit mungkin, label yang mudah dipahami, input seperlunya, default yang masuk akal, dan bantuan validasi otomatis dari Business Engine.
- **Professional by Default.** UI operasional tetap ringan dan mudah digunakan, sementara laporan, perhitungan, ledger, audit trail, HPP, dan kontrol bisnis tetap lengkap di belakangnya.
- Prinsip ringkas: **Premium Look. Effortless Experience.**

### B. Karakter Visual
- Gunakan dasar warna putih bersih atau ivory/off-white, dengan navy atau charcoal sebagai warna utama.
- Champagne gold boleh digunakan sebagai aksen premium secara terbatas; jangan menjadikannya warna dominan atau mengurangi keterbacaan.
- Gunakan tipografi modern, jelas, konsisten, dan memiliki hierarki yang tegas untuk judul, label, angka, serta status.
- Gunakan spacing yang lega, alignment rapi, ikon konsisten, radius komponen yang halus, border tipis, dan shadow lembut seperlunya.
- Status penting seperti berhasil, peringatan, gagal, stok menipis, dan mendekati kedaluwarsa harus mudah dibedakan serta tidak hanya mengandalkan warna.
- Hindari ornamen berlebihan, gradient mencolok, terlalu banyak warna, grafik dekoratif, kartu bertumpuk tanpa fungsi, teks terlalu kecil, dan layar yang terasa padat.
- Visual premium tidak boleh mengorbankan performa PWA, aksesibilitas, keterbacaan, atau kenyamanan perangkat kelas menengah.

### C. Pola Interaksi Mobile
- Navigasi utama di HP menggunakan **bottom navigation** untuk akses cepat dengan ibu jari. Menu sekunder dan fungsi yang jarang dipakai ditempatkan di halaman "Lainnya" atau area menu kontekstual.
- Letakkan aksi utama pada area yang mudah dijangkau, dengan ukuran target sentuh yang nyaman dan jarak antartombol yang mencegah salah tekan.
- Form dibuat ringkas, satu kolom bila sesuai, memakai pilihan/default otomatis, pencarian, keypad numerik untuk angka, serta validasi dekat dengan field terkait.
- Hindari tabel lebar di HP. Sajikan daftar atau ringkasan yang mudah dipindai; detail lengkap dibuka pada halaman detail atau bagian yang dapat diperluas.
- Angka operasional penting—berat, harga, total transaksi, stok, piutang, dan utang—harus mudah dibaca dan memiliki format konsisten.
- Berikan feedback yang jelas setelah aksi: loading, berhasil, gagal, perlu tindakan, atau data masih tersimpan lokal dan menunggu sinkronisasi.
- Jangan membuat interaksi bergantung pada hover. Pastikan fungsi penting tetap berjalan dengan sentuhan dan keyboard.
- Perhatikan safe area perangkat, keyboard virtual, orientasi layar, koneksi tidak stabil, serta kondisi PWA terpasang maupun dibuka dari browser.

### D. Pengalaman Berdasarkan Role
- **Sales:** fokus pada aktivitas penjualan. Alur utama yang dituju: pilih pelanggan (atau pelanggan umum) → pilih produk → masukkan berat/jumlah → periksa ringkasan → pilih pembayaran → simpan dan tampilkan bukti transaksi. Opsi tambahan hanya ditampilkan saat relevan. Sales tidak dibebani menu administrasi.
- **Admin:** fokus pada pekerjaan operasional seperti pembelian/penerimaan, persediaan, pelanggan/supplier, piutang/utang, dan OPEX. Aksi rutin dibuat langsung dan jelas; kontrol tambahan hanya muncul ketika kondisi transaksi memang memerlukannya.
- **Owner:** fokus pada ringkasan usaha, laporan, pengaturan kebijakan, pengguna, serta pengecualian yang benar-benar membutuhkan perhatian. Owner tidak dijadikan bottleneck untuk pekerjaan rutin yang dapat divalidasi otomatis.
- Navigasi dan halaman menyesuaikan hak akses masing-masing role. Menyederhanakan tampilan tidak boleh mengurangi otorisasi, validasi, pencatatan, atau audit trail.

### E. Adaptasi Desktop
- Desktop menggunakan ruang layar lebih luas untuk menampilkan navigasi samping, ringkasan multi-kolom, dan tabel yang relevan.
- Struktur informasi, istilah, aturan bisnis, serta hasil transaksi harus konsisten antara HP dan desktop.
- Jangan membuat dua workflow bisnis berbeda hanya karena ukuran layar berbeda. Perbedaan hanya pada penyusunan layout dan cara penyajian informasi.

### F. Batasan Implementasi dan Kriteria Penerimaan
- Bagian ini menetapkan arah dan prinsip UI/UX, bukan mengubah aturan bisnis, skema data, Business Engine, hak akses, atau keputusan arsitektur Local-First yang sudah ada.
- Seluruh aturan bisnis dan validasi tetap bersumber dari Business Engine; komponen UI tidak boleh membuat aturan transaksi tandingan.
- Jangan mengubah keputusan bisnis yang sudah ditetapkan hanya demi menyederhanakan tampilan. Jika ditemukan konflik antara UI dan aturan bisnis, pertahankan aturan bisnis dan laporkan konflik tersebut.
- Implementasi UI harus diuji pada viewport HP yang umum, termasuk layar kecil, serta desktop. Uji alur utama per role, kondisi offline, keyboard terbuka, validasi gagal, dan feedback penyimpanan.
- Kriteria hasil: pengguna dapat menyelesaikan tugas rutin dengan langkah yang ringkas dan jelas; informasi penting mudah ditemukan; tampilan terasa premium dan konsisten; tidak ada fungsi penting yang tersembunyi atau sulit disentuh; serta perilaku bisnis tetap sama dengan engine.
- Detail seperti susunan final bottom navigation, komposisi dashboard, komponen POS, ukuran tipografi, dan token desain ditetapkan saat tahap desain/implementasi setelah diuji pada layar HP nyata. Jangan menganggap contoh mockup sebagai keputusan menu final.


## 2026-11-14 — GAS transport hardening (Web PWA)

- Google Apps Script webhook health checks and event pulls use POST with `text/plain;charset=utf-8`; the shared secret is sent in the JSON request body, never in the URL.
- GAS accepts `health` and `sync_pull` through authenticated POST. GET requests for these actions are rejected, and query-string credentials are explicitly rejected.
- The existing `sync_push`, `media_upload`, and `media_download` request contracts remain unchanged. GAS now requires the configured `SYNC_SHARED_SECRET` for all POST actions, including sync push.
- Adapter tests assert that health/pull URLs contain no token and that the POST body carries the expected shared secret and pull parameters.
- Deployment verification is still required: redeploy `gas/Code.gs`, set Script Property `SYNC_SHARED_SECRET`, then verify health and pull against the live `/exec` URL. Repository CI cannot prove Google Apps Script redirect behavior or deployment configuration.


## 2026-11-14 — IndexedDB migration safety & PWA update guard (Web PWA)

- IndexedDB database version advances from 2 to 4 (v3 added migration metadata; v4 adds restore safety snapshots). Existing stores are preserved; the upgrade adds `migration_backups` and `migration_meta`.
- Before the v2-to-v4 upgrade completes, the current `kv_state/engine_state_v1` snapshot is copied into a pre-v3 backup record in the same IndexedDB version-change transaction. If reading the snapshot fails, the upgrade transaction aborts, leaving the prior database version intact.
- A read helper exposes the pre-v3 snapshot for recovery tooling. No business-state fields are transformed in this migration, so `ENGINE_SCHEMA_VERSION` remains 1; IndexedDB database version and engine payload schema version remain separate.
- PWA service-worker updates now use prompt mode. The app asks before activating a new worker and reloading; declining keeps the current app session running.
- Regression tests cover fresh database creation, v2-to-v3 backup planning, and idempotent opening of v3 databases.
- This is a storage-safety foundation, not yet a multi-version business-payload migration framework. Future payload changes must add explicit transforms and recovery tests before changing `ENGINE_SCHEMA_VERSION`.


---

## 13. CHANGE REGISTER — PENYEDERHANAAN, BACKUP & RESTORE (V4.8)

Bagian ini adalah keputusan terbaru. Jika ada detail pada Section 1–12 yang masih menyebut platform, backend, workflow, atau kontrol yang bertentangan, Change Register ini yang berlaku. Perubahan ini menyederhanakan pengalaman penggunaan dan beban implementasi; bukan memangkas kemampuan bisnis ERP DAGING.

### 13.1 Prinsip Produk yang Dikunci
- **Misi produk**: pengguna UMKM dapat menjalankan bisnis tanpa harus memahami akuntansi atau prosedur ERP yang rumit. ERP mengolah transaksi, kontrol, perhitungan, dan laporan secara profesional di belakang layar.
- **UI sederhana, mesin ERP profesional**: sederhanakan layar, istilah, input, dan langkah kerja; jangan menyederhanakan akurasi data, aturan bisnis, ledger, validasi, atau keluaran laporan.
- **Fitur pembeda tetap dipertahankan**: OCR Nota, AI Advisor, dan Voice Order tetap bagian dari scope produk. Ketiganya bukan fitur yang dihapus demi penyederhanaan.
- **Laporan tetap lengkap**: penyederhanaan antarmuka tidak mengurangi laporan penjualan, margin, HPP, persediaan, pembelian, landed cost, piutang, utang, kas, bank, OPEX, pajak, laba rugi, audit, dan rekonsiliasi.
- **Bukan aplikasi akuntansi untuk pengguna**: pengguna berinteraksi dengan istilah operasional sehari-hari. Jurnal dan perhitungan akuntansi dibentuk otomatis oleh Business Engine; tidak ada keharusan pengguna membuat jurnal manual atau memahami debit-kredit.

### 13.2 Status Keputusan: KEEP
Hal berikut tetap menjadi kemampuan inti dan tidak boleh dihapus hanya untuk mengecilkan scope:
- Model multi-device maksimal 8 perangkat: 1 Owner, 2 Admin, 5 Sales.
- PWA installable dan Local-First; IndexedDB per perangkat.
- Sinkronisasi melalui backend yang dipilih, Outbox, ACK, idempotency, UUID, server sequence/cursor, pull, dan conflict detection.
- POS, pembelian/penerimaan, FEFO, lot, landed cost, HPP per lot, yield/conversion, susut, dan quarantine.
- OWN, CONSIGNMENT, AFFILIATE beserta perlakuan stok dan kewajiban masing-masing.
- Pembayaran CASH/TRANSFER/TEMPO/campuran, pembayaran piutang parsial, pembayaran utang, kas, bank, dan OPEX.
- Retur tervalidasi terhadap faktur dan kuantitas yang telah diretur; void/reversal tercatat dan tidak menghapus sejarah transaksi.
- Audit trail operasional yang dapat ditelusuri; ledger append-only untuk pergerakan stok dan koreksi melalui reversal/adjustment.
- Backup/export JSON dan import/restore beserta seluruh lampiran; checksum integritas; backup-before-upgrade dan guard migrasi.
- OCR Nota: foto nota menghasilkan draft data pembelian atau OPEX yang dapat diperiksa pengguna.
- AI Advisor: analisis data aktual ERP, ringkasan, deteksi anomali, dan rekomendasi bisnis. Hasil harus menunjukkan periode/data dasar dan dapat ditelusuri; AI bukan sumber angka resmi.
- Voice Order: ucapan menjadi draft pesanan/transaksi. Sistem harus menampilkan hasil pengenalan untuk diperiksa sebelum transaksi final.
- Laporan profesional dan lengkap, termasuk laba rugi, margin, HPP, stok, AR/AP, umur tagihan, kas/bank, OPEX, pajak, dan rekonsiliasi sesuai data yang tersedia.

### 13.3 Status Keputusan: SIMPLIFY
- **Platform aktif**: PWA. Flutter/APK tidak menjadi target implementasi aktif.
- **Fondasi data lokal yang dikunci**: IndexedDB sebagai penyimpanan utama per perangkat; transaksi inti tetap berjalan secara Local-First.
- **Backend tidak dikunci**: GAS, REST API + PostgreSQL, Supabase, atau layanan lain dapat dieksplorasi dan dipilih berdasarkan kebutuhan, biaya, keamanan, kemampuan operasional, dan hasil pengujian.
- **Abstraksi**: pertahankan kontrak adapter yang tipis dan jelas agar Business Engine tidak terikat vendor. Tidak perlu membangun semua adapter sekaligus; implementasikan hanya backend yang dipilih.
- **Database lokal**: IndexedDB adalah penyimpanan aktif PWA. Backend server menjadi lapisan sinkronisasi/kolaborasi, bukan pengganti fondasi Local-First.
- **Sinkronisasi**: satu backend terpilih pada satu konfigurasi operasional, dengan protokol push/pull, ACK eksplisit, idempotency, cursor/serverSeq, dan status error yang terlihat. Hindari sinkronisasi paralel yang tidak dirancang.
- **Approval**: aktivitas rutin yang lolos validasi otomatis berjalan langsung. Approval/otorisasi hanya untuk tindakan sensitif dan pengecualian yang memiliki risiko nyata.
- **UI per role**: Sales fokus penjualan; Admin fokus operasional; Owner fokus laporan, kebijakan, dan pengecualian. Menu dan input yang tidak relevan tidak ditampilkan.
- **Workflow**: transaksi dibuat sebagai draft hanya ketika memang perlu pemeriksaan; setelah data valid, pengguna dapat menyimpan tanpa approval berulang.
- **AI/OCR/Voice**: satu jalur pemrosesan terkontrol. Hasil OCR dan Voice masuk sebagai draft; AI Advisor membaca data ERP dan tidak menulis transaksi final.
- **Backup**: satu format backup utama yang mencakup state dan lampiran, dengan kegagalan eksplisit jika ada bagian tidak terbaca. Restore multi-device harus memeriksa status sinkronisasi agar tidak menimpa transaksi lebih baru.

### 13.4 Status Keputusan: REMOVE FROM ACTIVE SCOPE
- Flutter/APK, Drift, SQLCipher Flutter, serta pekerjaan build Android.
- Kewajiban membangun dan memelihara semua backend/provider sekaligus.
- Akses langsung PWA ke PostgreSQL menggunakan kredensial database berhak istimewa atau secret server.
- Integrasi backend paralel tanpa kebutuhan dan rancangan konsistensi yang jelas.
- Multi-gudang, multi-cabang, stok kendaraan, payroll, komisi Sales, e-commerce/marketplace, integrasi e-Faktur, GPS, dan full General Ledger workflow.
- Enterprise SSO, PIN kedua, passphrase backup, recovery key, hash-chained audit, serta enkripsi tambahan berlapis tanpa kebutuhan bisnis yang terbukti.
- Approval Owner untuk setiap transaksi rutin, pencatatan jurnal manual oleh pengguna, dan prosedur yang hanya menambah klik tanpa kontrol nyata.

### 13.5 Status Keputusan: DEFER IMPLEMENTATION — FITUR TETAP BAGIAN PRODUK
- Pengembangan lanjutan OCR untuk variasi layout nota, peningkatan akurasi ekstraksi, dan perluasan field.
- Pengembangan lanjutan AI Advisor: analisis tren, margin, stok lambat, piutang, anomali, dan rekomendasi yang lebih kaya.
- Pengembangan lanjutan Voice Order: variasi aksen/bahasa, istilah produk daging, koreksi hasil pengenalan, dan konfirmasi draft.
- Penyempurnaan laporan lanjutan dan visualisasi manajerial.
- Penjadwalan backup otomatis atau retensi arsip tambahan hanya jika kebutuhan operasional dan kapasitas penyimpanan sudah terukur.

### 13.6 Aturan Keamanan Fitur Cerdas
- OCR dan Voice Order tidak boleh langsung memposting transaksi final. Keduanya menghasilkan draft dengan field yang dapat diperiksa dan dikoreksi.
- AI Advisor hanya memberi analisis/rekomendasi. Angka resmi tetap dihitung Business Engine dari transaksi dan ledger, bukan dihasilkan atau ditebak oleh AI.
- AI tidak boleh mengubah stok, harga, pembayaran, jurnal, piutang, atau utang tanpa tindakan eksplisit pengguna melalui workflow normal.
- Jika layanan AI tidak tersedia atau perangkat offline, transaksi inti tetap berjalan. Fitur yang memerlukan pemrosesan server menampilkan status tidak tersedia dan dapat dicoba kembali; tidak boleh memblokir POS atau pencatatan operasional.
- Data yang dikirim untuk pemrosesan AI harus dibatasi sesuai kebutuhan. Akses mengikuti role dan kebijakan server; jangan mengirim kredensial atau data sensitif yang tidak diperlukan.

### 13.7 Risiko Multi-Device yang Wajib Dijelaskan
- Setiap perangkat boleh membuat transaksi offline berdasarkan data lokal terakhir. Karena stok pusat dibagi oleh beberapa perangkat, stok yang terlihat saat offline bukan jaminan stok global real-time.
- Jika dua perangkat menjual stok yang sama saat offline, seluruh transaksi tetap dipertahankan. Setelah sinkronisasi, sistem harus mendeteksi potensi stok minus/oversell, menampilkan konflik, dan menyediakan rekonsiliasi yang tercatat; jangan menghapus atau diam-diam membatalkan penjualan yang sudah terjadi.
- Kebijakan transaksi stok minus yang telah ditetapkan tetap berlaku: alasan wajib dan konfirmasi tanggung jawab Owner; konflik hasil sinkronisasi ditangani melalui proses rekonsiliasi.
- Restore pada satu perangkat tidak boleh diam-diam mengganti data lebih baru yang sudah tersinkron dari perangkat lain. Restore harus Owner-only, membuat backup sebelum tindakan, memeriksa versi/cursor sinkronisasi, dan menghentikan proses bila rekonsiliasi aman tidak dapat dijamin.

### 13.8 Batas Akuntansi dan Laporan
- Pengguna tidak diwajibkan memahami chart of accounts, debit-kredit, atau membuat jurnal manual.
- Business Engine tetap membentuk catatan keuangan yang diperlukan untuk menghasilkan laporan secara konsisten. Penyederhanaan bukan alasan menghilangkan sumber perhitungan atau jejak audit.
- Laporan harus memiliki periode, filter, definisi angka, dan kemampuan menelusuri angka ringkasan ke transaksi sumber.
- Pajak mengikuti konfigurasi dan kebijakan yang telah ditetapkan; laporan pajak bukan klaim bahwa aplikasi menggantikan konsultasi atau pelaporan resmi perpajakan.
- Jangan menyebut laporan “akuntansi lengkap” bila fondasi data atau rekonsiliasinya belum mendukung. Tandai keterbatasan data secara eksplisit.

### 13.9 Kriteria Penerimaan Penyederhanaan
- Pengguna Sales dapat menyelesaikan penjualan rutin dengan alur singkat tanpa membuka menu administrasi.
- Admin dapat menjalankan pembelian, penerimaan, stok, AR/AP, dan OPEX tanpa approval Owner untuk aktivitas rutin yang valid.
- Owner dapat melihat laporan dan pengecualian tanpa harus memproses setiap transaksi.
- Offline tidak memblokir transaksi inti; status pending sync dan konflik terlihat jelas.
- OCR/Voice menghasilkan draft yang dapat diperiksa; AI Advisor menghasilkan analisis yang dapat ditelusuri dan tidak mengubah transaksi.
- Backup/restore mencakup semua lampiran dan tidak memberi pesan sukses bila ada data yang gagal dibaca.
- Tidak ada perubahan aturan bisnis yang sudah dikunci hanya demi menyederhanakan UI. Perubahan aturan harus dicatat terpisah dengan alasan dan bukti.


### 13.10 Keputusan Backup & Restore Multi-Device (V4.8 — DIKUNCI)
- **Local-first wajib**: transaksi selalu disimpan di IndexedDB dan Outbox perangkat sebelum jaringan/backend/Drive dipanggil. Kegagalan server atau Drive tidak boleh menghentikan transaksi lokal.
- **ZimaOS/backend utama**: menjadi jalur sinkronisasi dan sumber data bersama untuk event yang sudah diterima/ACK. Status backup server bergantung pada kemampuan dan konfigurasi backend yang benar-benar dipilih; jangan mengasumsikan backup provider otomatis tersedia.
- **Google Drive alternatif opsional**: Owner dapat mengaktifkan backup eksternal. Jika aktif, setiap device mengotorisasi akun Google Owner satu kali melalui OAuth dan mengirim cadangan langsung ke Drive, tanpa bergantung pada server ZimaOS. Re-authorization mungkin diperlukan bila token dicabut/kedaluwarsa.
- **Satu tujuan bersama**: satu folder `ERP DAGING BACKUP` pada Drive Owner untuk seluruh device; tidak ada folder atau konfigurasi manual per-device. Device ID hanya metadata internal asal transaksi.
- **File aman dari benturan**: setiap backup memakai backup ID/nama unik dan versi; tidak ada satu file JSON bersama yang ditimpa semua perangkat. JSON berisi data/event, Outbox, metadata, dan manifest; foto/lampiran disimpan terpisah dan diverifikasi.
- **Cadence**: perubahan transaksi dicatat lokal langsung. Mode incremental per transaksi tidak membuat full JSON setiap transaksi. Snapshot lokal dapat diatur 5 atau 10 menit saat PWA aktif; upload Drive dilakukan otomatis dalam batch saat internet tersedia. Timer/upload background ketika PWA ditutup tidak dijamin browser.
- **Status terpisah**: PWA menampilkan status penyimpanan lokal, sinkronisasi backend, dan backup Drive secara terpisah, termasuk waktu sukses terakhir dan antrean yang belum diunggah. Backup Drive bukan syarat transaksi dan bukan backend sinkronisasi.
- **Restore Owner-only**: sumber pemulihan adalah server (utama), Drive (alternatif), atau snapshot lokal. Sebelum restore, buat snapshot pengaman dan validasi checksum, schema, serta lampiran. Rekonsiliasi memakai UUID/idempotency; jangan overwrite seluruh database atau menghapus transaksi lebih baru.
- **Perangkat pengganti**: Device ID aktif baru dibuat; data server ditarik terlebih dahulu bila tersedia; backup Drive dipakai untuk melengkapi event yang belum ada. Device ID asal tetap melekat pada transaksi sebagai metadata.
- **Server down**: device tetap mencatat transaksi lokal. Drive dapat menyelamatkan backup per-device yang sudah berhasil diunggah, tetapi tidak menggantikan sinkronisasi real-time antar-device. Jika satu device hilang sebelum upload eksternal berhasil, transaksi lokal yang belum tersalin berisiko hilang.
- Keputusan ini menetapkan **desain dokumen**, bukan klaim bahwa OAuth Drive, upload otomatis, snapshot terjadwal, dan restore multi-device sudah diimplementasikan atau diuji. Seluruh jalur harus dibuktikan dengan pengujian integrasi dan perangkat nyata sebelum dinyatakan siap produksi.


### 13.11 Pembersihan Artefak Platform Nonaktif
- Flutter/APK telah dinyatakan bukan target aktif. Source tree Flutter `lib/` dan manifest `pubspec.yaml` dihapus dari branch utama agar tidak memberi kesan ada dua aplikasi aktif atau dua toolchain yang harus dipelihara.
- Implementasi aktif tetap React + TypeScript + Vite PWA di `src/`, dengan konfigurasi Node/Bun di `package.json` dan `bun.lock`.
- Arsip ZIP V4.3 dan endpoint unduhan legacy telah dihapus karena berasal dari konsep lama dan bukan deliverable aktif ERP DAGING. Jika suatu saat diperlukan paket distribusi, arsip harus dibuat ulang dari source aktif yang sesuai dengan `PLAN.md`.
- Service arsip Google Drive lama `src/services/googleDriveService.ts` dan `firebase-applet-config.json` telah dihapus. Keduanya hanya mendukung alur arsip dokumen lama, bukan workflow backup JSON/attachment/restore yang ditetapkan pada bagian backup. Penghapusan ini tidak membatalkan keputusan Google Drive sebagai opsi backup eksternal; implementasi backup sesuai desain V4.8 belum diklaim tersedia.
- Dependency `firebase` masih tercantum sementara di manifest/lockfile dan perlu dibersihkan bersama regenerasi `bun.lock`; tidak ada lagi source aktif yang mengimpor Firebase setelah service arsip lama dihapus.
- `supabase/supabase_schema.sql` dan adapter Supabase dipertahankan karena Supabase masih tercatat sebagai opsi backend konfigurabel.
- Cleanup source ini bukan bukti build/test baru.

### 13.12 Penyelarasan Google Sheets Gateway & Status Penyimpanan (2026-11-14)
- Adapter Google Sheets untuk sinkronisasi multi-device hanya menggunakan Google Apps Script Web App gateway. Jalur langsung Sheets API append-only tidak ditawarkan sebagai backend sync karena tidak memenuhi pull, cursor/server sequence, dan idempotency end-to-end.
- Pemeriksaan health dan push harus memeriksa nilai ok true pada body respons, bukan hanya HTTP 200. Shared Secret GAS wajib dikonfigurasi untuk semua action. ACK dan server sequence yang diterima adapter hanya berlaku untuk UUID yang memang dikirim pada batch tersebut.
- Deduplikasi event GAS menggunakan kombinasi Store ID + idempotency key saat membaca maupun menulis event log. Ini mencegah event dari store berbeda bercampur dan retry event yang sama membuat baris ganda.
- Kegagalan penulisan IndexedDB sebagai penyimpanan utama harus ditampilkan meskipun localStorage fallback masih berhasil. localStorage tidak boleh menyamarkan kegagalan penyimpanan utama.
- Jika pembukaan IndexedDB berstatus blocked lalu request terlambat berhasil, koneksi yang datang terlambat harus langsung ditutup agar tidak mengunci migrasi schema berikutnya.
- Perubahan kode ini belum membuktikan deployment GAS aktif, pengujian dua perangkat nyata, atau kelulusan CI/build. Semua itu tetap perlu diverifikasi terpisah.

### 13.13 Implementasi Guard Restore Snapshot (2026-11-14)
- Backup JSON baru menyimpan `originDeviceId` sebagai metadata envelope dan memasukkannya ke checksum; `deviceId` aktif tetap tidak dipindahkan ke state perangkat lain.
- Restore snapshot penuh dari file hanya diizinkan pada perangkat asal yang sama, dengan timestamp backup tidak lebih lama, `lastServerSeq` tidak tertinggal, serta seluruh transaksi, ledger, jurnal, audit, Outbox, retur, pembayaran piutang, dan idempotency key aktif tetap tercakup.
- Backup lintas perangkat dan backup lama tanpa metadata asal ditolak. Ini pembatasan keselamatan sementara; pemulihan perangkat pengganti harus memakai backend pull terlebih dahulu dan impor event yang hilang, bukan mengganti snapshot penuh.
- Restore state dan lampiran dilakukan dalam satu transaksi IndexedDB. Sebelum perubahan, state dan seluruh lampiran aktif disalin ke object store `restore_safety_snapshots`; jika snapshot pengaman atau penulisan restore gagal, transaksi IndexedDB dibatalkan seluruhnya. State IndexedDB dibandingkan lagi dengan state yang sudah diperiksa Owner tepat saat transaksi restore dimulai; jika ada perubahan yang datang belakangan, restore dibatalkan. Jika record state belum ada di IndexedDB, state aktif yang diperiksa Owner tetap disimpan sebagai snapshot pengaman. Lampiran backup diimpor secara additive berdasarkan media ID, tanpa menghapus atau menimpa lampiran yang sudah ada.
- IndexedDB dinaikkan ke versi 4 untuk menambahkan object store snapshot pengaman. Ini tidak mengubah `ENGINE_SCHEMA_VERSION` atau struktur payload bisnis.
- Pengujian unit mencakup guard backup lama/lintas perangkat dan rencana migrasi IndexedDB v4. Pengujian transaksi IndexedDB nyata dan pengujian perangkat/browser masih harus dilakukan sebelum klaim siap produksi.
- UI Backup menampilkan metadata snapshot pengaman terbaru dan menyediakan aksi pemulihan dengan PIN Owner. Payload snapshot dibaca dari IndexedDB; pemulihan memeriksa ulang state aktif di dalam transaksi, menyimpan state/lampiran aktif sebagai snapshot baru, lalu mengembalikan state dan lampiran snapshot secara atomik.
- Pemulihan snapshot mempertahankan `deviceId`, `ownerPinHash`, `ownerPinSalt`, dan `ownerPinNeedsChange` milik perangkat saat ini. Sebelum pemulihan, snapshot diperiksa dengan guard yang sama seperti backup file: `lastServerSeq` tidak boleh mundur dan seluruh transaksi/ledger/jurnal/audit/Outbox/retur/pembayaran/idempotency aktif harus tetap tercakup. Pemulihan yang gagal atau mendeteksi perubahan state setelah layar konfirmasi dibuka dibatalkan tanpa mengganti data aktif.
- UI pemulihan snapshot dan jalur transaksi IndexedDB ini sudah ditambahkan ke source. Test browser Chromium native mencakup restore state + lampiran, impor lampiran additive, penolakan state stale, rollback saat DataCloneError, pemulihan snapshot, dan persistensi setelah reload halaman.\n- Test DataCloneError membuktikan jalur abort transaksi, tetapi bukan simulasi kuota storage penuh. Kuota penuh fisik, uji lintas browser/perangkat, dan recovery setelah browser ditutup total tetap memerlukan pengujian terpisah.

### 13.15 Penguatan Batas ACK Adapter Sinkronisasi (2026-11-15)
- ACK dari REST API dan Supabase hanya sah jika UUID-nya termasuk batch Outbox yang benar-benar dikirim pada request tersebut. UUID asing, duplikat, dan server sequence untuk UUID yang tidak di-ACK diabaikan.
- Ini mencegah respons server yang malformed atau salah konfigurasi menandai event Outbox lain sebagai `SYNCED` hanya karena UUID tersebut kebetulan ada di antrean perangkat.
- Test adapter REST dan Supabase mencakup ACK asing, ACK duplikat, dan sequence asing. Test GAS yang sudah ada tetap menjadi pembanding perilaku adapter.
- Perubahan ini memperketat validasi sisi klien; belum menggantikan kewajiban server untuk melakukan idempotensi dan ACK atomik. Deployment backend dan uji dua perangkat tetap harus diverifikasi terpisah.

### 13.14 Arah Desain Harga Pelanggan & Insentif Sales (2026-11-15)

Status: **ARAH DESAIN DISEPAKATI UNTUK DILANJUTKAN; DETAIL PRIORITAS HARGA DAN PARAMETER KOMISI BELUM FINAL.** Bagian ini mencatat arah desain hasil pembahasan bisnis. Ini bukan klaim bahwa fitur sudah diimplementasikan. Ketentuan yang belum diputuskan harus tetap ditandai terbuka dan tidak boleh ditebak saat coding.

#### A. Prinsip Harga
- **Satu Pricing Engine** menjadi satu-satunya sumber harga transaksi. Jangan membuat mesin harga terpisah untuk B2B, clearance, atau pelanggan kontrak.
- Sumber aturan harga yang didukung secara konseptual:
  1. **Tier Price**: harga dasar berdasarkan kategori pelanggan (mis. HOME_USE, WARUNG, CAFE_RESTO, RESELLER_GROSIR, serta tier tambahan yang diizinkan Owner).
  2. **Volume Price**: harga berdasarkan kuantitas/berat pembelian dan ambang volume yang ditetapkan Owner.
  3. **Customer Deal**: harga khusus untuk pelanggan tertentu, dapat berlaku dengan atau tanpa kontrak formal.
  4. **Contract Price**: kesepakatan pelanggan yang memiliki periode dan syarat kontrak, termasuk produk, harga, minimum volume, pembayaran, atau pengiriman bila disepakati.
  5. **Lot Clearance Offer**: harga penawaran khusus untuk produk/lot tertentu, dibatasi kuantitas, masa berlaku, dan status kelayakan lot.
- Tidak semua pelanggan wajib memiliki kontrak atau harga khusus. Pelanggan tanpa kesepakatan khusus tetap menggunakan aturan tier dan volume.
- Harga khusus harus memiliki cakupan yang eksplisit (pelanggan, produk/SKU, kuantitas bila relevan, tanggal mulai/akhir, dan status aktif). Harga kontrak juga menyimpan referensi/versi kesepakatan dan syarat yang relevan.
- Harga clearance terikat pada lot yang ditentukan; tidak mengubah harga dasar produk, tier pelanggan, atau kontrak pelanggan secara global. Lot yang kedaluwarsa, dikarantina, atau tidak memenuhi syarat keamanan/kelayakan jual tidak boleh ditawarkan atau dijual melalui clearance.
- **Diskon tidak ditumpuk secara otomatis.** Engine harus memilih satu hasil harga final berdasarkan aturan prioritas/eligibility yang eksplisit dan konsisten dengan prinsip BR-011. Urutan final ketika Customer Deal, Contract Price, Volume Price, dan Lot Clearance Offer bertemu masih perlu diputuskan; implementasi tidak boleh mengarang prioritas.
- Harga final, sumber aturan, versi aturan, kuantitas, lot (bila relevan), dan identitas penetap/otorisasi harus disimpan sebagai snapshot pada item transaksi. Perubahan harga master setelah transaksi tidak mengubah transaksi historis.
- Semua perubahan harga dan kesepakatan memiliki audit trail; perubahan berlaku ke depan kecuali koreksi transaksi melalui mekanisme resmi yang tercatat.

#### B. Negosiasi dan Kewenangan
- Sales boleh berkomunikasi dan bernegosiasi dengan pelanggan, menyampaikan pilihan tier/volume yang tersedia, serta mengajukan permintaan harga khusus kepada Owner.
- **Sales tidak memiliki kewenangan membuat, mengubah, atau menimpa harga** pada master harga, kesepakatan pelanggan, penawaran clearance, maupun item transaksi. UI dan Business Engine wajib menolak mutasi harga oleh akun Sales, bukan hanya menyembunyikan tombol.
- Owner adalah satu-satunya pihak yang menetapkan dan mengubah harga khusus, kontrak harga, aturan tier/volume, dan penawaran clearance.
- Setelah Owner menetapkan harga, sistem menerapkannya otomatis saat pelanggan/produk/kuantitas/lot memenuhi syarat. Sales tidak perlu menginput ulang harga setiap transaksi.
- Permintaan negosiasi yang belum diputuskan Owner tidak boleh dipakai sebagai harga transaksi. Tidak diperlukan approval berlapis untuk harga yang sudah aktif dan sah.
- Pelanggan merupakan aset data bisnis ERP DAGING, bukan milik pribadi akun Sales. Penanggung jawab pelanggan, Sales yang menghasilkan transaksi, dan petugas operasional/penerima pembayaran harus dicatat sebagai atribut terpisah.

#### C. Clearance dan Pengendalian Margin
- Clearance merupakan alat pengelolaan perputaran stok, bukan izin menjual produk yang sudah tidak layak. Kelayakan dan keamanan produk tetap menjadi syarat mutlak dan mengalahkan target penjualan.
- Owner menetapkan lot, harga, jumlah maksimum, periode penawaran, serta pelanggan/segmen yang boleh menerima penawaran bila dibutuhkan.
- Harga clearance tidak boleh otomatis mengubah harga kontrak atau kesepakatan pelanggan. Perlakuan ketika clearance lebih murah daripada kontrak masih menjadi keputusan terbuka; sistem harus meminta aturan eksplisit sebelum implementasi.
- Harga di bawah HPP, jika diizinkan oleh kebijakan bisnis yang berlaku, harus mengikuti kontrol, alasan, dan audit yang telah ditetapkan; bagian ini tidak menetapkan angka batas margin baru.

#### D. Arah Desain Insentif Sales — Di Luar Scope Aktif Saat Ini
- Komisi Sales internal tetap **di luar scope implementasi aktif v1** sebagaimana keputusan REMOVE FROM ACTIVE SCOPE pada Section 13.4. Bagian ini hanya mencatat arah desain untuk pembahasan/versi berikutnya dan tidak membatalkan keputusan scope tersebut.
- Jangan mencampur komisi Sales internal dengan komisi AFFILIATE pada Section 5. Keduanya berbeda penerima, dasar perhitungan, dan alur pencatatannya.
- Rekomendasi dasar komisi Sales internal adalah **laba kotor aktual dari item/transaksi yang diatribusikan kepada Sales**, dengan HPP bersumber dari lot yang benar-benar terjual. Omzet dan volume lebih tepat dipakai sebagai indikator target/bonus, bukan menggantikan pemeriksaan profitabilitas.
- Komponen insentif yang dapat dievaluasi Owner: (1) komisi laba kotor; (2) bonus pencapaian target omzet dan/atau kilogram; (3) bonus akuisisi pelanggan baru dan retensi pelanggan aktif. Tidak ada tarif, target, atau bonus yang dikunci dalam perubahan ini.
- Retur, pembatalan/void, diskon, koreksi HPP, dan transaksi clearance harus memengaruhi basis komisi secara konsisten dan dapat ditelusuri. Rumus rinci belum final.
- Arah pembayaran yang direkomendasikan: komisi dapat dicatat saat penjualan sah/serah-terima selesai, sedangkan status siap dibayar mengikuti penerimaan pembayaran pelanggan secara proporsional. Kebijakan final untuk piutang macet, tempo, pembayaran parsial, dan retur masih harus diputuskan.
- Pisahkan **customer owner/penanggung jawab pelanggan**, **sales attribution/pemilik transaksi**, **petugas penerima pembayaran**, dan **petugas operasional**. Keterlibatan operasional tidak otomatis memberi hak komisi. Jika transaksi melibatkan lebih dari satu Sales, pembagian kontribusi hanya berlaku bila aturan dan persentasenya ditetapkan secara eksplisit oleh Owner.
- Owner mengendalikan tarif, target, periode, eligibility, pembagian kontribusi, dan pembayaran insentif. Setiap perubahan kebijakan harus memiliki effective date dan tidak boleh mengubah komisi historis secara diam-diam.

#### E. Keputusan Terbuka Sebelum Implementasi
1. Prioritas final antara Contract Price, Customer Deal, Volume Price, dan Lot Clearance Offer; termasuk apakah clearance boleh ditawarkan di bawah harga kontrak kepada pelanggan yang sama.
2. Apakah pembayaran tunai/transfer/tempo memengaruhi harga atau hanya syarat pembayaran/risiko kredit.
3. Masa berlaku dan aturan perpanjangan/perubahan Customer Deal serta kontrak; termasuk perlakuan saat HPP atau harga beli berubah.
4. Definisi margin minimum, kewenangan/jejak audit untuk harga di bawah HPP, dan batas pengecualian.
5. Rumus komisi final, tarif, target, bonus, periode, pembagian multi-Sales, perlakuan piutang macet, pembayaran parsial, retur, dan clearance.
6. Apakah dan kapan komisi Sales internal masuk ke scope implementasi setelah keputusan scope v1 ditinjau ulang.
- Sebelum keputusan terbuka tersebut ditutup, implementasi hanya boleh membangun fondasi data/audit yang sudah jelas dan tidak boleh mengaktifkan asumsi prioritas harga atau perhitungan komisi yang belum disetujui.

### 13.15 Penyelesaian Arah Harga, Komisi & Bonus Owner (2026-11-15)

Status: **ARAH DESAIN DISEPAKATI; KOMISI INTERNAL TETAP DI LUAR SCOPE AKTIF v1.** Bagian ini merupakan addendum terbaru atas Section 13.14. Jika terdapat perbedaan dengan uraian atau daftar keputusan terbuka pada 13.14, ketentuan 13.15 menjadi arah desain terbaru. Ini bukan klaim implementasi.

#### A. Prioritas Pricing Engine
- Satu Pricing Engine memilih tepat satu sumber harga dasar; harga tidak ditumpuk otomatis.
- Urutan prioritas yang disepakati:
  1. **Owner Price Override**: pengecualian satu kali pada transaksi/item tertentu, hanya oleh Owner, wajib alasan dan audit; tidak mengubah master price atau kesepakatan berulang.
  2. **Lot Clearance Offer**: penawaran khusus lot yang eligible; dapat mengesampingkan Contract Price, Customer Deal, dan Volume Price untuk pelanggan/segmen yang memang termasuk sasaran program.
  3. **Contract Price**.
  4. **Customer Deal**.
  5. **Volume Price**.
  6. **Customer Tier Price**.
  7. **Default Price**.
- Owner Price Override adalah prioritas tertinggi. Jika harga override berada di bawah HPP, Owner harus memberi konfirmasi khusus dan alasan; Sales tidak dapat menyetujui atau membuat override.
- Clearance ditentukan Owner per lot/produk, kuota, periode, dan cakupan penerima: semua pelanggan, tier tertentu, atau pelanggan terpilih. Clearance tidak mengubah harga master atau kesepakatan global.
- Kuota clearance dikonsumsi berdasarkan berat aktual yang benar-benar terjual, bukan berat order. Transaksi batal tidak mengonsumsi kuota. Retur dicatat sebagai koreksi dengan jejak sejarah, bukan menghapus penjualan.
- Harga clearance di bawah HPP menampilkan estimasi kerugian per kg dan total; Owner wajib mengonfirmasi serta memberi alasan. Tidak ada batas margin minimum baru yang ditetapkan di sini.
- Lot kedaluwarsa, karantina, tidak aman, atau tidak memenuhi syarat jual tidak boleh mengikuti clearance. Program berhenti ketika periode berakhir, kuota habis, Owner menonaktifkan, atau lot tidak lagi eligible.
- Perlakuan pengembalian kuota akibat retur harus dicatat sebagai koreksi; aturan pemulihan kuota dan kelayakan lot perlu ditetapkan secara eksplisit sebelum implementasi.

#### B. Volume Pricing, Tempo, dan Penguncian Harga
- Volume Price ditentukan dari **berat aktual dalam satu transaksi**, bukan akumulasi pembelian bulanan. Sistem menghitung ulang tier setelah berat aktual diketahui; berat order hanya estimasi.
- Ambang volume dan harga ditentukan Owner serta dapat diubah untuk transaksi berikutnya. Sales tidak dapat mengubahnya.
- **Cakupan agregasi Volume Price adalah per SKU/produk yang sama dalam satu transaksi.** Berat aktual seluruh baris item dengan SKU yang sama dijumlahkan; berat SKU berbeda tidak digabung, meskipun berada dalam kategori yang sama atau satu transaksi. Contoh: 80 kg SKU A + 70 kg SKU B + 60 kg SKU C tidak memenuhi ambang 100 kg untuk SKU mana pun. Jika pelanggan membeli beberapa SKU dan Owner ingin memberi harga paket/gabungan, gunakan Customer Deal atau Contract Price, bukan mengubah basis Volume Price.
- Payment Term Pricing menjadi komponen penyesuaian terpisah dari pemilihan sumber harga dasar. Owner dapat mengatur persentase tambahan secara fleksibel untuk jangka waktu TEMPO, termasuk mengubah persentase dan ketentuan sesuai kebutuhan bisnis; contoh angka 7/14/30 hari yang pernah dibahas hanya ilustrasi, bukan tarif baku.
- CASH dan TRANSFER langsung diperlakukan sebagai pembayaran segera dengan tambahan tempo 0%, kecuali kebijakan Owner yang eksplisit menyatakan lain. Persentase tempo diterapkan pada harga dasar terpilih hanya jika sumber harga tersebut belum dinyatakan sudah termasuk biaya/penyesuaian tempo. Hindari pengenaan ganda pada Contract Price, Customer Deal, atau Owner Override yang sudah ditandai termasuk tempo.
- Sales Order adalah estimasi. Setelah barang ditimbang, sistem menghitung ulang harga dari berat aktual dan aturan yang berlaku. Saat transaksi diselesaikan, harga final, berat, total, sumber dan versi aturan harga, lot, ketentuan tempo, serta identitas aktor/otorisasi disimpan sebagai snapshot immutable. Perubahan aturan berlaku untuk transaksi baru, bukan mengubah transaksi selesai.
- Detail penerapan tempo pada pembayaran parsial/perubahan metode bayar setelah transaksi dan urutan perhitungan tempo terhadap clearance masih perlu ditetapkan sebelum implementasi.

#### C. Komisi Internal Sales — Arah Desain
- Komisi internal Sales tetap di luar scope implementasi aktif v1 dan berbeda dari komisi AFFILIATE.
- Dasar komisi yang disepakati adalah **total laba kotor per transaksi**, bukan menghitung komisi tiap item secara terpisah. Laba/rugi seluruh item dalam satu transaksi digabung terlebih dahulu; item rugi mengurangi laba item lain. Komisi = laba kotor total transaksi yang positif × tarif komisi Owner. Jika laba kotor total nol atau negatif, komisi transaksi tersebut nol; kerugian tidak dibawa untuk mengurangi transaksi lain.
- HPP menggunakan HPP aktual lot yang benar-benar terjual sesuai kebijakan HPP. Komponen biaya yang termasuk dalam HPP mengikuti definisi HPP resmi ERP DAGING.
- Tarif komisi, periode, eligibility, dan parameter lain ditentukan Owner; belum ada tarif angka yang dikunci.
- Satu transaksi memiliki satu Sales utama sebagai pemilik atribusi komisi. Default pembagian 100% untuk Sales tersebut. Jika beberapa Sales berkolaborasi, Owner dapat menetapkan split persentase sebelum transaksi selesai; total split harus tervalidasi 100%. Identitas Sales dan split disimpan sebagai snapshot.
- Sales attribution berbeda dari customer owner/penanggung jawab pelanggan, petugas operasional, dan penerima pembayaran. Aktivitas timbang, kemas, serah barang, atau menerima uang tidak otomatis memberikan hak komisi.
- Komisi berstatus **EARNED** setelah penjualan valid dan barang diserahkan; menjadi **PAYABLE** secara proporsional dengan pembayaran pelanggan yang benar-benar diterima; menjadi **PAID** setelah Owner membayar dan mencatat pembayaran.
- Pembayaran komisi tidak otomatis ditransfer. Owner mengatur jadwal dan batch pembayaran, misalnya mingguan atau bulanan, dan sistem mengakumulasi saldo PAYABLE.
- Piutang macet atau pelanggan gagal melunasi tidak otomatis menjadi utang pribadi Sales. Komisi yang belum menjadi PAYABLE karena uang belum diterima tetap tertahan; tidak ada penalti atau chargeback otomatis kepada Sales atas risiko kredit bisnis.
- Pembatalan sebelum penyerahan barang tidak menghasilkan komisi. Retur sebagian menghitung ulang laba kotor transaksi setelah retur; retur penuh membuat hak komisi transaksi menjadi nol. Koreksi harus menyimpan referensi transaksi, nilai sebelum/sesudah, alasan, waktu, dan aktor.
- Jika koreksi mengurangi komisi yang belum dibayar, saldo PAYABLE dikoreksi. Jika komisi sudah dibayar, selisih menjadi saldo koreksi/pengurang komisi berikutnya; tidak otomatis meminta pengembalian tunai atau memotong gaji Sales. Jika tidak ada komisi berikutnya, saldo koreksi dibawa sebagai saldo terbuka untuk ditinjau Owner. Penanganan kasus kesalahan atau kecurangan yang terbukti dilakukan terpisah melalui pemeriksaan dan audit, bukan asumsi otomatis.
- Perlakuan rinci atas retur setelah komisi dibayar, koreksi HPP pasca-transaksi, dan penyelesaian saldo koreksi jika Sales berhenti bekerja perlu aturan operasional lebih lanjut sebelum implementasi.

#### D. Bonus dan Target atas Kebijakan Owner
- Target penjualan bukan kewajiban sistem dan tidak harus selalu aktif. Owner bebas menetapkan target atau memilih tidak menggunakan target.
- Bonus merupakan kebijakan/apresiasi diskresioner Owner, terpisah dari komisi reguler. Owner dapat menentukan penerima, nominal atau persentase, kriteria, periode, bonus individu/tim, waktu pemberian, dan apakah program berlaku atau tidak.
- Contoh indikator yang dapat dipilih Owner: omzet, laba, volume kg, pelanggan baru, retensi, atau pencapaian khusus. Daftar ini opsi, bukan target wajib atau rumus yang dikunci.
- Bonus yang diberikan Owner dicatat sebagai item insentif terpisah dengan nominal, alasan/kriteria, periode, penerima, pemberi, tanggal, dan status pembayaran. Dashboard Owner dan Sales menampilkan bonus yang relevan secara transparan.
- Perubahan kebijakan berlaku ke depan dan tidak boleh menghapus atau mengubah komisi/bonus yang sudah disahkan secara diam-diam. Pencatatan bonus tidak boleh disamakan dengan komisi reguler.

#### E. Batas Implementasi dan Hal yang Masih Terbuka
- Semua ketentuan komisi internal dan bonus di atas adalah spesifikasi arah desain untuk versi berikutnya; tidak mengubah keputusan bahwa komisi internal Sales berada di luar scope aktif v1.
- Hal yang masih perlu diputuskan sebelum implementasi: aturan tempo untuk pembayaran parsial/perubahan metode bayar dan urutan tempo terhadap clearance; pemulihan kuota clearance setelah retur; serta rincian administrasi saldo koreksi komisi pada kasus khusus.
- Tarif komisi, persentase tempo, target, dan nominal bonus tetap fleksibel di bawah kewenangan Owner; contoh angka dalam diskusi tidak menjadi nilai default yang dikunci.



### 13.16 Pengalaman Pengaturan Harga Owner (2026-11-15)

Status: **ARAH UI/UX DISEPAKATI; BUKAN KLAIM IMPLEMENTASI.** Bagian ini mencatat cara Owner mengelola aturan harga melalui aplikasi. Prioritas Pricing Engine pada Section 13.15 tetap menjadi sumber aturan bisnis dan tidak diubah oleh addendum ini.

#### A. Pusat Pengaturan Harga
- Sediakan satu pintu menu Owner bernama **Atur Harga** sebagai tempat mengelola seluruh aturan harga.
- Pengelompokan tampilan menggunakan istilah sederhana: **Harga Produk**, **Harga Grosir**, **Harga Khusus**, **Harga Kontrak**, **Harga Tempo**, dan **Harga Cuci Stok**. Istilah teknis seperti Customer Tier, Volume Pricing, Customer Deal, Contract Price, Payment Term Pricing, dan Lot Clearance boleh dipakai di kode/dokumentasi, tetapi bukan istilah utama yang harus dipahami pengguna.
- **Harga Produk** dan harga berdasarkan **Kelompok Pelanggan** dikelola melalui tabel yang mendukung pencarian, filter kategori, dan perubahan banyak SKU sekaligus. Pada desktop, tabel dapat menggunakan pola spreadsheet. Pada HP, informasi dan input harus tetap nyaman tanpa memaksa pengguna melakukan scroll horizontal; gunakan daftar/baris responsif atau halaman edit yang sesuai.
- Harga Grosir dikelola berdasarkan SKU dan ambang berat aktual sesuai aturan Volume Price per SKU pada Section 13.15. UI tidak boleh menggabungkan ambang beberapa SKU.
- Harga Khusus dan Harga Kontrak menyediakan input yang sesuai dengan cakupan pelanggan, produk, periode, dan syarat yang berlaku. Keduanya tetap mengikuti satu Pricing Engine.
- Harga Tempo menyediakan pengaturan tenor dan persentase sesuai kewenangan Owner. Contoh tenor atau persentase tidak menjadi nilai default yang dikunci.
- Harga Cuci Stok membantu Owner memilih lot, menentukan penawaran, kuota, periode, dan cakupan penerima sesuai aturan clearance pada Section 13.15. Lot yang tidak eligible tidak boleh ditawarkan.

#### B. Alur Perubahan Harga
- Perubahan harga massal atau satuan disimpan sebagai **Belum Aktif** terlebih dahulu dan tidak langsung mengubah aturan harga yang sedang berlaku.
- Owner membuka **Periksa Perubahan** untuk melihat ringkasan sebelum/sesudah, produk atau aturan yang terdampak, waktu mulai berlaku, serta peringatan validasi atau potensi konflik.
- Owner dapat memilih **Aktifkan Harga** setelah memeriksa perubahan. Hanya Owner yang berwenang mengaktifkan perubahan harga.
- Perubahan yang belum aktif tidak boleh dipakai Pricing Engine untuk transaksi baru. Setelah diaktifkan, aturan baru berlaku sesuai waktu mulai berlaku yang ditetapkan.
- Perubahan aturan hanya berlaku ke depan. Transaksi yang sudah selesai tetap memakai snapshot harga dan aturan saat transaksi diselesaikan.
- UI dapat menyediakan pengisian massal, salin pola harga, pencarian/filter, dan ringkasan perubahan untuk mengurangi input berulang. Fitur bantu tersebut tidak boleh melewati validasi Business Engine atau mengubah kewenangan.
- Setiap perubahan dan aktivasi harus dapat ditelusuri melalui **Riwayat Perubahan**, termasuk pelaku dan waktu perubahan.

#### C. Batas Logika dan Implementasi
- UI hanya menjadi sarana input, pemeriksaan, dan penyajian. Business Engine tetap menjadi satu-satunya sumber validasi dan hasil perhitungan harga.
- Draft/Belum Aktif harus terpisah dari aturan aktif agar tidak ikut terbaca oleh transaksi. Aktivasi harus menerapkan satu kumpulan perubahan yang sudah diperiksa secara konsisten; detail skema dan mekanisme penyimpanannya ditetapkan saat desain teknis tanpa mengubah aturan bisnis.
- Validasi harus mencakup format/nilai input, cakupan aturan, tanggal berlaku, kelayakan lot, kewenangan Owner, dan konflik prioritas yang relevan. UI tidak boleh diam-diam memilih atau menumpuk sumber harga yang bertentangan.
- Peringatan harga di bawah HPP, potensi kerugian clearance, dan konflik aturan harus ditampilkan dengan bahasa yang mudah dimengerti. Peringatan tidak boleh mengganti kontrol/konfirmasi bisnis yang telah ditetapkan pada Section 13.15.
- Istilah teknis boleh tersedia pada detail bantuan atau dokumentasi internal, tetapi label, tombol, status, dan instruksi utama harus memakai bahasa Indonesia sederhana.

#### D. Batas Scope
- Addendum ini mengunci arah pengalaman Owner untuk pengaturan harga, bukan bukti bahwa layar, draft pricing, aktivasi terjadwal, atau seluruh validasi sudah diimplementasikan dan diuji.
- Tidak ada perubahan pada prioritas Pricing Engine, kewenangan Owner/Sales, rumus harga, aturan HPP, atau snapshot transaksi yang telah disepakati pada Section 13.15.
- Detail seperti pembatalan draft, konflik saat dua perubahan harga dibuat bersamaan, serta penjadwalan aktivasi yang lebih kompleks harus ditetapkan sebelum implementasi terkait; jangan mengarang perilakunya saat coding.


### 13.17 Visibilitas Konflik Sinkronisasi (2026-11-15)

Status: **VISIBILITAS READ-ONLY DIIMPLEMENTASIKAN; REKONSILIASI BELUM DIIMPLEMENTASIKAN.**

- Konflik yang tersimpan pada `remoteSyncConflicts` ditampilkan pada panel status sinkronisasi, termasuk jumlah konflik, ID event, alasan, dan waktu pencatatan. Panel menampilkan maksimal lima konflik terbaru agar tetap ringkas.
- Pesan menjelaskan bahwa transaksi remote telah dicatat tetapi membutuhkan pemeriksaan dan rekonsiliasi Owner. Informasi konflik dapat terlihat di perangkat yang menggunakan status engine yang sama; UI tidak mengasumsikan adanya sistem role aktif karena integrasi role belum terverifikasi pada jalur aplikasi ini.
- Panel bersifat **read-only**. Tidak tersedia tombol hapus, abaikan, tandai selesai, atau proses ulang.
- **Alasan batas ini:** reducer menambahkan idempotency key ke `processedIdempotencyKeys` setelah event ditangani, termasuk ketika konflik dicatat. Dengan demikian event tidak otomatis diputar ulang pada pull berikutnya. Memproses ulang tanpa mekanisme rekonsiliasi khusus berisiko menggandakan transaksi, jurnal, pembayaran, atau pergerakan stok.
- Penyelesaian konflik tetap memerlukan rancangan rekonsiliasi yang spesifik per jenis konflik, jejak audit, validasi dampak ke stok/piutang/utang, dan pengujian idempotensi. Sampai itu tersedia, Owner menggunakan daftar ini sebagai pemberitahuan untuk pemeriksaan manual; jangan mengubah status konflik secara manual dari UI.


### 13.18 Pengamanan Integritas Reducer Konflik Remote (2026-11-15)

Status: **PERBAIKAN VALIDASI DAN UJI REGRESI DITERAPKAN; REKONSILIASI MANUAL BELUM TERSEDIA.**

Audit reducer `applyPulledSyncRecords` menemukan tiga kondisi yang dapat membuat dampak stok parsial atau identitas lot bertabrakan:

- **Barang pengganti retur:** sebelumnya reducer dapat mengurangi stok dari sebagian lot walaupun alokasi lot lain gagal. Sekarang seluruh kebutuhan lot dihitung dan divalidasi terlebih dahulu. Jika satu alokasi tidak valid/tidak cukup, tidak ada stok barang pengganti yang dikurangi; retur tetap dicatat ke karantina dan konflik tetap ditampilkan.
- **Konversi:** sebelumnya ID/kode lot hasil utama yang sudah ada dapat menyebabkan lot hasil tidak dibuat, sementara stok sumber tetap dikurangi dan ledger tetap ditulis. Sekarang benturan identitas lot hasil utama atau master/lot tujuan tetelan yang tidak cocok menghasilkan konflik tanpa menerapkan konversi.
- **Penerimaan pembelian:** sebelumnya lot remote dapat ditambahkan dengan ID/kode yang sudah dipakai. Sekarang benturan ID atau kode lot dicatat sebagai konflik dan lot tidak ditambahkan.

Pengujian regresi memverifikasi stok sumber/tujuan tidak berubah pada tiga kondisi tersebut. Ini tidak menyelesaikan semua konflik sinkronisasi: konflik stok SALE tetap mempertahankan faktur dan mencatat defisit sesuai prinsip transaksi tidak dihapus; konflik tersebut memerlukan prosedur rekonsiliasi khusus. Konflik yang sudah diproses tidak boleh diputar ulang otomatis.


### 13.19 Pembalikan Void atas Penjualan Remote yang Mengalami Shortage (2026-11-15)

Status: **PERBAIKAN DAN UJI REGRESI DITERAPKAN.**

- Saat SALE remote diterima, faktur, pembayaran/piutang, dan nilai penjualan tetap dicatat penuh agar transaksi sah tidak hilang.
- Pengurangan fisik lot pada perangkat penerima dibatasi pada stok yang benar-benar tersedia. Jumlah aktual per lot disimpan pada metadata transaksi `remoteStockAppliedAllocations`; alokasi faktur asli tetap dipertahankan.
- Jika faktur tersebut kemudian di-VOID dari perangkat lain, pemulihan lot dan ledger stok menggunakan jumlah aktual yang sebelumnya dikurangi, bukan seluruh kuantitas faktur. Pembalikan jurnal keuangan tetap membalik nilai transaksi penuh.
- Transaksi remote lama yang belum memiliki metadata tersebut memakai fallback alokasi faktur asli. Karena itu, perangkat yang membawa transaksi lama dengan shortage sebelum patch ini tetap memerlukan pemeriksaan/rekonsiliasi manual; jangan menganggap riwayat lama otomatis terkoreksi.
- Tes regresi memverifikasi SALE 2.500 gram pada perangkat yang hanya memiliki 1.000 gram, lalu VOID, menghasilkan stok akhir kembali 1.000 gram dan tidak membuat stok fiktif.


### 13.20 Retensi Idempotensi dan Konflik Event Remote (2026-11-15)

Status: **PENGAMANAN RETENSI DAN VALIDASI EVENT DITERAPKAN; PEMULIHAN KONFLIK BELUM DIIMPLEMENTASIKAN.**

- Riwayat event remote yang ditampilkan/diarsipkan pada remoteSyncEvents tetap dibatasi maksimal 2.000 entri sebagai batas histori ringkas.
- Kunci processedIdempotencyKeys tidak lagi dipotong menjadi 2.000 entri. Kunci lama harus tetap disimpan agar event lama yang terkirim ulang tidak dapat diterapkan dua kali hanya karena kuncinya terbuang dari perangkat.
- Daftar remoteSyncConflicts tidak lagi dipotong menjadi 500 entri. Konflik yang belum memiliki mekanisme penyelesaian tidak boleh hilang karena batas retensi tampilan.
- Event tanpa idempotencyKey sekarang tidak diterapkan ke data bisnis. Event dicatat sebagai konflik dengan identitas stabil berbasis UUID/queue ID, server sequence, atau fingerprint fallback; identitas konflik juga dicatat agar pengiriman ulang event malformed yang sama tidak menambah duplikat konflik.
- Server sequence valid tetap dimajukan setelah event malformed dicatat, sehingga satu event backend yang rusak tidak membuat seluruh antrean pull berhenti. Event tersebut harus diperbaiki melalui pemeriksaan backend/manual, bukan diterapkan otomatis.
- Tes regresi mencakup retensi lebih dari 2.000 kunci, retensi lebih dari 500 konflik, dan event tanpa idempotency key yang dikirim ulang.
- Catatan kapasitas: daftar kunci dan konflik kini bertambah mengikuti umur penggunaan. Ini disengaja demi integritas dan visibilitas; bila kelak diperlukan pengarsipan, desainnya harus memindahkan data ke arsip persisten dengan verifikasi, bukan menghapus entri unresolved atau kunci idempotensi secara diam-diam.


### 13.21 Pengamanan Void Remote atas Faktur yang Sudah Menerima Cicilan (2026-11-15)

Status: **PENCEGAHAN VOID OTOMATIS DITERAPKAN; REKONSILIASI/REFUND BELUM DIIMPLEMENTASIKAN.**

- Reducer tidak menerapkan VOID remote jika perangkat penerima sudah memiliki pembayaran piutang aktif untuk faktur tersebut.
- Kondisi ini dicatat sebagai konflik dan transaksi lokal tetap aktif sampai Owner melakukan pemeriksaan. Kas/bank, saldo piutang, dan jurnal pembayaran tidak boleh diubah otomatis oleh VOID yang belum memiliki pasangan refund/reversal pembayaran.
- Pembatasan ini mencegah skenario event berurutan SALE TEMPO → pembayaran cicilan → VOID yang sebelumnya dapat membalik penjualan tetapi meninggalkan penerimaan kas/bank dan jurnal cicilan tanpa penyelesaian.
- Tes regresi memastikan pembayaran Rp50.000 tetap tercatat, sisa piutang tetap Rp150.000, dan VOID remote ditahan sebagai konflik.
- Ini belum menyelesaikan kebijakan void/refund pada perangkat asal. Alur bisnis untuk membatalkan faktur yang sudah menerima cicilan harus ditetapkan terpisah sebelum otomatisasi refund/reversal diimplementasikan.


#### Koreksi cakupan retensi idempotensi

- Retensi tanpa pemotongan berlaku untuk seluruh jalur mutasi Business Engine lokal maupun reducer remote, bukan hanya pull sync. Seluruh operasi yang menambahkan processed idempotency key mempertahankan riwayat kunci sebelumnya.
- Uji tambahan memastikan transaksi lokal baru tidak menghapus kunci lama ketika jumlah kunci sudah mencapai 2.000.


### 13.22 Perlindungan Konflik Sinkronisasi pada Restore (2026-11-15)

Status: **PENCEGAHAN HILANGNYA KONFLIK SAAT RESTORE DITERAPKAN; UJI CI MENUNGGU.**

- Pemeriksaan keamanan restore wajib memastikan seluruh konflik sinkronisasi yang sudah tercatat pada perangkat aktif tetap tersedia pada snapshot backup yang akan dipulihkan.
- Identitas pembanding konflik menggunakan kombinasi `eventId`, `reason`, dan `createdAt`. Jika satu atau lebih konflik aktif tidak ditemukan pada backup, restore ditolak dan data aktif tetap dipertahankan.
- Aturan ini melengkapi perlindungan append-only untuk transaksi, ledger, jurnal, audit trail, Outbox, retur, pembayaran piutang, dan kunci idempotensi.
- Konflik belum memiliki alur resolusi terstruktur; karena itu tidak boleh diasumsikan selesai atau dihapus melalui restore snapshot.
- Uji regresi ditambahkan untuk memastikan backup yang kehilangan konflik sinkronisasi ditolak.


### 13.23 Pencegahan VOID Remote saat Dana Refund Tidak Tersedia (2026-11-15)

Status: **GUARD DAN UJI REGRESI DITERAPKAN; CI MENUNGGU.**

- VOID remote atas transaksi CASH/TEMPO yang memiliki penerimaan tunai, atau TRANSFER yang memiliki penerimaan bank, hanya boleh diterapkan otomatis jika saldo kas/bank lokal masih mencukupi nilai dana yang harus dibalik.
- Jika dana sudah tidak tersedia pada saldo terkait, event VOID tetap dicatat sebagai konflik dan transaksi tidak diubah statusnya. Stok, saldo kas/bank, serta jurnal tidak boleh dibalik sebagian.
- Penyelesaian memerlukan rekonsiliasi dan pencatatan refund manual; sistem tidak boleh mengasumsikan dana refund sudah dibayarkan.
- Guard ini melengkapi penahanan VOID atas faktur yang sudah menerima pembayaran piutang. Tidak ada perubahan pada aturan VOID bisnis lokal.
- Tes regresi mensimulasikan dana penerimaan yang sudah digunakan sebelum VOID remote tiba dan memastikan VOID ditahan tanpa mengubah stok atau status transaksi.


### 13.24 Kelengkapan Metadata Ongkir pada SALE Remote (2026-11-15)

Status: **PAYLOAD, REDUCER, DAN UJI REGRESI DITERAPKAN; CI MENUNGGU.**

- Event SALE lokal sekarang mengirim `shippingFee` dan `isFreeShipping` bersama payload transaksi.
- Reducer SALE remote memetakan kedua field tersebut ke transaksi perangkat penerima, bukan mengisi default nol/false secara permanen.
- Nilai total transaksi dan jurnal tetap mengikuti nilai finansial event asal; field ongkir dipertahankan untuk tampilan, laporan, dan audit transaksi.
- Backup/event lama yang tidak memiliki field ini tetap menggunakan fallback aman: ongkir nol dan bukan free shipping.
- Tes regresi memverifikasi metadata ongkir tetap utuh setelah SALE remote diterapkan.

### 13.25 Konsistensi Urutan Event Remote untuk Format server_seq (2026-11-15)

Status: **NORMALISASI PEMBACAAN SEQUENCE DAN UJI REGRESI DITERAPKAN; CI MENUNGGU.**

- Reducer pull mengurutkan event berdasarkan nomor sequence sebelum menerapkan mutasi, agar urutan SALE, PAYMENT, dan VOID tetap mengikuti urutan resmi backend.
- Sebagian adapter/backend mengirim nama field `serverSeq`, sementara backend lain dapat mengirim `server_seq`. Pengurutan sekarang membaca kedua bentuk tersebut secara konsisten, sama seperti pembacaan sequence saat event diproses.
- Tanpa normalisasi ini, event dengan field `server_seq` dapat dianggap memiliki sequence nol saat pengurutan. Akibatnya urutan input backend dapat mendahului urutan kausal yang seharusnya, misalnya PAYMENT/VOID diproses sebelum SALE.
- Tes regresi mengirim tiga event dengan `server_seq` dalam urutan input terbalik dan memastikan konflik tercatat menurut sequence 1, 2, lalu 3.
- Perubahan ini hanya memperbaiki kompatibilitas nama field sequence; tidak mengubah aturan bisnis, format payload, atau prioritas backend.

### 13.26 Konsistensi Saldo Kas/Bank pada Penjualan dan VOID Lokal (2026-11-15)

Status: **PERBAIKAN ENGINE DAN UJI REGRESI DITERAPKAN; CI MENUNGGU.**

Audit jalur transaksi lokal menemukan bahwa penjualan TRANSFER mencatat debit rekening bank pada jurnal tetapi tidak menambah `bankBalanceRupiah`. Selain itu, VOID lokal sebelumnya dapat mengurangi saldo kas dengan clamp nol tanpa memastikan dana refund tersedia, tidak mengurangi saldo bank untuk transaksi TRANSFER, dan dapat membatalkan faktur TEMPO yang sudah memiliki pembayaran piutang aktif.

Perbaikan:
- Penjualan TRANSFER lokal sekarang menambah `bankBalanceRupiah` sebesar dana transfer yang diterima, konsisten dengan jurnal penjualan dan reducer SALE remote.
- VOID lokal memeriksa kecukupan saldo kas atau bank sebelum mutasi. Jika dana tidak tersedia, VOID ditolak tanpa mengubah status faktur, stok, saldo, atau jurnal; Owner harus melakukan rekonsiliasi/refund terlebih dahulu.
- VOID TRANSFER mengurangi saldo bank sesuai `paidAmountRupiah` dan jurnal reversal mengkredit nilai penerimaan transfer yang sama, bukan asumsi nilai total faktur.
- VOID CASH/TEMPO membalik nilai penerimaan tunai aktual. Untuk TEMPO, VOID ditahan jika masih ada pembayaran piutang aktif yang belum di-reversal; pembayaran piutang harus dibalik terlebih dahulu agar kas/bank, piutang, dan jurnal tetap konsisten.
- Saldo nominal piutang pada faktur yang di-VOID lokal juga diubah menjadi nol dengan status LUNAS dan penanda tanggal pembatalan, agar nilai nominal tidak tertinggal pada record yang sudah tidak aktif.
- Uji regresi mencakup penerimaan transfer, penolakan VOID saat dana transfer/tunai sudah tidak tersedia, reversal transfer yang seimbang, dan penolakan VOID TEMPO sebelum pembayaran piutang di-reversal.

Perubahan ini menyelaraskan pengamanan VOID lokal dengan pengamanan VOID remote pada Section 13.21 dan 13.23. Tidak mengubah kewenangan Owner/PIN atau aturan bisnis pembatalan transaksi.

### 13.27 Kesenjangan Pembayaran Campuran (2026-11-15)

Status: **TEMUAN AWAL; GAP IMPLEMENTASI DITUTUP PADA SECTION 13.30.**

- Kebutuhan bisnis menyebut pembayaran CASH, TRANSFER, TEMPO, dan pembayaran campuran. Pada saat audit awal, tipe `PaymentMethod`, validasi `commitSaleTransaction`, dan skema pilihan pembayaran POS baru mengenal CASH, TRANSFER, dan TEMPO. Parser Voice Order tetap menghasilkan draft dengan metode yang dikenali saat ini; metode MIX belum diinterpretasikan otomatis dari ucapan.
- Pada saat temuan awal, TEMPO hanya mendukung DP tunai ditambah sisa piutang. POS belum mendukung satu faktur yang dibayar sebagian tunai dan sebagian transfer, atau kombinasi tunai/transfer dengan sisa tempo.
- Jangan menambahkan satu label `MIX` tanpa rincian nominal per sumber dana. Representasi yang direkomendasikan adalah rincian immutable per transaksi: nominal tunai, nominal transfer, dan nominal piutang; jenis pembayaran tampilan diturunkan dari kombinasi komponen tersebut.
- Kriteria penutupan gap: jumlah seluruh komponen sama dengan grand total; saldo kas dan bank diperbarui terpisah; jurnal, sinkronisasi, dan VOID mempertahankan rincian nominal setiap komponen. Implementasinya dicatat pada Section 13.30.
- Pengamanan refund yang sudah berlaku untuk CASH/TRANSFER/TEMPO harus diperluas ke setiap komponen campuran. VOID tidak boleh berhasil sebagian jika salah satu saldo sumber dana tidak mencukupi.
- Gap awal ini dinyatakan ditutup setelah implementasi dan tes regresi pada Section 13.30 lulus CI.

### 13.28 Saldo Awal dan Pengendalian Saldo Bank (2026-11-15)

Status: **GAP AUDIT AWAL; IMPLEMENTASI PENUTUPAN ADA PADA SECTION 13.29.**

- `bankBalanceRupiah` masih opsional pada `BusinessEngineState` dan state awal tidak menetapkan saldo bank secara eksplisit. Operasi transfer kemudian memakai fallback nol.
- Penjualan TRANSFER lokal/remote dan pembayaran piutang TRANSFER menambah saldo bank; pembayaran supplier lokal/remote mengurangi saldo bank. Namun jalur pembayaran supplier yang diaudit belum menolak nominal di atas saldo bank, dan belum ditemukan jalur pembentukan saldo awal bank yang terverifikasi pada Business Engine.
- Karena saldo awal bank dapat belum tercatat, saldo bank aplikasi berisiko negatif atau tidak merepresentasikan saldo rekening aktual setelah transaksi supplier. Ini bukan alasan untuk menganggap pembayaran supplier tidak sah; ini menunjukkan saldo awal dan kontrol sumber dana belum lengkap.
- Perbaikan penambahan saldo dari penjualan TRANSFER berlaku untuk transaksi baru. Transaksi historis sebelum patch tidak dihitung ulang otomatis; saldo bank historis harus ditetapkan melalui proses saldo awal/rekonsiliasi sebelum angka aplikasi dipakai sebagai saldo aktual. VOID transaksi TRANSFER lama dapat tertahan oleh guard sampai rekonsiliasi dilakukan.
- Penutupan gap harus mencakup: saldo bank numerik dan eksplisit saat inisialisasi/migrasi; input saldo awal bank dalam proses Opening Balance; jurnal pembukaan yang seimbang; validasi pembayaran supplier terhadap saldo yang tersedia setelah saldo awal dimasukkan; serta guard setara pada reducer remote agar event tidak membuat saldo bank negatif diam-diam.
- Sampai alur saldo awal bank tersedia, jangan menambahkan hard-block pembayaran supplier hanya berdasarkan nilai fallback nol. Tandai saldo bank belum direkonsiliasi dan jangan menyebut angka tersebut sebagai saldo rekening aktual.
- Gap ini terpisah dari perbaikan saldo transfer penjualan dan keamanan VOID pada Section 13.26; perbaikan tersebut tidak menyelesaikan saldo awal bank.

### 13.29 Saldo Awal Bank dan Pembayaran Utang Supplier Berbasis Sumber Dana (2026-11-15)

Status: **ENGINE, REDUCER, UI PEMBAYARAN SUPPLIER, FORM SALDO AWAL BANK DENGAN PIN OWNER, DAN TES REGRESI DITERAPKAN; CI PASS #43741277814.**

Temuan audit:
- Saldo bank sebelumnya opsional dan tidak memiliki jalur inisialisasi bisnis yang terverifikasi.
- Pembayaran utang supplier lokal selalu mengurangi bank, walau modal pembayaran di UI menyediakan pilihan Bank BCA atau Kas Utama. Pilihan sumber dana, nomor referensi, dan catatan tidak diteruskan oleh callback modal.
- Pembayaran supplier remote juga selalu mengurangi bank dan dapat membuat saldo bank negatif tanpa konflik.

Perbaikan:
- `setOpeningBankBalance()` mencatat saldo awal bank satu kali, wajib menggunakan PIN Owner aktif, menolak nominal negatif/non-integer, membuat jurnal pembukaan Bank vs Modal Awal, audit trail, serta event OPNAME `OPENING_BANK_BALANCE`. Saldo awal nol tetap dianggap sudah dikonfigurasi.
- Pembayaran supplier lokal sekarang menerima sumber dana CASH atau TRANSFER. Pembayaran transfer ditolak jika saldo awal bank belum dicatat atau saldo bank kurang; pembayaran kas ditolak jika kas utama kurang. Penolakan tidak mengubah utang, saldo, jurnal, maupun Outbox.
- Engine lokal dan reducer remote juga menolak nominal pembayaran supplier yang bukan integer Rupiah aman, nol/negatif, atau melebihi sisa utang. Tidak ada pembulatan/clamp diam-diam pada batas engine.
- Jurnal pembayaran memakai akun sumber dana yang dipilih. Outbox membawa `paymentMethod`, `paymentReference`, dan `notes`.
- Modal pembayaran supplier meneruskan pilihan Bank BCA/Kas Utama, nomor referensi, dan catatan melalui callback. App meneruskan nilai tersebut ke `recordSupplierPayablePayment()` dengan memetakan BANK_BCA → TRANSFER dan KAS_UTAMA → CASH. Input nominal modal memakai validasi integer aman dan tidak memotong pecahan dengan `parseInt`; modal tetap terbuka jika Business Engine menolak pembayaran.
- Reducer remote menerapkan event saldo awal bank hanya jika belum dikonfigurasi. Pembayaran supplier remote memeriksa saldo sumber dana; jika tidak cukup/tidak tersedia, event ditahan sebagai konflik tanpa mengurangi utang atau membuat saldo negatif. Event lama tanpa `paymentMethod` tetap diperlakukan sebagai TRANSFER untuk kompatibilitas.
- Tes regresi mencakup saldo awal sekali saja, saldo bank belum dikonfigurasi, saldo tidak cukup, pembayaran dari kas, jurnal sumber dana, dan urutan event saldo awal → pembayaran supplier.

Catatan operasional:
- `bankBalanceInitialized !== true` berarti saldo bank belum direkonsiliasi/dikonfigurasi, meskipun `bankBalanceRupiah` sudah berisi pergerakan sementara dari transaksi. Nilai `bankBalanceInitialized === true` menandakan saldo awal telah dicocokkan dengan rekening koran; saldo `0` sah dan berarti saldo awal memang nol. State lama tanpa flag dinormalisasi sebagai belum direkonsiliasi.
- Saldo awal harus diambil dari rekening koran aktual pada tanggal cut-over. Jangan memakai angka contoh/demo sebagai saldo aktual.
- Saldo awal bank adalah langkah persiapan go-live. UI setup kini tersedia di Purchasing → AP Debt, meminta nominal, referensi rekening koran/tanggal cut-over, dan PIN Owner aktif. UI memanggil `setOpeningBankBalance()` dan menampilkan saldo sebagai belum direkonsiliasi sampai flag `bankBalanceInitialized` bernilai `true`.

### 13.30 Implementasi Pembayaran Campuran pada POS dan Sinkronisasi (2026-11-15)

Status: **ENGINE, POS, JOURNAL, VOID, REMOTE REDUCER, RECEIPT, DAN TES REGRESI DITERAPKAN; CI PASS #43741277814 (commit 37c6492850).**

Keputusan representasi:
- Metode transaksi baru `MIX` hanya digunakan bila satu faktur memiliki minimal dua komponen pembayaran positif dan wajib memiliki rincian `cashPaidRupiah`, `transferPaidRupiah`, serta `receivableRupiah`.
- Transfer wajib bernilai lebih dari nol untuk metode `MIX`. Kombinasi CASH + TEMPO tanpa transfer tetap menggunakan metode TEMPO yang sudah ada, sehingga perilaku lama tidak berubah.
- Jumlah ketiga komponen harus sama persis dengan grand total. Semua komponen harus Rupiah integer aman, tidak negatif, dan tidak boleh dibulatkan atau di-clamp diam-diam.
- `paidAmountRupiah` menyimpan total penerimaan tunai + transfer; `balanceDueRupiah` menyimpan komponen piutang. `paymentBreakdown` disimpan pada transaksi dan payload SALE.

Perubahan implementasi:
- POS menyediakan pilihan Campuran dengan input nominal Tunai dan Transfer; sisa tagihan menjadi Tempo/Piutang secara otomatis. UI menolak submit jika rincian tidak valid.
- Voice Order tetap membuat draft dan belum mengekstrak nominal campuran secara otomatis. Jika order suara memakai beberapa sumber dana, kasir memilih Campuran dan mengisi nominal Tunai/Transfer di POS sebelum transaksi diposting.
- Business Engine menambah saldo kas dan bank secara terpisah, membentuk jurnal debit Kas, Bank, dan Piutang sesuai nominal aktual, serta membuat piutang hanya sebesar komponen Tempo.
- Peringatan plafon kredit menggunakan komponen piutang aktual, bukan total faktur.
- Receipt dan riwayat transaksi menampilkan label Campuran serta rincian sumber dana.
- VOID lokal membalik saldo kas, bank, dan piutang sesuai `paymentBreakdown`. Jika dana tunai/bank tidak cukup, atau saldo bank belum direkonsiliasi untuk komponen transfer, VOID ditahan tanpa mutasi parsial.
- Reducer SALE remote memvalidasi breakdown sebelum mengurangi stok. Event MIX tanpa rincian valid dicatat sebagai konflik dan tidak mengubah stok/keuangan.
- Reducer VOID remote membalik setiap komponen dari rincian transaksi dan tidak menggunakan clamp saldo.
- Transaksi historis CASH/TRANSFER/TEMPO tanpa `paymentBreakdown` tetap dibaca melalui aturan fallback kompatibel. Record MIX tanpa breakdown tidak dapat di-VOID otomatis dan harus direkonsiliasi manual.

Tes regresi:
- Penjualan MIX CASH + TRANSFER + TEMPO menguji saldo kas, bank, piutang, jurnal, dan payload Outbox.
- VOID lokal menguji penahanan saat dana bank tidak tersedia dan pembalikan penuh saat dana tersedia.
- SALE remote MIX + VOID remote menguji pemeliharaan breakdown dan pembalikan tiga komponen.
- SALE remote MIX tanpa breakdown valid diuji agar dikarantina sebelum perubahan stok.


### 13.31 UI Pencatatan Saldo Awal Bank dan Catatan Cut-over (2026-11-16)

Status: **FORM UI, VERIFIKASI PIN OWNER, ENGINE, REDUCER REMOTE, DAN TES REGRESI SUDAH TERHUBUNG; CI HEAD TERBARU MASIH BERJALAN.**

- Di Purchasing → AP Debt, kartu saldo bank menampilkan "Belum direkonsiliasi" selama `bankBalanceInitialized !== true`, sekalipun transaksi transfer sebelumnya sudah membentuk pergerakan sementara.
- Form saldo awal menerima nominal Rupiah integer non-negatif, referensi rekening koran/tanggal cut-over, dan PIN Owner aktif. PIN diperiksa oleh engine; percobaan gagal menggunakan guard lockout yang sama dengan perlindungan PIN Owner.
- Form dinonaktifkan setelah saldo awal berhasil ditetapkan. Koreksi tidak dilakukan dengan menimpa saldo awal; perlu proses rekonsiliasi tersendiri.
- Callback pembayaran supplier memetakan Bank BCA → TRANSFER dan Kas Utama → CASH, serta meneruskan referensi dan catatan ke engine. Penolakan engine tidak mengubah utang, saldo, jurnal, atau Outbox.
- Commit UI: `d56c24928d4aa25189c2585c4ea40df888ab8557`. CI run #43740238887 masih berjalan saat catatan ini dibuat.

**Temuan audit lanjutan — cut-over setelah transaksi transfer sementara:**
- `setOpeningBankBalance()` saat ini menetapkan `bankBalanceRupiah` langsung ke angka rekening koran dan membuat jurnal pembukaan sebesar angka penuh tersebut.
- Sebelum flag rekonsiliasi aktif, transaksi penjualan/penerimaan piutang transfer masih dapat menambah saldo bank sementara dan membentuk jurnalnya sendiri. Jika transaksi seperti itu sudah terjadi sebelum saldo awal dicatat, penetapan saldo awal dapat menimpa saldo sementara tanpa merekonsiliasi selisih jurnalnya.
- Karena itu, saldo awal harus dicatat sebelum transaksi operasional transfer pertama pada tanggal cut-over, atau engine perlu mekanisme jurnal selisih rekonsiliasi yang eksplisit. Jangan menganggap form baru otomatis menyelesaikan skenario cut-over yang sudah memiliki transaksi transfer.
- Belum ada perubahan kode untuk skenario selisih tersebut. Dibutuhkan keputusan akun penyeimbang dan definisi tanggal cut-over sebelum implementasi, agar tidak mengarang perlakuan akuntansi atau mengubah saldo/jurnal historis secara diam-diam.

### 13.31 Kesiapan Adapter Supabase dan Kontrak Event Sync (2026-11-15)

Status: **GAP AUDIT TERKONFIRMASI; SUPABASE BELUM LAYAK DIPILIH UNTUK GO-LIVE. BELUM DIPERBAIKI.**

Temuan dari kode adapter dan SQL schema:
- `SupabaseBackendAdapter.pushOutbox()` mengirim `target_table: item.entityType.toLowerCase()`. Contoh SALE menjadi `sale`, sedangkan RPC SQL hanya menangani nama tabel `transactions`, `stock_ledger`, dan `conflict_cases`. Tidak ada pemetaan SALE → transactions atau PAYMENT/VOID/OPNAME ke model event yang sesuai.
- Payload Business Engine memakai field camelCase dan event envelope `entityType + payload`; RPC SQL mengharapkan field snake_case untuk insert ke tabel relasional. Bentuk payload tidak dinormalisasi oleh adapter.
- `SupabaseBackendAdapter.pullChanges()` mengambil row tabel `transactions` secara langsung. Reducer lokal `applyPulledSyncRecords()` membutuhkan event envelope berisi `serverSeq`, `uuid`, `idempotencyKey`, `entityType`, dan `payload`. SQL schema yang diaudit hanya menyediakan fungsi `sync_push`, bukan kontrak `sync_pull` yang mengembalikan envelope tersebut.
- Tabel `transactions` pada SQL schema belum memiliki kolom `payment_breakdown`; rincian MIX tidak akan tersimpan lewat model tabel tersebut.
- Default `storeId` adapter adalah `TOKO_KARKASIA_01`, sedangkan fallback tenant di SQL/RLS masih memakai `TOKO_SAMPORA_01`. Policy juga membaca `current_setting('app.current_store_id', true)`, sementara adapter tidak mengirim konteks tersebut secara eksplisit.
- Jalur autentikasi dan isolasi tenant melalui Supabase Auth/RLS belum terbukti terhubung dengan adapter PWA. Anon key adalah public client key, bukan pengganti autentikasi user/otorisasi tenant.

Dampak:
- Health check HTTP dapat berhasil, tetapi itu tidak membuktikan push/pull transaksi berjalan benar.
- Event berpotensi tidak mendapat ACK sequence yang valid, tidak dapat direduksi saat pull, atau gagal melewati policy tenant.
- Jangan menyatakan Supabase adapter siap produksi hanya karena URL dan Anon Key berhasil dites.

Arah perbaikan yang direkomendasikan:
- Gunakan append-only `sync_events` dengan JSONB payload utuh, `server_seq`, `store_id`, `device_id`, `uuid`, `idempotency_key`, `entity_type`, dan `created_at`.
- Push dan pull harus memakai envelope event yang sama dengan REST/GAS agar `applyPulledSyncRecords()` dapat digunakan tanpa translasi semantik.
- Idempotensi wajib unik per store; sequence diberikan server; pull mengembalikan event berurutan dan mengecualikan event perangkat sendiri sesuai kontrak reducer.
- Tenant isolation harus diikat ke identitas Supabase Auth atau Edge Function/server tepercaya. Jangan mengandalkan anon key atau nilai storeId dari client sebagai bukti otorisasi.
- Tambahkan migration SQL, adapter tests untuk SALE/PAYMENT/VOID/MIX, dan integration test pada project Supabase nyata sebelum status adapter diubah menjadi siap.

Batasan saat ini: gap ini hanya memblokir pemakaian adapter SUPABASE. REST_API/ZIMAOS/POSTGRES_BRIDGE dan Google Sheets/GAS tetap memiliki jalur adapter masing-masing; tiap backend tetap wajib diuji pada konfigurasi yang benar-benar dipilih.


### 13.32 Audit Kontrak Sinkronisasi Seluruh Backend Adapter (2026-11-16)

Status: **AUDIT KODE SELESAI UNTUK ADAPTER YANG ADA DI REPOSITORY; GAP KONTRAK DAN KEAMANAN DICATAT. PERBAIKAN ACK DITERAPKAN, MENUNGGU CI. BELUM ADA BACKEND EKSTERNAL YANG DINYATAKAN SIAP GO-LIVE.**

#### Kontrak event yang wajib dipenuhi

- Push mengirim event utuh dengan `uuid`, `idempotencyKey`, `entityType`, `createdAt`, `summary`, dan `payload`; jangan memecah satu event bisnis menjadi tabel-tabel yang mengubah semantik transaksi.
- ACK hanya sah jika backend secara eksplisit mengonfirmasi UUID yang memang dikirim **dan** memberikan `serverSeq` positif berupa safe integer. HTTP 2xx, daftar UUID tanpa sequence, atau sequence tanpa ACK eksplisit tidak cukup untuk mengubah Outbox menjadi `SYNCED`.
- Pull harus mengembalikan envelope event dengan `serverSeq`, `uuid`, `idempotencyKey`, `entityType`, `createdAt`, dan `payload`; cursor harus monotonik dan tidak boleh melompati event yang belum disertakan pada halaman hasil.
- Idempotency key unik dalam lingkup store/tenant. Sequence ditetapkan server dan urutan event harus stabil. Filter perangkat sendiri tidak boleh menghilangkan event perangkat lain.
- Event yang formatnya tidak dikenal tidak boleh diam-diam dianggap berhasil. Reducer lokal mengarantina event yang tidak memiliki idempotency key atau belum memiliki reducer.

#### Hasil audit per adapter

| Adapter | Hasil kode | Batasan / gap |
|---|---|---|
| LOCAL_ONLY | Aman sebagai mode lokal; tidak membuat ACK palsu dan tidak menjalankan pull remote. | Bukan sinkronisasi multi-device. |
| GOOGLE_SHEETS | Adapter dan `gas/Code.gs` memakai envelope event camelCase yang sesuai dengan reducer. GAS memberi sequence, idempotensi per store, append-only log, pull berurutan, dan filter device sendiri. | Shared Secret dikirim dari PWA dan disimpan sebagai konfigurasi client. Nilai yang berada di browser dapat diekstrak; jangan perlakukan sebagai secret server-side atau kredensial berprivilege tinggi untuk produksi. Perlu autentikasi per pengguna/perangkat atau gateway tepercaya sebelum go-live multi-user. Belum ada pengujian integrasi terhadap deployment GAS dan Spreadsheet nyata dalam audit ini. |
| REST_API | Adapter generik mengirim envelope event dan menerima endpoint `/sync/push` serta `/sync/pull`. | Implementasi server sync bukan bagian dari `server.ts` saat ini; server di repo menyediakan endpoint AI, bukan kontrak sync. Kesesuaian backend REST eksternal belum terbukti. Pull menerima array/records tanpa validasi envelope dan hanya membaca cursor jika berupa number. |
| ZIMAOS | Menggunakan implementasi REST_API yang sama. | Belum ada deployment ZimaOS, gateway, atau integration test; statusnya template kompatibilitas HTTP, bukan adapter khusus yang sudah tervalidasi. |
| POSTGRES_BRIDGE | Menggunakan implementasi REST_API yang sama. | Belum ada bridge PostgreSQL yang disertakan atau diuji. Tidak boleh dianggap setara dengan koneksi PostgreSQL langsung. |
| SUPABASE | Adapter aktif hanya jika dipilih operator. | Belum layak produksi: pemetaan `SALE` menjadi `sale` tidak cocok dengan RPC SQL yang hanya mengenali `transactions`, `stock_ledger`, dan `conflict_cases`; payload camelCase tidak dinormalisasi ke kolom snake_case; tabel transaksi tidak memiliki `payment_breakdown`; pull membaca tabel transaksi, bukan event envelope; tidak ada RPC `sync_pull`; SQL tidak menyimpan idempotency key secara benar; jenis event yang tidak didukung masih dapat masuk ke daftar ACK RPC. Tenant fallback `TOKO_SAMPORA_01` bertentangan dengan default PWA `TOKO_KARKASIA_01`, sementara RLS memakai GUC `app.current_store_id` yang tidak disetel oleh adapter dan memiliki fallback tenant statis. Alur Supabase Auth dan isolasi tenant belum terhubung/terbukti. |

#### Perbaikan ACK yang diterapkan pada kode

- Ditambahkan helper `isValidServerSequence()`: hanya menerima sequence positif yang merupakan safe integer.
- REST API, Google Sheets, dan Supabase tidak lagi menerima ACK tanpa sequence server yang valid. REST juga mensyaratkan ACK eksplisit; objek `serverSeqs` saja tidak dianggap konfirmasi.
- Ditambahkan tes regresi untuk ACK tanpa sequence pada ketiga adapter, serta sequence tanpa ACK eksplisit pada REST.
- Tujuannya mencegah Outbox ditandai `SYNCED` padahal tidak memiliki cursor resmi. Sebelumnya `applyOutboxSyncResults()` tetap menandai item SYNCED meskipun serverSeq tidak ada; item tersebut berisiko tidak terkirim ulang dan tidak punya posisi aman dalam pull berikutnya.

#### Keputusan teknis yang dipertahankan

- Tidak mengunci backend ke Supabase, GAS, atau vendor tertentu.
- REST_API, ZIMAOS, dan POSTGRES_BRIDGE tetap memakai kontrak HTTP generik yang sama; masing-masing deployment harus membuktikan kontrak tersebut melalui integration test.
- Supabase hanya dapat dinyatakan siap setelah tersedia append-only `sync_events` dengan JSONB envelope utuh, unique idempotency per store, sequence server, pull berurutan, pemetaan event lengkap termasuk MIX/PAYMENT/VOID/OPNAME, serta tenant isolation berbasis autentikasi server tepercaya.
- Jangan menaruh service-role key, shared secret berprivilege tinggi, atau kredensial database di PWA. Anon key Supabase adalah public client key dan tidak menggantikan autentikasi user maupun otorisasi tenant.

**Batas klaim audit:** audit ini memeriksa kode adapter, reducer, GAS source, SQL schema, dan test yang tersedia di repository. Audit ini belum membuktikan perilaku deployment eksternal nyata, kebijakan akun, konfigurasi RLS aktif, atau reliabilitas jaringan produksi.


### 13.33 Penguatan Idempotensi dan Uji Cursor Multi-device GAS (2026-11-16)

Status: **PERBAIKAN KODE DAN HARNESS TEST DITAMBAHKAN; MENUNGGU CI. KEAMANAN AUTENTIKASI CLIENT MASIH MENJADI BLOCKER GO-LIVE.**

#### Perbaikan yang diterapkan pada `gas/Code.gs`

- Sequence berikutnya sekarang dihitung dari nilai `serverSeq` terbesar yang benar-benar tersimpan, bukan dari jumlah baris. Jika ada baris lama yang terhapus/bolong, sequence baru tidak akan memakai ulang nomor sequence yang pernah diterbitkan.
- Retry dengan `storeId + idempotencyKey` yang sama hanya mendapat ACK ulang jika UUID, device, entity type, timestamp, summary, dan payload event cocok dengan record awal.
- Payload dibandingkan dengan JSON kanonis yang mengurutkan key object, sehingga perbedaan urutan key JSON tidak dianggap sebagai perubahan isi event.
- Pemakaian ulang idempotency key dengan isi berbeda ditolak dan tidak mendapat ACK.
- Pemakaian ulang UUID dengan idempotency key berbeda dalam store yang sama juga ditolak.
- Event baru wajib memiliki `uuid`, `idempotencyKey`, dan `createdAt`; payload non-object/array dinormalisasi menjadi object kosong.
- Idempotency key tetap di-scope per store; key yang sama di store berbeda tidak dianggap bentrok.

#### Harness test GAS yang ditambahkan

File: `gas/Code.test.mjs`, dijalankan bersama `bun run test`.

Skenario:
1. Retry event identik menghasilkan sequence yang sama dan tidak menambah baris.
2. Idempotency key sama dengan payload berbeda ditolak tanpa append.
3. UUID sama dengan idempotency key berbeda ditolak.
4. Idempotency lintas store terpisah dan sequence tetap monoton setelah ada gap baris.
5. Pull 600 event melewati batas halaman 500 tanpa kehilangan event; cursor halaman pertama 500, halaman kedua membawa sisa 100.
6. Pull hanya mengembalikan event untuk store yang diminta dan mengecualikan event dari device peminta; cursor tetap maju agar tidak mengulang event sendiri.
7. Request tanpa secret server ditolak.

Batas pengujian: harness ini menjalankan source GAS dengan mock Spreadsheet/Lock/Properties/ContentService di Node/Bun. Ini menguji logika protokol, bukan perilaku deployment Google Apps Script dan Google Sheets nyata. Uji deployment nyata tetap wajib sebelum go-live.

#### Keputusan keamanan gateway — belum boleh dianggap selesai

- Fakta: adapter PWA saat ini mengirim `apiKeyOrToken` sebagai `sharedSecret` dalam body request. Nilai yang dipakai browser dapat dibaca dari DevTools, bundle, atau penyimpanan lokal; obfuscation tidak mengamankannya.
- Karena itu, shared secret GAS yang sekarang dipakai hanya cocok sebagai proteksi sementara untuk lingkungan uji/terbatas, bukan autentikasi multi-user yang aman.
- Solusi produksi yang direkomendasikan: PWA login melalui identity provider yang dipilih; gateway memvalidasi token user dan membership store/role; gateway menyimpan secret GAS hanya di server; gateway menandatangani request ke GAS menggunakan secret antar-server dan timestamp/nonce; GAS menolak request tanpa signature valid dan mencegah replay.
- Repository saat ini belum memiliki login user atau identity provider yang dapat dipakai untuk memverifikasi identitas Owner/Admin/Sales pada gateway. `API_ACCESS_TOKEN` server yang ada bersifat opsional dan bukan pengganti login user; memindahkan shared secret statis dari GAS ke endpoint server tanpa identitas user tidak menyelesaikan masalah.
- Tidak ada provider autentikasi yang dipilih atau diaktifkan secara diam-diam. Sampai identity provider dan alur membership store diputuskan serta diterapkan, adapter GAS belum boleh dinyatakan aman untuk go-live multi-user. Mode LOCAL_ONLY tetap tersedia; sinkronisasi GAS hanya untuk pengujian terbatas dengan pemahaman risiko.



### 13.34 Keputusan Identitas Pengguna — Google Sign-In (2026-11-16)

Status: **GOOGLE SIGN-IN DISETUJUI SEBAGAI IDENTITY PROVIDER DASAR. IMPLEMENTASI LOGIN, SESSION, MEMBERSHIP, DAN GATEWAY BELUM DITERAPKAN. GO-LIVE MULTI-USER TETAP TERBLOKIR SAMPAI SEMUA KOMPONEN DAN UJI KEAMANAN LULUS.**

#### Keputusan yang dikunci

- Google Sign-In menggunakan Google Identity Services (GIS) untuk PWA berbasis web.
- Google hanya menjadi penyedia identitas. Google Sign-In **tidak otomatis memberi role ERP** dan bukan sumber kebenaran untuk hak akses toko.
- Server wajib memverifikasi Google ID token menggunakan library resmi Google Auth Library untuk Node.js. Validasi minimal mencakup signature, audience/client ID yang diizinkan, issuer, dan expiry.
- Identitas internal pengguna memakai klaim Google `sub` yang stabil dan unik. Email hanya atribut kontak/lookup, bukan primary key atau bukti role.
- Setiap akses ke API sensitif harus melewati autentikasi server dan otorisasi membership: user aktif, Store ID yang diizinkan, serta role Owner/Admin/Sales. Nilai role/store dari PWA tidak boleh dipercaya tanpa pemeriksaan server.
- Session aplikasi diterbitkan dan dikelola server setelah verifikasi identitas. Pilihan cookie/session harus memakai HTTPS, cookie HttpOnly + Secure + SameSite yang sesuai, proteksi CSRF untuk request yang memakai cookie, expiry, logout/revocation, dan rotasi session yang aman.
- Autentikasi dan membership adalah lapisan terpisah dari adapter sinkronisasi. Mengaktifkan Google Sign-In tidak mengunci ERP ke GAS, Supabase, atau vendor backend tertentu.
- Untuk gateway GAS: PWA tidak lagi mengirim `SYNC_SHARED_SECRET`. Server memeriksa session dan membership, lalu mengirim request ke GAS menggunakan secret antar-server yang hanya tersimpan di server. GAS harus memverifikasi signature server, timestamp/nonce, dan menolak replay sebelum menerima push, pull, atau media.
- Tidak ada self-registration yang otomatis memberi akses. Akun Google yang berhasil login tetapi belum memiliki membership aktif harus ditolak dari data toko dan diarahkan ke proses provisioning oleh Owner.
- Offline-first tetap berlaku: login pertama dan pemulihan session memerlukan koneksi. Perangkat yang sebelumnya sudah terdaftar boleh melanjutkan operasi lokal sesuai mekanisme local unlock yang ada ketika offline; operasi server/sync tetap tertunda sampai session dapat divalidasi kembali. Token Google yang kedaluwarsa tidak boleh dianggap valid hanya karena data lokal masih tersedia.

#### Batas dan keputusan yang belum boleh diasumsikan

- Repository sudah memiliki Express server, tetapi belum ada bukti hosting produksi, domain HTTPS, atau pola deployment yang akan dipakai. Implementasi endpoint autentikasi tidak boleh mengasumsikan platform hosting tertentu sebelum konfigurasi runtime/deployment diperiksa.
- Google OAuth 2.0 Web Client ID, authorized JavaScript origins, dan domain aplikasi harus dibuat/dikonfigurasi di Google Cloud Console. Nilainya masuk konfigurasi environment yang sesuai; client ID bukan secret, sedangkan private server secrets tidak boleh masuk ke bundle PWA.
- Sumber penyimpanan membership (misalnya database backend yang dipilih atau registry server-side yang dikelola aman), proses bootstrap Owner pertama, undangan/penambahan Admin dan Sales, serta UI pencabutan akses belum diputuskan. Jangan membuat fallback role dari email, PIN lokal, atau nilai client.
- Sinkronisasi backend saat ini tetap vendor-agnostic. Lapisan autentikasi tidak boleh memaksa pemilihan backend sync yang belum disepakati.

#### Acceptance criteria sebelum dinyatakan siap

1. Token valid diterima hanya untuk audience aplikasi yang dikonfigurasi; token salah signature, issuer, audience, atau expired ditolak.
2. Email saja, user ID yang dikirim client, Store ID client, dan role client tidak pernah cukup untuk memperoleh akses.
3. Pengguna tanpa membership, membership nonaktif, atau role yang tidak sesuai ditolak pada setiap endpoint sensitif.
4. User dari satu store tidak dapat membaca/menulis event atau media store lain dengan mengubah request.
5. Session memakai HTTPS dan kontrol cookie/CSRF yang sesuai; logout, expiry, dan pencabutan akses menghentikan akses server.
6. PWA tidak menyimpan atau mengirim secret GAS berprivilege tinggi. Hanya gateway server yang dapat menandatangani request ke GAS.
7. GAS menolak request tanpa signature valid, timestamp di luar toleransi, nonce yang pernah dipakai, atau signature dengan payload yang diubah.
8. Uji integrasi mencakup Owner/Admin/Sales, user tidak terdaftar, user dinonaktifkan, lintas-store, replay, token kedaluwarsa, serta kondisi offline dan pemulihan koneksi.
9. Uji deployment dilakukan pada domain HTTPS dan minimal dua perangkat nyata sebelum sinkronisasi multi-user dinyatakan siap produksi.

#### Dasar teknis

Google merekomendasikan ID token dikirim ke backend melalui HTTPS dan diverifikasi di server. Klaim `sub` digunakan sebagai identifier stabil; email tidak dipakai sebagai primary key. Validasi token harus memeriksa signature, audience, issuer, dan expiry. Referensi implementasi: Google Identity Services — Verify Google ID token on your server side (`https://developers.google.com/identity/gsi/web/guides/verify-google-id-token`) dan Sign in with Google best practices (`https://developers.google.com/identity/siwg/best-practices`).

**Batas klaim:** keputusan provider dan arsitektur dasar sudah disetujui. Belum ada kode login, endpoint verifikasi, penyimpanan membership, session, penandatanganan gateway, konfigurasi Google Cloud, atau uji deployment yang boleh diklaim selesai.


### 13.35 Implementasi Awal Google Identity & Session Server (2026-11-16)

Status: **FONDASI SERVER DITAMBAHKAN; BELUM MENJADI LOGIN PWA ATAU PENGAMAN SEMUA API. BUKAN GO-LIVE READY.**

Commit implementasi saat ini:
- `e48984e` — service verifikasi identitas/membership dan penerbitan session ERP.
- `bf548e7` — unit test autentikasi dan otorisasi.
- `7d15c53` — endpoint Express Google Sign-In dan pemeriksaan session.
- `b726346` — suite autentikasi dimasukkan ke perintah test CI.
- `e88bcd2` — template konfigurasi environment server.

Perilaku yang sudah ditambahkan:
- Server memakai Google Auth Library untuk memverifikasi Google ID token dengan audience `GOOGLE_CLIENT_ID`; klaim `sub`, issuer, audience, dan expiry divalidasi sebelum dipakai.
- Identitas internal menggunakan `sub`; email/nama/foto hanya atribut profil.
- `POST /api/auth/google` menukar Google credential menjadi ERP access token bertanda tangan HMAC-SHA256, masa berlaku maksimum 15 menit.
- `GET /api/auth/me` memvalidasi token ERP dan mengecek kembali membership aktif, store, dan role.
- Role yang diterima hanya OWNER, ADMIN, SALES. User tanpa membership, membership ganda aktif, signature salah, token expired, atau perubahan role/store ditolak.
- Konfigurasi server-only: `GOOGLE_CLIENT_ID`, `ERP_AUTH_SESSION_SECRET` (minimal 32 karakter), dan `ERP_AUTH_MEMBERS_JSON`. Contoh disediakan di `.env.example`; daftar kosong berarti tidak ada user yang diberi akses.
- Endpoint login dibatasi 10 percobaan per IP per menit. Tidak ada self-registration atau fallback role berdasarkan email.
- Access token harus disimpan sementara di memori aplikasi ketika nanti diintegrasikan; jangan simpan ke localStorage/IndexedDB atau masukkan secret server ke variabel `VITE_*`.

Batas implementasi saat ini:
- `ERP_AUTH_MEMBERS_JSON` adalah registry bootstrap server-side sementara, bukan UI manajemen pengguna atau database membership permanen. Perubahan konfigurasi memerlukan reload/restart server.
- Belum ada UI Google Sign-In di PWA, pemulihan token, pemilihan toko, undangan/penambahan user, atau proses bootstrap Owner yang ramah operasional.
- Middleware session sudah tersedia dan dipakai endpoint `/api/auth/me`, tetapi endpoint transaksi/sync/media dan AI belum seluruhnya dilindungi middleware ini.
- Adapter Google Sheets masih mengirim shared secret langsung dari PWA ke GAS. Belum ada server proxy sync/media, HMAC server-to-server, nonce/replay protection di GAS, atau pemindahan secret ke server.
- Belum ada uji integrasi token Google nyata, Google Cloud OAuth client, domain HTTPS produksi, multi-device, maupun pencabutan membership pada deployment. Unit test menggunakan verifier terkontrol, bukan token Google sungguhan.
- Belum diputuskan database membership jangka panjang. Registry env ini hanya langkah awal yang fail-closed dan tidak mengunci backend sinkronisasi ERP.

Tahap berikutnya sebelum menyebut autentikasi selesai:
1. Buat UI login GIS dan state auth yang tetap terpisah dari local device unlock/offline mode.
2. Lindungi endpoint server yang relevan dan pindahkan GAS sync/media melalui proxy server; PWA tidak boleh lagi memegang secret GAS.
3. Implementasikan signature HMAC + timestamp + nonce anti-replay di server dan GAS.
4. Tentukan penyimpanan membership permanen, bootstrap Owner, dan lifecycle Admin/Sales.
5. Jalankan test CI penuh, uji token Google nyata di authorized origin, serta uji role/store isolation dan pencabutan akses di HTTPS.


### 13.36 Fondasi Client Autentikasi PWA (2026-11-16)

Status: **CLIENT API LAYER DAN UI GOOGLE SIGN-IN OPSIONAL SUDAH DITAMBAHKAN; ROLE-GATING DAN PERLINDUNGAN API BISNIS BELUM SELESAI.**

Implementasi:
- `src/auth/erpAuthClient.ts` menyediakan client untuk membaca `GET /api/auth/config`, menukar Google credential melalui `POST /api/auth/google`, dan memvalidasi session melalui `GET /api/auth/me`.
- Client memvalidasi bentuk respons dan role OWNER/ADMIN/SALES sebelum menyimpan identitas sesi di memori runtime.
- Access token ERP hanya disimpan di memori JavaScript. Tidak ditulis ke localStorage, IndexedDB, atau URL; reload tab mengakhiri sesi client dan memerlukan autentikasi ulang.
- Jika server menolak session dengan HTTP 401/403, token dan cached user langsung dibersihkan.
- Test client menguji konfigurasi publik, pertukaran credential, validasi role, header Bearer, penolakan session, dan pembersihan token.

Batas dan keputusan yang tetap berlaku:
- UI Google Sign-In opsional kini tersedia pada kontrol Akun di header PWA. UI menampilkan nama/email, role, storeId, waktu expiry, dan logout setelah server menerima credential. Ini hanya identitas sesi; belum mengubah hak akses menu/aksi atau actor transaksi.
- Tidak ada perubahan terhadap PIN Owner lokal. PIN tetap merupakan kontrol lokal untuk tindakan sensitif; Google Sign-In adalah identitas akun dan tidak menggantikan PIN.
- Tidak ada perubahan perilaku startup/offline: login tidak diwajibkan saat aplikasi dibuka, dan kegagalan membaca konfigurasi auth tidak menghalangi penggunaan lokal. Tombol Google hanya aktif jika server mengirim konfigurasi valid dan perangkat online.
- Belum boleh menyebut role UI atau API bisnis terlindungi. Middleware server baru digunakan oleh `/api/auth/me`; endpoint bisnis/sync/media/AI tetap membutuhkan tahap pengamanan tersendiri.
- Session client memory-only adalah batas keamanan sementara yang disengaja, bukan mekanisme persistensi perangkat. Desain local unlock/enrollment offline harus diselesaikan sebelum login diwajibkan pada startup.

Test suite `src/auth/erpAuthClient.test.ts` telah dimasukkan ke script `bun run test`. CI harus dijalankan pada commit perubahan ini sebelum status test dinyatakan lulus.


### 13.37 Integrasi UI Google Sign-In Opsional (2026-11-16)

Status: **UI LOGIN GOOGLE SUDAH TERPASANG; BELUM ADA ROLE-GATING ATAU ENFORCEMENT PADA API BISNIS.**

Implementasi:
- Komponen `src/components/GoogleSignInButton.tsx` memuat Google Identity Services secara lazy saat panel Akun dibuka dan Client ID tersedia. Credential hasil GIS langsung dikirim ke `POST /api/auth/google` untuk diverifikasi server; PWA tidak mempercayai profil/role dari callback browser.
- Header PWA memiliki panel Akun untuk login, menampilkan identitas akun, role dan toko dari session server, masa berlaku session, serta logout.
- Panel menangani server belum terkonfigurasi, jaringan offline, error pemuatan GIS, penolakan membership, dan refresh konfigurasi.
- Client session tetap memory-only dan dibersihkan saat logout, ketika server mengembalikan 401/403, atau saat expiry session tercapai.
- Login bersifat opsional. Startup, transaksi lokal, IndexedDB, dan PIN Owner tidak digate oleh Google Sign-In. Perubahan ini tidak mengubah data transaksi maupun aturan bisnis.

Batas yang belum boleh dianggap selesai:
- Role hanya ditampilkan sebagai informasi hasil verifikasi; belum membatasi navigasi, tombol, operasi engine, maupun endpoint bisnis. Jangan menganggap UI login sama dengan authorization.
- Actor transaksi dan audit log masih memakai actorName yang sudah ada di alur aplikasi; identitas Google belum diikat ke event transaksi.
- GIS production origin belum dapat diuji sampai domain HTTPS dan Authorized JavaScript Origins ditetapkan di Google Cloud Console. Localhost juga perlu didaftarkan untuk pengujian lokal.
- Session tidak bertahan setelah reload tab. Mekanisme local device enrollment/unlock offline dan pemulihan session yang aman belum diputuskan; jangan menyimpan bearer token ke localStorage/IndexedDB sebagai jalan pintas.
- Endpoint transaksi/sync/media/AI masih belum seluruhnya memakai middleware `requireErpSession`; Google Sheets shared secret masih perlu dipindahkan ke server proxy dan diamankan dengan HMAC + timestamp + nonce anti-replay.
- CI dan pengujian browser Google nyata pada authorized origin harus lulus sebelum UI ini dinyatakan siap dipakai operasional.


### 13.38 Rancangan Local Device Unlock & Offline Identity (2026-11-16)

Status: **DESAIN TEKNIS REKOMENDASI; BELUM DIIMPLEMENTASIKAN DAN BELUM MENGUBAH STARTUP APLIKASI.**

Tujuan: perangkat yang sudah dienroll tetap dapat dibuka dan dipakai saat internet putus, tanpa menjadikan PIN Owner sebagai password login semua staf dan tanpa menaruh signing secret di PWA.

Rancangan yang direkomendasikan:
1. **Enrollment awal wajib online:** pengguna masuk dengan Google Sign-In; server memverifikasi Google ID token, membership aktif, store, role, dan identitas perangkat sebelum menerbitkan grant offline.
2. **Identitas perangkat tetap unik:** gunakan `deviceId` lokal yang sudah dimiliki engine. Grant diikat ke `googleSub + storeId + role + deviceId`; perubahan/perpindahan akun atau toko memerlukan enrollment ulang yang tercatat.
3. **Kredensial buka perangkat terpisah:** PIN/device credential khusus perangkat, bukan PIN Owner. PIN tidak pernah disinkronkan dan tidak disimpan dalam bentuk plaintext. Simpan verifier dengan salt dan derivasi kunci yang sesuai Web Crypto; gunakan kunci turunan untuk membuka material grant yang disimpan lokal.
4. **Grant offline harus bisa diverifikasi tanpa server:** server menandatangani grant menggunakan private key Ed25519; PWA hanya membawa public key untuk verifikasi. Jangan memakai HMAC server secret sebagai offline-verification key karena secret tidak boleh berada di browser.
5. **Isi grant minimum:** issuer/audience, Google subject, storeId, role, deviceId, issuedAt, expiresAt, membershipVersion, dan grantId. Tolak signature salah, claim hilang, device/store mismatch, versi grant mundur, dan grant kedaluwarsa.
6. **Saat online kembali:** validasi ulang membership ke server, perbarui grant bila sah, dan proses sinkronisasi melalui mekanisme backend yang sudah tervalidasi. Pencabutan akses harus tercermin saat perangkat tersambung lagi.
7. **Data transaksi lokal tidak dihapus saat grant invalid/expired:** hentikan klaim bahwa perangkat memiliki otorisasi aktif, pertahankan antrean dan audit lokal, lalu minta autentikasi/enrollment online. Jangan membuang transaksi yang sudah dibuat offline.
8. **Recovery:** lupa PIN lokal atau ganti pemilik perangkat membutuhkan autentikasi Google online dan enrollment ulang; PIN Owner bukan bypass login perangkat. Proses reset harus mencatat perangkat lama dan grant yang dicabut.

Keputusan/risiko yang masih terbuka sebelum implementasi:
- Masa berlaku grant offline: rekomendasi awal 7 hari, tetapi ini adalah trade-off antara kelancaran operasi offline dan jeda pencabutan user; belum dikunci.
- Apakah satu perangkat hanya boleh memiliki satu profil aktif atau boleh berganti beberapa user lokal. Default teknis yang paling sederhana adalah satu profil aktif per perangkat, dengan pergantian akun harus online.
- Kebijakan transaksi baru setelah grant kedaluwarsa saat benar-benar offline: rekomendasi aman adalah tetap mempertahankan akses baca dan antrean lama, tetapi meminta koneksi untuk enrollment ulang sebelum transaksi baru memakai identitas yang tidak lagi dapat diverifikasi. Dampak operasional perlu diputuskan.
- Mekanisme backup/restore grant dan PIN lokal: tidak boleh ikut dipulihkan ke perangkat lain; grant harus terikat ke deviceId dan proses restore data bisnis tidak memindahkan otorisasi perangkat.
- Web Crypto memerlukan secure context (HTTPS atau localhost); deployment produksi wajib HTTPS.

**Batas penting:** rancangan ini belum boleh dipakai untuk menyatakan authorization selesai. UI Google Sign-In yang sudah ada hanya autentikasi online opsional. Role-gating, signed offline grant, device enrollment, dan enforcement server masih merupakan pekerjaan terpisah.


### 13.39 Historical baseline checklist P0-1 s.d. P0-7 (2026-11-16 — SUPERSEDED)

Status: **HASIL AUDIT SOURCE; MATRIKS TINDAK LANJUT. BUKAN PERNYATAAN SELURUH PATCH SUDAH SELESAI.**

Matriks ini menyelaraskan usulan hardening eksternal dengan kontrak dan implementasi ERP DAGING yang sudah ada. Jangan menyalin contoh kode/field dari usulan tanpa menyesuaikan kontrak event ERP.

| ID | Keputusan | Kondisi kode/arsitektur saat audit | Tindak lanjut dan acceptance |
|---|---|---|---|
| P0-1 Durable Outbox | Pertahankan Outbox sebagai bagian dari state bisnis sampai ada desain transaksi atomik yang membuktikan pemisahan store aman. Jangan membuat store `sync_outbox` paralel secara langsung. | `syncOutbox` berada di `BusinessEngineState` dan snapshot disimpan ke IndexedDB `kv_state/engine_state_v1`; bukan store Outbox independen. Fungsi persistensi mengembalikan Promise IndexedDB, sehingga setiap jalur mutasi harus dibuktikan menunggu hasil persistensi sebelum UI menyatakan sukses. | Audit seluruh mutasi bisnis dan dispatch/persist flow. **Temuan source terkonfirmasi (2026-11-16): P0-1 BELUM LULUS dan menjadi blocker produksi.** `persistEngineState()` di `src/engine/businessEngine.ts` mengembalikan `{ localStorageOk, indexedDbPromise }`, tetapi banyak fungsi mutasi domain memanggil `persistEngineState(nextState)` tanpa menunggu `indexedDbPromise`. Di `src/App.tsx`, `commitEngineResultState()` langsung mengubah `latestEngineStateRef` dan React state tanpa menunggu commit IndexedDB. Jalur `updateEngineAndPersist()` juga memanggil `updateMasterData()` lalu langsung commit state. Karena itu, fakta bahwa `syncOutbox` berada di snapshot `kv_state/engine_state_v1` belum menjamin transaksi dan Outbox durable sebelum UI menganggap aksi selesai. **Jangan tutup temuan ini hanya dengan menambah store `sync_outbox` atau menambah await pada satu fungsi.**

Tindak lanjut implementasi harus memakai satu jalur commit async yang terpusat dan diserialisasi: hitung state berikutnya dari state terbaru, tulis snapshot state+Outbox secara atomik ke IndexedDB, baru publikasikan state ke UI dan izinkan notifikasi sukses. Mutasi yang gagal persist harus gagal tertutup (tidak publish state baru sebagai transaksi berhasil), menampilkan error, dan mencegah mutasi berikutnya memakai snapshot stale. Semua callsite mutasi termasuk callback komponen, POS, pembelian, pembayaran, retur, VOID, approval, master data, sync ACK/pull, restore, dan pengaturan harus dipetakan dan dimigrasikan; lifecycle `pagehide` hanya best-effort flush, bukan jaminan transaksi. Uji concurrency/rapid taps dan penulisan gagal wajib ditambahkan.

Mutasi hanya sukses setelah IndexedDB commit berhasil; bila gagal, tampilkan error dan jangan mengklaim transaksi tersimpan. Browser test: buat 3 event offline, tunggu sukses, reload/crash-reload, pastikan 3 event dan state bisnis konsisten lalu dapat disinkronkan. |
| P0-2 GAS idempotency | Sudah ada untuk kontrak ERP DAGING; jangan ganti `uuid`/`idempotencyKey` menjadi `eventId` tanpa migrasi kontrak. | GAS memakai scope store + idempotencyKey, memeriksa UUID, identitas event dan payload kanonis; retry identik mendapat ACK ulang dengan sequence semula, perubahan isi ditolak. Response memakai `acknowledgedIds` dan `serverSeqs`, bukan daftar `accepted` kosong. | Pertahankan perilaku ACK ulang karena client perlu menyelesaikan retry. Acceptance: kirim event identik 3 kali; hanya satu row tersimpan, ketiga request mendapat ACK identitas/sequence sama; payload berubah dengan key sama harus ditolak dan tidak append. Jalankan harness dan deployment GAS nyata. |
| P0-3 Ordering metadata | Pertahankan `serverSeq` sebagai cursor resmi pull. Timestamp penerimaan server dan sequence lokal/device boleh menjadi metadata tambahan, bukan pengganti cursor. | GAS memberi sequence monoton berdasarkan event yang diterima dan pull mengurutkan berdasarkan sequence. `deviceId` sudah ada. Belum ada bukti `server_received_at` atau counter sequence lokal per device. | Tambahkan server receipt timestamp bila dibutuhkan untuk audit waktu penerimaan. Tambahkan local sequence hanya jika dipakai untuk mendeteksi gap/urutan event dari device yang sama; alokasikan secara atomik bersama enqueue. Acceptance: ubah jam perangkat ±1 hari; cursor sync tetap monoton berdasarkan serverSeq, timestamp server tidak mengikuti jam HP, dan urutan lokal dapat diaudit. Jangan klaim serverSeq membuktikan urutan kejadian lintas device. |
| P0-4 Integer money/quantity | Prinsip Rupiah integer dan berat gram integer tetap dikunci; jangan jalankan pembulatan massal tanpa laporan migrasi. | Engine dan tipe data menggunakan field Rupiah/gram serta validasi integer pada sejumlah jalur. Helper yang memakai `Math.round` tidak membuktikan semua field/transaksi bebas pecahan atau overflow. | Audit semua field finansial, kuantitas, reducer, adapter, laporan, dan batas `Number.MAX_SAFE_INTEGER`. Migrasi harus dry-run, backup, daftar nilai berubah, rekonsiliasi total sebelum/sesudah, lalu commit terkontrol. Acceptance: semua nilai sumber tervalidasi integer; total laporan sama persis dengan agregasi raw; nilai tidak aman ditolak, bukan dibulatkan diam-diam. |
| P0-5 Tombstone master data | Terapkan soft delete hanya untuk master data yang memang dapat dihapus; transaksi, stock ledger, jurnal, audit, dan pembayaran tetap immutable dengan VOID/reversal. | SQL Supabase sudah memiliki `deleted_at` pada beberapa tabel master (users/customers/suppliers/products), tetapi belum membuktikan alur event delete lintas adapter/reducer dan filter query konsisten. GAS menyimpan event log, bukan tabel master ter-normalisasi dengan filter otomatis. | Definisikan event `MASTER_DATA` delete/restore dengan entity type, entity ID, timestamp/version dan aturan konflik. Pastikan semua query/list, reducer remote, export dan adapter menghormati tombstone. Acceptance: A menghapus master, B offline tetap menyimpan cache, setelah pull B menyembunyikan record; event lama/retry tidak menghidupkannya kembali. Larang delete pada ledger/transaksi keuangan. |
| P0-6 Payload schema validation | Perlu validasi payload bisnis di gateway sebelum append; jangan gunakan contoh schema generik `sale/stock/delete`. | GAS saat ini memvalidasi identitas event dan payload sebagai object, tetapi belum melakukan validasi schema spesifik setiap `entityType`. Kontrak ERP memakai tipe seperti SALE, PURCHASE, OPNAME, CONVERSION, RETURN, PAYMENT, VOID, APPROVAL, MASTER_DATA. | Buat validator per entityType dan versi schema; cek required fields, tipe, integer/range, ukuran, nested items, dan referensi penting. Event type/versi tidak dikenal ditolak/quarantine dengan alasan jelas, tidak ACK sukses. Acceptance: payload wajib hilang, tipe salah, integer pecahan/negatif terlarang, nested item rusak, dan payload terlalu besar ditolak tanpa append; event valid diterima. |
| P0-7 Backup durability | Pertahankan format backup/restore ERP DAGING yang sudah mengemas state dan lampiran, checksum, Owner PIN, serta safety snapshot. Jangan menggantinya dengan dump 5 tabel. | Export/restore JSON dan pemulihan lampiran Base64 sudah ada. Belum ditemukan pemanggilan `navigator.storage.persist()` maupun reminder backup lebih dari 7 hari. | Tambahkan permintaan persistent storage secara best-effort dan tampilkan status hasilnya; jangan menjanjikan browser tidak akan menghapus data. Tambahkan metadata waktu backup terakhir dan reminder non-blocking >7 hari. Acceptance: export dan restore pada browser lain memulihkan state, Outbox, dan lampiran dengan checksum valid; backup invalid ditolak tanpa merusak data aktif. |

#### Prioritas eksekusi yang disepakati untuk tindak lanjut

1. **P0-1 audit jalur mutasi/persistensi** — risiko langsung kehilangan transaksi lokal; jangan menganggap snapshot IndexedDB otomatis memenuhi syarat await-before-success.
2. **P0-6 validasi schema event GAS** — mencegah event bisnis malformed mendapat ACK.
3. **P0-5 tombstone master data** — mencegah master yang dihapus muncul kembali lintas device.
4. **P0-3 metadata penerimaan server dan urutan lokal** — penguatan audit; serverSeq tetap cursor.
5. **P0-4 audit integer menyeluruh dan rencana migrasi** — jangan mengubah data historis tanpa dry-run dan rekonsiliasi.
6. **P0-7 persist storage + reminder** — melengkapi backup yang sudah ada.
7. **P0-2 uji regresi idempotency** — implementasi inti sudah ada; perlu menjaga acceptance pada harness dan deployment.

#### Batas klaim

- P0-1 belum dinyatakan lulus sampai semua jalur mutasi terbukti menunggu IndexedDB commit dan browser test refresh/recovery lulus.
- P0-2 source/harness telah memiliki idempotency logic; deployment GAS nyata tetap perlu diuji.
- P0-3, P0-5, P0-6, P0-7 adalah gap atau pekerjaan lanjutan sesuai ruang lingkup di atas.
- P0-4 adalah prinsip arsitektur yang sudah dikunci, tetapi audit kelengkapan seluruh field dan migrasi historis belum selesai.
- Tidak ada perubahan kontrak event, backend pilihan, alur bisnis, atau keputusan offline-first yang diotorisasi oleh matriks ini.


### 13.40 Status Hardening Blocker Produksi — 2026-11-16

Bagian ini memperbarui status audit P0-1 s.d. P0-7 setelah implementasi lanjutan. Status **source code**, **CI**, dan **deployment nyata** harus dibedakan. Selama acceptance deployment/perangkat belum lulus, ERP DAGING tidak boleh diberi label Production Ready.

| ID | Status source saat ini | Batas bukti / syarat penutupan |
|---|---|---|
| P0-1 Durable mutation commit | **SUDAH MERGE ke main** pada commit `bb0b8485f464063c080139e907faa717938208d0`; CI main sebelumnya sukses untuk lint, test, build, dan Chromium IndexedDB. | Pertahankan regresi untuk mutasi gagal, transaksi beruntun, reload, dan pemulihan Outbox. Jangan mengubah lagi jalur commit tanpa uji browser. |
| P0-2 GAS idempotency | Logika idempotensi Store ID + idempotencyKey, UUID collision guard, retry ACK, dan sequence sudah ada. PR hardening menambah validasi payload dan regression tests untuk retry/collision. CI PR serta deployment GAS nyata masih harus lulus. | CI PR dan uji deployment GAS nyata tetap wajib jika adapter GAS dipilih. |
| P0-3 Server receipt metadata | Gateway GAS menambahkan `serverReceivedAt` sebagai kolom terpisah dari `createdAt` perangkat dan mengembalikannya pada pull. Header sheet lama diperluas tanpa menulis ulang event historis. PR hardening juga mengamankan jalur PWA → server → GAS dengan session ERP, Store ID dari membership, secret hanya di server, dan HMAC timestamp + nonce anti-replay. | CI dan uji sheet GAS yang sudah berjalan perlu lulus. `serverSeq` tetap cursor resmi; tidak ada klaim urutan kejadian lintas perangkat dari jam HP. |
| P0-4 Integer Rupiah/Gram | Ditambahkan audit read-only untuk nilai Rupiah/Gram, harga per kg, dan field numerik finansial; audit menampilkan path pelanggaran dan field KG lama tanpa membulatkan atau mengubah data. | Belum lulus penuh sebelum data aktual seluruh perangkat diaudit, semua pelanggaran direkonsiliasi, dan field kuantitas KG lama dimigrasikan terkontrol ke Gram bila diperlukan. |
| P0-5 Master tombstone | Kategori produk kini memakai `deletedAt`, dikirim melalui `MASTER_DATA_PATCH`, dan reducer mempertahankan tombstone terhadap patch lama tanpa restore eksplisit. Kategori yang masih dipakai produk tidak boleh diarsipkan. | Saat ini hanya kategori yang memiliki operasi hapus. Produk, pelanggan, supplier, lot, transaksi, ledger, jurnal, dan pembayaran tidak boleh diberi hard-delete baru; jika operasi hapus master lain ditambahkan, wajib memakai tombstone dan uji lintas perangkat. |
| P0-6 Payload validation | Gateway GAS memakai allow-list `entityType`, validasi required fields per event family, nested SALE rows/lot allocations, batas payload, timestamp, dan integer Rupiah/Gram. MASTER_DATA dibatasi pada field master yang dikenal. | CI PR dan deployment GAS nyata tetap wajib. Payload legacy yang tidak sesuai schema harus ditolak dengan alasan; jangan ACK event yang tidak tervalidasi. |
| P0-7 Storage/backup durability | PWA meminta persistent storage secara best-effort, menampilkan status grant browser, dan mengingatkan backup lokal. PR #10 menambahkan uploader Google Drive: akun Drive diverifikasi harus sama dengan email Owner ERP, satu folder bersama `ERP DAGING BACKUP`, nama file JSON unik, lampiran JPEG terpisah, dan manifest SHA-256. | Implementasi uploader baru berada di PR dan belum lulus CI/live Google OAuth + Drive. Belum ada antrean/penjadwalan upload, listing/download, atau restore dari Drive. Backup off-device belum boleh dinyatakan operasional sebelum upload nyata, checksum, kuota, retry, dan restore diuji. |

#### Blocker keamanan dan operasional yang belum tertutup

1. Google Sign-In dan session client sudah memiliki fondasi. PR hardening mewajibkan session aktif, Device ID terdaftar, dan memeriksa role saat push event GAS: OWNER semua event; ADMIN tidak dapat mengirim APPROVAL/VOID; SALES dibatasi SALE, RETURN sampai Rp500.000, dan PAYMENT jenis RECEIVABLE_PAYMENT. Ini baru membatasi event yang masuk ke GAS. UI/Business Engine offline belum mengunci seluruh operasi berdasarkan role; pull data belum difilter per role/assigned_sales_id; adapter backend lain harus memiliki kebijakan setara.
2. Jika GAS dipilih, PR hardening mengganti jalur langsung browser menjadi proxy `/api/sync/gas`: session + membership diverifikasi server, Store ID berasal dari membership, Device ID harus ada di allow-list, secret tidak lagi disimpan/dikirim browser, dan request server-ke-GAS ditandatangani HMAC timestamp + nonce. Ini belum dianggap lulus sebelum CI, deployment GAS dengan Script Properties, dan uji integrasi nyata berhasil.
3. Registry `ERP_AUTH_MEMBERS_JSON` masih bootstrap server-side sementara. Lifecycle Owner/Admin/Sales, provisioning Owner pertama, dan pencabutan akses perlu prosedur operasional yang diuji.
4. **Isolasi data Sales belum selesai.** Membership role SALES kini wajib memiliki `salesId` stabil yang ikut diikat ke session; perubahan mapping `salesId` membatalkan session lama. Registry lama yang memiliki membership SALES tanpa `salesId` harus dilengkapi sebelum autentikasi akun Sales dapat berjalan. Model `CustomerEntity.assignedSalesId` dan `SalesTransactionRecord.salesId` sudah ditambahkan; Business Engine menyimpan Sales ID ke transaksi/event jika caller memberikannya dan menolak transaksi ketika ID tersebut berbeda dari assignment pelanggan. Gateway push membandingkan `payload.salesId` dengan Sales ID dari session terautentikasi. Namun kecocokan identitas belum membuktikan bahwa pelanggan/transaksi memang milik Sales tersebut; karena server belum memiliki pemeriksaan assignment otoritatif, seluruh event push role SALES kini ditolak sementara (fail-closed), bukan hanya event dengan identitas tidak cocok. Namun alur UI belum memasok Sales ID dari session ke Business Engine, event RETURN/PAYMENT belum semuanya membawa identitas transaksi/pelanggan, dan GAS pull masih mengirim event satu store kepada seluruh device terdaftar. Karena itu gateway kini menolak `sync_pull` untuk role SALES sampai stock-only projection tersedia; Sales juga ditolak mengunduh lampiran secara umum sampai media terikat ke record yang berhak diakses. Ini fail-closed sementara, bukan penyelesaian workflow Sales. Diperlukan stock-only projection dengan cursor global `serverSeq` yang tetap maju benar meski sebagian event disembunyikan, serta otorisasi lampiran berbasis record.
5. Device allow-list server per membership kini diterapkan untuk push/pull dan transfer lampiran GAS. Owner/Sales dapat melihat Device ID perangkat; Owner menambahkannya secara manual pada `deviceIds` di `ERP_AUTH_MEMBERS_JSON`. Enrollment belum self-service dan belum ada signed offline grant. Saat offline, transaksi lokal tetap bisa dibuat tanpa verifikasi role server; UI/Business Engine belum mencegah Sales membuat operasi yang nanti ditolak gateway.
6. Google OAuth Client ID, authorized origin, domain HTTPS, environment server, dan deployment gateway belum dibuktikan pada lingkungan produksi.
7. PR #10 menambahkan simulasi acceptance dua perangkat pada GAS harness (push independen, pull silang, cursor global, retry idempoten, dan append-only). Ini belum membuktikan dua HP nyata, isolasi role Sales, konflik stok, upload media, restore, pencabutan membership, atau batas delapan perangkat.
8. Backup off-device tidak lagi design-only: PR #10 menambahkan kode upload snapshot JSON unik dan lampiran terpisah ke satu folder bersama `ERP DAGING BACKUP`, memakai token OAuth sementara dan memverifikasi email akun Drive sama dengan email Owner ERP. Namun CI/live Drive belum terverifikasi; antrean/penjadwalan, listing/download, dan restore dari Drive masih belum ada. Jangan membuat folder per-device atau menimpa satu file JSON bersama.
9. Backend operasional belum dikunci oleh Change Register. GAS tetap opsional; deployment GAS bukan syarat jika backend lain yang memenuhi kontrak dipilih.

**Kesimpulan status:** P0-1 telah merge ke `main`. Pada PR hardening, source untuk P0-2, P0-3, P0-5, P0-6, P0-7, role-gate GAS, device allow-list, dan voice parser aktual telah diperbarui; status CI terakhir harus dibaca dari check PR, bukan dari bagian historis 13.39. P0-4 tetap audit-only sampai data aktual direkonsiliasi. ERP DAGING tetap **BELUM PRODUCTION READY** karena isolasi data Sales, signed offline grant, backup off-device, deployment GAS/OAuth, dan acceptance perangkat nyata masih terbuka.


### 13.41 Status P0-2 — Sync Reliability (2026-11-16)

**Status source code: MERGED ke main.** PR [#5](https://github.com/emailmercyzone-glitch/ERP-DAGING/pull/5) di-squash merge pada commit `fb5102c27bdf62ef387308c7bdf77f9c21006e68`.

Perubahan yang sudah masuk:
1. Siklus sync dalam satu instance aplikasi dikunci secara sinkron agar dua pemanggilan tidak mengirim snapshot Outbox yang sama secara bersamaan.
2. Fase network push/pull hanya mengembalikan delta. Reducer ACK dan event pull dijalankan terhadap state terbaru di dalam durable mutation queue; tidak lagi melakukan persistensi snapshot network di luar antrean.
3. Outbox hanya berstatus SYNCED jika UUID ada pada Outbox saat ini dan ACK membawa serverSeq integer aman yang positif.
4. Respons pull divalidasi sebelum event/cursor diterapkan: records wajib array, cursor tidak boleh mundur dan wajib integer aman, sequence event wajib unik, menaik, dan berada dalam rentang cursor.
5. Alias field REST/Supabase dinormalisasi ke kontrak reducer bersama. GAS menolak cursor pull negatif atau pecahan.
6. Regression test mencakup sync lock, network delta tanpa mutasi state, ACK tanpa sequence, pull envelope malformed, duplicate/out-of-order sequence, dan cursor GAS tidak valid.

**Bukti CI:** PR check run `43874141316` sukses untuk lint, seluruh test suite, build, instalasi Chromium, dan native Chromium IndexedDB test. Post-merge main check run `43874678072` juga selesai sukses pada seluruh langkah yang sama.

**Batas penutupan:** P0-2 dinyatakan selesai pada level source + CI. Uji integrasi backend nyata (deployment GAS/Google Sheet, endpoint REST, atau project Supabase yang dipilih) belum dilakukan dalam lingkungan produksi; jangan menganggap semua adapter siap operasional hanya karena unit/integration harness lulus. Kontrak Outbox tetap di snapshot IndexedDB `kv_state/engine_state_v1`; UUID, idempotencyKey, dan aturan bisnis tidak berubah.


### 13.42 Status Hardening P0-4/P0-5 — 2026-11-16

**P0-4 — Validasi integer event remote**
- PR [#6](https://github.com/emailmercyzone-glitch/ERP-DAGING/pull/6) merged ke `main`, commit `6e0e995773aa9096e0ea13f5c95e2e49f0377606`.
- Reducer remote kini menolak payload dengan nilai field Rupiah/Gram berupa pecahan, string numerik, atau integer di luar `Number.MAX_SAFE_INTEGER`; field harga per unit yang dikenal dan `tierPrices` ikut diperiksa.
- Event invalid dikarantina sebagai konflik rekonsiliasi, dicatat sebagai processed agar tidak mengulang pull tanpa akhir, dan tidak mengubah transaksi/stok/ledger lokal. Cursor halaman tetap mengikuti cursor tervalidasi dari adapter.
- PR CI dan post-merge main CI run `43884154912` sukses untuk lint, test, build, dan native Chromium IndexedDB.
- **Batas:** ini melindungi event remote sebelum reducer. Audit read-only terhadap seluruh data historis/perangkat dan rekonsiliasi semua field masih belum selesai. Tidak ada migrasi atau pembulatan massal.

**P0-5 — Proteksi tombstone kategori**
- PR [#7](https://github.com/emailmercyzone-glitch/ERP-DAGING/pull/7) merged ke `main`, commit `12a1e36d1bde9f26b8c2ee9a5b75e48f001a0c74`.
- Jika kategori sudah memiliki `deletedAt`, patch remote biasa tidak dapat menghapus atau mengganti timestamp tombstone melalui nilai `undefined`, `null`, atau timestamp yang lebih lama.
- Regression test mencakup ketiga variasi metadata tersebut. PR CI sukses untuk lint, test, build, dan native Chromium IndexedDB. Post-merge main run `43885095367` selesai sukses untuk lint, test, build, dan native Chromium IndexedDB.
- **Batas:** tombstone saat ini baru untuk kategori produk. Tidak ada fitur restore kategori yang ditambahkan; restore eksplisit harus menjadi event/aksi terpisah bila kelak disetujui.

**Backend integration — belum dapat dijalankan terhadap produksi**
- Konfigurasi default repository tetap `LOCAL_ONLY`; Change Register belum memilih backend operasional.
- GAS/Google Sheets, REST/PostgreSQL, dan Supabase tetap opsi. Tidak ada URL endpoint, OAuth production, secret server, Script Properties GAS, atau project Supabase produksi yang tersedia di source repository untuk membuktikan round-trip nyata.
- Karena itu, CI dan harness tidak boleh disebut uji integrasi produksi. Deployment acceptance dua perangkat dilakukan pada setiap konfigurasi backend yang hendak dipakai; pilihan backend bersifat runtime/configurable dan tidak mengunci vendor secara permanen.
- Blocker isolasi data Sales tetap terbuka: mapping `salesId`/pelanggan dan stock-only projection belum diputuskan. Jangan mengirim seluruh event store ke perangkat Sales sebelum aturan akses tersebut ditutup.

**Status keseluruhan:** P0-1, P0-2, P0-4 guard remote integer, dan P0-5 tombstone kategori telah merge. ERP DAGING tetap **BELUM PRODUCTION READY** sampai backend operasional, isolasi role/data Sales, deployment OAuth/backend, backup off-device, dan acceptance multi-device nyata selesai.

### 13.43 Backend Pluggable, Konfigurasi, dan Keamanan Perpindahan — 2026-11-16

**Koreksi prinsip arsitektur (menggantikan tafsir vendor-lock pada catatan historis):**
- Tidak ada backend yang dipilih atau dikunci permanen. LOCAL_ONLY, GAS + Google Sheets, REST + PostgreSQL, Supabase, ZimaOS/bridge, dan adapter lain adalah target yang dapat dipilih sesuai kebutuhan.
- Yang distabilkan adalah kontrak sinkronisasi dan integritas data, bukan vendor: UUID, idempotencyKey, event envelope, ACK eksplisit, serverSeq sebagai cursor milik namespace backend, pagination, conflict handling, dan aturan validasi Business Engine.
- Dalam satu konfigurasi operasional, hanya ada satu backend sinkronisasi aktif. Multi-backend aktif/dual-write bukan bagian dari desain sekarang.

**Pemisahan tiga operasi:**
1. **Switch** — mengganti backend aktif. Tidak sama dengan memindahkan histori.
2. **Migration** — memindahkan histori dan status sinkronisasi secara terverifikasi ke backend baru.
3. **Failover** — berpindah sementara karena backend utama gagal; tidak boleh mengirim ulang event ke target kedua sebelum status penerimaan target pertama diketahui.

**Pengamanan kode yang diterapkan pada branch ini:**
- `backendSwitchRequiresMigration()` membandingkan identitas namespace target (jenis adapter, store/tenant, endpoint/project URL), bukan token yang dapat dirotasi.
- Setiap perpindahan remote-to-remote ke namespace berbeda ditahan, sekalipun cursor perangkat ini masih nol, karena perangkat lain mungkin sudah menulis histori pada server lama. Dari `LOCAL_ONLY` ke remote, aktivasi juga ditahan bila ada `lastServerSeq`, event `SYNCED`, atau event `FAILED/retry`.
- Peralihan ke `LOCAL_ONLY` tetap boleh karena tidak menghapus data lokal maupun Outbox; sinkronisasi jaringan berhenti.
- Pengguna tetap dapat menguji koneksi konfigurasi target sebelum aktivasi. UI tidak lagi menjanjikan bahwa backend dapat langsung diganti kapan saja tanpa migrasi.
- Ini adalah guard keselamatan sementara. Wizard migrasi lintas backend, ekspor/impor event lengkap, verifikasi checksum/count, dan multi-profile belum diimplementasikan.

**Dampak pada P0-4 dan P0-5 yang baru merge:**
- P0-4 memvalidasi nilai Rupiah/Gram pada event remote di reducer umum. Aturan ini berlaku untuk event dari adapter mana pun setelah dinormalisasi ke envelope bersama; tidak ada ketergantungan ke GAS, REST, atau Supabase.
- P0-5 mempertahankan tombstone kategori saat reducer menggabungkan patch master data remote. Aturan ini juga berada di reducer umum dan tidak mengubah protokol vendor.
- Kedua patch tetap dipertahankan. Perpindahan backend tidak boleh melewati validasi P0-4/P0-5 atau membuat adapter melakukan coercion/pembulatan yang menyamarkan payload invalid.

**Batas dan pekerjaan berikutnya:**
- Implementasi repository saat ini masih memiliki satu konfigurasi aktif, bukan multi-profile. Konfigurasi target sementara dapat diuji lewat koneksi, tetapi belum disimpan sebagai beberapa profil independen.
- Belum ada format ekspor/impor backend-neutral yang mencakup event historis, server ACK registry/idempotency, checkpoint cursor, media, dan tenant mapping.
- Belum ada mekanisme rollback/switch-back yang membandingkan checkpoint kedua backend.
- Belum ada uji integrasi live untuk membuktikan GAS, REST/PostgreSQL, dan Supabase benar-benar interchangeable. Masing-masing harus lulus contract test dan staging round-trip sebelum dapat dipakai.
- Isolasi data Sales tetap blocker lintas adapter: mapping salesId, assignedSalesId, dan stock-only projection harus menjadi policy contract yang sama pada setiap backend, bukan aturan khusus GAS.

**Status:** arsitektur vendor-neutral dikukuhkan; guard aktivasi lintas namespace diterapkan melalui PR #8 (merge commit `1adfd869310ce048e15ee2a3bcd490da92687c1e`). Backend migration dan multi-profile belum selesai. ERP DAGING tetap **BELUM PRODUCTION READY**.


### 13.44 P0 Role, Drive Backup, dan Multi-device — 2026-11-17

Status terbaru pada branch `fix/p0-role-data-isolation`, PR [#10](https://github.com/emailmercyzone-glitch/ERP-DAGING/pull/10). Semua perubahan di bagian ini masih Draft dan belum di-merge.

**Perubahan kode terbaru:**
1. Client auth sekarang mempertahankan `salesId` yang berasal dari session server. Parser menolak session SALES tanpa `salesId` valid dan menolak `salesId` pada role non-Sales.
2. Checkout PWA mengirim `salesId` dari `authUser` terverifikasi ke Business Engine; transaksi lokal tidak boleh mengambil identitas Sales dari input form bebas.
3. Jika server menyatakan autentikasi aktif, checkout menolak transaksi tanpa session ERP aktif.
4. Test GAS menambahkan simulasi acceptance dua perangkat: event Device A dan B memperoleh serverSeq global terpisah, masing-masing device menarik event device lain tanpa menarik event sendiri, cursor tetap maju, retry idempoten tidak menambah row, dan device ketiga dapat catch-up.
5. Uploader Google Drive ditambahkan sebagai implementasi awal: OAuth scope `drive.file` + `openid email`, verifikasi email Drive harus sama dengan email Owner ERP, satu folder bersama `ERP DAGING BACKUP`, file JSON unik per snapshot, lampiran JPEG diunggah terpisah, dan manifest lampiran menyimpan SHA-256. Access token hanya dipakai saat proses dan tidak disimpan oleh uploader.

**Bukti yang belum tersedia:**
- CI untuk commit terbaru masih harus lulus lint, test, build, dan Chromium IndexedDB.
- Upload Google Drive nyata belum dijalankan; konfigurasi OAuth consent screen, Client ID, authorized origin, akun Owner, kuota, serta izin folder belum dibuktikan.
- Restore/listing/download backup Drive belum diimplementasikan. Kode upload awal bukan bukti backup off-device siap operasional.
- Auth server belum dideploy dengan `GOOGLE_CLIENT_ID`, `ERP_AUTH_SESSION_SECRET`, dan `ERP_AUTH_MEMBERS_JSON` produksi. Belum ada Google ID token nyata yang berhasil login ke domain deployment.
- Role policy belum ditegakkan di semua mutasi lokal/offline dan seluruh tampilan data. Signed offline grant belum tersedia.
- Push Sales masih fail-closed; pull Sales dan media download Sales masih diblokir sampai ownership server-side, stock-only projection, cursor, dan parent-record media authorization selesai.
- Simulasi dua perangkat hanya menguji GAS event log. Belum ada acceptance test dua HP nyata dengan akun/role berbeda, konflik stok, offline-resume, revoke, restore, dan device enrollment.

**Kesimpulan:** ada kemajuan kode pada binding identitas Sales, uploader Drive awal, dan simulasi dua perangkat. Namun P0 Role & Data Isolation, deployment/authentication, backup off-device operasional, dan acceptance test multi-device nyata tetap **BELUM SELESAI**. ERP DAGING tetap **BELUM PRODUCTION READY**. Jangan merge PR #10 hanya berdasarkan simulasi atau status CI.


**Tambahan deployment preparation pada PR #10:**
- `Dockerfile` multi-stage menggunakan Bun: build PWA di stage build, lalu runtime image hanya membawa dependency produksi, `server.ts`, modul auth server, dan `dist/`.
- `.dockerignore` mencegah `.env`, node_modules, artefak build, dan file lokal masuk ke image context.
- `GET /api/health/live` memeriksa proses; `GET /api/health/ready` mengembalikan 503 sampai Google OAuth/session secret dan minimal satu membership Owner aktif terkonfigurasi. Probe hanya mengembalikan status boolean, bukan secret atau identitas membership.
- `DEPLOYMENT.md` mendokumentasikan environment, Docker run, HTTPS, OAuth authorized origin, dan langkah smoke/acceptance test.

Batas: belum ada hosting target/domain, secret produksi, OAuth Client ID, registry membership, atau kredensial backend yang diberikan/terpasang. Karena itu deployment dan login Google nyata tetap belum diverifikasi.


### 13.45 Klarifikasi Keputusan Hosting dan Batas Fase 0 — 2026-11-17

Bagian ini mengikat dan harus dibaca bersama seluruh catatan deployment historis. Jika catatan lama terdengar seolah hosting wajib dipilih sekarang, klarifikasi pada bagian ini yang berlaku.

**Keputusan Owner:**
- Hosting/provider, domain, region, dan waktu deployment BELUM DIPILIH.
- Deployment aktual sengaja DITUNDA sampai Owner menentukan sendiri pilihan tersebut.
- Engineering/AI tidak boleh memilih provider, membuat akun layanan, mengaktifkan biaya, membeli domain, atau melakukan deployment tanpa instruksi Owner.
- Docker adalah format packaging portabel, bukan keputusan hosting.

**Yang dikerjakan sekarang (deployment preparation saja):**
1. Menjaga build PWA dan Docker image tetap portabel.
2. Mendokumentasikan environment variables: nama, fungsi, wajib/opsional, contoh non-rahasia, dan validasi.
3. Memisahkan konfigurasi publik PWA dari secret server. Secret tidak boleh masuk Git, Docker image layer, log, atau bundle browser.
4. Menyediakan build/start command, port binding configurable, health liveness/readiness, serta panduan HTTPS/reverse proxy dan CORS.
5. Menyediakan checklist OAuth Client ID/authorized origins, session secret, membership Owner/Admin/Sales, dan endpoint backend.
6. Menyiapkan smoke-test serta acceptance checklist untuk dijalankan setelah Owner memilih environment.
7. Memastikan backend dapat dipilih melalui konfigurasi/adaptor tanpa mengubah core Business Engine, IndexedDB, Outbox, UUID, idempotency, ACK, dan cursor protocol.

**Pemisahan status — jangan dicampur:**
- Deployment preparation: dikerjakan dan diuji sekarang melalui source, dokumentasi, dan CI.
- Backend/authentication readiness: kode, konfigurasi, dan contract test disiapkan sekarang. Login Google nyata serta backend round-trip nyata belum dapat diverifikasi tanpa environment/credential yang nanti dipilih Owner.
- Hosting selection dan live deployment: keputusan Owner, ditunda, dan BUKAN blocker untuk pekerjaan coding Fase 0.
- Acceptance pada backend/hosting nyata: dilakukan setelah Owner memilih dan menyediakan environment. Sampai saat itu, status integrasi live tetap belum terverifikasi.

**Aturan pelaporan:**
- Jangan menyebut deployment selesai hanya karena Docker build sukses.
- Jangan menyebut autentikasi/backend production-verified hanya karena unit test lulus.
- Jangan menahan pekerjaan coding Fase 0 hanya karena provider/domain belum dipilih.
- Selalu laporkan kesiapan konfigurasi, verifikasi backend/auth, dan deployment live sebagai tiga status terpisah.

### 13.46 Koreksi Batas Retur Admin pada Gateway Auth — 2026-11-17

Audit ulang matriks otorisasi menemukan satu celah spesifik pada server-side event authorization: role ADMIN sebelumnya diizinkan mengirim seluruh event `RETURN` tanpa memeriksa nilai refund. Ini bertentangan dengan matriks akses yang menetapkan retur sampai Rp500.000 dapat diproses Admin, sedangkan nilai di atas Rp500.000 memerlukan Owner.

**Perbaikan pada PR #10:**
- ADMIN hanya dapat mengirim event `RETURN` jika `estimatedRefundValue` berupa safe integer Rupiah, tidak negatif, dan maksimal Rp500.000.
- Nilai di atas Rp500.000, nilai pecahan, negatif, atau field yang hilang ditolak oleh server.
- RETURN dikeluarkan dari allow-list umum ADMIN agar tidak melewati pemeriksaan nilai.
- Unit test ditambahkan untuk batas tepat Rp500.000, Rp500.001, dan payload tanpa nilai.

**Batas verifikasi:** perubahan source dan test sudah dikomit ke branch PR #10. Status CI untuk head terbaru harus diperiksa setelah workflow berjalan. Ini menutup satu celah otorisasi event, bukan berarti RBAC seluruh UI/mutasi lokal atau isolasi data Sales sudah selesai.

### 13.47 Google Drive Backup — Listing dan Verified Download — 2026-11-17

**Implementasi lanjutan pada PR #10:**
- Adapter kini dapat menemukan folder bersama `ERP DAGING BACKUP` dan mengambil daftar file snapshot JSON milik aplikasi (filter appProperties), bukan mencampur foto lampiran atau file lain.
- Adapter dapat mengunduh snapshot JSON dan lampiran JPEG secara terpisah.
- Sebelum hasil restore diserahkan ke pemanggil, adapter memverifikasi SHA-256 manifest, ukuran lampiran, dan SHA-256 setiap lampiran. Jika satu pemeriksaan gagal, proses dibatalkan dan tidak ada hasil parsial yang dikembalikan.
- Penanganan file dilakukan sebagai tahap pengambilan/verifikasi. Fungsi ini belum menulis data ke IndexedDB atau mengganti database aktif; pemulihan database yang transaksional, validasi skema backup penuh, UI restore Owner-only, dan uji restore end-to-end masih harus diselesaikan.
- Daftar Drive mengikuti seluruh halaman API menggunakan `nextPageToken`, sehingga arsip lebih dari 100 snapshot tetap dapat ditelusuri. Nama file backup juga dapat dipertahankan oleh pemanggil saat mengunduh snapshot.

**Batas verifikasi:** unit test listing, manifest tampering, dan checksum attachment ditambahkan. CI pada commit terbaru sedang berjalan; hasilnya belum boleh dinyatakan lulus sampai workflow selesai. Google OAuth/Drive nyata tetap belum diverifikasi.

### 13.48 RBAC Lokal dan Restore Backup Penuh — 2026-11-17

Implementasi lanjutan pada PR #10. Bagian ini memperbarui status historis 13.44 dan 13.47; butir lama yang menyebut listing/restore belum tersedia tidak lagi menggambarkan head branch terbaru.

**RBAC yang sudah ditambahkan pada source:**
1. src/auth/rolePolicy.ts menjadi policy bersama untuk navigasi, izin event mutasi lokal, dan proyeksi data Sales.
2. App shell dikunci sampai role terverifikasi tersedia. Session ERP yang kedaluwarsa mengunci kembali akses dan meminta login ulang.
3. Navigasi Sales dibatasi ke POS, stok/warehouse, dan tagihan. Dashboard, pembelian, laporan, jurnal, audit, pajak, pengaturan, approval, serta backup tidak diberikan ke Sales.
4. Menu dan route sekunder juga diperiksa berdasarkan role. Approval, void transaksi, pengaturan PIN Owner, backup, restore, reset data, dan konfigurasi backend dibatasi ke Owner.
5. Sebelum mutasi lokal Admin/Sales di-commit, setiap perubahan state wajib menghasilkan event Outbox baru. Event tidak dikenal ditolak. Admin tidak dapat melakukan void/approval/pembayaran supplier/retur di atas Rp500.000; Admin tetap dapat mencatat pembayaran piutang dan OPEX kas kecil.
6. Checkout, penerimaan pembayaran piutang, dan retur Sales mengikat salesId dari session. Engine menolak pembayaran/retur atas pelanggan atau faktur yang tidak ditugaskan kepada Sales tersebut.
7. Proyeksi Sales menyaring pelanggan/piutang/transaksi sesuai assignment, menghapus HPP dan margin, saldo kas/bank, jurnal, supplier, PIN hash/salt, audit log, sync payload, dan detail supplier dari stock ledger.

**Batas RBAC yang masih terbuka — jangan dinyatakan selesai:**
- Proyeksi Sales saat ini adalah pembatasan tampilan dan input lokal, BUKAN isolasi data at-rest. Engine state bersama masih berada di IndexedDB/memori perangkat; pengguna teknis dapat memeriksa data mentah melalui DevTools. Sebelum production, perangkat Sales harus menerima dan menyimpan hanya projection role-scoped yang dibuat server, dengan persistence terpisah/terbatas. Jangan menyebut proyeksi UI sebagai kontrol keamanan penuh.
- Server push Sales masih fail-closed sampai ownership customer/transaction divalidasi terhadap data authoritative di backend. Server pull Sales dan media download Sales juga masih diblokir sampai proyeksi stock-only, filter assigned customer, cursor, dan parent-record media authorization teruji.
- Belum ada signed offline grant. Session yang habis masa berlakunya mengunci akses; operasi offline jangka panjang setelah TTL belum aman untuk diaktifkan. Ini perlu desain lease offline yang ditandatangani server dan diverifikasi client, bukan menyimpan role biasa di localStorage.
- Semantik pelanggan bersama UMUM belum ditetapkan. Sales tidak diberi fallback ke pelanggan contoh atau pelanggan yang tidak ditugaskan; checkout ditolak bila belum ada customer assignment yang valid.
- Perlu acceptance test dua HP nyata dengan role berbeda, termasuk offline-resume, revoke, perubahan assignment, konflik, dan media authorization.

**Restore backup yang sudah ditambahkan:**
1. Owner dapat memuat daftar snapshot JSON dari folder bersama Google Drive. Listing hanya menerima app marker ERP DAGING dan mengikuti pagination Drive.
2. Sebelum listing atau download, akun Google yang sedang dipakai diverifikasi terhadap email Owner ERP; akun berbeda ditolak.
3. Download memverifikasi SHA-256 isi snapshot, SHA-256 manifest, MIME type, ukuran, dan SHA-256 setiap lampiran JPEG. Tidak ada hasil parsial yang diteruskan jika satu pemeriksaan gagal.
4. Parser restore memeriksa koleksi inti, schema version, timestamp, ID unik, struktur transaksi, dan integritas nilai Rupiah/Gram. Snapshot yang tidak lengkap atau korup ditolak sebelum menyentuh database aktif.
5. Restore IndexedDB membuat safety snapshot kondisi aktif, lalu mengganti state dan kumpulan lampiran secara atomik dalam satu transaksi. Jika penulisan state/lampiran gagal, transaksi dibatalkan dan database aktif tetap seperti semula.
6. Uji Chromium diperluas untuk memastikan lampiran lama yang tidak ada di snapshot dihapus pada restore penuh, dan simulasi DataCloneError tidak mengubah state maupun lampiran aktif.

**Batas restore yang masih terbuka:**
- Safety policy saat ini hanya mengizinkan restore untuk identitas perangkat asal yang sama dan menolak snapshot yang lebih lama dari data aktif. Pemulihan ke HP baru/perangkat pengganti belum diizinkan.
- Google OAuth dan Google Drive nyata belum diverifikasi dengan akun Owner; saat ini yang tersedia adalah source dan mock/unit/browser tests.
- Backup lama yang belum memiliki metadata SHA-256 snapshot baru tidak memenuhi format verified-download terbaru.
- Restore database tidak boleh disebut live-verified sampai uji Drive nyata dan acceptance test restore perangkat nyata dilakukan.

**Status verifikasi CI pada saat pencatatan:**
- Commit 84d0998a: lint berhasil; unit test menemukan dua kegagalan (PIN hash/salt belum disamarkan pada proyeksi Sales dan fixture FEFO bergantung pada tanggal sistem). Keduanya diperbaiki.
- Commit 81059188: lint berhasil; 166 dari 167 unit tests lulus. Satu test void/FEFO gagal karena lot fixture sudah expired pada tanggal runner; tanggal fixture diperbaiki menjadi valid untuk tanggal pengujian.
- Commit ef497310: lint, 167 unit tests, production build, dan Docker image build berhasil. Uji Chromium untuk restore masih berjalan pada saat pemeriksaan.
- Perubahan lanjutan setelah ef497310 memperketat pencocokan pelanggan duplikat dan dokumentasi batas keamanan; CI untuk head terbaru harus selesai sebelum status akhir dapat dinyatakan hijau.
- Jangan merge PR #10 sampai CI head terbaru hijau dan blocker server-side Sales/offline grant diselesaikan atau diputuskan eksplisit oleh Owner.

**Kesimpulan:** restore sudah memiliki jalur transaksional dan verifikasi yang lebih lengkap, sedangkan RBAC lokal/UI/data sudah diperketat. Namun RBAC end-to-end lintas perangkat dan offline belum selesai. ERP DAGING tetap **BELUM PRODUCTION READY**.


### 13.49 Aturan pelanggan bersama UMUM untuk Sales — 2026-11-17

Keputusan operasional yang diterapkan pada PR #10:
- Pelanggan sistem `UMUM` bersifat bersama dan tampil pada proyeksi pelanggan semua Sales; pelanggan bernama lain tetap dibatasi berdasarkan `assignedSalesId`.
- Sales hanya boleh membuat transaksi UMUM dengan pembayaran `CASH` atau `TRANSFER` langsung. `TEMPO` dan `MIX` ditolak oleh UI sebelum checkout dan divalidasi ulang oleh Business Engine/local event policy.
- Setiap transaksi UMUM tetap menyimpan `salesId` dari session terverifikasi. Proyeksi Sales hanya menampilkan transaksi UMUM yang `salesId`-nya sama dengan Sales aktif; transaksi Sales lain tidak ikut tampil.
- Retur UMUM hanya dapat dilakukan oleh Sales yang `salesId`-nya sama dengan Sales pada faktur asal. Batas nominal Sales tetap mengikuti aturan retur yang ada.
- UMUM tidak menjadi pelanggan piutang untuk Sales; projection tidak membuka receivable UMUM sebagai piutang Sales.

**Batas verifikasi:** aturan ini sudah diterapkan pada UI checkout, Business Engine, local role policy, dan test unit yang ditambahkan. Sales push/pull/media tetap fail-closed di gateway sampai server memiliki data assignment dan projection otoritatif; jangan menganggap sinkronisasi Sales sudah aktif. Proyeksi UI juga belum sama dengan isolasi data at-rest karena state lengkap masih ada di IndexedDB perangkat. CI pada head terbaru wajib diperiksa sebelum menyatakan test lulus.


**Tambahan implementasi 13.49:** pelanggan sistem `CUST_UMUM` / kode `UMUM` sekarang ikut seed PWA dan ditambahkan satu kali saat normalisasi store lama yang belum memilikinya. Record UMUM default memakai tier RETAIL, plafon dan saldo piutang nol, tanpa term tempo. Record UMUM yang sudah ada tidak ditimpa atau digandakan.

**Catatan kompatibilitas:** record UMUM lama tetap diperlakukan sebagai pelanggan bersama meskipun memiliki `assignedSalesId` historis; assignment lama tidak boleh membuat UMUM terkunci untuk satu Sales. Kepemilikan transaksi tetap ditentukan oleh `salesId` pada faktur, bukan assignment pelanggan UMUM.
