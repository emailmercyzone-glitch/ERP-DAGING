import 'package:drift/drift.dart';

/// MOD-07 & KEPUTUSAN UTAMA: Stock Ledger Table (Event Sourcing Immutable Ledger)
/// Dilarang keras melakukan UPDATE atau DELETE pada baris event yang sudah tercatat.
@DataClassName('StockLedgerEntry')
class StockLedgerTable extends Table {
  @override
  String get tableName => 'stock_ledger';

  TextColumn get id => text()(); // UUID v4 (Event ID)

  // Relasi Produk & Batch Lot Spesifik
  TextColumn get productId => text()(); // FK ke products.id
  TextColumn get lotId => text()(); // FK ke lots.id

  // Tipe Pergerakan Append-Only:
  // IN_PURCHASE       : Penerimaan barang impor dari supplier
  // OUT_SALE          : Penjualan ke pelanggan (POS / Sales)
  // IN_RETURN_SALE    : Retur masuk dari pelanggan ke karantina
  // OUT_RETURN_SUPP   : Retur keluar ke supplier
  // OUT_CONVERSION    : Pengeluaran potongan primal (misal Trimming 10kg)
  // IN_CONVERSION     : Hasil konversi masuk (misal Tetelan/Cincang 8.5kg)
  // OUT_CUTTING_LOSS  : Susut pemotongan/lemak tak bernilai (Yield Loss 1.5kg)
  // OUT_DRIP_LOSS     : Susut berat thawing/air daging beku
  // OUT_QUARANTINE    : Pemindahan ke area karantina cacat mutu
  // IN_OPENING_BAL    : Stok awal saat Go-Live
  // ADJ_OPNAME_PLUS   : Penyesuaian fisik opname lebih
  // ADJ_OPNAME_MINUS  : Penyesuaian fisik opname kurang
  TextColumn get movementType => text()();

  // Kuantitas Pergerakan (Selalu Positif, Arah Gerak Ditentukan oleh movementType)
  IntColumn get weightGram => integer()();
  IntColumn get pcs => integer().nullable()();

  // Saldo Berjalan (Running Balance) Setelah Event Ini Terjadi
  IntColumn get runningBalanceGram => integer()();

  // Dokumen Referensi (misal Invoice No, GR No, Retur No, Opname ID)
  TextColumn get referenceNumber => text()();
  TextColumn get referenceType => text()(); // INVOICE, GOODS_RECEIPT, CONVERSION, OPNAME, RETURN

  // Nilai HPP Per Gram Tercatat saat Peristiwa Terjadi
  Int64Column get hppPerGramRupiah => int64()();

  // Audit Aktor & Device
  TextColumn get performedByUserId => text()();
  TextColumn get deviceId => text()();
  TextColumn get notes => text().nullable()();

  // Server Sequence dari Supabase (ACK)
  IntColumn get serverSeq => integer().nullable()();

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// MOD-07: Stock Summary Table (Materialized Cache Stok Real-Time <50ms)
/// Menyimpan saldo agregat cepat per Lot & per Produk
@DataClassName('StockSummaryEntry')
class StockSummaryTable extends Table {
  @override
  String get tableName => 'stock_summary';

  TextColumn get id => text()(); // Composite / UUID: {productId}_{lotId}
  TextColumn get productId => text()();
  TextColumn get lotId => text()();

  // Total Berat Tersedia Siap Jual (Gram Utuh)
  IntColumn get availableWeightGram => integer().withDefault(const Constant(0))();
  IntColumn get reservedWeightGram => integer().withDefault(const Constant(0))(); // Sedang diproses kirim
  IntColumn get quarantinedWeightGram => integer().withDefault(const Constant(0))(); // Karantina mutu

  // HPP rata-rata berjalan (Rupiah per gram)
  Int64Column get avgHppPerGramRupiah => int64().withDefault(const Constant(0))();

  TextColumn get storeId => text().withDefault(const Constant('TOKO_SAMPORA_01'))();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
