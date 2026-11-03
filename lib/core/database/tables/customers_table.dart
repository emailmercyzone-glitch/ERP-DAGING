import 'package:drift/drift.dart';

/// MOD-06: Customers Table
/// Mengelola CRM, Plafon Piutang Fleksibel, Jatuh Tempo, dan Tier Harga Pelanggan
@DataClassName('CustomerEntry')
class CustomersTable extends Table {
  @override
  String get tableName => 'customers';

  TextColumn get id => text()(); // UUID v4
  TextColumn get customerCode => text().unique()(); // misal CUST-0001
  TextColumn get name => text().withLength(min: 2, max: 150)();
  TextColumn get phone => text().nullable()();
  TextColumn get address => text().nullable()();

  // Tier Harga Relasi (Grosir Horeka, Retail, Resto)
  TextColumn get tierId => text().nullable()();

  // Aturan Piutang & Plafon (Zero Float - Rupiah Utuh)
  Int64Column get creditLimitRupiah => int64().withDefault(const Constant(0))();
  Int64Column get currentReceivableRupiah => int64().withDefault(const Constant(0))();
  IntColumn get paymentTermDays => integer().withDefault(const Constant(0))(); // 0 = Cash/COD

  // Toko Identifier
  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();

  // Status & Audit
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get deletedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
