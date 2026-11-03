import 'package:drift/drift.dart';

/// MOD-07 / PROTOKOL SINKRONISASI: Sync Queue Table (Offline-to-Cloud Event Sync)
/// Menutup Gap P05 & D4: Idempotensi, Server Sequence, dan ACK Handshake
@DataClassName('SyncQueueEntry')
class SyncQueueTable extends Table {
  @override
  String get tableName => 'sync_queue';

  TextColumn get id => text()(); // UUID v4 (Queue Item ID)

  // Nama Tabel Target di Supabase (misal transactions, stock_ledger, customers)
  TextColumn get targetTable => text()();
  TextColumn get recordId => text()(); // ID baris lokal yang disinkronkan

  // Aksi Operasi: INSERT (kebanyakan event), UPDATE (master data), SOFT_DELETE
  TextColumn get operationType => text().withLength(min: 3, max: 20)();

  // Payload Lengkap dalam Format JSON String
  TextColumn get payloadJson => text()();

  // Status Sinkronisasi: PENDING, SYNCING, DONE, FAILED
  TextColumn get status => text().withDefault(const Constant('PENDING'))();

  // Nomor Urut Resmi dari Supabase setelah ACK diterima
  IntColumn get serverSeq => integer().nullable()();

  // Jumlah Percobaan & Error Terakhir
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();

  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get syncedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

/// MOD-20: Media Queue Table (Antrean Upload Foto Bukti Retur & Kwitansi OPEX)
/// Foto wajib terkompresi lokal max 720p (< 300 KB) sebelum masuk antrean
@DataClassName('MediaQueueEntry')
class MediaQueueTable extends Table {
  @override
  String get tableName => 'media_queue';

  TextColumn get id => text()(); // UUID v4

  // Tipe Media: RETURN_PROOF, OPEX_RECEIPT, GOODS_RECEIPT_PROOF
  TextColumn get mediaType => text()();
  TextColumn get referenceId => text()(); // FK ke return_id atau opex_id

  // Path File Lokal di Perangkat
  TextColumn get localFilePath => text()();
  IntColumn get fileSizeBytes => integer()(); // Wajib < 307200 (300 KB)

  // URL Cloud Storage Supabase setelah terunggah
  TextColumn get remoteStorageUrl => text().nullable()();

  // Status: PENDING, UPLOADING, DONE, FAILED
  TextColumn get status => text().withDefault(const Constant('PENDING'))();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();

  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get uploadedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
