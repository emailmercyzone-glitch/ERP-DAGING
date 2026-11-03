import 'package:drift/drift.dart';

/// MOD-09 & BR-060: Supplier Invoices (Accounts Payable / Utang Impor)
@DataClassName('SupplierInvoiceEntry')
class SupplierInvoicesTable extends Table {
  @override
  String get tableName => 'supplier_invoices';

  TextColumn get id => text()(); // UUID v4
  TextColumn get invoiceNumber => text().unique()(); // Nomor Faktur Resmi dari Supplier
  TextColumn get supplierId => text()(); // FK ke suppliers.id
  TextColumn get goodsReceiptId => text().nullable()(); // FK ke goods_receipts.id

  DateTimeColumn get invoiceDate => dateTime()();
  DateTimeColumn get dueDate => dateTime()(); // Tanggal Jatuh Tempo Pembayaran

  // Tagihan Finansial (Zero Float - Rupiah Utuh)
  Int64Column get totalAmountRupiah => int64()();
  Int64Column get paidAmountRupiah => int64().withDefault(const Constant(0))();
  Int64Column get remainingAmountRupiah => int64()();

  // Status: UNPAID, PARTIAL, PAID, CANCELLED
  TextColumn get status => text().withDefault(const Constant('UNPAID'))();

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// MOD-09: AP Payments Table (Pencatatan Pembayaran Utang Supplier)
@DataClassName('ApPaymentEntry')
class ApPaymentsTable extends Table {
  @override
  String get tableName => 'ap_payments';

  TextColumn get id => text()(); // UUID v4
  TextColumn get paymentNumber => text().unique()(); // PAY-AP-2026-001
  TextColumn get invoiceId => text()(); // FK ke supplier_invoices.id
  TextColumn get supplierId => text()();

  DateTimeColumn get paymentDate => dateTime()();
  Int64Column get amountPaidRupiah => int64()();

  // Metode: CASH, BANK_TRANSFER, GIRO
  TextColumn get paymentMethod => text()();
  TextColumn get bankReference => text().nullable()();
  TextColumn get proofPhotoUrl => text().nullable()();

  TextColumn get recordedByUserId => text()();
  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
