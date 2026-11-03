import '../../../core/database/app_database.dart';

/// Hasil alokasi per lot batch untuk pesanan produk tertentu
class AllocatedLotChunk {
  final String lotId;
  final String lotCode;
  final DateTime expiryDate;
  final int allocatedGram;
  final BigInt hppPerGramRupiah;

  AllocatedLotChunk({
    required this.lotId,
    required this.lotCode,
    required this.expiryDate,
    required this.allocatedGram,
    required this.hppPerGramRupiah,
  });
}

/// Hasil evaluasi alokasi stok produk
class FefoAllocationResult {
  final String productId;
  final int requestedGram;
  final int totalAllocatedGram;
  final int deficitGram;
  final bool hasDeficit;
  final List<AllocatedLotChunk> chunks;

  FefoAllocationResult({
    required this.productId,
    required this.requestedGram,
    required this.totalAllocatedGram,
    required this.deficitGram,
    required this.hasDeficit,
    required this.chunks,
  });
}

/// MOD-07: Layanan Alokasi FEFO (First Expired, First Out)
/// Mengambil lot yang tanggal kedaluwarsanya paling dekat secara otomatis
class FefoAllocationService {
  final AppDatabase db;

  FefoAllocationService(this.db);

  /// Mengalokasikan gram yang diminta secara greedy dari lot-lot tertua yang aktif
  Future<FefoAllocationResult> allocateProductWeight({
    required String productId,
    required int requestedGram,
  }) async {
    // 1. Ambil lot aktif, tidak dikarantina, currentWeight > 0, urutkan expiry_date ASC
    final lots = await (db.select(db.lotsTable)
          ..where((tbl) => tbl.productId.equals(productId) & tbl.isQuarantined.equals(false) & tbl.currentWeightGram.isBiggerThanValue(0))
          ..orderBy([(tbl) => OrderingTerm.asc(tbl.expiryDate)]))
        .get();

    int remainingToAllocate = requestedGram;
    final List<AllocatedLotChunk> chunks = [];

    for (final lot in lots) {
      if (remainingToAllocate <= 0) break;

      final availableInThisLot = lot.currentWeightGram;
      final int takeGram = availableInThisLot >= remainingToAllocate 
          ? remainingToAllocate 
          : availableInThisLot;

      chunks.add(
        AllocatedLotChunk(
          lotId: lot.id,
          lotCode: lot.lotCode,
          expiryDate: lot.expiryDate,
          allocatedGram: takeGram,
          hppPerGramRupiah: lot.hppPerGramRupiah,
        ),
      );

      remainingToAllocate -= takeGram;
    }

    final totalAllocated = requestedGram - remainingToAllocate;
    final hasDeficit = remainingToAllocate > 0;

    return FefoAllocationResult(
      productId: productId,
      requestedGram: requestedGram,
      totalAllocatedGram: totalAllocated,
      deficitGram: remainingToAllocate > 0 ? remainingToAllocate : 0,
      hasDeficit: hasDeficit,
      chunks: chunks,
    );
  }
}
