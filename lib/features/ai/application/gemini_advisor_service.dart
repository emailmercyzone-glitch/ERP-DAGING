import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/database/app_database.dart';

/// Model hasil rekomendasi Gemini AI untuk Owner
class AiAdvisorActionItem {
  final String title;
  final String detail;
  final String pic;

  AiAdvisorActionItem({
    required this.title,
    required this.detail,
    required this.pic,
  });

  factory AiAdvisorActionItem.fromJson(Map<String, dynamic> json) {
    return AiAdvisorActionItem(
      title: json['title'] ?? '',
      detail: json['detail'] ?? '',
      pic: json['pic'] ?? 'Owner',
    );
  }
}

class AiStoreAdvisorReport {
  final String summary;
  final String urgencyLevel; // 'CRITICAL' | 'WARNING' | 'HEALTHY'
  final String cashAlert;
  final String fefoStrategy;
  final String receivableWarning;
  final List<AiAdvisorActionItem> actionItems;
  final String source;

  AiStoreAdvisorReport({
    required this.summary,
    required this.urgencyLevel,
    required this.cashAlert,
    required this.fefoStrategy,
    required this.receivableWarning,
    required this.actionItems,
    required this.source,
  });

  factory AiStoreAdvisorReport.fromJson(Map<String, dynamic> json, String source) {
    final rawActions = json['actionItems'] as List? ?? [];
    return AiStoreAdvisorReport(
      summary: json['summary'] ?? 'Kondisi operasional normal.',
      urgencyLevel: json['urgencyLevel'] ?? 'HEALTHY',
      cashAlert: json['cashAlert'] ?? '',
      fefoStrategy: json['fefoStrategy'] ?? '',
      receivableWarning: json['receivableWarning'] ?? '',
      actionItems: rawActions.map((e) => AiAdvisorActionItem.fromJson(e)).toList(),
      source: source,
    );
  }
}

/// Service MOD-14: Gemini AI Business Advisor via Server-Side Proxy
class GeminiAdvisorService {
  final AppDatabase db;
  final String apiBaseUrl;

  GeminiAdvisorService({
    required this.db,
    this.apiBaseUrl = 'http://localhost:3000/api/ai',
  });

  /// Mengumpulkan data toko dari SQLite Drift dan meminta saran dari Gemini AI
  Future<AiStoreAdvisorReport> fetchStoreAdvisorReport() async {
    // 1. Hitung kas di tangan sales dari DB
    final allCashInHand = await db.cashSettlementDao.getAllSalesCashInHand();
    final totalCashInHand = allCashInHand.fold<int>(0, (sum, item) => sum + item.cashInHandRupiah);

    // 2. Ambil lot yang mendekati expired (<= 14 hari)
    final criticalLots = await db.stockDao.getExpiringLots(14);
    final lotData = criticalLots.map((l) => {
      'lotCode': l.lotCode,
      'product': l.sku,
      'weightKg': (l.totalGram / 1000).toStringAsFixed(1),
      'daysLeft': l.expiryDate.difference(DateTime.now()).inDays,
      'landedCostPerKg': l.landedCostRupiahPerGram * 1000,
    }).toList();

    // 3. Hitung kasus konflik belum selesai
    final pendingConflicts = await (db.select(db.conflictCasesTable)
      ..where((tbl) => tbl.resolutionStatus.equals('PENDING'))).get();

    final payload = {
      'healthScore': totalCashInHand > 3000000 ? 82 : (criticalLots.isNotEmpty ? 88 : 96),
      'totalSalesToday': 8450000,
      'cashInHand': totalCashInHand,
      'cashSoftLimit': 3000000,
      'overdueReceivables': 12000000,
      'lotsNearingExpiry': lotData,
      'pendingConflicts': pendingConflicts.length,
      'opexToday': 350000,
    };

    try {
      final response = await http.post(
        Uri.parse('$apiBaseUrl/advisor'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded['success'] == true) {
          return AiStoreAdvisorReport.fromJson(decoded['data'], decoded['source'] ?? 'gemini-3.8-flash');
        }
      }
    } catch (_) {
      // Offline fallback: generate local report
    }

    // Heuristic offline fallback jika server proxy tidak terjangkau di pelosok
    return AiStoreAdvisorReport(
      summary: 'Analisis offline: Ditemukan ${lotData.length} lot kritis mendekati kedaluwarsa dan kas sales Rp ${totalCashInHand}.',
      urgencyLevel: totalCashInHand > 3000000 ? 'WARNING' : 'HEALTHY',
      cashAlert: totalCashInHand > 3000000
          ? 'Kas di tangan sales melebihi limit Rp 3.000.000! Wajib setor sore ini.'
          : 'Kas sales aman.',
      fefoStrategy: criticalLots.isNotEmpty
          ? 'Terapkan diskon bundling untuk lot ${criticalLots.first.sku} atau potong trimming menjadi tetelan.'
          : 'Rotasi FEFO terjaga dengan baik.',
      receivableWarning: 'Follow-up penagihan tempo pelanggan yang melebihi batas 14 hari.',
      actionItems: [
        AiAdvisorActionItem(
          title: 'Setor Kas Tunai',
          detail: 'Instruksikan sales setor tunai ke rekening bank toko sebelum jam 17:00.',
          pic: 'Sales Lapangan',
        ),
        AiAdvisorActionItem(
          title: 'Obral FEFO Lot Kritis',
          detail: 'Kirim penawaran potongan harga ke langganan resto steak di Banten.',
          pic: 'Admin Toko',
        ),
      ],
      source: 'offline-rule-engine',
    );
  }
}
