import 'package:drift/drift.dart';

/// MOD-09: Purchase Orders Table (PO Pembelian Daging Impor)
@DataClassName('PurchaseOrderEntry')
class PurchaseOrdersTable extends Table {
  @override
  String get tableName => 'purchase_orders';

  TextColumn get id => text()(); // UUID v4
  TextColumn get poNumber => text().unique()(); // PO-IMP-2026-001
  TextColumn get supplierId => text()(); // FK ke suppliers.id

  DateTimeColumn get orderDate => dateTime()();
  DateTimeColumn get expectedArrivalDate => dateTime().nullable()();

  // Kuantitas yang Dipesan (Gram Utuh & Estimasi Biaya)
  IntColumn get totalOrderedGram => integer()();
  Int64Column get estimatedTotalCostRupiah => int64()();

  // Status: DRAFT, SUBMITTED, PARTIALLY_RECEIVED, FULLY_RECEIVED, CANCELLED
  TextColumn get status => text().withDefault(const Constant('DRAFT'))();

  TextColumn get notes => text().nullable()();
  TextColumn get createdByUserId => text()(); // FK ke users.id
  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();

  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// MOD-09: Goods Receipts Table (Penerimaan Fisik & Selisih Timbangan)
/// Menutup Gap P02: Menangani variansi berat aktual datang vs PO
@DataClassName('GoodsReceiptEntry')
class GoodsReceiptsTable extends Table {
  @override
  String get tableName => 'goods_receipts';

  TextColumn get id => text()(); // UUID v4
  TextColumn get receiptNumber => text().unique()(); // GR-2026-001
  TextColumn get poId => text()(); // FK ke purchase_orders.id
  TextColumn get supplierId => text()();

  DateTimeColumn get receivedDate => dateTime()();

  // Berat Aktual Datang (Gram Utuh)
  IntColumn get totalReceivedGram => integer()();
  // Selisih Gram: totalReceivedGram - totalOrderedGram (bisa minus atau plus)
  IntColumn get varianceGram => integer()();

  // Landed Cost Alokasi Total (Freight, Custom/Bea Masuk, Handling, Cold Storage)
  Int64Column get freightCostRupiah => int64().withDefault(const Constant(0))();
  Int64Column get customsCostRupiah => int64().withDefault(const Constant(0))();
  Int64Column get storageCostRupiah => int64().withDefault(const Constant(0))();
  Int64Column get totalLandedCostRupiah => int64().withDefault(const Constant(0))();

  // Receiver Admin
  TextColumn get receivedByUserId => text()();
  TextColumn get photoProofUrl => text().nullable()();
  TextColumn get notes => text().nullable()();

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
