import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/sync_queue_table.dart';

/// DAO untuk Protokol Sinkronisasi Offline-First, ACK, dan Idempotensi
/// Menutup Gap P05 & D4
class SyncDao {
  final AppDatabase db;

  SyncDao(this.db);

  /// Mengambil antrean sinkronisasi tertunda (PENDING atau FAILED yang belum melebihi max retries)
  Future<List<SyncQueueEntry>> getPendingSyncQueue({int limit = 50}) async {
    return (db.select(db.syncQueueTable)
          ..where((tbl) => tbl.status.equals('PENDING') | (tbl.status.equals('FAILED') & tbl.retryCount.isSmallerThanValue(5)))
          ..orderBy([(tbl) => OrderingTerm.asc(tbl.createdAt)])
          ..limit(limit))
        .get();
  }

  /// Menandai item dalam status sedang dikirim (SYNCING)
  Future<void> markAsSyncing(List<String> queueIds) async {
    await (db.update(db.syncQueueTable)..where((tbl) => tbl.id.isIn(queueIds))).write(
      const SyncQueueCompanion(status: Value('SYNCING')),
    );
  }

  /// Menerima ACK resmi dari server Supabase:
  /// Memasukkan server_seq dan mengubah status menjadi DONE
  Future<void> acknowledgeSyncSuccess({
    required String queueId,
    required int serverSeq,
  }) async {
    final now = DateTime.now();
    await (db.update(db.syncQueueTable)..where((tbl) => tbl.id.equals(queueId))).write(
      SyncQueueCompanion(
        status: const Value('DONE'),
        serverSeq: Value(serverSeq),
        syncedAt: Value(now),
      ),
    );
  }

  /// Mencatat kegagalan sinkronisasi, menaikkan retry count
  Future<void> recordSyncFailure({
    required String queueId,
    required String errorMessage,
  }) async {
    final item = await (db.select(db.syncQueueTable)..where((tbl) => tbl.id.equals(queueId))).getSingle();
    final newRetryCount = item.retryCount + 1;
    final newStatus = newRetryCount >= 5 ? 'PERMANENT_FAIL' : 'FAILED';

    await (db.update(db.syncQueueTable)..where((tbl) => tbl.id.equals(queueId))).write(
      SyncQueueCompanion(
        status: Value(newStatus),
        retryCount: Value(newRetryCount),
        lastError: Value(errorMessage),
      ),
    );
  }

  /// Antrean Media: Ambil foto kompresi yang belum terunggah
  Future<List<MediaQueueEntry>> getPendingMediaUploads({int limit = 10}) async {
    return (db.select(db.mediaQueueTable)
          ..where((tbl) => tbl.status.equals('PENDING'))
          ..orderBy([(tbl) => OrderingTerm.asc(tbl.createdAt)])
          ..limit(limit))
        .get();
  }

  /// Update URL cloud setelah media berhasil diunggah ke Supabase Storage
  Future<void> acknowledgeMediaUploadSuccess({
    required String mediaId,
    required String remoteUrl,
  }) async {
    await (db.update(db.mediaQueueTable)..where((tbl) => tbl.id.equals(mediaId))).write(
      MediaQueueCompanion(
        status: const Value('DONE'),
        remoteStorageUrl: Value(remoteUrl),
        uploadedAt: Value(DateTime.now()),
      ),
    );
  }

  // ===========================================================================
  // OUTBOX PATTERN METHODS (Rule 4: 'PENDING', 'SYNCED', 'FAILED')
  // ===========================================================================

  /// Insert mutated event into sync_outbox with full JSON payload
  Future<void> insertOutbox({
    required String id,
    required String targetTable,
    required String recordId,
    required String mutationType,
    required String payloadJson,
  }) async {
    await db.into(db.syncOutboxTable).insert(
      SyncOutboxCompanion.insert(
        id: id,
        targetTable: targetTable,
        recordId: recordId,
        mutationType: mutationType,
        payload: payloadJson,
        status: const Value('PENDING'),
        createdAt: Value(DateTime.now()),
      ),
    );
  }

  /// Get pending outbox entries (strict status: PENDING or FAILED with retryCount < 5)
  Future<List<SyncOutboxEntry>> getPendingOutbox({int limit = 50}) async {
    return (db.select(db.syncOutboxTable)
          ..where((tbl) =>
              tbl.status.equals('PENDING') |
              (tbl.status.equals('FAILED') & tbl.retryCount.isSmallerThanValue(5)))
          ..orderBy([(tbl) => OrderingTerm.asc(tbl.createdAt)])
          ..limit(limit))
        .get();
  }

  /// Acknowledge outbox entry as SYNCED (Strict enum status: 'SYNCED')
  Future<void> acknowledgeOutboxSuccess({
    required String outboxId,
    required int serverSeq,
  }) async {
    await (db.update(db.syncOutboxTable)..where((tbl) => tbl.id.equals(outboxId))).write(
      SyncOutboxCompanion(
        status: const Value('SYNCED'),
        serverSeq: Value(serverSeq),
        syncedAt: Value(DateTime.now()),
      ),
    );
  }

  /// Record outbox entry failure (Strict enum status: 'FAILED')
  Future<void> recordOutboxFailure({
    required String outboxId,
    required String errorMessage,
  }) async {
    final item = await (db.select(db.syncOutboxTable)..where((tbl) => tbl.id.equals(outboxId))).getSingle();
    await (db.update(db.syncOutboxTable)..where((tbl) => tbl.id.equals(outboxId))).write(
      SyncOutboxCompanion(
        status: const Value('FAILED'),
        retryCount: Value(item.retryCount + 1),
        lastError: Value(errorMessage),
      ),
    );
  }

  /// Ringkasan antrean Outbox lokal untuk UI & diagnostic
  Future<OutboxStats> getOutboxStats() async {
    final all = await db.select(db.syncOutboxTable).get();
    int pending = 0;
    int synced = 0;
    int failed = 0;
    for (final item in all) {
      if (item.status == 'SYNCED') {
        synced++;
      } else if (item.status == 'FAILED') {
        failed++;
      } else {
        pending++;
      }
    }
    return OutboxStats(
      total: all.length,
      pending: pending,
      synced: synced,
      failed: failed,
    );
  }

  /// Ambil entri Outbox terbaru untuk transparansi status ke operator
  Future<List<SyncOutboxEntry>> getRecentOutboxEntries({int limit = 20}) async {
    return (db.select(db.syncOutboxTable)
          ..orderBy([(tbl) => OrderingTerm.desc(tbl.createdAt)])
          ..limit(limit))
        .get();
  }
}

class OutboxStats {
  final int total;
  final int pending;
  final int synced;
  final int failed;

  const OutboxStats({
    required this.total,
    required this.pending,
    required this.synced,
    required this.failed,
  });

  int get unsyncedCount => pending + failed;
}


