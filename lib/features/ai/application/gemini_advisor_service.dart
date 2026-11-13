import 'package:drift/drift.dart';
import '../../../core/backend/backend_adapter.dart';
import '../../../core/database/app_database.dart';
import '../../../core/database/daos/stock_dao.dart';

/// Model hasil rekomendasi Advisor untuk Owner
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
      title: (json['title'] as String?) ?? '',
      detail: (json['detail'] as String?) ?? '',
      pic: (json['pic'] as String?) ?? 'Owner',
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
      summary: (json['summary'] as String?) ?? 'Kondisi operasional normal.',
      urgencyLevel: (json['urgencyLevel'] as String?) ?? 'HEALTHY',
      cashAlert: (json['cashAlert'] as String?) ?? '',
      fefoStrategy: (json['fefoStrategy'] as String?) ?? '',
      receivableWarning: (json['receivableWarning'] as String?) ?? '',
      actionItems: rawActions
          .whereType<Map>()
          .map((e) => AiAdvisorActionItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      source: source,
    );
  }
}

/// Service MOD-14: Business Advisor Local-First (berjalan penuh offline via SQLite,
/// dan opsional memanggil BackendAdapter eksternal jika dikonfigurasi).
class GeminiAdvisorService {
  final AppDatabase db;
  final BackendAdapter? adapter;

  GeminiAdvisorService({
    required this.db,
    this.adapter,
  });

  /// Mengumpulkan data toko dari SQLite Drift dan menghasilkan analisis operasional.
  Future<AiStoreAdvisorReport> fetchStoreAdvisorReport() async {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);

    // 1. Hitung kas di tangan sales (transaksi CASH belum disetor, dikurangi kembalian)
    final unsettledCashTxs = await (db.select(db.transactionsTable)
          ..where((tbl) =>
              tbl.paymentMethod.equals('CASH') &
              tbl.settlementId.isNull() &
              tbl.status.isNotValue('VOID')))
        .get();
    final totalCashInHand = unsettledCashTxs.fold<int>(0, (sum, tx) {
      final netCash = tx.paidAmountRupiah - tx.changeRupiah;
      return sum + (netCash > BigInt.zero ? netCash.toInt() : 0);
    });

    // 2. Total penjualan hari ini
    final todayTxs = await (db.select(db.transactionsTable)
          ..where((tbl) =>
              tbl.transactionDate.isBiggerOrEqualValue(todayStart) &
              tbl.status.isNotValue('VOID')))
        .get();
    final totalSalesToday =
        todayTxs.fold<int>(0, (sum, tx) => sum + tx.grandTotalRupiah.toInt());

    // 3. Ambil lot yang mendekati expired (<= 14 hari)
    final criticalLots = await StockDao(db).getExpiringLots(14);
    final lotData = criticalLots
        .map((l) => {
              'lotCode': l.lotCode,
              'product': l.productId,
              'weightKg': (l.currentWeightGram / 1000).toStringAsFixed(1),
              'daysLeft': l.expiryDate.difference(now).inDays,
              'landedCostPerKg': (l.hppPerGramRupiah * BigInt.from(1000)).toInt(),
            })
        .toList();

    // 4. Hitung piutang overdue / berjalan
    final customers = await db.select(db.customersTable).get();
    final totalReceivables = customers.fold<int>(
      0,
      (sum, c) => sum + c.currentReceivableRupiah.toInt(),
    );

    // 5. Hitung kasus konflik belum selesai
    final pendingConflicts = await (db.select(db.conflictCasesTable)
          ..where((tbl) => tbl.resolutionStatus.equals('PENDING')))
        .get();

    final payload = {
      'healthScore': totalCashInHand > 3000000 ? 82 : (criticalLots.isNotEmpty ? 88 : 96),
      'totalSalesToday': totalSalesToday,
      'cashInHand': totalCashInHand,
      'cashSoftLimit': 3000000,
      'overdueReceivables': totalReceivables,
      'lotsNearingExpiry': lotData,
      'pendingConflicts': pendingConflicts.length,
      'opexToday': 0,
    };

    // Opsional melalui BackendAdapter jika server adapter aktif & online
    if (adapter != null && adapter!.requiresNetwork) {
      final remote = await adapter!.fetchAdvisorInsight(payload);
      if (remote != null && remote['data'] is Map) {
        return AiStoreAdvisorReport.fromJson(
          Map<String, dynamic>.from(remote['data'] as Map),
          (remote['source'] as String?) ?? adapter!.displayName,
        );
      }
    }

    // Rule engine lokal mandiri (berjalan 100% offline tanpa server)
    return AiStoreAdvisorReport(
      summary:
          'Analisis lokal: Terpantau ${lotData.length} lot mendekati kedaluwarsa, kas sales Rp $totalCashInHand, dan ${pendingConflicts.length} konflik stok.',
      urgencyLevel:
          pendingConflicts.isNotEmpty || totalCashInHand > 3000000 ? 'WARNING' : 'HEALTHY',
      cashAlert: totalCashInHand > 3000000
          ? 'Kas di tangan sales (Rp $totalCashInHand) melebihi batas aman Rp 3.000.000! Wajib setor hari ini.'
          : 'Kas sales aman di angka Rp $totalCashInHand.',
      fefoStrategy: criticalLots.isNotEmpty
          ? 'Prioritaskan jual cepat lot ${criticalLots.first.lotCode} atau konversi menjadi tetelan.'
          : 'Rotasi FEFO terjaga dengan baik.',
      receivableWarning: totalReceivables > 0
          ? 'Total piutang pelanggan aktif saat ini Rp $totalReceivables. Pantau jatuh tempo di tab Tagihan.'
          : 'Tidak ada piutang pelanggan tertunggak.',
      actionItems: [
        AiAdvisorActionItem(
          title: 'Setor Kas Tunai',
          detail: 'Pastikan setoran tunai sales dicatat di menu Setoran Kas sebelum tutup toko.',
          pic: 'Sales Lapangan',
        ),
        AiAdvisorActionItem(
          title: 'Prioritaskan Lot FEFO',
          detail: criticalLots.isNotEmpty
              ? 'Jual terlebih dahulu lot ${criticalLots.first.lotCode} sesuai urutan FEFO.'
              : 'Lanjutkan pemantauan stok harian di Cold Storage.',
          pic: 'Admin Toko',
        ),
      ],
      source: 'offline-rule-engine',
    );
  }
}
