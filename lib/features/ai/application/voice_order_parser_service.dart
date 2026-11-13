import '../../../core/backend/backend_adapter.dart';
import '../../pos/application/pos_service.dart';

/// Item hasil ekstraksi NLP suara
class VoiceParsedItem {
  final String productSku;
  final String productName;
  final int weightGram;
  final int quantityPcs;
  final int unitPriceRupiah;

  VoiceParsedItem({
    required this.productSku,
    required this.productName,
    required this.weightGram,
    this.quantityPcs = 1,
    required this.unitPriceRupiah,
  });

  factory VoiceParsedItem.fromJson(Map<String, dynamic> json) {
    return VoiceParsedItem(
      productSku: (json['productSku'] as String?) ?? 'SKU-GENERIC',
      productName: (json['productName'] as String?) ?? 'Produk Daging',
      weightGram: (json['weightGram'] as num?)?.toInt() ?? 1000,
      quantityPcs: (json['quantityPcs'] as num?)?.toInt() ?? 1,
      unitPriceRupiah: (json['unitPriceRupiah'] as num?)?.toInt() ?? 100000,
    );
  }
}

/// Order hasil ekstraksi voice note sales lapangan
class VoiceParsedOrder {
  final String customerName;
  final String paymentMethod; // CASH, TRANSFER, TEMPO
  final int tempoDays;
  final String notes;
  final double confidenceScore;
  final List<VoiceParsedItem> items;
  final String source;

  VoiceParsedOrder({
    required this.customerName,
    required this.paymentMethod,
    required this.tempoDays,
    required this.notes,
    required this.confidenceScore,
    required this.items,
    required this.source,
  });

  factory VoiceParsedOrder.fromJson(Map<String, dynamic> json, String source) {
    final rawItems = json['items'] as List? ?? [];
    return VoiceParsedOrder(
      customerName: (json['customerName'] as String?) ?? 'Pelanggan Umum',
      paymentMethod: (json['paymentMethod'] as String?) ?? 'CASH',
      tempoDays: (json['tempoDays'] as num?)?.toInt() ?? 0,
      notes: (json['notes'] as String?) ?? '',
      confidenceScore: (json['confidenceScore'] as num?)?.toDouble() ?? 0.9,
      items: rawItems
          .whereType<Map>()
          .map((e) => VoiceParsedItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      source: source,
    );
  }

  /// Konversi langsung ke Cart Item untuk POS Checkout
  List<CartItemRequest> toCartItems() {
    return items.map((item) {
      return CartItemRequest(
        productSku: item.productSku,
        quantityPcs: item.quantityPcs,
        weightGram: item.weightGram,
        unitPriceRupiah: item.unitPriceRupiah,
        isCatchWeight: true,
      );
    }).toList();
  }
}

/// Service MOD-21: Voice Note Order Parsing Local-First.
/// Tidak lagi terikat ke http://localhost:3000; opsional memanggil BackendAdapter.
class VoiceOrderParserService {
  final BackendAdapter? adapter;

  VoiceOrderParserService({
    this.adapter,
  });

