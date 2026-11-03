import 'package:drift/drift.dart';

/// MOD-03: Products Table (Master Produk & Dual-Unit Daging)
/// Menangani penjualan berbasis Berat (Catch Weight) dan Satuan Kemasan (Pcs/Box)
@DataClassName('ProductEntry')
class ProductsTable extends Table {
  @override
  String get tableName => 'products';

  TextColumn get id => text()(); // UUID v4
  TextColumn get sku => text().unique()(); // misal SKU-RIBEYE-AUS-01
  TextColumn get name => text().withLength(min: 2, max: 200)();
  
  // Kategori: PRIMAL_CUT, SECONDARY_CUT, TETELAN_OFFAL, PROCESSED, AFFILIATE
  TextColumn get category => text()();

  // Unit Dasar Penjualan & Inventori: GRAM (utama)
  // Unit Tampilan: KG, PCS, BOX
  TextColumn get primaryUnit => text().withDefault(const Constant('KG'))();
  TextColumn get secondaryUnit => text().nullable()(); // misal PCS
  
  // Rasio Konversi gram per pcs estimasi (misal 1 pcs = 250 gram)
  IntColumn get defaultGramPerPcs => integer().nullable()();

  // Catch Weight Flag (Apakah berat aktual ditimbang saat checkout)
  BoolColumn get isCatchWeight => boolean().withDefault(const Constant(true))();

  // Batas Minimum Stok Alert (dalam Gram)
  IntColumn get minStockAlertGram => integer().withDefault(const Constant(10000))(); // 10 kg

  // Harga Eceran Dasar (Base Retail Price per KG - Rupiah Utuh)
  Int64Column get basePricePerKgRupiah => int64()();

  // Toko Identifier
  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();

  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get deletedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
