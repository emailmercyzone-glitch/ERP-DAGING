import 'dart:convert';
import 'package:drift/drift.dart';
import '../../../core/database/app_database.dart';

/// DTO Hasil Input Stock Opname
class OpnameAdjustmentItem {
  final String lotId;
  final String productId;
  final int systemWeightGram;
  final int physicalWeightGram;
  final String reason; // DRIP_LOSS_THAWING, DEFECT_SPOILAGE, COUNT_ERROR

  OpnameAdjustmentItem({
    required this.lotId,
    required this.productId,
    required this.systemWeightGram,
    required this.physicalWeightGram,
    required this.reason,
  });

  int get varianceGram => physicalWeightGram - systemWeightGram; // Negatif jika susut
}

/// MOD-07B: Layanan Stock Opname, Drip Loss (Susut Thawing), & Karantina Lot Mutu
class OpnameService {
  final AppDatabase db;

  OpnameService(this.db);

  /// Eksekusi Stock Opname & Penyesuaian Susut Timbangan Daging
  /// Mencatat selisih ke stock_ledger via ADJ_OPNAME_PLUS, OUT_DRIP_LOSS, atau ADJ_OPNAME_MINUS
  Future<void> commitStockOpname({
    required String opnameBatchId,
    required String adminUserId,
    required String deviceId,
    required List<OpnameAdjustmentItem> adjustments,
    String? notes,
  }) async {
    final now = DateTime.now();

    await db.transaction(() async {
      for (final item in adjustments) {
        if (item.varianceGram == 0) continue; // Tidak ada perubahan fisik

        final lot = await (db.select(db.lotsTable)..where((tbl) => tbl.id.equals(item.lotId))).getSingle();

        String movementType;
        int deltaWeightGram = item.varianceGram.abs();

        if (item.varianceGram < 0) {
          // Susut / Hilang
          if (item.reason == 'DRIP_LOSS_THAWING') {
            movementType = 'OUT_DRIP_LOSS';
          } else {
            movementType = 'ADJ_OPNAME_MINUS';
          }
        } else {
          // Fisik Lebih Banyak
          movementType = 'ADJ_OPNAME_PLUS';
        }

        // 1. Tulis ke immutable stock_ledger
        await db.appendStockLedger(
          id: 'LEDGER_OPNAME_${item.lotId}_${now.millisecondsSinceEpoch}',
          productId: item.productId,
          lotId: item.lotId,
          movementType: movementType,
          weightGram: deltaWeightGram,
          referenceNumber: opnameBatchId,
          referenceType: 'STOCK_OPNAME',
          hppPerGramRupiah: lot.hppPerGramRupiah,
          performedByUserId: adminUserId,
          deviceId: deviceId,
          notes: 'Opname: ${item.reason} (Selisih: ${item.varianceGram} gr)',
        );

        // 2. Perbarui fisik aktual pada tabel lots
        await (db.update(db.lotsTable)..where((tbl) => tbl.id.equals(item.lotId))).write(
          LotsCompanion(
            currentWeightGram: Value(item.physicalWeightGram),
            updatedAt: Value(now),
          ),
        );
      }

      final opnamePayloadJson = jsonEncode({
        'opnameBatchId': opnameBatchId,
        'adminUserId': adminUserId,
        'deviceId': deviceId,
        'itemsAdjusted': adjustments.length,
        'createdAt': now.toIso8601String(),
      });

      await db.into(db.syncOutboxTable).insert(
        SyncOutboxCompanion.insert(
          id: 'OUTBOX_OPN_${opnameBatchId}_${now.millisecondsSinceEpoch}',
          targetTable: 'stock_ledger',
          recordId: opnameBatchId,
          mutationType: 'INSERT',
          payload: opnamePayloadJson,
          status: const Value('PENDING'),
          createdAt: Value(now),
        ),
      );

      // Catat Audit Trail
      await db.into(db.auditLogsTable).insert(
        AuditLogsCompanion.insert(
          id: 'AUDIT_OPNAME_${now.millisecondsSinceEpoch}',
          action: 'OPNAME_COMMIT',
          actorUserId: adminUserId,
          deviceId: deviceId,
          detailsJson: opnamePayloadJson,
          timestamp: Value(now),
        ),
      );
    });
  }

  /// Karantina Lot Daging (Mutu Rusak / Bau / Freezer Mati)
  /// Mengeluarkan lot dari pool FEFO agar tidak bisa terjual di POS
  Future<void> quarantineLot({
    required String lotId,
    required String reason,
    required String adminUserId,
    required String deviceId,
  }) async {
    final now = DateTime.now();

    await db.transaction(() async {
      final lot = await (db.select(db.lotsTable)..where((tbl) => tbl.id.equals(lotId))).getSingle();

      // Tandai lot dikarantina
      await (db.update(db.lotsTable)..where((tbl) => tbl.id.equals(lotId))).write(
        LotsCompanion(
          isQuarantined: const Value(true),
          quarantineReason: Value(reason),
          updatedAt: Value(now),
        ),
      );

      // Catat mutasi karantina ke ledger
      await db.appendStockLedger(
        id: 'LEDGER_QUARANTINE_${lotId}_${now.millisecondsSinceEpoch}',
        productId: lot.productId,
        lotId: lotId,
        movementType: 'OUT_QUARANTINE',
        weightGram: lot.currentWeightGram,
        referenceNumber: 'QUARANTINE-$lotId',
        referenceType: 'QUARANTINE',
        hppPerGramRupiah: lot.hppPerGramRupiah,
        performedByUserId: adminUserId,
        deviceId: deviceId,
        notes: 'Masuk Karantina: $reason',
      );
    });
  }

  /// Melepaskan Karantina Lot (Release to Active Stock)
  Future<void> releaseQuarantineLot({
    required String lotId,
    required String adminUserId,
    required String deviceId,
  }) async {
    final now = DateTime.now();

    await db.transaction(() async {
      final lot = await (db.select(db.lotsTable)..where((tbl) => tbl.id.equals(lotId))).getSingle();

      await (db.update(db.lotsTable)..where((tbl) => tbl.id.equals(lotId))).write(
        LotsCompanion(
          isQuarantined: const Value(false),
          quarantineReason: const Value(null),
          updatedAt: Value(now),
        ),
      );

      // Balikkan stok ke ledger
      await db.appendStockLedger(
        id: 'LEDGER_RELEASE_${lotId}_${now.millisecondsSinceEpoch}',
        productId: lot.productId,
        lotId: lotId,
        movementType: 'IN_CONVERSION',
        weightGram: lot.currentWeightGram,
        referenceNumber: 'RELEASE-$lotId',
        referenceType: 'QUARANTINE_RELEASE',
        hppPerGramRupiah: lot.hppPerGramRupiah,
        performedByUserId: adminUserId,
        deviceId: deviceId,
        notes: 'Pelepasan Karantina Mutu Normal',
      );
    });
  }
}
