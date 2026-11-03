import 'package:drift/drift.dart';

/// MOD-05: Customer Tiers (Klasifikasi Level Pelanggan: Horeka, Reseller, Eceran)
@DataClassName('CustomerTierEntry')
class CustomerTiersTable extends Table {
  @override
  String get tableName => 'customer_tiers';

  TextColumn get id => text()(); // UUID v4
  TextColumn get tierCode => text().unique()(); // TIER-HOREKA, TIER-RESELLER, TIER-RETAIL
  TextColumn get name => text().withLength(min: 2, max: 100)();
  TextColumn get description => text().nullable()();

  // Urutan Prioritas
  IntColumn get priorityLevel => integer().withDefault(const Constant(1))();

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// MOD-05: Product Prices (Harga Khusus per Tier & Event Promo/Bazar Berjadwal)
@DataClassName('ProductPriceEntry')
class ProductPricesTable extends Table {
  @override
  String get tableName => 'product_prices';

  TextColumn get id => text()(); // UUID v4
  TextColumn get productId => text()(); // FK ke products.id
  TextColumn get tierId => text().nullable()(); // Nullable jika berlaku untuk promo umum

  // Harga Jual per KG (Zero Float - Rupiah Utuh)
  Int64Column get pricePerKgRupiah => int64()();

  // Minimal Pembelian Berat (dalam Gram, misal >= 20.000 gram / 20 kg)
  IntColumn get minWeightGram => integer().withDefault(const Constant(0))();

  // Event Promo / Bazar Berjadwal (Optional)
  BoolColumn get isPromoBazar => boolean().withDefault(const Constant(false))();
  DateTimeColumn get promoStartDate => dateTime().nullable()();
  DateTimeColumn get promoEndDate => dateTime().nullable()();

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
