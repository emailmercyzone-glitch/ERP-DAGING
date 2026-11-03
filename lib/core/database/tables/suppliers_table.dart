import 'package:drift/drift.dart';

/// MOD-09: Suppliers Table (Supplier Daging Impor / Lokal)
@DataClassName('SupplierEntry')
class SuppliersTable extends Table {
  @override
  String get tableName => 'suppliers';

  TextColumn get id => text()(); // UUID v4
  TextColumn get supplierCode => text().unique()(); // misal SUP-AUS-01
  TextColumn get name => text().withLength(min: 2, max: 150)();
  TextColumn get countryOrigin => text().nullable()(); // Australia, USA, Brazil, etc.
  TextColumn get contactPerson => text().nullable()();
  TextColumn get phone => text().nullable()();
  TextColumn get email => text().nullable()();
  TextColumn get address => text().nullable()();

  // Utang Usaha Berjalan (AP - Rupiah Utuh)
  Int64Column get currentPayableRupiah => int64().withDefault(const Constant(0))();
  IntColumn get defaultPaymentTermDays => integer().withDefault(const Constant(30))();

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get deletedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
