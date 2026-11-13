import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'backend_adapter.dart';

/// Adapter Supabase Opsional via REST RPC (tanpa wajib Supabase.initialize saat startup).
/// Status SYNCED hanya diberikan jika RPC sync_push mengembalikan ACK resmi.
class SupabaseBackendAdapter implements BackendAdapter {
  final BackendConfig config;
  final http.Client client;

  SupabaseBackendAdapter({
    required this.config,
    http.Client? client,
  }) : client = client ?? http.Client();

  @override
  BackendAdapterType get type => BackendAdapterType.supabase;

  @override
  String get displayName => 'Supabase (Opsional)';

  @override
  bool get requiresNetwork => true;

  String get _url => config.supabaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
  String get _anonKey => config.supabaseAnonKey.trim();

  Map<String, String> _headers() {
    final token = config.apiKeyOrToken.trim().isNotEmpty ? config.apiKeyOrToken.trim() : _anonKey;
    return {
      'Content-Type': 'application/json',
      'apikey': _anonKey,
      'Authorization': 'Bearer $token',
    };
  }

  @override
  Future<HealthCheckResult> checkHealth() async {
    if (_url.isEmpty || _anonKey.isEmpty) {
      return const HealthCheckResult(
        ok: false,
        adapterType: BackendAdapterType.supabase,
        latencyMs: 0,
        message: 'Supabase URL dan Anon Key belum diisi.',
      );
    }

    final sw = Stopwatch()..start();
    try {
      final res = await client
          .get(Uri.parse('$_url/rest/v1/'), headers: _headers())
          .timeout(const Duration(seconds: 8));
      sw.stop();
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return HealthCheckResult(
          ok: true,
          adapterType: BackendAdapterType.supabase,
          latencyMs: sw.elapsedMilliseconds,
          message: 'Supabase REST terhubung (${sw.elapsedMilliseconds} ms).',
        );
      }
      return HealthCheckResult(
        ok: false,
        adapterType: BackendAdapterType.supabase,
        latencyMs: sw.elapsedMilliseconds,
        message: 'Supabase merespons HTTP ${res.statusCode}.',
      );
    } catch (e) {
      sw.stop();
      return HealthCheckResult(
        ok: false,
        adapterType: BackendAdapterType.supabase,
        latencyMs: sw.elapsedMilliseconds,
        message: 'Gagal menjangkau Supabase: $e',
      );
    }
  }

  @override
  Future<OutboxPushResult> pushOutbox(
    List<OutboxMutationPayload> items, {
    required String storeName,
    required String deviceId,
  }) async {
    if (items.isEmpty) {
      return const OutboxPushResult(ok: true, message: 'Tidak ada antrean tertunda.');
    }

    if (_url.isEmpty || _anonKey.isEmpty) {
      const msg = 'Supabase URL / Anon Key belum dikonfigurasi.';
      return OutboxPushResult(
        ok: false,
        failedErrors: {for (final i in items) i.id: msg},
        message: '$msg Data tetap aman di perangkat (PENDING).',
      );
    }

    try {
      final events = items.map((item) {
        dynamic parsedPayload;
        try {
          parsedPayload = jsonDecode(item.payloadJson);
        } catch (_) {
          parsedPayload = {'raw': item.payloadJson};
        }
        return {
          'queue_id': item.id,
          'target_table': item.targetTable,
          'record_id': item.recordId,
          'operation_type': item.mutationType,
          'payload': parsedPayload,
        };
      }).toList();

      final res = await client
          .post(
            Uri.parse('$_url/rest/v1/rpc/sync_push'),
            headers: _headers(),
            body: jsonEncode({
              'p_store_id': config.storeId,
              'p_device_id': deviceId,
              'p_events': events,
            }),
          )
          .timeout(const Duration(seconds: 20));

      if (res.statusCode < 200 || res.statusCode >= 300) {
        final msg = 'Supabase RPC sync_push gagal (HTTP ${res.statusCode}).';
        return OutboxPushResult(
          ok: false,
          failedErrors: {for (final i in items) i.id: msg},
          message: msg,
        );
      }

      final decoded = jsonDecode(res.body);
      final ackIds = <String>[];
      final ackSet = <String>{};
      final serverSeqs = <String, int>{};

      if (decoded is Map && decoded['acks'] is List) {
        for (final ack in decoded['acks'] as List) {
          if (ack is Map) {
            final id = (ack['queue_id'] ?? ack['uuid'])?.toString();
            if (id != null && id.isNotEmpty) {
              if (ackSet.add(id)) ackIds.add(id);
              final seq = ack['server_seq'];
              if (seq is num) serverSeqs[id] = seq.toInt();
            }
          }
        }
      }

      final failedErrors = <String, String>{};
      for (final item in items) {
        if (!ackSet.contains(item.id)) {
          failedErrors[item.id] = 'RPC sync_push tidak mengembalikan ACK untuk item ini.';
        }
      }

      return OutboxPushResult(
        ok: ackIds.isNotEmpty && failedErrors.isEmpty,
        acknowledgedIds: ackIds,
        serverSeqs: serverSeqs,
        failedErrors: failedErrors,
        message: ackIds.isNotEmpty
            ? '${ackIds.length} catatan dikonfirmasi oleh Supabase.'
            : 'Supabase tidak mengembalikan ACK konfirmasi.',
      );
    } catch (e) {
      final msg = 'Gagal menghubungi Supabase: $e';
      return OutboxPushResult(
        ok: false,
        failedErrors: {for (final i in items) i.id: msg},
        message: msg,
      );
    }
  }

  @override
  Future<PullChangesResult> pullChanges({
    required int sinceSeq,
    required String deviceId,
  }) async {
    if (_url.isEmpty || _anonKey.isEmpty) {
      return const PullChangesResult(
        ok: false,
        message: 'Supabase URL dan Anon Key belum diisi.',
      );
    }
    try {
      final uri = Uri.parse('$_url/rest/v1/transactions').replace(queryParameters: {
        'select': '*',
        'store_id': 'eq.${config.storeId}',
        'server_seq': 'gt.$sinceSeq',
        'device_id': 'neq.$deviceId',
        'order': 'server_seq.asc',
        'limit': '100',
      });
      final res = await client.get(uri, headers: _headers()).timeout(const Duration(seconds: 15));
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return PullChangesResult(
          ok: false,
          message: 'Gagal menarik data Supabase (HTTP ${res.statusCode}).',
        );
      }
      final raw = jsonDecode(res.body);
      final records = raw is List
          ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
          : <Map<String, dynamic>>[];
      return PullChangesResult(
        ok: true,
        records: records,
        message: '${records.length} catatan ditarik dari Supabase.',
      );
    } catch (e) {
      return PullChangesResult(ok: false, message: 'Gagal menarik data Supabase: $e');
    }
  }

  @override
  Future<MediaUploadResult> uploadMedia({
    required String mediaId,
    required String mediaType,
    required String localFilePath,
  }) async {
    if (_url.isEmpty || _anonKey.isEmpty) {
      return const MediaUploadResult(ok: false, errorMessage: 'Supabase URL/Anon Key belum diisi.');
    }
    try {
      final file = File(localFilePath);
      if (!await file.exists()) {
        return const MediaUploadResult(ok: false, errorMessage: 'File foto lokal tidak ditemukan.');
      }
      final bytes = await file.readAsBytes();
      final remotePath = '${mediaType.toLowerCase()}/$mediaId.jpg';
      final uploadUri = Uri.parse('$_url/storage/v1/object/erp-media-proofs/$remotePath');
      final headers = _headers()
        ..['Content-Type'] = 'image/jpeg'
        ..['x-upsert'] = 'true';

      final res = await client.post(uploadUri, headers: headers, body: bytes).timeout(const Duration(seconds: 25));
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return MediaUploadResult(
          ok: true,
          remoteUrl: '$_url/storage/v1/object/public/erp-media-proofs/$remotePath',
        );
      }
      return MediaUploadResult(
        ok: false,
        errorMessage: 'Upload Supabase Storage gagal (HTTP ${res.statusCode}).',
      );
    } catch (e) {
      return MediaUploadResult(ok: false, errorMessage: e.toString());
    }
  }

  @override
  Future<Map<String, dynamic>?> parseVoiceOrder(String transcript) async => null;

  @override
  Future<Map<String, dynamic>?> fetchAdvisorInsight(
    Map<String, dynamic> operationalSnapshot,
  ) async =>
      null;
}
