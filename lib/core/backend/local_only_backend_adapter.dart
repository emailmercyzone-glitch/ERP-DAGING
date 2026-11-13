import 'backend_adapter.dart';

/// Adapter Default Local-Only untuk Android APK Mandiri.
/// - Beroperasi 100% tanpa internet maupun server eksternal.
/// - Tidak pernah memalsukan status SYNCED; antrean tetap PENDING secara jujur.
class LocalOnlyBackendAdapter implements BackendAdapter {
  @override
  BackendAdapterType get type => BackendAdapterType.localOnly;

  @override
  String get displayName => 'Mode Lokal Mandiri (Tanpa Server)';

  @override
  bool get requiresNetwork => false;

  @override
  Future<HealthCheckResult> checkHealth() async {
    return const HealthCheckResult(
      ok: true,
      adapterType: BackendAdapterType.localOnly,
      latencyMs: 0,
      message:
          'Mode Lokal Mandiri aktif. Seluruh transaksi berjalan normal di database SQLite perangkat tanpa server.',
    );
  }

  @override
  Future<OutboxPushResult> pushOutbox(
    List<OutboxMutationPayload> items, {
    required String storeName,
    required String deviceId,
  }) async {
    return OutboxPushResult(
      ok: true,
      skippedLocalOnly: true,
      acknowledgedIds: const [],
      serverSeqs: const {},
      failedErrors: const {},
      message: items.isEmpty
          ? 'Mode Lokal Mandiri aktif. Tidak ada antrean tertunda.'
          : 'Mode Lokal Mandiri aktif: ${items.length} catatan tetap aman di Outbox lokal (PENDING) hingga server eksternal dihubungkan.',
    );
  }

  @override
  Future<PullChangesResult> pullChanges({
    required int sinceSeq,
    required String deviceId,
  }) async {
    return const PullChangesResult(
      ok: true,
      skippedLocalOnly: true,
      records: [],
      message: 'Mode Lokal Mandiri: menggunakan database SQLite perangkat secara penuh.',
    );
  }

  @override
  Future<MediaUploadResult> uploadMedia({
    required String mediaId,
    required String mediaType,
    required String localFilePath,
  }) async {
    return const MediaUploadResult(
      ok: true,
      skippedLocalOnly: true,
      remoteUrl: null,
      errorMessage: null,
    );
  }

  @override
  Future<Map<String, dynamic>?> parseVoiceOrder(String transcript) async => null;

  @override
  Future<Map<String, dynamic>?> fetchAdvisorInsight(
    Map<String, dynamic> operationalSnapshot,
  ) async =>
      null;
}
