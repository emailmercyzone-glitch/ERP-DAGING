import 'dart:typed_data';
import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import 'package:intl/intl.dart';

/// DTO Data Struk untuk Pencetakan Thermal 58mm
class ReceiptPrintData {
  final String invoiceNumber;
  final DateTime transactionDate;
  final String salesUserName;
  final String customerName;
  final List<ReceiptItemData> items;
  final BigInt subtotalRupiah;
  final BigInt shippingFeeRupiah;
  final bool isFreeShippingStrikethrough; // BR-040
  final BigInt grandTotalRupiah;
  final String paymentMethod;
  final BigInt paidAmountRupiah;
  final BigInt changeRupiah;
  final BigInt balanceDueRupiah;

  ReceiptPrintData({
    required this.invoiceNumber,
    required this.transactionDate,
    required this.salesUserName,
    required this.customerName,
    required this.items,
    required this.subtotalRupiah,
    required this.shippingFeeRupiah,
    required this.isFreeShippingStrikethrough,
    required this.grandTotalRupiah,
    required this.paymentMethod,
    required this.paidAmountRupiah,
    required this.changeRupiah,
    required this.balanceDueRupiah,
  });
}

class ReceiptItemData {
  final String productName;
  final int weightGram;
  final BigInt pricePerKgRupiah;
  final BigInt subtotalRupiah;

  ReceiptItemData({
    required this.productName,
    required this.weightGram,
    required this.pricePerKgRupiah,
    required this.subtotalRupiah,
  });
}

/// MOD-17: Layanan Driver Printer Thermal Bluetooth ESC/POS (Lebar Kertas 58mm / 32 Karakter)
class ThermalPrinterService {
  final currencyFormat = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

  /// Mencari daftar perangkat Bluetooth printer thermal yang terpasang
  Future<List<BluetoothInfo>> scanPairedPrinters() async {
    return await PrintBluetoothThermal.pairedBluetooths;
  }

  /// Menghubungkan ke printer thermal berdasarkan Mac Address
  Future<bool> connectPrinter(String macAddress) async {
    final isConnected = await PrintBluetoothThermal.connect(macPrinterAddress: macAddress);
    return isConnected;
  }

  /// Memutuskan koneksi printer
  Future<bool> disconnectPrinter() async {
    return await PrintBluetoothThermal.disconnect;
  }

