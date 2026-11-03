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
}
