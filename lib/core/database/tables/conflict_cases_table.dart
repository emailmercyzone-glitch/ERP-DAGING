import 'package:drift/drift.dart';

/// MOD-15: Conflict Cases Table (Isolasi Transaksi Minus Offline)
/// Menutup Gap P04 & D7: Menjaga tabel transaksi & ledger tetap murni tanpa merusak immutabilitas
@DataClassName('ConflictCaseEntry')
class ConflictCasesTable extends Table {
  @override
  String get tableName => 'conflict_cases';

  TextColumn get id => text()(); // UUID v4

  // Referensi Transaksi Asal & Perangkat Sales Pengirim
  TextColumn get transactionId => text()(); // FK ke transactions.id
  TextColumn get invoiceNumber => text()();
  TextColumn get salesUserId => text()();
  TextColumn get deviceId => text()();

  // Detail Item yang Mengalami Bentrok Stok
  TextColumn get productId => text()();
  TextColumn get lotId => text()();
  IntColumn get requestedGram => integer()();
  IntColumn get availableGramAtSync => integer()();
  IntColumn get deficitGram => integer()(); // requestedGram - availableGramAtSync

  // Status Resolusi oleh Owner (MOD-15):
  // PENDING           : Menunggu tinjauan Owner
  // APPROVED_FORCE    : Owner menyetujui transaksi (misal ada stok fisik belum diinput)
  // ALLOCATED_NEW_LOT : Dialokasikan ke lot pengganti yang masih punya stok
  // REJECTED_VOID     : Dibatalkan / Void oleh Owner
  TextColumn get resolutionStatus => text().withDefault(const Constant('PENDING'))();
  TextColumn get replacementLotId => text().nullable()();
  TextColumn get resolutionNotes => text().nullable()();
  TextColumn get resolvedByUserId => text().nullable()(); // Harus Owner
  DateTimeColumn get resolvedAt => dateTime().nullable()();

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
