import 'package:drift/drift.dart';
import '../../../core/database/app_database.dart';
import '../../customers/application/credit_limit_service.dart';

/// Permintaan Retur Penjualan Daging
class SalesReturnRequest {
  final String returnId;
  final String transactionId;
  final String invoiceNumber;
  final String customerId;
  final String productId;
  final String lotId;
  final int returnedWeightGram;
  final BigInt unitPricePerKgRupiah;
  final String returnReason; // DEFECT_MUTU, TIMBANGAN_SELISIH, SALAH_KIRIM, KADALUWARSA
  final String photoProofQueueId; // Bukti Foto Wajib Kamera MOD-20
  final String resolutionType; // DEDUCT_RECEIVABLE, CASH_REFUND
  final String issuedByUserId;
  final String deviceId;
  final String? notes;

  SalesReturnRequest({
    required this.returnId,
    required this.transactionId,
    required this.invoiceNumber,
    required this.customerId,
    required this.productId,
    required this.lotId,
    required this.returnedWeightGram,
    required this.unitPricePerKgRupiah,
    required this.returnReason,
    required this.photoProofQueueId,
    required this.resolutionType,
    required this.issuedByUserId,
    required this.deviceId,
    this.notes,
  });

  /// Kalkulasi Nilai Credit Note: (Gram * Harga/KG) / 1000
  BigInt get creditNoteAmountRupiah => 
      (BigInt.from(returnedWeightGram) * unitPricePerKgRupiah) ~/ BigInt.from(1000);
}

/// MOD-08: Layanan Retur Penjualan Daging & Penerbitan Credit Note
class ReturnService {
  final AppDatabase db;
  final CreditLimitService creditLimitService;

  ReturnService(this.db, this.creditLimitService);

  /// Memproses Retur Penjualan & Menerbitkan Credit Note Resmi
  Future<CreditNoteEntry> processSalesReturn(SalesReturnRequest req) async {
    final now = DateTime.now();
    final creditNoteNumber = 'CN-${now.year.toString().substring(2)}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}-${now.millisecondsSinceEpoch.toString().substring(9)}';
    final amountRupiah = req.creditNoteAmountRupiah;

    await db.transaction(() async {
      // 1. Terbitkan Credit Note ke credit_notes_table
      await db.into(db.creditNotesTable).insert(
        CreditNotesCompanion.insert(
          id: req.returnId,
          creditNoteNumber: creditNoteNumber,
          transactionId: req.transactionId,
          customerId: req.customerId,
          amountRupiah: amountRupiah,
          returnReason: req.returnReason,
          photoProofQueueId: Value(req.photoProofQueueId),
          status: Value(req.resolutionType == 'DEDUCT_RECEIVABLE' ? 'APPLIED_TO_INVOICE' : 'REFUNDED_CASH'),
          issuedByUserId: req.issuedByUserId,
          createdAt: Value(now),
        ),
      );

      // 2. Ambil data lot untuk HPP
      final lot = await (db.select(db.lotsTable)..where((tbl) => tbl.id.equals(req.lotId))).getSingle();

      // 3. Masukkan daging retur ke karantina gudang via IN_RETURN_SALE
      await db.appendStockLedger(
        id: 'LEDGER_RETURN_${req.returnId}_${now.millisecondsSinceEpoch}',
        productId: req.productId,
        lotId: req.lotId,
        movementType: 'IN_RETURN_SALE',
        weightGram: req.returnedWeightGram,
        referenceNumber: creditNoteNumber,
        referenceType: 'SALES_RETURN',
        hppPerGramRupiah: lot.hppPerGramRupiah,
        performedByUserId: req.issuedByUserId,
        deviceId: req.deviceId,
        notes: 'Retur dari ${req.invoiceNumber}: ${req.returnReason}',
      );

      // 4. Masukkan langsung ke Karantina agar tidak terjual lagi
      await db.appendStockLedger(
        id: 'LEDGER_QUAR_${req.returnId}_${now.millisecondsSinceEpoch}',
        productId: req.productId,
        lotId: req.lotId,
        movementType: 'OUT_QUARANTINE',
        weightGram: req.returnedWeightGram,
        referenceNumber: creditNoteNumber,
        referenceType: 'RETURN_QUARANTINE',
        hppPerGramRupiah: lot.hppPerGramRupiah,
        performedByUserId: req.issuedByUserId,
        deviceId: req.deviceId,
        notes: 'Barang retur masuk karantina mutu',
      );

      // 5. Jika metode DEDUCT_RECEIVABLE, kurangi saldo piutang pelanggan
      if (req.resolutionType == 'DEDUCT_RECEIVABLE') {
        await creditLimitService.reduceReceivable(
          customerId: req.customerId,
          amountPaidRupiah: amountRupiah,
        );
      }

      // 6. Catat Audit Log
      await db.into(db.auditLogsTable).insert(
        AuditLogsCompanion.insert(
          id: 'AUDIT_RET_${now.millisecondsSinceEpoch}',
          action: 'SALES_RETURN',
          actorUserId: req.issuedByUserId,
          deviceId: req.deviceId,
          detailsJson: '{"cn":"$creditNoteNumber","inv":"${req.invoiceNumber}","amount":${amountRupiah.toString()}}',
          timestamp: Value(now),
        ),
      );
    });

    return (db.select(db.creditNotesTable)..where((tbl) => tbl.id.equals(req.returnId))).getSingle();
  }
}
