/// Helper Utilitas Penyelaras Tipe Data Uang & Berat (Zero-Float Policy)
/// Menyelaraskan int dan BigInt secara konsisten dengan Drift SQLite Int64Column
class MoneyUtils {
  /// Mengonversi nilai dinamis (int, num, String, BigInt) ke BigInt secara aman
  static BigInt toBigInt(dynamic value) {
    if (value == null) return BigInt.zero;
    if (value is BigInt) return value;
    if (value is int) return BigInt.from(value);
    if (value is num) return BigInt.from(value.round());
    if (value is String) {
      final cleaned = value.replaceAll(RegExp(r'[^0-9\-]'), '');
      return BigInt.tryParse(cleaned) ?? BigInt.zero;
    }
    return BigInt.zero;
  }

  /// Mengonversi BigInt ke int secara aman untuk komponen UI yang membutuhkan int
  static int toInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is BigInt) {
      if (value.isValidInt) return value.toInt();
      return value > BigInt.from(2147483647) ? 2147483647 : value.toInt();
    }
    if (value is num) return value.round();
    if (value is String) {
      final cleaned = value.replaceAll(RegExp(r'[^0-9\-]'), '');
      return int.tryParse(cleaned) ?? 0;
    }
    return 0;
  }

  /// Format Rupiah dengan pemisah ribuan titik tanpa desimal
  static String formatRupiah(dynamic amount) {
    final b = toBigInt(amount);
    final isNegative = b < BigInt.zero;
    final absStr = b.abs().toString();
    final buffer = StringBuffer();
    for (int i = 0; i < absStr.length; i++) {
      if (i > 0 && (absStr.length - i) % 3 == 0) {
        buffer.write('.');
      }
      buffer.write(absStr[i]);
    }
    return '${isNegative ? "-Rp " : "Rp "}${buffer.toString()}';
  }

  /// Hitung Subtotal Penjualan Daging Zero-Float: (Gram * HargaPerKG) / 1000
  static BigInt calculateSubtotal({
    required int weightGram,
    required dynamic pricePerKgRupiah,
  }) {
    final priceBig = toBigInt(pricePerKgRupiah);
    return (BigInt.from(weightGram) * priceBig) ~/ BigInt.from(1000);
  }
}
