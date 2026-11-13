import 'dart:convert';
import 'package:http/http.dart' as http;
import 'backend_adapter.dart';

/// Adapter Google Sheets (via Google Apps Script Web App Webhook atau Sheets API v4).
class GoogleSheetsBackendAdapter implements BackendAdapter {
  final BackendConfig config;
  final http.Client client;

  GoogleSheetsBackendAdapter({
    required this.config,
    http.Client? client,
  }) : client = client ?? http.Client();

  @override
  BackendAdapterType get type => BackendAdapterType.googleSheets;

  @override
  String get displayName => 'Google Sheets';

  @override
  bool get requiresNetwork => true;

  @override
  Future<HealthCheckResult> checkHealth() async {
    final webhook = config.endpointUrl.trim();
    final sheetId = config.googleSheetId.trim();
    final token = config.apiKeyOrToken.trim();

    if (webhook.isEmpty && (sheetId.isEmpty || token.isEmpty)) {
      return const HealthCheckResult(
        ok: false,
        adapterType: BackendAdapterType.googleSheets,
        latencyMs: 0,
        message: 'Isi URL Apps Script Web App atau Spreadsheet ID + OAuth Token.',
      );
    }

    final sw = Stopwatch()..start();
    try {
      if (webhook.isNotEmpty) {
        final res = await client.get(Uri.parse(webhook)).timeout(const Duration(seconds: 8));
        sw.stop();
        return HealthCheckResult(
          ok: res.statusCode >= 200 && res.statusCode < 300,
          adapterType: BackendAdapterType.googleSheets,
          latencyMs: sw.elapsedMilliseconds,
          message: res.statusCode >= 200 && res.statusCode < 300
              ? 'Google Sheets Webhook terhubung (${sw.elapsedMilliseconds} ms).'
              : 'Webhook merespons HTTP ${res.statusCode}.',
        );
      }

      final uri = Uri.parse(
        'https://sheets.googleapis.com/v4/spreadsheets/${Uri.encodeComponent(sheetId)}?fields=spreadsheetId,properties.title',
      );
      final res = await client.get(uri, headers: {'Authorization': 'Bearer $token'}).timeout(const Duration(seconds: 8));
      sw.stop();
      return HealthCheckResult(
        ok: res.statusCode >= 200 && res.statusCode < 300,
        adapterType: BackendAdapterType.googleSheets,
        latencyMs: sw.elapsedMilliseconds,
        message: res.statusCode >= 200 && res.statusCode < 300
            ? 'Google Sheets API terhubung (${sw.elapsedMilliseconds} ms).'
            : 'Google Sheets API merespons HTTP ${res.statusCode}.',
      );
    } catch (e) {
      sw.stop();
      return HealthCheckResult(
        ok: false,
        adapterType: BackendAdapterType.googleSheets,
        latencyMs: sw.elapsedMilliseconds,
        message: 'Gagal menghubungi Google Sheets: $e',
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

    final webhook = config.endpointUrl.trim();
    final sheetId = config.googleSheetId.trim();
    final token = config.apiKeyOrToken.trim();
    final range = config.googleSheetRange.trim().isNotEmpty ? config.googleSheetRange.trim() : 'OutboxSync!A:H';

    if (webhook.isEmpty && (sheetId.isEmpty || token.isEmpty)) {
      const msg = 'Konfigurasi Google Sheets belum lengkap.';
      return OutboxPushResult(
        ok: false,
        failedErrors: {for (final i in items) i.id: msg},
        message: msg,
      );
    }

    try {
      if (webhook.isNotEmpty) {
        final res = await client
            .post(
              Uri.parse(webhook),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'action': 'sync_push',
                'storeId': config.storeId,
                'storeName': storeName,
                'deviceId': deviceId,
                'events': items
                    .map((i) => {
                          'uuid': i.id,
                          'targetTable': i.targetTable,
                          'recordId': i.recordId,
                          'mutationType': i.mutationType,
                          'createdAt': i.createdAt.toIso8601String(),
                          'payloadJson': i.payloadJson,
                        })
                    .toList(),
              }),
            )
            .timeout(const Duration(seconds: 20));

        if (res.statusCode < 200 || res.statusCode >= 300) {
          final msg = 'Google Sheets Webhook gagal (HTTP ${res.statusCode}).';
          return OutboxPushResult(
            ok: false,
            failedErrors: {for (final i in items) i.id: msg},
            message: msg,
          );
        }

        final decoded = jsonDecode(res.body);
        final ackIds = <String>[];
        if (decoded is Map && decoded['acknowledgedIds'] is List) {
          for (final id in decoded['acknowledgedIds'] as List) {
            if (id is String) ackIds.add(id);
          }
        }
        final ackSet = ackIds.toSet();
        final failedErrors = <String, String>{
          for (final i in items)
            if (!ackSet.contains(i.id)) i.id: 'Webhook tidak mengembalikan ACK untuk item ini.',
        };

        return OutboxPushResult(
          ok: ackIds.isNotEmpty && failedErrors.isEmpty,
          acknowledgedIds: ackIds,
          failedErrors: failedErrors,
          message: ackIds.isNotEmpty
              ? '${ackIds.length} baris dikonfirmasi masuk Google Sheets.'
              : 'Google Sheets Webhook tidak mengonfirmasi item.',
        );
      }

      // Direct Google Sheets API v4 append
      final rows = items
          .map((i) => [
                i.id,
                i.targetTable,
                i.recordId,
                i.mutationType,
                i.createdAt.toIso8601String(),
                i.payloadJson,
                deviceId,
                config.storeId,
              ])
          .toList();

      final uri = Uri.parse(
        'https://sheets.googleapis.com/v4/spreadsheets/${Uri.encodeComponent(sheetId)}/values/${Uri.encodeComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
      );
      final res = await client
          .post(
            uri,
            headers: {
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'values': rows}),
          )
          .timeout(const Duration(seconds: 20));

      if (res.statusCode < 200 || res.statusCode >= 300) {
        final msg = 'Google Sheets API gagal (HTTP ${res.statusCode}).';
        return OutboxPushResult(
          ok: false,
          failedErrors: {for (final i in items) i.id: msg},
          message: msg,
        );
      }

      final decoded = jsonDecode(res.body);
      final updatedRows = (decoded is Map && decoded['updates'] is Map)
          ? ((decoded['updates']['updatedRows'] as num?)?.toInt() ?? 0)
          : 0;

      if (updatedRows >= items.length) {
        return OutboxPushResult(
          ok: true,
          acknowledgedIds: items.map((i) => i.id).toList(),
          message: '$updatedRows baris berhasil dicatat ke Google Sheets.',
        );
      }

      final ackIds = items.take(updatedRows < 0 ? 0 : updatedRows).map((i) => i.id).toList();
      final ackSet = ackIds.toSet();
      return OutboxPushResult(
        ok: false,
        acknowledgedIds: ackIds,
        failedErrors: {
          for (final i in items)
            if (!ackSet.contains(i.id)) i.id: 'Baris belum terkonfirmasi masuk ke Google Sheets.',
        },
        message: 'Hanya $updatedRows dari ${items.length} baris tercatat di Google Sheets.',
      );
    } catch (e) {
      final msg = 'Gagal mengirim ke Google Sheets: $e';
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
    return const PullChangesResult(
      ok: true,
      records: [],
      message: 'Google Sheets berfungsi sebagai tujuan append outbox.',
    );
  }

  @override
  Future<MediaUploadResult> uploadMedia({
    required String mediaId,
    required String mediaType,
    required String localFilePath,
  }) async {
    return const MediaUploadResult(
      ok: false,
      errorMessage: 'Google Sheets adapter tidak mendukung upload file biner.',
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
