import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/lots_table.dart';
import '../tables/stock_summary_table.dart';

/// DAO untuk Manajemen Stok, FEFO (First Expired First Out), & Konversi Daging (Yield Loss)
class StockDao {
  final AppDatabase db;

  StockDao(this.db);

  /// BR-FEFO: Mengambil lot-lot aktif yang masih memiliki stok untuk produk tertentu,
  /// diurutkan dari tanggal kedaluwarsa paling dekat (First Expired, First Out).
  Future<List<LotEntry>> getActiveLotsFefo(String productId) async {
    final query = db.select(db.lotsTable)
      ..where((tbl) => tbl.productId.equals(productId) & tbl.isQuarantined.equals(false) & tbl.currentWeightGram.isBiggerThanValue(0))
      ..orderBy([(tbl) => OrderingTerm.asc(tbl.expiryDate)]);
    return query.get();
  }

  /// BR-051 & BR-052: Konversi Potong Daging (Trimming Primal ke Tetelan & Yield Loss)
  /// Contoh: Primal Cut 10.000 gr dipotong menjadi:
  /// - Tetelan Masuk (IN_CONVERSION): 8.500 gr
  /// - Cutting Loss / Lemak Dibuang (OUT_CUTTING_LOSS): 1.500 gr
  Future<void> performCuttingConversion({
    required String conversionEventId,
    required String sourceLotId,
    required String sourceProductId,
    required int sourceGramUsed,
    required String targetProductId, // misal Tetelan
    required String targetLotCode,
    required DateTime targetExpiryDate,
    required int targetGramProduced,
    required int cuttingLossGram,
    required String performedByUserId,
    required String deviceId,
    String? notes,
  }) async {
    // Validasi integritas berat: sourceGramUsed harus sama dengan targetGramProduced + cuttingLossGram
    if (sourceGramUsed != (targetGramProduced + cuttingLossGram)) {
      throw ArgumentError(
        'Integritas Yield Gagal: Berat Asal ($sourceGramUsed gr) != Hasil ($targetGramProduced gr) + Susut Potong ($cuttingLossGram gr)',
      );
    }

    await db.transaction(() async {
      // 1. Ambil lot asal untuk hitung HPP
      final sourceLot = await (db.select(db.lotsTable)..where((tbl) => tbl.id.equals(sourceLotId))).getSingle();
      final totalSourceCost = sourceLot.hppPerGramRupiah * BigInt.from(sourceGramUsed);

      // HPP produk turunan menanggung seluruh biaya bahan baku asal (karena cutting loss tidak bernilai jual)
      final targetHppPerGram = totalSourceCost ~/ BigInt.from(targetGramProduced);

      // 2. Potong stok lot asal melalui OUT_CONVERSION
      await db.appendStockLedger(
        id: '${conversionEventId}_OUT',
        productId: sourceProductId,
        lotId: sourceLotId,
        movementType: 'OUT_CONVERSION',
        weightGram: sourceGramUsed,
        referenceNumber: conversionEventId,
        referenceType: 'CONVERSION',
        hppPerGramRupiah: sourceLot.hppPerGramRupiah,
        performedByUserId: performedByUserId,
        deviceId: deviceId,
        notes: notes ?? 'Pemotongan primal ke tetelan',
      );

      // Update sisa berat lot asal
      final updatedSourceWeight = sourceLot.currentWeightGram - sourceGramUsed;
      await (db.update(db.lotsTable)..where((tbl) => tbl.id.equals(sourceLotId))).write(
        LotsCompanion(currentWeightGram: Value(updatedSourceWeight)),
      );

      // 3. Catat Limpahan Susut Potong (OUT_CUTTING_LOSS) untuk akuntansi susut
      await db.appendStockLedger(
        id: '${conversionEventId}_LOSS',
        productId: sourceProductId,
        lotId: sourceLotId,
        movementType: 'OUT_CUTTING_LOSS',
        weightGram: cuttingLossGram,
        referenceNumber: conversionEventId,
        referenceType: 'CONVERSION',
        hppPerGramRupiah: BigInt.zero, // Limbah susut dinilai 0
        performedByUserId: performedByUserId,
        deviceId: deviceId,
        notes: 'Susut lemak/tulang pemotongan (Yield Loss)',
      );

      // 4. Buat Lot Baru untuk Produk Hasil Konversi (Tetelan)
      final newLotId = 'LOT_${DateTime.now().millisecondsSinceEpoch}';
      await db.into(db.lotsTable).insert(
        LotsCompanion.insert(
          id: newLotId,
          productId: targetProductId,
          lotCode: targetLotCode,
          expiryDate: targetExpiryDate,
          initialWeightGram: targetGramProduced,
          currentWeightGram: targetGramProduced,
          hppPerGramRupiah: targetHppPerGram,
          storageLocation: const Value('COLD_STORAGE_UTAMA'),
          createdAt: Value(DateTime.now()),
          updatedAt: Value(DateTime.now()),
        ),
      );

      // 5. Masukkan stok hasil konversi melalui IN_CONVERSION
      await db.appendStockLedger(
        id: '${conversionEventId}_IN',
        productId: targetProductId,
        lotId: newLotId,
        movementType: 'IN_CONVERSION',
        weightGram: targetGramProduced,
        referenceNumber: conversionEventId,
        referenceType: 'CONVERSION',
        hppPerGramRupiah: targetHppPerGram,
        performedByUserId: performedByUserId,
        deviceId: deviceId,
        notes: 'Hasil konversi dari lot ${sourceLot.lotCode}',
      );
    });
  }
}