  /// Ekstrak transkrip suara melalui BackendAdapter (jika aktif) atau parser NLP lokal offline.
  Future<VoiceParsedOrder> parseVoiceTranscript(String transcript) async {
    if (adapter != null && adapter!.requiresNetwork) {
      final remote = await adapter!.parseVoiceOrder(transcript);
      if (remote != null && remote['data'] is Map) {
        return VoiceParsedOrder.fromJson(
          Map<String, dynamic>.from(remote['data'] as Map),
          (remote['source'] as String?) ?? adapter!.displayName,
        );
      }
    }

    // Parser NLP lokal deterministik (berjalan 100% offline di HP Android)
    final lower = transcript.toLowerCase();
    String cust = 'Pelanggan Umum';
    if (lower.contains('grand serang') || lower.contains('hotel')) {
      cust = 'Hotel Grand Serang';
    } else if (lower.contains('steakhouse') || lower.contains('banten')) {
      cust = 'Steakhouse Banten Prima';
    } else if (lower.contains('padang')) {
      cust = 'Resto Padang Sederhana Cilegon';
    } else if (lower.contains('bakso')) {
      cust = 'Warung Bakso KARKASIA';
    }

    final isTempo = lower.contains('tempo') || lower.contains('minggu');
    final isTransfer = !isTempo && (lower.contains('transfer') || lower.contains('tf'));
    int tempoDays = 0;
    if (isTempo) {
      final matchDays = RegExp(r'tempo\s*(\d+)\s*hari').firstMatch(lower);
      if (matchDays != null) {
        tempoDays = int.tryParse(matchDays.group(1) ?? '7') ?? 7;
      } else {
        tempoDays = lower.contains('2 minggu') ? 14 : 7;
      }
    }

    int extractWeightGram(String keyword, int defaultGram) {
      final before = RegExp('(\\d+[\\.,]?\\d*)\\s*(kg|kilo|gram|gr|g)?\\s*$keyword').firstMatch(lower);
      final after = RegExp('$keyword\\s*(\\d+[\\.,]?\\d*)\\s*(kg|kilo|gram|gr|g)?').firstMatch(lower);
      final match = before ?? after;
      if (match != null) {
        final rawNum = (match.group(1) ?? '').replaceAll(',', '.');
        final unit = (match.group(2) ?? 'kg').toLowerCase();
        final val = double.tryParse(rawNum);
        if (val != null && val > 0) {
          if (unit == 'gram' || unit == 'gr' || unit == 'g') {
            return val.round();
          }
          return (val * 1000).round();
        }
      }
      return defaultGram;
    }

    final items = <VoiceParsedItem>[];

    if (lower.contains('ribeye')) {
      items.add(VoiceParsedItem(
        productSku: 'SKU-RIBEYE-AUS',
        productName: 'Australian Ribeye Chilled',
        weightGram: extractWeightGram('ribeye', 2000),
        unitPriceRupiah: 240000,
      ));
    }
    if (lower.contains('sirloin') || lower.contains('striploin')) {
      items.add(VoiceParsedItem(
        productSku: 'SKU-SIRLOIN-USA',
        productName: 'Sirloin Choice USA',
        weightGram: extractWeightGram('sirloin', 2000),
        unitPriceRupiah: 210000,
      ));
    }
    if (lower.contains('shortplate') || lower.contains('slice')) {
      final g = extractWeightGram('shortplate', 2000);
      items.add(VoiceParsedItem(
        productSku: 'SKU-SHORTPLATE-US',
        productName: 'US Beef Shortplate 500g Slice',
        weightGram: g,
        quantityPcs: (g / 500).round().clamp(1, 999),
        unitPriceRupiah: 125000,
      ));
    }
    if (lower.contains('tetelan') || lower.contains('cincang') || lower.contains('saikoro')) {
      items.add(VoiceParsedItem(
        productSku: 'SKU-TETELAN-01',
        productName: 'Tetelan / Cincang Super',
        weightGram: extractWeightGram('tetelan', 3000),
        unitPriceRupiah: 85000,
      ));
    }
    if (items.isEmpty) {
      items.add(VoiceParsedItem(
        productSku: 'SKU-SHORTPLATE-US',
        productName: 'US Beef Shortplate 500g Slice',
        weightGram: 1000,
        unitPriceRupiah: 125000,
      ));
    }

    return VoiceParsedOrder(
      customerName: cust,
      paymentMethod: isTempo ? 'TEMPO' : (isTransfer ? 'TRANSFER' : 'CASH'),
      tempoDays: tempoDays,
      notes: 'Diparsing lokal offline dari suara: "$transcript"',
      confidenceScore: 0.9,
      items: items,
      source: 'local-nlp-engine',
    );
  }
}
