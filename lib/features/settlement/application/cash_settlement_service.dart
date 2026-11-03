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

  /// Menghitung total uang tunai fisik yang sedang dipegang oleh seorang sales
  Future<SalesCashPosition> getSalesCashPosition(String salesUserId) async {
    // 1. Ambil seluruh transaksi CASH yang dilakukan oleh sales ini yang belum di-settle
    // (di mana paidAmountRupiah > 0 dan status != VOID)
    final cashTransactions = await (db.select(db.transactionsTable)
          ..where((tbl) => 
              tbl.salesUserId.equals(salesUserId) & 
              tbl.paymentMethod.equals('CASH') & 
              tbl.status.isNotValue('VOID')))
        .get();

    // 2. Ambil total yang sudah pernah disetorkan
    final settlements = await (db.select(db.cashSettlementsTable)
          ..where((tbl) => tbl.salesUserId.equals(salesUserId) & tbl.status.equals('VERIFIED')))
        .get();

    BigInt totalCollected = BigInt.zero;
    for (final tx in cashTransactions) {
      totalCollected += tx.paidAmountRupiah;
    }

    BigInt totalSettled = BigInt.zero;
    for (final st in settlements) {
      totalSettled += st.actualDepositedRupiah;
    }

    final cashInHand = totalCollected - totalSettled;
    final inHandClean = cashInHand < BigInt.zero ? BigInt.zero : cashInHand;
    final isExceeded = inHandClean >= softLimit;

    String? warning;
    if (isExceeded) {
      warning = 'PERINGATAN KAS LAPANGAN: Sales memegang uang tunai Rp ${inHandClean.toString()} '
          '(Melewati batas aman Rp 3.000.000). Segera lakukan setoran ke kasir atau transfer!';
    }

    return SalesCashPosition(
      salesUserId: salesUserId,
      totalCashInHandRupiah: inHandClean,
      pendingCashTransactionsCount: cashTransactions.length,
      isSoftLimitExceeded: isExceeded,
      softLimitRupiah: softLimit,
      warningMessage: warning,
    );
  }

  /// Memproses verifikasi setoran kas dari sales ke kasir toko / owner
  Future<CashSettlementEntry> processCashSettlement({
    required String settlementId,
    required String salesUserId,
    required String receivedByUserId,
    required BigInt reportedCollectedRupiah,
    required BigInt actualDepositedRupiah,
    required String depositMethod, // TUNAI_FISIK, ATM_SETOR_TUNAI, TRANSFER
    String? proofPhotoQueueId,
    String? notes,
  }) async {
    final now = DateTime.now();
    final variance = actualDepositedRupiah - reportedCollectedRupiah;
    final settlementNumber = 'SETTLE-${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}-${now.millisecondsSinceEpoch.toString().substring(8)}';

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

    // Catat audit log setoran
    await db.into(db.auditLogsTable).insert(
      AuditLogsCompanion.insert(
        id: 'AUDIT_SETTLE_${now.millisecondsSinceEpoch}',
        action: 'CASH_SETTLEMENT',
        actorUserId: receivedByUserId,
        deviceId: 'TOKO_OFFICE',
        detailsJson: '{"sales":"$salesUserId","amount":${actualDepositedRupiah.toString()},"variance":${variance.toString()}}',
        timestamp: Value(now),
      ),
    );

    return (db.select(db.cashSettlementsTable)..where((tbl) => tbl.id.equals(settlementId))).getSingle();
  }
}
