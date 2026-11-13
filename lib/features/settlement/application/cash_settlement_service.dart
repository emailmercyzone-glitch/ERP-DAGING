import 'dart:convert';
import 'package:drift/drift.dart';
import '../../../core/database/app_database.dart';

/// Ringkasan Posisi Kas yang Dipegang Sales Lapangan
class SalesCashPosition {
  final String salesUserId;
  final BigInt totalCashInHandRupiah;
  final int pendingCashTransactionsCount;
  final bool isSoftLimitExceeded;
  final BigInt softLimitRupiah;
  final String? warningMessage;

  SalesCashPosition({
    required this.salesUserId,
    required this.totalCashInHandRupiah,
    required this.pendingCashTransactionsCount,
    required this.isSoftLimitExceeded,
    required this.softLimitRupiah,
    this.warningMessage,
  });
}

/// MOD-11: Layanan Setoran Kas Sales & Pengawasan Soft Limit Rp 3.000.000
class CashSettlementService {
  final AppDatabase db;
  static final BigInt softLimit = BigInt.from(3000000); // Rp 3.000.000

  CashSettlementService(this.db);

  /// Menghitung total uang tunai fisik yang sedang dipegang oleh seorang sales (Belum disetor)
  Future<SalesCashPosition> getSalesCashPosition(String salesUserId) async {
    // 1. Ambil seluruh transaksi CASH yang belum memiliki settlementId (belum disetor)
    final pendingCashTransactions = await (db.select(db.transactionsTable)
          ..where((tbl) => 
              tbl.salesUserId.equals(salesUserId) & 
              tbl.paymentMethod.equals('CASH') & 
              tbl.settlementId.isNull() &
              tbl.status.isNotValue('VOID')))
        .get();

    BigInt totalCollected = BigInt.zero;
    for (final tx in pendingCashTransactions) {
      totalCollected += tx.paidAmountRupiah;
    }

    final inHandClean = totalCollected < BigInt.zero ? BigInt.zero : totalCollected;
    final isExceeded = inHandClean >= softLimit;

    String? warning;
    if (isExceeded) {
      warning = 'PERINGATAN KAS LAPANGAN: Sales memegang uang tunai Rp ${inHandClean.toString()} '
          '(Melewati batas aman Rp 3.000.000). Segera lakukan setoran ke kasir atau transfer!';
    }

    return SalesCashPosition(
      salesUserId: salesUserId,
      totalCashInHandRupiah: inHandClean,
      pendingCashTransactionsCount: pendingCashTransactions.length,
      isSoftLimitExceeded: isExceeded,
      softLimitRupiah: softLimit,
      warningMessage: warning,
    );
  }

  /// Memproses verifikasi setoran kas dari sales ke kasir toko / owner serta alokasi transaksi
  Future<CashSettlementEntry> processCashSettlement({
    required String settlementId,
    required String salesUserId,
    required String receivedByUserId,
    required BigInt reportedCollectedRupiah,
    required BigInt actualDepositedRupiah,
    required String depositMethod, // TUNAI_FISIK, ATM_SETOR_TUNAI, TRANSFER
    List<String>? settledTransactionIds,
    String? proofPhotoQueueId,
    String? notes,
  }) async {
    final now = DateTime.now();
    final variance = actualDepositedRupiah - reportedCollectedRupiah;
    final settlementNumber = 'SETTLE-${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}-${now.millisecondsSinceEpoch.toString().substring(8)}';

    await db.transaction(() async {
      // 1. Simpan catatan setoran kas
      await db.into(db.cashSettlementsTable).insert(
        CashSettlementsCompanion.insert(
          id: settlementId,
          settlementNumber: settlementNumber,
          salesUserId: salesUserId,
          settlementDate: now,
          totalCashCollectedRupiah: reportedCollectedRupiah,
          actualDepositedRupiah: actualDepositedRupiah,
          varianceRupiah: Value(variance),
          receivedByUserId: receivedByUserId,
          depositMethod: depositMethod,
          proofPhotoQueueId: Value(proofPhotoQueueId),
          notes: Value(notes),
          status: Value(variance == BigInt.zero ? 'VERIFIED' : 'DISCREPANCY'),
          createdAt: Value(now),
        ),
      );

      // 2. Alokasikan ke transaksi-transaksi penjualan kas yang bersangkutan
      final txQuery = db.select(db.transactionsTable)
        ..where((tbl) => 
            tbl.salesUserId.equals(salesUserId) & 
            tbl.paymentMethod.equals('CASH') & 
            tbl.settlementId.isNull() & 
            tbl.status.isNotValue('VOID'));

      final targetTxs = settledTransactionIds != null
          ? await (db.select(db.transactionsTable)..where((tbl) => tbl.id.isIn(settledTransactionIds))).get()
          : await txQuery.get();

      final List<String> allocatedInvoiceNumbers = [];
      for (final tx in targetTxs) {
        await (db.update(db.transactionsTable)..where((tbl) => tbl.id.equals(tx.id))).write(
          TransactionsCompanion(
            settlementId: Value(settlementId),
            updatedAt: Value(now),
          ),
        );
        allocatedInvoiceNumbers.add(tx.invoiceNumber);
      }

      // 3. Catat antrean sinkronisasi outbox dengan JSON valid
      final settlePayloadJson = jsonEncode({
        'settlementId': settlementId,
        'settlementNumber': settlementNumber,
        'salesUserId': salesUserId,
        'reportedCollectedRupiah': reportedCollectedRupiah.toString(),
        'actualDepositedRupiah': actualDepositedRupiah.toString(),
        'varianceRupiah': variance.toString(),
        'depositMethod': depositMethod,
        'allocatedCount': targetTxs.length,
        'allocatedInvoices': allocatedInvoiceNumbers,
        'createdAt': now.toIso8601String(),
      });

      await db.into(db.syncOutboxTable).insert(
        SyncOutboxCompanion.insert(
          id: 'OUTBOX_SETTLE_${settlementId}_${now.millisecondsSinceEpoch}',
          targetTable: 'cash_settlements',
          recordId: settlementId,
          mutationType: 'INSERT',
          payload: settlePayloadJson,
          status: const Value('PENDING'),
          createdAt: Value(now),
        ),
      );

      await db.into(db.syncQueueTable).insert(
        SyncQueueCompanion.insert(
          id: 'SYNC_SETTLE_${settlementId}_${now.millisecondsSinceEpoch}',
          targetTable: 'cash_settlements',
          recordId: settlementId,
          operationType: 'INSERT',
          payloadJson: settlePayloadJson,
          status: const Value('PENDING'),
          createdAt: Value(now),
        ),
      );

      // 4. Catat audit log setoran lengkap dengan alokasi transaksi
      await db.into(db.auditLogsTable).insert(
        AuditLogsCompanion.insert(
          id: 'AUDIT_SETTLE_${now.millisecondsSinceEpoch}',
          action: 'CASH_SETTLEMENT',
          actorUserId: receivedByUserId,
          deviceId: 'TOKO_OFFICE',
          detailsJson: settlePayloadJson,
          timestamp: Value(now),
        ),
      );
    });

    return (db.select(db.cashSettlementsTable)..where((tbl) => tbl.id.equals(settlementId))).getSingle();
  }
}
