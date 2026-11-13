import 'dart:convert';
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

      // 3. Masukkan fisik barang retur ke Lot Karantina Terisolasi (isQuarantined = true)
      // Daging retur TIDAK BOLEH masuk ke stok jual reguler (FEFO menyaring isQuarantined = false)
      final quarantineLotId = 'LOT_QUAR_${req.returnId}';
      await db.into(db.lotsTable).insert(
        LotsCompanion.insert(
          id: quarantineLotId,
          productId: req.productId,
          supplierId: Value(lot.supplierId),
          lotCode: 'RET-${lot.lotCode}',
          expiryDate: lot.expiryDate,
          initialWeightGram: req.returnedWeightGram,
          currentWeightGram: req.returnedWeightGram,
          hppPerGramRupiah: lot.hppPerGramRupiah,
          storageLocation: const Value('CHILLER-ISOLASI-01'),
          isQuarantined: const Value(true), // Karantina Mutu Terisolasi
          quarantineReason: Value('Retur Komplain: ${req.returnReason} (${req.invoiceNumber})'),
          createdAt: Value(now),
          updatedAt: Value(now),
        ),
      );

      // 4. Catat Mutasi Masuk Karantina (IN_QUARANTINE) ke stock_ledger
      await db.appendStockLedger(
        id: 'LEDGER_QUAR_${req.returnId}_${now.millisecondsSinceEpoch}',
        productId: req.productId,
        lotId: quarantineLotId,
        movementType: 'IN_QUARANTINE',
        weightGram: req.returnedWeightGram,
        referenceNumber: creditNoteNumber,
        referenceType: 'RETURN_QUARANTINE',
        hppPerGramRupiah: lot.hppPerGramRupiah,
        performedByUserId: req.issuedByUserId,
        deviceId: req.deviceId,
        notes: 'Daging retur diisolasi di CHILLER-ISOLASI-01: ${req.returnReason}',
      );

      // 5. Jika metode DEDUCT_RECEIVABLE, kurangi saldo piutang pelanggan
      if (req.resolutionType == 'DEDUCT_RECEIVABLE') {
        await creditLimitService.reduceReceivable(
          customerId: req.customerId,
          amountPaidRupiah: amountRupiah,
        );
      }

      final returnPayloadJson = jsonEncode({
        'returnId': req.returnId,
        'creditNoteNumber': creditNoteNumber,
        'transactionId': req.transactionId,
        'invoiceNumber': req.invoiceNumber,
        'customerId': req.customerId,
        'productId': req.productId,
        'returnedWeightGram': req.returnedWeightGram,
        'amountRupiah': amountRupiah.toString(),
        'resolutionType': req.resolutionType,
        'createdAt': now.toIso8601String(),
      });

      await db.into(db.syncOutboxTable).insert(
        SyncOutboxCompanion.insert(
          id: 'OUTBOX_RET_${req.returnId}_${now.millisecondsSinceEpoch}',
          targetTable: 'credit_notes',
          recordId: req.returnId,
          mutationType: 'INSERT',
          payload: returnPayloadJson,
          status: const Value('PENDING'),
          createdAt: Value(now),
        ),
      );

      // 6. Catat Audit Log
      await db.into(db.auditLogsTable).insert(
        AuditLogsCompanion.insert(
          id: 'AUDIT_RET_${now.millisecondsSinceEpoch}',
          action: 'SALES_RETURN',
          actorUserId: req.issuedByUserId,
          deviceId: req.deviceId,
          detailsJson: returnPayloadJson,
          timestamp: Value(now),
        ),
      );
    });

    return (db.select(db.creditNotesTable)..where((tbl) => tbl.id.equals(req.returnId))).getSingle();
  }
}
