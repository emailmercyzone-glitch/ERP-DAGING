import 'dart:convert';
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

    // === VALIDASI TRANSAKSI LENGKAP (Item 9) ===
    // 1. Validasi Kuantitas & Item
    if (items.isEmpty) {
      throw ArgumentError('Validasi Gagal: Transaksi harus memiliki minimal 1 item.');
    }
    for (final item in items) {
      if (item.weightGram <= 0) {
        throw ArgumentError('Validasi Gagal: Berat item ${item.productId} harus lebih dari 0 gram (ditemukan: ${item.weightGram}g).');
      }
      if (item.quantityPcs != null && item.quantityPcs! < 0) {
        throw ArgumentError('Validasi Gagal: Kuantitas pcs tidak boleh bernilai negatif.');
      }
      // 2. Validasi Harga
      if (item.pricePerKgRupiah <= BigInt.zero) {
        throw ArgumentError('Validasi Gagal: Harga jual per KG item ${item.productId} harus lebih dari Rp 0.');
      }
      if (item.subtotalRupiah <= BigInt.zero) {
        throw ArgumentError('Validasi Gagal: Subtotal item ${item.productId} harus lebih dari Rp 0.');
      }
    }

    if (subtotalRupiah <= BigInt.zero) {
      throw ArgumentError('Validasi Gagal: Subtotal transaksi harus lebih dari Rp 0.');
    }
    if (grandTotalRupiah < BigInt.zero) {
      throw ArgumentError('Validasi Gagal: Grand total transaksi tidak boleh bernilai negatif.');
    }

    // 3. Validasi Pembayaran
    if (paymentMethod == 'CASH') {
      if (paidAmountRupiah < grandTotalRupiah) {
        throw ArgumentError('Validasi Gagal: Uang tunai diterima ($paidAmountRupiah) kurang dari total tagihan ($grandTotalRupiah).');
      }
      final expectedChange = paidAmountRupiah - grandTotalRupiah;
      if (changeRupiah != expectedChange) {
        throw ArgumentError('Validasi Gagal: Perhitungan uang kembalian tidak sesuai ($changeRupiah != $expectedChange).');
      }
    } else if (paymentMethod == 'TEMPO') {
      if (balanceDueRupiah <= BigInt.zero) {
        throw ArgumentError('Validasi Gagal: Transaksi TEMPO wajib memiliki sisa tagihan piutang (balance due > 0).');
      }
      final expectedBalanceDue = grandTotalRupiah - paidAmountRupiah;
      if (balanceDueRupiah != expectedBalanceDue) {
        throw ArgumentError('Validasi Gagal: Sisa tagihan piutang ($balanceDueRupiah) tidak sesuai ($expectedBalanceDue).');
      }
    }

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

      // 4. Masukkan ke sync_outbox (Local-First Outbox Pattern, status PENDING)
      final salePayloadJson = jsonEncode({
        'transactionId': transactionId,
        'invoiceNumber': invoiceNumber,
        'deviceId': deviceId,
        'salesMode': salesMode,
        'customerId': customerId,
        'salesUserId': salesUserId,
        'paymentMethod': paymentMethod,
        'grandTotalRupiah': grandTotalRupiah.toString(),
        'paidAmountRupiah': paidAmountRupiah.toString(),
        'changeRupiah': changeRupiah.toString(),
        'balanceDueRupiah': balanceDueRupiah.toString(),
        'isConflict': hasStockConflict,
        'itemsCount': items.length,
        'createdAt': now.toIso8601String(),
      });

      await db.into(db.syncOutboxTable).insert(
        SyncOutboxCompanion.insert(
          id: 'OUTBOX_TX_$transactionId',
          targetTable: 'transactions',
          recordId: transactionId,
          mutationType: 'INSERT',
          payload: salePayloadJson,
          status: const Value('PENDING'),
          createdAt: Value(now),
        ),
      );

      await db.into(db.syncQueueTable).insert(
        SyncQueueCompanion.insert(
          id: 'SYNC_TX_$transactionId',
          targetTable: 'transactions',
          recordId: transactionId,
          operationType: 'INSERT',
          payloadJson: salePayloadJson,
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

      // 3. Reversal Piutang Pelanggan (Jika Transaksi TEMPO / Ada Sisa Piutang)
      if (tx.balanceDueRupiah > BigInt.zero) {
        final cust = await (db.select(db.customersTable)..where((tbl) => tbl.id.equals(tx.customerId))).getSingleOrNull();
        if (cust != null) {
          final reversedReceivable = cust.currentReceivableRupiah - tx.balanceDueRupiah;
          await (db.update(db.customersTable)..where((tbl) => tbl.id.equals(tx.customerId))).write(
            CustomersCompanion(
              currentReceivableRupiah: Value(reversedReceivable < BigInt.zero ? BigInt.zero : reversedReceivable),
              updatedAt: Value(now),
            ),
          );
        }
      }

      // 4. Ubah status transaksi menjadi VOID (Tanpa menghapus histori atau item transaksi)
      await (db.update(db.transactionsTable)..where((tbl) => tbl.id.equals(transactionId))).write(
        TransactionsCompanion(
          status: const Value('VOID'),
          notes: Value('${tx.notes ?? ""} [VOID REVERSAL: $voidReason oleh $voidedByUserId pada ${now.toIso8601String()}]'),
          updatedAt: Value(now),
        ),
      );

      // 5. Antrean Sinkronisasi Reversal ke sync_outbox & sync_queue
      final voidPayloadJson = jsonEncode({
        'transactionId': transactionId,
        'invoiceNumber': tx.invoiceNumber,
        'status': 'VOID',
        'reason': voidReason,
        'voidedByUserId': voidedByUserId,
        'reversedAmountRupiah': tx.grandTotalRupiah.toString(),
        'reversedReceivableRupiah': tx.balanceDueRupiah.toString(),
        'voidedAt': now.toIso8601String(),
      });

      await db.into(db.syncOutboxTable).insert(
        SyncOutboxCompanion.insert(
          id: 'OUTBOX_VOID_${transactionId}_${now.millisecondsSinceEpoch}',
          targetTable: 'transactions',
          recordId: transactionId,
          mutationType: 'UPDATE',
          payload: voidPayloadJson,
          status: const Value('PENDING'),
          createdAt: Value(now),
        ),
      );

      await db.into(db.syncQueueTable).insert(
        SyncQueueCompanion.insert(
          id: 'SYNC_VOID_${transactionId}_${now.millisecondsSinceEpoch}',
          targetTable: 'transactions',
          recordId: transactionId,
          operationType: 'VOID_REVERSAL',
          payloadJson: voidPayloadJson,
          status: const Value('PENDING'),
          createdAt: Value(now),
        ),
      );

      // 6. Catat Audit Log Resmi
      await db.into(db.auditLogsTable).insert(
        AuditLogsCompanion.insert(
          id: 'AUDIT_VOID_${now.millisecondsSinceEpoch}',
          action: 'VOID_TRANSACTION_REVERSAL',
          actorUserId: voidedByUserId,
          deviceId: deviceId,
          detailsJson: voidPayloadJson,
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
