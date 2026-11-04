import 'package:drift/drift.dart';

// Import seluruh modul tabel modular
import 'tables/users_table.dart';
import 'tables/customers_table.dart';
import 'tables/suppliers_table.dart';
import 'tables/products_table.dart';
import 'tables/lots_table.dart';
import 'tables/purchase_orders_table.dart';
import 'tables/supplier_invoices_table.dart';
import 'tables/customer_tiers_table.dart';
import 'tables/transactions_table.dart';
import 'tables/stock_ledger_table.dart';
import 'tables/conflict_cases_table.dart';
import 'tables/sync_queue_table.dart';
import 'tables/sync_outbox_table.dart';
import 'tables/product_commissions_table.dart';
import 'tables/cash_settlements_table.dart';

// Drift part file hasil generasi build_runner
part 'app_database.g.dart';

/// ============================================================================
/// BLUEPRINT SOLID ERP DAGING IMPORT V4.3 - PRODUCTION READY
/// Single Source of Truth Database: Drift SQLite + SQLCipher
/// 
/// Prinsip Arsitektur Utama:
/// 1. Zero Float: Gram Utuh (INTEGER) & Rupiah Utuh (BIGINT)
/// 2. Event Sourcing Immutable Ledger (stock_ledger append-only)
/// 3. Offline is King: Validasi transaksi lokal <50ms
/// 4. UUID Everywhere untuk identitas global antar HP
/// 5. Pemisahan Transaksi Bentrok ke conflict_cases (Menjaga Immutabilitas Event)
/// 6. Sync Outbox Pattern: Mutated state JSON payload dengan status PENDING, SYNCED, FAILED
/// ============================================================================
@DriftDatabase(
  tables: [
    UsersTable,
    CustomersTable,
    SuppliersTable,
    ProductsTable,
    LotsTable,
    PurchaseOrdersTable,
    GoodsReceiptsTable,
    SupplierInvoicesTable,
    ApPaymentsTable,
    CustomerTiersTable,
    ProductPricesTable,
    TransactionsTable,
    TransactionItemsTable,
    StockLedgerTable,
    StockSummaryTable,
    ConflictCasesTable,
    SyncQueueTable,
    SyncOutboxTable,
    MediaQueueTable,
    ProductCommissionsTable,
    CreditNotesTable,
    CashSettlementsTable,
    PettyCashOpexTable,
    AuditLogsTable,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(QueryExecutor e) : super(e);

  // Konstruktor default untuk inisialisasi aplikasi
  AppDatabase.defaults() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (Migrator m) async {
          // Buat seluruh 24 tabel secara terstruktur
          await m.createAll();

          // Native SQLite triggers untuk menjamin immutabilitas stock_ledger (Sesuai Spesifikasi Rule 2)
          await customStatement('''
            CREATE TRIGGER IF NOT EXISTS prevent_stock_ledger_update
            BEFORE UPDATE ON stock_ledger
            BEGIN
              SELECT RAISE(ABORT, 'Illegal operation: stock_ledger is immutable.');
            END;
          ''');

          await customStatement('''
            CREATE TRIGGER IF NOT EXISTS prevent_stock_ledger_delete
            BEFORE DELETE ON stock_ledger
            BEGIN
              SELECT RAISE(ABORT, 'Illegal operation: stock_ledger is immutable.');
            END;
          ''');
        },
        beforeOpen: (details) async {
          // Aktifkan relasi Foreign Keys di SQLite
          await customStatement('PRAGMA foreign_keys = ON;');
          // Optimasi performa baca dan tulis untuk transaksi cepat <50ms
          await customStatement('PRAGMA journal_mode = WAL;');
          await customStatement('PRAGMA synchronous = NORMAL;');

          // Pastikan triggers immutabilitas aktif di sesi database yang dibuka
          await customStatement('''
            CREATE TRIGGER IF NOT EXISTS prevent_stock_ledger_update
            BEFORE UPDATE ON stock_ledger
            BEGIN
              SELECT RAISE(ABORT, 'Illegal operation: stock_ledger is immutable.');
            END;
          ''');

          await customStatement('''
            CREATE TRIGGER IF NOT EXISTS prevent_stock_ledger_delete
            BEFORE DELETE ON stock_ledger
            BEGIN
              SELECT RAISE(ABORT, 'Illegal operation: stock_ledger is immutable.');
            END;
          ''');
        },
      );

  // ===========================================================================
  // ATOMIC BUSINESS LOGIC & LEDGER ENGINE (BR-SERIES)
  // ===========================================================================

  /// Mencatat event mutasi stok secara APPEND-ONLY ke stock_ledger
  /// Dilarang melakukan update pada row ledger sebelumnya!
  Future<void> appendStockLedger({
    required String id,
    required String productId,
    required String lotId,
    required String movementType,
    required int weightGram,
    int? pcs,
    required String referenceNumber,
    required String referenceType,
    required BigInt hppPerGramRupiah,
    required String performedByUserId,
    required String deviceId,
    String? notes,
    String storeId = 'TOKO_SAMPORA_01',
  }) async {
    await transaction(() async {
      // 1. Ambil saldo terakhir lot dari stock_summary
      final summary = await (select(stockSummaryTable)
            ..where((t) => t.lotId.equals(lotId)))
          .getSingleOrNull();

      int currentBalance = summary?.availableWeightGram ?? 0;
      int newBalance = currentBalance;

      // Hitung delta arah mutasi
      final isIncoming = movementType.startsWith('IN_') || movementType == 'ADJ_OPNAME_PLUS';
      if (isIncoming) {
        newBalance += weightGram;
      } else {
        newBalance -= weightGram;
      }

      // 2. Tulis baris baru ke immutable stock_ledger
      await into(stockLedgerTable).insert(
        StockLedgerCompanion.insert(
          id: id,
          productId: productId,
          lotId: lotId,
          movementType: movementType,
          weightGram: weightGram,
          pcs: Value(pcs),
          runningBalanceGram: newBalance,
          referenceNumber: referenceNumber,
          referenceType: referenceType,
          hppPerGramRupiah: hppPerGramRupiah,
          performedByUserId: performedByUserId,
          deviceId: deviceId,
          notes: Value(notes),
          storeId: Value(storeId),
          createdAt: Value(DateTime.now()),
        ),
      );

      // 3. Mutakhirkan cache stock_summary atomik
      final summaryId = '${productId}_$lotId';
      await into(stockSummaryTable).insertOnConflictUpdate(
        StockSummaryCompanion.insert(
          id: summaryId,
          productId: productId,
          lotId: lotId,
          availableWeightGram: Value(newBalance),
          avgHppPerGramRupiah: Value(hppPerGramRupiah),
          storeId: Value(storeId),
          updatedAt: Value(DateTime.now()),
        ),
      );
    });
  }

  /// Generator Nomor Invoice Offline Standar: INV-{DEVICE_ID}-{YYMMDD}-{SEQ}
  /// Menjamin tidak akan pernah ada bentrok nomor invoice antar HP Sales
  Future<String> generateNextInvoiceNumber({
    required String deviceId,
    required DateTime date,
  }) async {
    final year = date.year.toString().substring(2);
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    final datePrefix = '$year$month$day';
    final searchPrefix = 'INV-$deviceId-$datePrefix-';

    // Cari sequence terakhir pada hari ini untuk perangkat ini
    final lastInvoice = await (select(transactionsTable)
          ..where((t) => t.invoiceNumber.like('$searchPrefix%'))
          ..orderBy([(t) => OrderingTerm.desc(t.invoiceNumber)])
          ..limit(1))
        .getSingleOrNull();

    int nextSeq = 1;
    if (lastInvoice != null) {
      final parts = lastInvoice.invoiceNumber.split('-');
      if (parts.length >= 4) {
        final currentSeq = int.tryParse(parts.last) ?? 0;
        nextSeq = currentSeq + 1;
      }
    }

    final seqString = nextSeq.toString().padLeft(4, '0');
    return '$searchPrefix$seqString';
  }
}

/// Fallback QueryExecutor dummy untuk lingkungan development / kompilasi
QueryExecutor _openConnection() {
  throw UnimplementedError(
    'Gunakan implementasi koneksi SQLCipher terenkripsi di native_connection.dart',
  );
}
