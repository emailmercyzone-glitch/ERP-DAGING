import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';

/// DTO Data Surat Jalan Pengiriman Gudang
class DeliveryNoteData {
  final String deliveryNoteNumber; // SJ-261102-0042
  final String referenceInvoiceNumber; // INV-HP03-261102-0042
  final DateTime deliveryDate;
  final String courierName;
  final String vehiclePlateNumber;
  final String boxTemperatureCelsius; // e.g. -18°C
  final String customerName;
  final String customerAddress;
  final String customerPhone;
  final List<DeliveryNoteItem> items;
  final String warehouseAdminName;
  final String? notes;

  DeliveryNoteData({
    required this.deliveryNoteNumber,
    required this.referenceInvoiceNumber,
    required this.deliveryDate,
    required this.courierName,
    required this.vehiclePlateNumber,
    this.boxTemperatureCelsius = '-18°C',
    required this.customerName,
    required this.customerAddress,
    required this.customerPhone,
    required this.items,
    required this.warehouseAdminName,
    this.notes,
  });
}

class DeliveryNoteItem {
  final String sku;
  final String productName;
  final String lotCode;
  final String nkvNumber;
  final DateTime expiryDate;
  final int weightGram;
  final int? pcs;

  DeliveryNoteItem({
    required this.sku,
    required this.productName,
    required this.lotCode,
    required this.nkvNumber,
    required this.expiryDate,
    required this.weightGram,
    this.pcs,
  });
}

/// MOD-19: Generator Dokumen Resmi Surat Jalan Pengiriman (Format Standar Gudang A4)
class DeliveryNotePdfService {
  final dateFormat = DateFormat('dd MMMM yyyy, HH:mm', 'id_ID');
  final shortDate = DateFormat('dd/MM/yyyy');

