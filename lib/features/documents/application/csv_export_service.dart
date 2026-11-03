/// MOD-19 & Bagian 9: Layanan Ekspor Laporan CSV (Format Standar Migrasi & Pelaporan)
class CsvExportService {
  /// Ekspor Data Stok Lot ke CSV (Format OI-02)
  static String exportLotsToCsv(List<Map<String, dynamic>> lots) {
    final StringBuffer csv = StringBuffer();
    csv.writeln('sku,lot_code,expiry_date,total_gram,total_pcs,cost_total_rupiah,storage_location');

    for (final lot in lots) {
      csv.writeln(
        '${lot['sku']},'
        '${lot['lotCode']},'
        '${lot['expiryDate']},'
        '${lot['currentWeightGram']},'
        '${lot['currentPcs'] ?? 0},'
        '${lot['hppPerGramRupiah'] * lot['currentWeightGram']},'
        '${lot['storageLocation']}',
      );
    }
    return csv.toString();
  }

  /// Ekspor Riwayat Transaksi Penjualan ke CSV
  static String exportTransactionsToCsv(List<Map<String, dynamic>> transactions) {
    final StringBuffer csv = StringBuffer();
    csv.writeln('invoice_number,transaction_date,device_id,customer_name,sales_user,subtotal,shipping_fee,grand_total,payment_method,status');

    for (final tx in transactions) {
      csv.writeln(
        '${tx['invoiceNumber']},'
        '${tx['transactionDate']},'
        '${tx['deviceId']},'
        '"${tx['customerName']}",'
        '"${tx['salesUser']}",'
        '${tx['subtotalRupiah']},'
        '${tx['shippingFeeRupiah']},'
        '${tx['grandTotalRupiah']},'
        '${tx['paymentMethod']},'
        '${tx['status']}',
      );
    }
    return csv.toString();
  }

  /// Ekspor Piutang Pelanggan ke CSV
  static String exportReceivablesToCsv(List<Map<String, dynamic>> receivables) {
    final StringBuffer csv = StringBuffer();
    csv.writeln('customer_code,customer_name,credit_limit,current_receivable,payment_term_days');

    for (final r in receivables) {
      csv.writeln(
        '${r['customerCode']},'
        '"${r['customerName']}",'
        '${r['creditLimitRupiah']},'
        '${r['currentReceivableRupiah']},'
        '${r['paymentTermDays']}',
      );
    }
    return csv.toString();
  }
}
