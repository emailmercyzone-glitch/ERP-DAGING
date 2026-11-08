import 'package:drift/drift.dart';

/// MOD-04: Transactions Table (Penjualan Kasir Toko & Sales Lapangan)
/// Menutup Gap P01, P03, P05, D6
@DataClassName('TransactionEntry')
class TransactionsTable extends Table {
  @override
  String get tableName => 'transactions';

  TextColumn get id => text()(); // UUID v4 (Global Unique)

  // Format Penomoran: INV-{DEVICE_ID}-{YYMMDD}-{SEQ} (BR-040)
  TextColumn get invoiceNumber => text().unique()();
  TextColumn get deviceId => text()(); // ID Unik HP Penginput

  // Mode Transaksi: KASIR_TOKO atau SALES_LAPANGAN
  TextColumn get salesMode => text().withDefault(const Constant('KASIR_TOKO'))();

  // Relasi Pelanggan & Sales Person
  TextColumn get customerId => text()(); // FK ke customers.id
  TextColumn get salesUserId => text()(); // FK ke users.id

  DateTimeColumn get transactionDate => dateTime()();
  DateTimeColumn get dueDate => dateTime().nullable()(); // Tanggal jatuh tempo jika Tempo/Kredit

  // Finansial Penjualan (Zero Float - Rupiah Utuh)
  Int64Column get subtotalRupiah => int64()();
  Int64Column get discountRupiah => int64().withDefault(const Constant(0))();
  Int64Column get shippingFeeRupiah => int64().withDefault(const Constant(0))(); // Ongkir
  BoolColumn get isFreeShippingStrikethrough => boolean().withDefault(const Constant(false))(); // Struk Coret Ongkir
  Int64Column get grandTotalRupiah => int64()();
  Int64Column get paidAmountRupiah => int64().withDefault(const Constant(0))();
  Int64Column get changeRupiah => int64().withDefault(const Constant(0))();
  Int64Column get balanceDueRupiah => int64().withDefault(const Constant(0))();

  // Metode Pembayaran: CASH, TRANSFER, TEMPO, SPLIT
  TextColumn get paymentMethod => text()();
  TextColumn get paymentReference => text().nullable()();

  // Status Siklus: DRAFT, ISSUED, SHIPPED, COMPLETED, VOID
  TextColumn get status => text().withDefault(const Constant('ISSUED'))();

  // Relasi Setoran Kas Sales (MOD-11)
  TextColumn get settlementId => text().nullable()(); // FK ke cash_settlements.id saat disetor sales ke kasir

  // Flag Konflik Stok Minus Offline (Memicu Baris di conflict_cases)
  BoolColumn get isConflict => boolean().withDefault(const Constant(false))();

  // Catatan Pengiriman & Alamat
  TextColumn get shippingAddress => text().nullable()();
  TextColumn get notes => text().nullable()();

  // Identifikasi Toko
  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();

  // Sinkronisasi Server
  IntColumn get serverSeq => integer().nullable()(); // Nomor urut resmi Supabase
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();

  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// MOD-04: Transaction Items Table (Rincian Item Daging per Invoice)
@DataClassName('TransactionItemEntry')
class TransactionItemsTable extends Table {
  @override
  String get tableName => 'transaction_items';

  TextColumn get id => text()(); // UUID v4
  TextColumn get transactionId => text()(); // FK ke transactions.id
  TextColumn get productId => text()(); // FK ke products.id
  TextColumn get lotId => text()(); // FK ke lots.id (FEFO Lot)

  // Berat Aktual Terjual (Zero Float - Gram Utuh)
  IntColumn get weightGram => integer()();
  IntColumn get quantityPcs => integer().nullable()();

  // Harga & HPP per Gram / KG (Rupiah Utuh)
  Int64Column get pricePerKgRupiah => int64()();
  Int64Column get subtotalRupiah => int64()();
  Int64Column get hppPerGramRupiah => int64()(); // Snapshot HPP lot saat transaksi

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
