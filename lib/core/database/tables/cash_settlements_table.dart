import 'package:drift/drift.dart';

/// MOD-11: Cash Settlements Table (Setoran Kas Sales Lapangan)
/// Aturan: Soft Limit Rp 3.000.000 memicu warning Health Score bila belum disetor
@DataClassName('CashSettlementEntry')
class CashSettlementsTable extends Table {
  @override
  String get tableName => 'cash_settlements';

  TextColumn get id => text()(); // UUID v4
  TextColumn get settlementNumber => text().unique()(); // SETTLE-2026-001
  TextColumn get salesUserId => text()(); // FK ke users.id

  DateTimeColumn get settlementDate => dateTime()();

  // Jumlah Kas yang Disetorkan (Rupiah Utuh)
  Int64Column get totalCashCollectedRupiah => int64()();
  Int64Column get actualDepositedRupiah => int64()();
  Int64Column get varianceRupiah => int64().withDefault(const Constant(0))(); // Selisih

  // Verifikasi oleh Kasir Toko / Owner
  TextColumn get receivedByUserId => text()();
  TextColumn get depositMethod => text()(); // TUNAI_FISIK, SETOR_TUNAI_ATM, TRANSFER
  TextColumn get proofPhotoQueueId => text().nullable()(); // FK ke media_queue.id
  TextColumn get notes => text().nullable()();

  // Status: SUBMITTED, VERIFIED, DISCREPANCY
  TextColumn get status => text().withDefault(const Constant('VERIFIED'))();

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// MOD-12: Petty Cash & OPEX (Pengeluaran Operasional Kecil)
/// Es balok, garam/plastik vakum, bensin kurir, dsb. Wajib foto struk terkompresi.
@DataClassName('PettyCashOpexEntry')
class PettyCashOpexTable extends Table {
  @override
  String get tableName => 'petty_cash_opex';

  TextColumn get id => text()(); // UUID v4
  TextColumn get voucherNumber => text().unique()(); // OPEX-2026-001
  
  // Kategori OPEX: ES_PACKING, BENSIN_PENGIRIMAN, LISTRIK_COLDSTORAGE, PLASTIK_VAKUM, MAKAN_KARYAWAN, LAINNYA
  TextColumn get category => text()();
  TextColumn get description => text()();

  // Nominal Biaya (Rupiah Utuh)
  Int64Column get amountRupiah => int64()();

  DateTimeColumn get expenseDate => dateTime()();
  TextColumn get paidByUserId => text()();
  TextColumn get receiptPhotoQueueId => text().nullable()(); // FK ke media_queue.id

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// MOD-18: Audit Trail Logs (Pencatatan Event Sensitif Sistem)
@DataClassName('AuditLogEntry')
class AuditLogsTable extends Table {
  @override
  String get tableName => 'audit_logs';

  TextColumn get id => text()(); // UUID v4
  TextColumn get action => text()(); // LOGIN, VOID_TRANSACTION, CONFLICT_RESOLUTION, OPNAME_COMMIT, PRICE_OVERRIDE
  TextColumn get actorUserId => text()();
  TextColumn get deviceId => text()();
  TextColumn get detailsJson => text()();
  DateTimeColumn get timestamp => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
