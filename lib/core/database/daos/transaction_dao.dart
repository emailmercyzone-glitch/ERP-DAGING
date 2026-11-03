import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/transactions_table.dart';
import '../tables/conflict_cases_table.dart';

/// DAO untuk Transaksi POS Kasir Toko & Sales Lapangan
/// Menutup Gap P01, P03, P04, D6, D7
class TransactionDao {
  final AppDatabase db;

  TransactionDao(this.db);

  /// Menjalankan checkout penjualan secara atomik:
  /// 1. Cek ketersediaan stok lokal (<50ms)
  /// 2. Jika stok minus, tandai isConflict=true & buat record di conflict_cases
  /// 3. Catat transaksi & transaction_items
  /// 4. Catat event OUT_SALE ke stock_ledger secara append-only
  Future<TransactionEntry> createSaleTransaction({
    required String transactionId,
    required String deviceId,
    required String salesMode, // KASIR_TOKO atau SALES_LAPANGAN
    required String customerId,
    required String salesUserId,
    required String paymentMethod,
    required BigInt subtotalRupiah,
    required BigInt discountRupiah,
    required BigInt shippingFeeRupiah,
    required bool isFreeShippingStrikethrough,
    required BigInt grandTotalRupiah,
    required BigInt paidAmountRupiah,
    required BigInt changeRupiah,
    required BigInt balanceDueRupiah,
    DateTime? dueDate,
    String? shippingAddress,
    String? notes,
    required List<SaleItemParam> items,
  }) async {
    final now = DateTime.now();
    final invoiceNumber = await db.generateNextInvoiceNumber(deviceId: deviceId, date: now);
    bool hasStockConflict = false;

    await db.transaction(() async {
      // 1. Validasi stok setiap item
      for (final item in items) {
        final summary = await (db.select(db.stockSummaryTable)
              ..where((tbl) => tbl.lotId.equals(item.lotId)))
            .getSingleOrNull();

        final availableGram = summary?.availableWeightGram ?? 0;
        if (availableGram < item.weightGram) {
          hasStockConflict = true;

          // Catat ke tabel terpisah conflict_cases (Menjaga immutabilitas transaksi)
          await db.into(db.conflictCasesTable).insert(
            ConflictCasesCompanion.insert(
              id: 'CONF_${item.lotId}_${DateTime.now().millisecondsSinceEpoch}',
              transactionId: transactionId,
              invoiceNumber: invoiceNumber,
              salesUserId: salesUserId,
              deviceId: deviceId,
              productId: item.productId,
              lotId: item.lotId,
              requestedGram: item.weightGram,
              availableGramAtSync: availableGram,
              deficitGram: item.weightGram - availableGram,
              createdAt: Value(now),
            ),
          );
        }
      }

      // 2. Insert Transaksi
      await db.into(db.transactionsTable).insert(
        TransactionsCompanion.insert(
          id: transactionId,
          invoiceNumber: invoiceNumber,
          deviceId: deviceId,
          salesMode: Value(salesMode),
          customerId: customerId,
          salesUserId: salesUserId,
          transactionDate: now,
          dueDate: Value(dueDate),
          subtotalRupiah: subtotalRupiah,
          discountRupiah: Value(discountRupiah),
          shippingFeeRupiah: Value(shippingFeeRupiah),
          isFreeShippingStrikethrough: Value(isFreeShippingStrikethrough),
          grandTotalRupiah: grandTotalRupiah,
          paidAmountRupiah: Value(paidAmountRupiah),
          changeRupiah: Value(changeRupiah),
          balanceDueRupiah: Value(balanceDueRupiah),
          paymentMethod: paymentMethod,
          status: const Value('ISSUED'),
          isConflict: Value(hasStockConflict),
          shippingAddress: Value(shippingAddress),
          notes: Value(notes),
          createdAt: Value(now),
          updatedAt: Value(now),
        ),
      );

      // 3. Insert Transaction Items & Append Stock Ledger
      for (final item in items) {
        final itemId = 'ITEM_${DateTime.now().microsecondsSinceEpoch}';
        await db.into(db.transactionItemsTable).insert(
          TransactionItemsCompanion.insert(
            id: itemId,
            transactionId: transactionId,
            productId: item.productId,
            lotId: item.lotId,
            weightGram: item.weightGram,
            quantityPcs: Value(item.quantityPcs),
            pricePerKgRupiah: item.pricePerKgRupiah,
            subtotalRupiah: item.subtotalRupiah,
            hppPerGramRupiah: item.hppPerGramRupiah,
            createdAt: Value(now),
          ),
        );

        // Catat pengeluaran stok di immutable stock_ledger
        await db.appendStockLedger(
          id: 'LEDGER_SALE_$itemId',
          productId: item.productId,
          lotId: item.lotId,
          movementType: 'OUT_SALE',
          weightGram: item.weightGram,
          pcs: item.quantityPcs,
          referenceNumber: invoiceNumber,
          referenceType: 'INVOICE',
          hppPerGramRupiah: item.hppPerGramRupiah,
          performedByUserId: salesUserId,
          deviceId: deviceId,
          notes: 'Penjualan invoice $invoiceNumber',
        );

        // Kurangi berat lot fisik jika bukan conflict fatal
        final lot = await (db.select(db.lotsTable)..where((tbl) => tbl.id.equals(item.lotId))).getSingle();
        final newLotWeight = lot.currentWeightGram - item.weightGram;
        await (db.update(db.lotsTable)..where((tbl) => tbl.id.equals(item.lotId))).write(
          LotsCompanion(currentWeightGram: Value(newLotWeight < 0 ? 0 : newLotWeight)),
        );
      }

      // 4. Masukkan ke sync_queue untuk background upload
      await db.into(db.syncQueueTable).insert(
        SyncQueueCompanion.insert(
          id: 'SYNC_TX_$transactionId',
          targetTable: 'transactions',
          recordId: transactionId,
          operationType: 'INSERT',
          payloadJson: '{"invoice":"$invoiceNumber","total":$grandTotalRupiah,"conflict":$hasStockConflict}',
          status: const Value('PENDING'),
          createdAt: Value(now),
        ),
      );
    });

    return (db.select(db.transactionsTable)..where((tbl) => tbl.id.equals(transactionId))).getSingle();
  }