  /// Membuat payload ESC/POS byte array khusus ukuran 58mm (PaperSize.mm58)
  Future<List<int>> generate58mmReceiptBytes(ReceiptPrintData data) async {
    final profile = await CapabilityProfile.load();
    final generator = Generator(PaperSize.mm58, profile);
    List<int> bytes = [];

    // Header Toko
    bytes += generator.text(
      'ERP DAGING IMPORT',
      styles: const PosStyles(
        align: PosAlign.center,
        bold: true,
        height: PosTextSize.size2,
        width: PosTextSize.size2,
      ),
    );
    bytes += generator.text(
      'SAMPORA BANTEN • TOKO PUSAT',
      styles: const PosStyles(align: PosAlign.center, bold: true),
    );
    bytes += generator.text(
      'Telp: 0812-9876-5432 • Halal ID3611...',
      styles: const PosStyles(align: PosAlign.center),
    );
    bytes += generator.hr(ch: '=');

    // Metadata Transaksi
    bytes += generator.row([
      PosColumn(text: 'Faktur:', width: 4),
      PosColumn(text: data.invoiceNumber, width: 8, styles: const PosStyles(align: PosAlign.right, bold: true)),
    ]);
    bytes += generator.row([
      PosColumn(text: 'Tgl:', width: 4),
      PosColumn(
        text: DateFormat('dd/MM/yy HH:mm').format(data.transactionDate),
        width: 8,
        styles: const PosStyles(align: PosAlign.right),
      ),
    ]);
    bytes += generator.row([
      PosColumn(text: 'Sales:', width: 4),
      PosColumn(text: data.salesUserName, width: 8, styles: const PosStyles(align: PosAlign.right)),
    ]);
    bytes += generator.row([
      PosColumn(text: 'Cust:', width: 4),
      PosColumn(text: data.customerName, width: 8, styles: const PosStyles(align: PosAlign.right, bold: true)),
    ]);
    bytes += generator.hr(ch: '-');

    // Rincian Item Daging Catch Weight
    for (final item in data.items) {
      // Baris 1: Nama Produk
      bytes += generator.text(item.productName, styles: const PosStyles(bold: true));
      
      // Baris 2: Berat (KG) @ Harga -> Subtotal
      final kgStr = (item.weightGram / 1000).toStringAsFixed(2);
      final priceStr = currencyFormat.format(item.pricePerKgRupiah.toInt());
      final subtotalStr = currencyFormat.format(item.subtotalRupiah.toInt());

      bytes += generator.row([
        PosColumn(text: '$kgStr KG @ $priceStr', width: 7, styles: const PosStyles(fontType: PosFontType.fontB)),
        PosColumn(text: subtotalStr, width: 5, styles: const PosStyles(align: PosAlign.right, fontType: PosFontType.fontB)),
      ]);
    }
    bytes += generator.hr(ch: '-');

    // Finansial Subtotal
    bytes += generator.row([
      PosColumn(text: 'Subtotal:', width: 6),
      PosColumn(text: currencyFormat.format(data.subtotalRupiah.toInt()), width: 6, styles: const PosStyles(align: PosAlign.right)),
    ]);

    // BR-040: Struk Coret Ongkir
    if (data.isFreeShippingStrikethrough) {
      bytes += generator.row([
        PosColumn(text: 'Ongkir:', width: 6),
        PosColumn(
          text: '[CORET] GRATIS Rp 0',
          width: 6,
          styles: const PosStyles(align: PosAlign.right, bold: true),
        ),
      ]);
    } else if (data.shippingFeeRupiah > BigInt.zero) {
      bytes += generator.row([
        PosColumn(text: 'Ongkir:', width: 6),
        PosColumn(text: currencyFormat.format(data.shippingFeeRupiah.toInt()), width: 6, styles: const PosStyles(align: PosAlign.right)),
      ]);
    }

    // Grand Total (Ukuran Ganda)
    bytes += generator.hr(ch: '=');
    bytes += generator.row([
      PosColumn(text: 'TOTAL:', width: 5, styles: const PosStyles(bold: true, height: PosTextSize.size2)),
      PosColumn(
        text: currencyFormat.format(data.grandTotalRupiah.toInt()),
        width: 7,
        styles: const PosStyles(align: PosAlign.right, bold: true, height: PosTextSize.size2),
      ),
    ]);

    // Pembayaran
    bytes += generator.row([
      PosColumn(text: 'Bayar (${data.paymentMethod}):', width: 6),
      PosColumn(text: currencyFormat.format(data.paidAmountRupiah.toInt()), width: 6, styles: const PosStyles(align: PosAlign.right)),
    ]);

    if (data.changeRupiah > BigInt.zero) {
      bytes += generator.row([
        PosColumn(text: 'Kembali:', width: 6),
        PosColumn(text: currencyFormat.format(data.changeRupiah.toInt()), width: 6, styles: const PosStyles(align: PosAlign.right)),
      ]);
    }

    if (data.balanceDueRupiah > BigInt.zero) {
      bytes += generator.row([
        PosColumn(text: 'Sisa Tempo:', width: 6, styles: const PosStyles(bold: true)),
        PosColumn(text: currencyFormat.format(data.balanceDueRupiah.toInt()), width: 6, styles: const PosStyles(align: PosAlign.right, bold: true)),
      ]);
    }

    // Barcode 1D / QR Code Invoice Number
    bytes += generator.hr(ch: '-');
    bytes += generator.barcode(
      Barcode.code128(data.invoiceNumber),
      height: 45,
      width: 2,
    );

    // Footer Catatan Mutu & Retur
    bytes += generator.text(
      'Komplain mutu / susut timbangan wajib dilaporkan max 1x24 jam beserta foto bukti.',
      styles: const PosStyles(align: PosAlign.center, fontType: PosFontType.fontB),
    );
    bytes += generator.text(
      '*** TERIMA KASIH ***',
      styles: const PosStyles(align: PosAlign.center, bold: true),
    );

    // Potong Kertas / Feed Baris
    bytes += generator.feed(2);
    bytes += generator.cut();

    return bytes;
  }

  /// Mengirim byte array ke printer Bluetooth thermal yang terhubung
  Future<bool> printReceipt(ReceiptPrintData data) async {
    final isConnected = await PrintBluetoothThermal.connectionStatus;
    if (!isConnected) {
      return false;
    }

    final bytes = await generate58mmReceiptBytes(data);
    return await PrintBluetoothThermal.writeBytes(bytes);
  }
}
