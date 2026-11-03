import 'dart:convert';
import 'package:http/http.dart' as http;
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
      productSku: json['productSku'] ?? 'SKU-GENERIC',
      productName: json['productName'] ?? 'Produk Daging',
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
      customerName: json['customerName'] ?? 'Pelanggan Umum',
      paymentMethod: json['paymentMethod'] ?? 'CASH',
      tempoDays: (json['tempoDays'] as num?)?.toInt() ?? 0,
      notes: json['notes'] ?? '',
      confidenceScore: (json['confidenceScore'] as num?)?.toDouble() ?? 0.9,
      items: rawItems.map((e) => VoiceParsedItem.fromJson(e)).toList(),
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

/// Service MOD-21: Voice Note Order Parsing via Edge/Backend Proxy
class VoiceOrderParserService {
  final String apiBaseUrl;

  VoiceOrderParserService({
    this.apiBaseUrl = 'http://localhost:3000/api/ai',
  });

  /// Mengirim transkrip suara WhatsApp atau rekaman mic sales ke server untuk diekstrak
  Future<VoiceParsedOrder> parseVoiceTranscript(String transcript) async {
    try {
      final response = await http.post(
        Uri.parse('$apiBaseUrl/voice-parse'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'transcript': transcript}),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded['success'] == true) {
          return VoiceParsedOrder.fromJson(decoded['data'], decoded['source'] ?? 'gemini-3.8-flash');
        }
      }
    } catch (_) {
      // Offline fallback
    }

    // Heuristic parser jika offline di daerah tanpa sinyal
    final lower = transcript.toLowerCase();
    String cust = 'Pelanggan Umum';
    if (lower.contains('steakhouse') || lower.contains('banten')) {
      cust = 'Steakhouse Banten Prima';
    } else if (lower.contains('bakso')) {
      cust = 'Warung Bakso Sampora';
    }

    final isTempo = lower.contains('tempo') || lower.contains('minggu');
    final items = <VoiceParsedItem>[];

    if (lower.contains('ribeye')) {
      items.add(VoiceParsedItem(
        productSku: 'SKU-RIBEYE-AUS',
        productName: 'Australian Ribeye Chilled',
        weightGram: 2000,
        unitPriceRupiah: 195000,
      ));
    }
    if (lower.contains('tetelan') || lower.contains('cincang')) {
      items.add(VoiceParsedItem(
        productSku: 'SKU-TETELAN-01',
        productName: 'Tetelan / Cincang Super',
        weightGram: 3000,
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
      paymentMethod: isTempo ? 'TEMPO' : 'CASH',
      tempoDays: isTempo ? 7 : 0,
      notes: 'Diparsing offline dari suara: "$transcript"',
      confidenceScore: 0.85,
      items: items,
      source: 'offline-regex-parser',
    );
  }
}
