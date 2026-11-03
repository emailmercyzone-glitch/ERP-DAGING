import 'package:drift/drift.dart';

/// MOD-05 & Bagian 5: Product Commissions (Skema Komisi Sales & Affiliate)
@DataClassName('ProductCommissionEntry')
class ProductCommissionsTable extends Table {
  @override
  String get tableName => 'product_commissions';

  TextColumn get id => text()(); // UUID v4
  TextColumn get productId => text()(); // FK ke products.id
  TextColumn get salesUserId => text().nullable()(); // Nullable jika berlaku global

  // Tipe Skema Komisi: PERSEN, NOMINAL_PER_KG, NOMINAL_PER_PCS
  TextColumn get commissionType => text()();

  // Nilai Komisi:
  // Jika PERSEN: misal 200 = 2.00% (menggunakan basis point integer 100 = 1%)
  // Jika NOMINAL_PER_KG: misal 2000 = Rp 2.000/kg (Rupiah utuh)
  // Jika NOMINAL_PER_PCS: misal 500 = Rp 500/pcs (Rupiah utuh)
  Int64Column get commissionRate => int64()();

  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();

  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// MOD-08: Credit Notes Table (Kompensasi Retur Mutu Daging / Refund)
/// Diterbitkan saat retur divalidasi dengan bukti foto MOD-20
@DataClassName('CreditNoteEntry')
class CreditNotesTable extends Table {
  @override
  String get tableName => 'credit_notes';

  TextColumn get id => text()(); // UUID v4
  TextColumn get creditNoteNumber => text().unique()(); // CN-2026-001
  TextColumn get transactionId => text()(); // FK ke transactions.id asal
  TextColumn get customerId => text()();

  // Nilai Kompensasi / Pengurang Tagihan (Zero Float - Rupiah Utuh)
  Int64Column get amountRupiah => int64()();

  // Alasan Retur: DEFECT_MUTU, TIMBANGAN_SELISIH, SALAH_KIRIM, KADALUWARSA
  TextColumn get returnReason => text()();
  TextColumn get photoProofQueueId => text().nullable()(); // FK ke media_queue.id

  // Status: ISSUED, APPLIED_TO_INVOICE, REFUNDED_CASH
  TextColumn get status => text().withDefault(const Constant('ISSUED'))();

  TextColumn get issuedByUserId => text()();
  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();

  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
