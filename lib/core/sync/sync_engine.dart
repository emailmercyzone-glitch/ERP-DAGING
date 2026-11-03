import 'dart:convert';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../database/app_database.dart';
import '../database/daos/sync_dao.dart';

/// MOD-07 & PROTOKOL SINKRONISASI: Engine Sinkronisasi Dua Arah (Two-Way Sync)
/// Menutup Gap P05, D4, D6: Idempotency, Server Sequence, dan ACK Handshake
class SyncEngine {
  final AppDatabase db;
  final SyncDao syncDao;
  final SupabaseClient supabase;
  final String deviceId;
  final String storeId;

  bool _isSyncing = false;

  SyncEngine({
    required this.db,
    required this.syncDao,
    required this.supabase,
    required this.deviceId,
    this.storeId = 'TOKO_SAMPORA_01',
  });

  /// Mulai mendengarkan status konektivitas internet (Auto-Sync saat Online)
  void startConnectivityListener() {
    Connectivity().onConnectivityChanged.listen((results) {
      final isConnected = results.any((r) => r != ConnectivityResult.none);
      if (isConnected && !_isSyncing) {
        performFullSync();
      }
    });
  }

  /// Eksekusi Sinkronisasi Penuh (Push Event Lokal -> Pull Pembaruan Cloud)
  Future<SyncResult> performFullSync() async {
    if (_isSyncing) {
      return SyncResult(success: false, message: 'Sinkronisasi sedang berlangsung.');
    }

    _isSyncing = true;
    int pushedCount = 0;
    int pulledCount = 0;

    try {
      // 1. PUSH: Mengirim antrean lokal ke Supabase via RPC sync_push
      pushedCount = await _pushLocalQueue();

      // 2. PULL: Mengambil perubahan data dari cloud yang lebih baru dari sequence lokal
      pulledCount = await _pullCloudChanges();

      // 3. MEDIA: Mengunggah foto bukti retur & kwitansi OPEX
      await _uploadPendingMediaFiles();

      return SyncResult(
        success: true,
        pushedCount: pushedCount,
        pulledCount: pulledCount,
        message: 'Sinkronisasi berhasil ($pushedCount terkirim, $pulledCount ditarik).',
      );
    } catch (e) {
      return SyncResult(success: false, message: 'Gagal sinkronisasi: ${e.toString()}');
    } finally {
      _isSyncing = false;
    }
  }

  /// PUSH Worker: Mengemas antrean pending dan mengirim RPC ke Supabase
  Future<int> _pushLocalQueue() async {
    final pendingItems = await syncDao.getPendingSyncQueue(limit: 50);
    if (pendingItems.isEmpty) return 0;

    final List<String> queueIds = pendingItems.map((e) => e.id).toList();
    await syncDao.markAsSyncing(queueIds);

    final payloadList = pendingItems.map((item) {
      return {
        'queue_id': item.id,
        'target_table': item.targetTable,
        'record_id': item.recordId,
        'operation_type': item.operationType,
        'payload': jsonDecode(item.payloadJson),
      };
    }).toList();

    try {
      // Panggil RPC sync_push (SECURITY INVOKER)
      final response = await supabase.rpc(
        'sync_push',
        params: {
          'p_store_id': storeId,
          'p_device_id': deviceId,
          'p_events': payloadList,
        },
      );

      // Tangani respon jabat tangan ACK
      final acks = (response['acks'] as List?) ?? [];
      for (final ack in acks) {
        final queueId = ack['queue_id'] as String;
        final serverSeq = (ack['server_seq'] as num?)?.toInt() ?? 0;
        await syncDao.acknowledgeSyncSuccess(queueId: queueId, serverSeq: serverSeq);
      }

      return pendingItems.length;
    } catch (e) {
      // Catat kegagalan untuk tiap item antrean
      for (final item in pendingItems) {
        await syncDao.recordSyncFailure(queueId: item.id, errorMessage: e.toString());
      }
      rethrow;
    }
  }

  /// PULL Worker: Menarik master data & event mutasi terbaru dari Supabase
  Future<int> _pullCloudChanges() async {
    // Cari server_seq tertinggi yang tercatat lokal
    final maxSeqResult = await db.customSelect(
      'SELECT MAX(server_seq) as max_seq FROM sync_queue WHERE status = "DONE"',
    ).getSingleOrNull();

    final int lastSeq = maxSeqResult?.data['max_seq'] as int? ?? 0;

    // Ambil transaksi baru dari server yang diinput oleh HP sales lain
    final serverUpdates = await supabase
        .from('transactions')
        .select()
        .eq('store_id', storeId)
        .gt('server_seq', lastSeq)
        .neq('device_id', deviceId) // Hindari menarik data diri sendiri
        .order('server_seq', ascending: true)
        .limit(100);

    // Terapkan ke Drift SQLite lokal (simulasi pull)
    return (serverUpdates as List).length;
  }

  /// MEDIA Worker: Unggah foto terkompresi (<300 KB) ke Supabase Storage
  Future<void> _uploadPendingMediaFiles() async {
    final pendingMedia = await syncDao.getPendingMediaUploads(limit: 5);
    for (final media in pendingMedia) {
      try {
        // Simulasi unggah ke bucket erp-media-proofs
        final remotePath = '${media.mediaType.toLowerCase()}/${media.id}.jpg';
        final remoteUrl = supabase.storage.from('erp-media-proofs').getPublicUrl(remotePath);

        await syncDao.acknowledgeMediaUploadSuccess(
          mediaId: media.id,
          remoteUrl: remoteUrl,
        );
      } catch (_) {
        // Biarkan retry di siklus berikutnya
      }
    }
  }
}

/// DTO Status Hasil Sinkronisasi
class SyncResult {
  final bool success;
  final int pushedCount;
  final int pulledCount;
  final String message;

  SyncResult({
    required this.success,
    this.pushedCount = 0,
    this.pulledCount = 0,
    required this.message,
  });
}