  /// BR-VOID: Pembatalan Invoice (Reversal Entry)
  /// Dilarang DELETE! Menerbitkan pembalikan ledger dan status menjadi VOID
  Future<void> voidTransaction({
    required String transactionId,
    required String voidedByUserId,
    required String deviceId,
    required String voidReason,
  }) async {
    final now = DateTime.now();

    await db.transaction(() async {
      final tx = await (db.select(db.transactionsTable)..where((tbl) => tbl.id.equals(transactionId))).getSingle();
      if (tx.status == 'VOID') {
        throw StateError('Transaksi $transactionId sudah berstatus VOID sebelumnya.');
      }

      // 1. Ambil seluruh item transaksi
      final items = await (db.select(db.transactionItemsTable)..where((tbl) => tbl.transactionId.equals(transactionId))).get();

      // 2. Buat Reversal Ledger Entry untuk setiap item (Balikkan stok)
      for (final item in items) {
        await db.appendStockLedger(
          id: 'LEDGER_VOID_${item.id}_${now.millisecondsSinceEpoch}',
          productId: item.productId,
          lotId: item.lotId,
          movementType: 'IN_RETURN_SALE',
          weightGram: item.weightGram,
          pcs: item.quantityPcs,
          referenceNumber: tx.invoiceNumber,
          referenceType: 'INVOICE_VOID',
          hppPerGramRupiah: item.hppPerGramRupiah,
          performedByUserId: voidedByUserId,
          deviceId: deviceId,
          notes: 'Reversal Void: $voidReason',
        );

        // Kembalikan sisa berat pada lot
        final lot = await (db.select(db.lotsTable)..where((tbl) => tbl.id.equals(item.lotId))).getSingle();
        await (db.update(db.lotsTable)..where((tbl) => tbl.id.equals(item.lotId))).write(
          LotsCompanion(currentWeightGram: Value(lot.currentWeightGram + item.weightGram)),
        );
      }

      // 3. Ubah status transaksi menjadi VOID
      await (db.update(db.transactionsTable)..where((tbl) => tbl.id.equals(transactionId))).write(
        TransactionsCompanion(
          status: const Value('VOID'),
          notes: Value('${tx.notes ?? ""} [VOID: $voidReason oleh $voidedByUserId]'),
          updatedAt: Value(now),
        ),
      );

      // 4. Catat Audit Log
      await db.into(db.auditLogsTable).insert(
        AuditLogsCompanion.insert(
          id: 'AUDIT_${now.millisecondsSinceEpoch}',
          action: 'VOID_TRANSACTION',
          actorUserId: voidedByUserId,
          deviceId: deviceId,
          detailsJson: '{"invoice":"${tx.invoiceNumber}","reason":"$voidReason"}',
          timestamp: Value(now),
        ),
      );
    });
  }
}

/// Parameter DTO untuk pembuatan item checkout
class SaleItemParam {
  final String productId;
  final String lotId;
  final int weightGram;
  final int? quantityPcs;
  final BigInt pricePerKgRupiah;
  final BigInt subtotalRupiah;
  final BigInt hppPerGramRupiah;

  SaleItemParam({
    required this.productId,
    required this.lotId,
    required this.weightGram,
    this.quantityPcs,
    required this.pricePerKgRupiah,
    required this.subtotalRupiah,
    required this.hppPerGramRupiah,
  });
}
