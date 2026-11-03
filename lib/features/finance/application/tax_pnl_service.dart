import 'package:drift/drift.dart';
import '../../../core/database/app_database.dart';

/// Laporan Laba Rugi Bersih & Estimasi Pajak UMKM
class ProfitAndLossReport {
  final DateTime startDate;
  final DateTime endDate;
  final BigInt grossRevenueRupiah; // Total Omzet Bruto
  final BigInt costOfGoodsSoldRupiah; // Total HPP Daging Terjual
  final BigInt grossProfitRupiah; // Laba Kotor = Omzet - HPP
  final BigInt totalOpexRupiah; // Biaya Operasional (Es, Plastik, BBM, dll)
  final BigInt netOperatingProfitRupiah; // Laba Bersih = Laba Kotor - OPEX
  final BigInt estimatedUmkmTaxRupiah; // PPh Final UMKM 0.5% (PP 23/2018)
  final BigInt netProfitAfterTaxRupiah; // Laba Bersih Setelah Pajak

  ProfitAndLossReport({
    required this.startDate,
    required this.endDate,
    required this.grossRevenueRupiah,
    required this.costOfGoodsSoldRupiah,
    required this.grossProfitRupiah,
    required this.totalOpexRupiah,
    required this.netOperatingProfitRupiah,
    required this.estimatedUmkmTaxRupiah,
    required this.netProfitAfterTaxRupiah,
  });
}

/// MOD-13: Layanan Kalkulator Pajak & Laporan Laba Bersih Sederhana
class TaxPnlService {
  final AppDatabase db;

  TaxPnlService(this.db);

  /// Menghitung Laporan Laba Rugi & Estimasi Pajak UMKM 0.5% secara instan
  Future<ProfitAndLossReport> generatePnlReport({
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    // 1. Ambil seluruh transaksi penjualan non-VOID dalam rentang tanggal
    final transactions = await (db.select(db.transactionsTable)
          ..where((tbl) => 
              tbl.transactionDate.isBiggerOrEqualValue(startDate) & 
              tbl.transactionDate.isSmallerOrEqualValue(endDate) & 
              tbl.status.isNotValue('VOID')))
        .get();

    BigInt grossRevenue = BigInt.zero;
    for (final tx in transactions) {
      grossRevenue += tx.grandTotalRupiah;
    }

    // 2. Ambil seluruh item transaksi untuk menghitung HPP Aktual
    final txIds = transactions.map((t) => t.id).toList();
    BigInt totalCogs = BigInt.zero;

    if (txIds.isNotEmpty) {
      final items = await (db.select(db.transactionItemsTable)
            ..where((tbl) => tbl.transactionId.isIn(txIds)))
          .get();

      for (final it in items) {
        // HPP Item = (Gram * HppPerGram)
        totalCogs += (BigInt.from(it.weightGram) * it.hppPerGramRupiah);
      }
    }

    // 3. Ambil total OPEX Kasir Kecil
    final opexList = await (db.select(db.pettyCashOpexTable)
          ..where((tbl) => 
              tbl.expenseDate.isBiggerOrEqualValue(startDate) & 
              tbl.expenseDate.isSmallerOrEqualValue(endDate)))
        .get();

    BigInt totalOpex = BigInt.zero;
    for (final op in opexList) {
      totalOpex += op.amountRupiah;
    }

    // 4. Kalkulasi Laba & Pajak UMKM 0.5%
    final grossProfit = grossRevenue - totalCogs;
    final netOperating = grossProfit - totalOpex;
    
    // Pajak UMKM 0.5% dari Omzet Bruto = (grossRevenue * 5) / 1000
    final estimatedTax = (grossRevenue * BigInt.from(5)) ~/ BigInt.from(1000);
    final netAfterTax = netOperating - estimatedTax;

    return ProfitAndLossReport(
      startDate: startDate,
      endDate: endDate,
      grossRevenueRupiah: grossRevenue,
      costOfGoodsSoldRupiah: totalCogs,
      grossProfitRupiah: grossProfit,
      totalOpexRupiah: totalOpex,
      netOperatingProfitRupiah: netOperating,
      estimatedUmkmTaxRupiah: estimatedTax,
      netProfitAfterTaxRupiah: netAfterTax,
    );
  }
}