  /// Menghasilkan PDF Byte Buffer Surat Jalan Pengiriman
  Future<Uint8List> generateDeliveryNotePdf(DeliveryNoteData data) async {
    final pdf = pw.Document();

    final totalWeightGram = data.items.fold(0, (sum, it) => sum + it.weightGram);
    final totalWeightKg = (totalWeightGram / 1000).toStringAsFixed(2);

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              // Header Kop Surat
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        'ERP DAGING IMPORT SAMPORA',
                        style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold, color: PdfColors.red900),
                      ),
                      pw.Text('Supplier Daging Impor Cold Chain • Sampora, Banten', style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey700)),
                      pw.Text('NKV: RPHU-3604010-019 • Telp: (0254) 8923-4567', style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey600)),
                    ],
                  ),
                  pw.Container(
                    padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(color: PdfColors.red800, width: 1.5),
                      borderRadius: pw.BorderRadius.circular(6),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.end,
                      children: [
                        pw.Text('SURAT JALAN RESMI', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: PdfColors.red900)),
                        pw.Text('NO: ${data.deliveryNoteNumber}', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                        pw.Text('Ref Faktur: ${data.referenceInvoiceNumber}', style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
                      ],
                    ),
                  ),
                ],
              ),
              pw.SizedBox(height: 12),
              pw.Divider(thickness: 1.5, color: PdfColors.red900),
              pw.SizedBox(height: 10),

              // Detail Pengiriman & Penerima
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  // Sisi Kiri: Pelanggan
                  pw.Container(
                    width: 250,
                    padding: const pw.EdgeInsets.all(8),
                    decoration: pw.BoxDecoration(color: PdfColors.grey100, borderRadius: pw.BorderRadius.circular(6)),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text('TUJUAN PENERIMA:', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.grey700)),
                        pw.Text(data.customerName, style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
                        pw.Text(data.customerAddress, style: const pw.TextStyle(fontSize: 9)),
                        pw.Text('Kontak: ${data.customerPhone}', style: const pw.TextStyle(fontSize: 9)),
                      ],
                    ),
                  ),

                  // Sisi Kanan: Ekspedisi & Armada
                  pw.Container(
                    width: 240,
                    padding: const pw.EdgeInsets.all(8),
                    decoration: pw.BoxDecoration(color: PdfColors.grey100, borderRadius: pw.BorderRadius.circular(6)),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text('INFORMASI LOGISTIK COLD-CHAIN:', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.grey700)),
                        pw.Text('Tgl Kirim: ${shortDate.format(data.deliveryDate)}', style: const pw.TextStyle(fontSize: 9)),
                        pw.Text('Kurir: ${data.courierName} (${data.vehiclePlateNumber})', style: const pw.TextStyle(fontSize: 9)),
                        pw.Text('Suhu Box Kendaraan: ${data.boxTemperatureCelsius} (Wajib Beku)', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.blue800)),
                      ],
                    ),
                  ),
                ],
              ),
              pw.SizedBox(height: 16),

              // Tabel Daging
              pw.Table(
                border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
                columnWidths: {
                  0: const pw.FixedColumnWidth(25),
                  1: const pw.FlexColumnWidth(3),
                  2: const pw.FlexColumnWidth(2),
                  3: const pw.FlexColumnWidth(1.5),
                  4: const pw.FlexColumnWidth(1.5),
                  5: const pw.FlexColumnWidth(1.5),
                },
                children: [
                  // Table Header
                  pw.TableRow(
                    decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                    children: [
                      _th('No'),
                      _th('Deskripsi Produk & SKU'),
                      _th('Batch Lot (NKV)'),
                      _th('Expired Date'),
                      _th('Kuantitas'),
                      _th('Berat Aktual'),
                    ],
                  ),
                  // Table Rows
                  ...data.items.asMap().entries.map((entry) {
                    final idx = entry.key + 1;
                    final it = entry.value;
                    return pw.TableRow(
                      children: [
                        _td('$idx', align: pw.TextAlign.center),
                        _td('${it.productName}\n[SKU: ${it.sku}]'),
                        _td('${it.lotCode}\nNKV: ${it.nkvNumber}'),
                        _td(shortDate.format(it.expiryDate), align: pw.TextAlign.center),
                        _td(it.pcs != null ? '${it.pcs} Pcs' : '-', align: pw.TextAlign.center),
                        _td('${(it.weightGram / 1000).toStringAsFixed(2)} KG\n(${it.weightGram} gr)', align: pw.TextAlign.right, isBold: true),
                      ],
                    );
                  }).toList(),
                  // Total Row
                  pw.TableRow(
                    decoration: const pw.BoxDecoration(color: PdfColors.grey100),
                    children: [
                      _td('', align: pw.TextAlign.center),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('TOTAL BERAT PENGIRIMAN FISIK', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
                      ),
                      _td(''),
                      _td(''),
                      _td('${data.items.length} Baris', align: pw.TextAlign.center),
                      _td('$totalWeightKg KG', align: pw.TextAlign.right, isBold: true),
                    ],
                  ),
                ],
              ),
              pw.SizedBox(height: 12),

              // Catatan
              pw.Container(
                padding: const pw.EdgeInsets.all(8),
                decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.grey300), borderRadius: pw.BorderRadius.circular(4)),
                child: pw.Text(
                  'PERHATIAN MUTU: Penerima wajib menimbang ulang daging dingin/beku di hadapan kurir sebelum menandatangani surat jalan. '
                  'Komplain selisih berat susut di atas toleransi atau cacat fisik wajib dicatat pada kolom catatan di hadapan kurir pengantar.',
                  style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700),
                ),
              ),

              pw.Spacer(),

              // Tanda Tangan 3 Pihak
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  _sigBox('Pengirim (Gudang Sampora)', data.warehouseAdminName),
                  _sigBox('Kurir / Pengantar', data.courierName),
                  _sigBox('Penerima / Chef / Store', 'Nama Jelas & Cap Toko'),
                ],
              ),
              pw.SizedBox(height: 8),
              pw.Center(
                child: pw.Text('Dokumen ini sah diterbitkan dari sistem ERP Daging Import V4.3 - Sampora Banten', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey500)),
              ),
            ],
          );
        },
      ),
    );

    return pdf.save();
  }

  pw.Widget _th(String text) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(6),
      child: pw.Text(text, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold), textAlign: pw.TextAlign.center),
    );
  }

  pw.Widget _td(String text, {pw.TextAlign align = pw.TextAlign.left, bool isBold = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(5),
      child: pw.Text(
        text,
        style: pw.TextStyle(fontSize: 8.5, fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal),
        textAlign: align,
      ),
    );
  }

  pw.Widget _sigBox(String role, String name) {
    return pw.Container(
      width: 160,
      child: pw.Column(
        children: [
          pw.Text(role, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 48), // Ruang tanda tangan
          pw.Container(width: 140, height: 1, color: PdfColors.grey600),
          pw.SizedBox(height: 3),
          pw.Text(name, style: const pw.TextStyle(fontSize: 8.5)),
        ],
      ),
    );
  }
}
