import 'package:drift/drift.dart';

/// MOD-07: Lots Table (Batch Daging Impor, NKV, FEFO, & Landed Cost)
/// Memastikan pengeluaran stok otomatis First Expired First Out
@DataClassName('LotEntry')
class LotsTable extends Table {
  @override
  String get tableName => 'lots';

  TextColumn get id => text()(); // UUID v4
  TextColumn get productId => text()(); // FK ke products.id
  TextColumn get supplierId => text().nullable()(); // FK ke suppliers.id
  
  // Nomor Batch / Lot Kontainer Impor
  TextColumn get lotCode => text()();

  // Karantina & Nomor Kontrol Veteriner (NKV)
  TextColumn get nkvNumber => text().nullable()();
  
  // Tanggal Potong (Slaughter) & Tanggal Kedaluwarsa (Kunci Sorting FEFO)
  DateTimeColumn get slaughterDate => dateTime().nullable()();
  DateTimeColumn get expiryDate => dateTime()();

  // Kuantitas Stok Lot (Zero Float - Gram Utuh)
  IntColumn get initialWeightGram => integer()();
  IntColumn get currentWeightGram => integer()();
  IntColumn get currentPcs => integer().nullable()();

  // HPP & Landed Cost Terhitung (Rupiah Utuh)
  // hppPerGramRupiah = (Harga Beli PO + Landed Cost Alokasi) / Total Gram Aktual
  Int64Column get hppPerGramRupiah => int64()();
  Int64Column get totalLandedCostRupiah => int64().withDefault(const Constant(0))();

  // Lokasi Fisik di Cold Storage (misal FREEZER-A-01)
  TextColumn get storageLocation => text().withDefault(const Constant('COLD_STORAGE_UTAMA'))();

  // MOD-07B: Karantina & Status Mutu
  BoolColumn get isQuarantined => boolean().withDefault(const Constant(false))();
  TextColumn get quarantineReason => text().nullable()();

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
