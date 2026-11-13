import '../config/app_config.dart';

/// Jenis Backend Adapter yang didukung ERP KARKASIA.
/// Mengganti adapter tidak boleh mengubah UI maupun aturan bisnis ERP.
enum BackendAdapterType {
  localOnly('LOCAL_ONLY', 'Mode Lokal Mandiri (Tanpa Server)', false),
  restApi('REST_API', 'REST API Mandiri', true),
  zimaOs('ZIMAOS', 'ZimaOS Self-Hosted Server', true),
  postgresBridge('POSTGRES_BRIDGE', 'PostgreSQL HTTP Bridge', true),
  googleSheets('GOOGLE_SHEETS', 'Google Sheets', true),
  supabase('SUPABASE', 'Supabase (Opsional)', true);

  final String code;
  final String displayName;
  final bool requiresNetwork;

  const BackendAdapterType(this.code, this.displayName, this.requiresNetwork);

  static BackendAdapterType fromCode(String? code) {
    for (final value in BackendAdapterType.values) {
      if (value.code.toUpperCase() == (code ?? '').trim().toUpperCase()) {
        return value;
      }
    }
    return BackendAdapterType.localOnly;
  }
}

class BackendConfig {
  final BackendAdapterType adapterType;
  final String storeId;
  final String endpointUrl;
  final String apiKeyOrToken;
  final String supabaseUrl;
  final String supabaseAnonKey;
  final String googleSheetId;
  final String googleSheetRange;

  const BackendConfig({
    this.adapterType = BackendAdapterType.localOnly,
    this.storeId = 'TOKO_KARKASIA_01',
    this.endpointUrl = '',
    this.apiKeyOrToken = '',
    this.supabaseUrl = '',
    this.supabaseAnonKey = '',
    this.googleSheetId = '',
    this.googleSheetRange = 'OutboxSync!A:H',
  });

  factory BackendConfig.fromEnvironmentDefaults() {
    return BackendConfig(
      adapterType: BackendAdapterType.fromCode(AppConfig.defaultBackendAdapter),
      storeId: AppConfig.storeId,
      endpointUrl: AppConfig.apiBaseUrl,
      supabaseUrl: AppConfig.supabaseUrl,
      supabaseAnonKey: AppConfig.supabaseAnonKey,
    );
  }

  BackendConfig copyWith({
    BackendAdapterType? adapterType,
    String? storeId,
    String? endpointUrl,
    String? apiKeyOrToken,
    String? supabaseUrl,
    String? supabaseAnonKey,
    String? googleSheetId,
    String? googleSheetRange,
  }) {
    return BackendConfig(
      adapterType: adapterType ?? this.adapterType,
      storeId: storeId ?? this.storeId,
      endpointUrl: endpointUrl ?? this.endpointUrl,
      apiKeyOrToken: apiKeyOrToken ?? this.apiKeyOrToken,
      supabaseUrl: supabaseUrl ?? this.supabaseUrl,
      supabaseAnonKey: supabaseAnonKey ?? this.supabaseAnonKey,
      googleSheetId: googleSheetId ?? this.googleSheetId,
      googleSheetRange: googleSheetRange ?? this.googleSheetRange,
    );
  }

  Map<String, dynamic> toJson() => {
        'adapterType': adapterType.code,
        'storeId': storeId,
        'endpointUrl': endpointUrl,
        'apiKeyOrToken': apiKeyOrToken,
        'supabaseUrl': supabaseUrl,
        'supabaseAnonKey': supabaseAnonKey,
        'googleSheetId': googleSheetId,
        'googleSheetRange': googleSheetRange,
      };

  factory BackendConfig.fromJson(Map<String, dynamic> json) {
    return BackendConfig(
      adapterType: BackendAdapterType.fromCode(json['adapterType'] as String?),
      storeId: (json['storeId'] as String?)?.trim().isNotEmpty == true
          ? (json['storeId'] as String).trim()
          : AppConfig.storeId,
      endpointUrl: (json['endpointUrl'] as String?) ?? '',
      apiKeyOrToken: (json['apiKeyOrToken'] as String?) ?? '',
      supabaseUrl: (json['supabaseUrl'] as String?) ?? '',
      supabaseAnonKey: (json['supabaseAnonKey'] as String?) ?? '',
      googleSheetId: (json['googleSheetId'] as String?) ?? '',
      googleSheetRange: (json['googleSheetRange'] as String?)?.trim().isNotEmpty == true
          ? (json['googleSheetRange'] as String).trim()
          : 'OutboxSync!A:H',
    );
  }
}

class OutboxMutationPayload {
  final String id;
  final String targetTable;
  final String recordId;
  final String mutationType;
  final String payloadJson;
  final DateTime createdAt;

  const OutboxMutationPayload({
    required this.id,
    required this.targetTable,
    required this.recordId,
    required this.mutationType,
    required this.payloadJson,
    required this.createdAt,
  });
}

class HealthCheckResult {
  final bool ok;
  final BackendAdapterType adapterType;
  final int latencyMs;
  final String message;

  const HealthCheckResult({
    required this.ok,
    required this.adapterType,
    required this.latencyMs,
    required this.message,
  });
}

class OutboxPushResult {
  final bool ok;
  final bool skippedLocalOnly;
  final List<String> acknowledgedIds;
  final Map<String, int> serverSeqs;
  final Map<String, String> failedErrors;
  final String message;

  const OutboxPushResult({
    required this.ok,
    this.skippedLocalOnly = false,
    this.acknowledgedIds = const [],
    this.serverSeqs = const {},
    this.failedErrors = const {},
    required this.message,
  });
}

class PullChangesResult {
  final bool ok;
  final bool skippedLocalOnly;
  final List<Map<String, dynamic>> records;
  final int? lastServerSeq;
  final String message;

  const PullChangesResult({
    required this.ok,
    this.skippedLocalOnly = false,
    this.records = const [],
    this.lastServerSeq,
    required this.message,
  });
}

class MediaUploadResult {
  final bool ok;
  final bool skippedLocalOnly;
  final String? remoteUrl;
  final String? errorMessage;

  const MediaUploadResult({
    required this.ok,
    this.skippedLocalOnly = false,
    this.remoteUrl,
    this.errorMessage,
  });
}

/// Kontrak Adapter Backend agnostik-vendor.
/// Seluruh komunikasi backend wajib melalui interface ini.
abstract class BackendAdapter {
  BackendAdapterType get type;
  String get displayName;
  bool get requiresNetwork;

  Future<HealthCheckResult> checkHealth();

  Future<OutboxPushResult> pushOutbox(
    List<OutboxMutationPayload> items, {
    required String storeName,
    required String deviceId,
  });

  Future<PullChangesResult> pullChanges({
    required int sinceSeq,
    required String deviceId,
  });

  Future<MediaUploadResult> uploadMedia({
    required String mediaId,
    required String mediaType,
    required String localFilePath,
  });

  Future<Map<String, dynamic>?> parseVoiceOrder(String transcript);

  Future<Map<String, dynamic>?> fetchAdvisorInsight(
    Map<String, dynamic> operationalSnapshot,
  );
}
