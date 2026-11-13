import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'backend_adapter.dart';

/// Adapter HTTP/JSON generik untuk REST API Mandiri, ZimaOS Self-Hosted,
/// maupun PostgreSQL HTTP Bridge.
class RestApiBackendAdapter implements BackendAdapter {
  @override
  final BackendAdapterType type;
  final BackendConfig config;
  final http.Client client;

  RestApiBackendAdapter({
    required this.type,
    required this.config,
    http.Client? client,
  }) : client = client ?? http.Client();

  @override
  String get displayName => type.displayName;

  @override
  bool get requiresNetwork => true;

  String get _baseUrl => config.endpointUrl.trim().replaceAll(RegExp(r'/+$'), '');

  Map<String, String> _headers() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'X-Store-Id': config.storeId,
      'X-Backend-Adapter': type.code,
    };
    final token = config.apiKeyOrToken.trim();
    if (token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  @override
  Future<HealthCheckResult> checkHealth() async {
    if (_baseUrl.isEmpty) {
      return HealthCheckResult(
        ok: false,
        adapterType: type,
        latencyMs: 0,
        message: 'URL endpoint $displayName belum dikonfigurasi.',
      );
    }

    final sw = Stopwatch()..start();
    try {
      final res = await client
          .get(Uri.parse('$_baseUrl/health'), headers: _headers())
          .timeout(const Duration(seconds: 8));
      sw.stop();
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return HealthCheckResult(
          ok: true,
          adapterType: type,
          latencyMs: sw.elapsedMilliseconds,
          message: '$displayName terhubung (${sw.elapsedMilliseconds} ms).',
        );
      }
      return HealthCheckResult(
        ok: false,
        adapterType: type,
        latencyMs: sw.elapsedMilliseconds,
        message: 'Server merespons HTTP ${res.statusCode}.',
      );
    } catch (e) {
      sw.stop();
      return HealthCheckResult(
        ok: false,
        adapterType: type,
        latencyMs: sw.elapsedMilliseconds,
        message: 'Tidak dapat menjangkau $_baseUrl: $e',
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
      return const OutboxPushResult(
        ok: true,
        message: 'Tidak ada antrean tertunda.',
      );
    }

    if (_baseUrl.isEmpty) {
      return OutboxPushResult(
        ok: false,
        failedErrors: {for (final i in items) i.id: 'URL endpoint $displayName belum diisi.'},
        message: 'URL endpoint $displayName belum diisi. Data tetap aman di perangkat (PENDING).',
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
          'uuid': item.id,
          'targetTable': item.targetTable,
          'recordId': item.recordId,
          'mutationType': item.mutationType,
          'createdAt': item.createdAt.toIso8601String(),
          'payload': parsedPayload,
        };
      }).toList();

      final res = await client
          .post(
            Uri.parse('$_baseUrl/sync/push'),
            headers: _headers(),
            body: jsonEncode({
              'storeId': config.storeId,
              'storeName': storeName,
              'deviceId': deviceId,
              'adapterType': type.code,
              'events': events,
            }),
          )
          .timeout(const Duration(seconds: 20));

      if (res.statusCode < 200 || res.statusCode >= 300) {
        final msg = 'Server menolak sinkronisasi (HTTP ${res.statusCode}).';
        return OutboxPushResult(
          ok: false,
          failedErrors: {for (final i in items) i.id: msg},
          message: msg,
        );
      }

      final decoded = jsonDecode(res.body);
      final ackSet = <String>{};
      final ackIds = <String>[];
      final serverSeqs = <String, int>{};

      if (decoded is Map<String, dynamic>) {
        final rawAckIds = decoded['acknowledgedIds'];
        if (rawAckIds is List) {
          for (final id in rawAckIds) {
            if (id is String && ackSet.add(id)) {
              ackIds.add(id);
            }
          }
        }
        final rawAcks = decoded['acks'];
        if (rawAcks is List) {
          for (final ack in rawAcks) {
            if (ack is Map) {
              final id = (ack['uuid'] ?? ack['queue_id'] ?? ack['id'])?.toString();
              if (id != null && id.isNotEmpty) {
                if (ackSet.add(id)) ackIds.add(id);
                final seq = ack['server_seq'] ?? ack['serverSeq'];
                if (seq is num) serverSeqs[id] = seq.toInt();
              }
            }
          }
        }
      }

      final failedErrors = <String, String>{};
      for (final item in items) {
        if (!ackSet.contains(item.id)) {
          failedErrors[item.id] = 'Server tidak mengembalikan konfirmasi ACK untuk item ini.';
        }
      }

      return OutboxPushResult(
        ok: ackIds.isNotEmpty && failedErrors.isEmpty,
        acknowledgedIds: ackIds,
        serverSeqs: serverSeqs,
        failedErrors: failedErrors,
        message: ackIds.isNotEmpty
            ? '${ackIds.length} catatan dikonfirmasi diterima oleh $displayName.'
            : 'Tidak ada item yang mendapat konfirmasi ACK dari $displayName.',
      );
    } catch (e) {
      final msg = 'Gagal menghubungi $displayName: $e';
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
    if (_baseUrl.isEmpty) {
      return PullChangesResult(
        ok: false,
        message: 'URL endpoint $displayName belum diisi.',
      );
    }
    try {
      final uri = Uri.parse('$_baseUrl/sync/pull').replace(queryParameters: {
        'since_seq': sinceSeq.toString(),
        'device_id': deviceId,
        'store_id': config.storeId,
      });
      final res = await client.get(uri, headers: _headers()).timeout(const Duration(seconds: 15));
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return PullChangesResult(
          ok: false,
          message: 'Gagal menarik data (HTTP ${res.statusCode}).',
        );
      }
      final decoded = jsonDecode(res.body);
      final rawRecords = decoded is Map ? (decoded['records'] as List? ?? []) : (decoded is List ? decoded : []);
      final records = rawRecords.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      final lastSeq = decoded is Map && decoded['lastServerSeq'] is num
          ? (decoded['lastServerSeq'] as num).toInt()
          : null;
      return PullChangesResult(
        ok: true,
        records: records,
        lastServerSeq: lastSeq,
        message: '${records.length} pembaruan ditarik dari $displayName.',
      );
    } catch (e) {
      return PullChangesResult(
        ok: false,
        message: 'Gagal menarik data: $e',
      );
    }
  }

  @override
  Future<MediaUploadResult> uploadMedia({
    required String mediaId,
    required String mediaType,
    required String localFilePath,
  }) async {
    if (_baseUrl.isEmpty) {
      return const MediaUploadResult(ok: false, errorMessage: 'URL endpoint belum diisi.');
    }
    try {
      final file = File(localFilePath);
      if (!await file.exists()) {
        return const MediaUploadResult(ok: false, errorMessage: 'File bukti lokal tidak ditemukan.');
      }
      final req = http.MultipartRequest('POST', Uri.parse('$_baseUrl/media/upload'));
      req.headers.addAll(_headers()..remove('Content-Type'));
      req.fields['mediaId'] = mediaId;
      req.fields['mediaType'] = mediaType;
      req.fields['storeId'] = config.storeId;
      req.files.add(await http.MultipartFile.fromPath('file', localFilePath));

      final streamed = await client.send(req).timeout(const Duration(seconds: 25));
      final body = await streamed.stream.bytesToString();
      if (streamed.statusCode >= 200 && streamed.statusCode < 300) {
        final decoded = jsonDecode(body);
        final url = decoded is Map ? decoded['url']?.toString() : null;
        if (url != null && url.isNotEmpty) {
          return MediaUploadResult(ok: true, remoteUrl: url);
        }
      }
      return MediaUploadResult(
        ok: false,
        errorMessage: 'Upload media ditolak server (HTTP ${streamed.statusCode}).',
      );
    } catch (e) {
      return MediaUploadResult(ok: false, errorMessage: e.toString());
    }
  }

  @override
  Future<Map<String, dynamic>?> parseVoiceOrder(String transcript) async {
    if (_baseUrl.isEmpty) return null;
    try {
      final res = await client
          .post(
            Uri.parse('$_baseUrl/ai/voice-parse'),
            headers: _headers(),
            body: jsonEncode({'transcript': transcript}),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic> && decoded['success'] == true) {
          return decoded;
        }
      }
    } catch (_) {}
    return null;
  }

  @override
  Future<Map<String, dynamic>?> fetchAdvisorInsight(
    Map<String, dynamic> operationalSnapshot,
  ) async {
    if (_baseUrl.isEmpty) return null;
    try {
      final res = await client
          .post(
            Uri.parse('$_baseUrl/ai/advisor'),
            headers: _headers(),
            body: jsonEncode(operationalSnapshot),
          )
          .timeout(const Duration(seconds: 12));
      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic> && decoded['success'] == true) {
          return decoded;
        }
      }
    } catch (_) {}
    return null;
  }
}
