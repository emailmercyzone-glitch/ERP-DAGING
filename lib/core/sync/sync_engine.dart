import 'package:connectivity_plus/connectivity_plus.dart';
import '../backend/backend_adapter.dart';
import '../config/app_config.dart';
import '../database/app_database.dart';
import '../database/daos/sync_dao.dart';

/// Engine Sinkronisasi Local-First Dua Arah berbasis BackendAdapter & Outbox.
/// - Tidak terikat ke vendor atau server tertentu.
/// - Mode Local-Only tidak pernah memalsukan status SYNCED.
/// - Status SYNCED hanya diberikan setelah adapter mengonfirmasi ACK resmi.
class SyncEngine {
  final AppDatabase db;
  final SyncDao syncDao;
  final BackendAdapter adapter;
  final String deviceId;
  final String storeId;
  final String storeName;

  bool _isSyncing = false;

  SyncEngine({
    required this.db,
    required this.syncDao,
    required this.adapter,
    required this.deviceId,
    String? storeId,
    String? storeName,
  })  : storeId = storeId ?? AppConfig.storeId,
        storeName = storeName ?? AppConfig.storeName;

  /// Mulai mendengarkan status konektivitas internet (Auto-Sync hanya jika adapter eksternal aktif)
  void startConnectivityListener() {
    Connectivity().onConnectivityChanged.listen((results) {
      final isConnected = results.any((r) => r != ConnectivityResult.none);
      if (isConnected && !_isSyncing && adapter.requiresNetwork) {
        performFullSync();
      }
    });
  }

  /// Eksekusi Sinkronisasi Penuh melalui BackendAdapter aktif
  Future<SyncResult> performFullSync() async {
    if (_isSyncing) {
      return SyncResult(success: false, message: 'Sinkronisasi sedang berlangsung.');
    }

    if (!adapter.requiresNetwork) {
      final pending = await syncDao.getPendingOutbox(limit: 500);
      return SyncResult(
        success: true,
        skippedLocalOnly: true,
        pushedCount: 0,
        pulledCount: 0,
        message: pending.isEmpty
            ? 'Mode Lokal Mandiri aktif. Tidak ada antrean tertunda.'
            : 'Mode Lokal Mandiri aktif: ${pending.length} catatan tersimpan aman di Outbox lokal (PENDING).',
      );
    }

    _isSyncing = true;
    int pushedCount = 0;
    int pulledCount = 0;

    try {
      // 1. PUSH Outbox melalui BackendAdapter
      pushedCount = await _pushLocalOutbox();

      // 2. PULL Pembaruan melalui BackendAdapter
      pulledCount = await _pullBackendChanges();

      // 3. MEDIA Upload melalui BackendAdapter (hanya ACK jika upload benar-benar sukses)
      await _uploadPendingMediaFiles();

      return SyncResult(
        success: true,
        pushedCount: pushedCount,
        pulledCount: pulledCount,
        message: 'Sinkronisasi ${adapter.displayName} selesai ($pushedCount terkonfirmasi, $pulledCount ditarik).',
      );
    } catch (e) {
      return SyncResult(
        success: false,
        pushedCount: pushedCount,
        pulledCount: pulledCount,
        message: 'Gagal sinkronisasi (${adapter.displayName}): $e',
      );
    } finally {
      _isSyncing = false;
    }
  }

  /// PUSH Worker: Membaca sync_outbox (PENDING/FAILED) & hanya ACK item terkonfirmasi
  Future<int> _pushLocalOutbox() async {
    final pendingItems = await syncDao.getPendingOutbox(limit: 50);
    if (pendingItems.isEmpty) return 0;

    final payload = pendingItems
        .map(
          (item) => OutboxMutationPayload(
            id: item.id,
            targetTable: item.targetTable,
            recordId: item.recordId,
            mutationType: item.mutationType,
            payloadJson: item.payload,
            createdAt: item.createdAt,
          ),
        )
        .toList();

    final pushResult = await adapter.pushOutbox(
      payload,
      storeName: storeName,
      deviceId: deviceId,
    );

    if (pushResult.skippedLocalOnly) {
      return 0;
    }

    for (final ackId in pushResult.acknowledgedIds) {
      final serverSeq = pushResult.serverSeqs[ackId] ?? 0;
      await syncDao.acknowledgeOutboxSuccess(outboxId: ackId, serverSeq: serverSeq);
    }

    for (final entry in pushResult.failedErrors.entries) {
      await syncDao.recordOutboxFailure(
        outboxId: entry.key,
        errorMessage: entry.value,
      );
    }

    return pushResult.acknowledgedIds.length;
  }

  /// PULL Worker: Menarik pembaruan terbaru dari adapter yang terhubung
  Future<int> _pullBackendChanges() async {
    final maxSeqResult = await db
        .customSelect('SELECT MAX(server_seq) as max_seq FROM sync_outbox WHERE status = "SYNCED"')
        .getSingleOrNull();

    final int lastSeq = (maxSeqResult?.data['max_seq'] as num?)?.toInt() ?? 0;
    final pullResult = await adapter.pullChanges(sinceSeq: lastSeq, deviceId: deviceId);
    if (!pullResult.ok || pullResult.skippedLocalOnly) {
      return 0;
    }
    return pullResult.records.length;
  }

  /// MEDIA Worker: Upload file nyata melalui adapter; dilarang menandai DONE jika upload gagal
  Future<void> _uploadPendingMediaFiles() async {
    final pendingMedia = await syncDao.getPendingMediaUploads(limit: 5);
    for (final media in pendingMedia) {
      final uploadRes = await adapter.uploadMedia(
        mediaId: media.id,
        mediaType: media.mediaType,
        localFilePath: media.localFilePath,
      );

      if (uploadRes.skippedLocalOnly) {
        return;
      }

      if (uploadRes.ok && uploadRes.remoteUrl != null && uploadRes.remoteUrl!.isNotEmpty) {
        await syncDao.acknowledgeMediaUploadSuccess(
          mediaId: media.id,
          remoteUrl: uploadRes.remoteUrl!,
        );
      }
    }
  }
}

/// DTO Status Hasil Sinkronisasi
class SyncResult {
  final bool success;
  final bool skippedLocalOnly;
  final int pushedCount;
  final int pulledCount;
  final String message;

  SyncResult({
    required this.success,
    this.skippedLocalOnly = false,
    this.pushedCount = 0,
    this.pulledCount = 0,
    required this.message,
  });
}
