import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// MOD-04: Layanan UI POS Unified Dual-Mode (Modern Enterprise B2B SaaS)
/// Menangani Catch Weight Gram, Struk Coret Ongkir (BR-040), dan Validasi Plafon Piutang
class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  String _salesMode = 'KASIR_TOKO';
  String _paymentMethod = 'CASH'; // CASH, TRANSFER, TEMPO
  bool _isFreeShippingStrikethrough = true;
  final int _shippingFeeRupiah = 25000;

  final String _customerName = 'Hotel Grand Serang';
  final int _creditLimitRupiah = 25000000;
  final int _currentReceivableRupiah = 12500000;

  final List<Map<String, dynamic>> _catalogProducts = [
    {
      'sku': 'SKU-RIBEYE-AUS',
      'name': 'Ribeye Meltique AUS (Primal)',
      'stockGram': 48500,
      'pricePerKgRupiah': 240000,
      'category': 'PRIMAL',
    },
    {
      'sku': 'SKU-SIRLOIN-USA',
      'name': 'Sirloin Choice USA (Primal)',
      'stockGram': 82000,
      'pricePerKgRupiah': 210000,
      'category': 'PRIMAL',
    },
    {
      'sku': 'SKU-TETELAN-SP',
      'name': 'Tetelan Rawon Super Sampora',
      'stockGram': 24000,
      'pricePerKgRupiah': 85000,
      'category': 'TETELAN',
    },
    {
      'sku': 'SKU-SHORTPLATE-US',
      'name': 'US Beef Shortplate 500g Slice',
      'stockGram': 65000,
      'pricePerKgRupiah': 125000,
      'category': 'SLICE',
    },
  ];

  final List<Map<String, dynamic>> _cartItems = [
    {
      'sku': 'SKU-RIBEYE-AUS',
      'name': 'Ribeye Meltique AUS (Primal)',
      'weightGram': 2000,
      'pricePerKgRupiah': 240000,
    },
    {
      'sku': 'SKU-TETELAN-SP',
      'name': 'Tetelan Rawon Super Sampora',
      'weightGram': 3000,
      'pricePerKgRupiah': 85000,
    },
  ];

  int get _subtotalRupiah {
    return _cartItems.fold(0, (sum, item) {
      final gram = item['weightGram'] as int;
      final priceKg = item['pricePerKgRupiah'] as int;
      return sum + ((gram * priceKg) ~/ 1000);
    });
  }

  int get _totalWeightGram {
    return _cartItems.fold(0, (sum, item) => sum + (item['weightGram'] as int));
  }

  int get _grandTotalRupiah {
    final effectiveShipping = _isFreeShippingStrikethrough ? 0 : _shippingFeeRupiah;
    return _subtotalRupiah + effectiveShipping;
  }

  bool get _isTempoBlocked {
    if (_paymentMethod != 'TEMPO') return false;
    if (_creditLimitRupiah == 0) return true;
    return (_currentReceivableRupiah + _grandTotalRupiah) > _creditLimitRupiah;
  }

  void _addItemToCart(Map<String, dynamic> product, int weightGram) {
    setState(() {
      final idx = _cartItems.indexWhere((item) => item['sku'] == product['sku']);
      if (idx != -1) {
        _cartItems[idx]['weightGram'] = (_cartItems[idx]['weightGram'] as int) + weightGram;
      } else {
        _cartItems.add({
          'sku': product['sku'],
          'name': product['name'],
          'weightGram': weightGram,
          'pricePerKgRupiah': product['pricePerKgRupiah'],
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const cardBorder = Color(0xFFE2E8F0);
    const slateMuted = Color(0xFF64748B);
    const accentEmerald = Color(0xFF10B981);
    const alertRose = Color(0xFFEF4444);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'TOKO SAMPORA 01',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: primaryNavy,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            const SizedBox(width: 10),
            const Text(
              'POS Daging Import',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        actions: [
          // Dual-mode toggle
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                _buildModeBtn('KASIR_TOKO', 'Kasir Toko', Icons.storefront),
                _buildModeBtn('SALES_LAPANGAN', 'Sales Lapangan', Icons.two_wheeler),
              ],
            ),
          ),
        ],
      ),
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left side: Product catalog grid
          Expanded(
            flex: 6,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Customer & Search Bar
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: cardBorder),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.person_outline, size: 20, color: slateMuted),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Pelanggan Terpilih', style: TextStyle(fontSize: 11, color: slateMuted)),
                              Text(
                                _customerName,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: primaryNavy),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFBFDBFE)),
                          ),
                          child: const Text(
                            'HOREKA • Limit Rp 25Jt',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF1D4ED8)),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Search & Filter row
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 40,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: cardBorder),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Row(
                            children: const [
                              Icon(Icons.search, size: 18, color: slateMuted),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text('Cari nama potongan atau SKU...', style: TextStyle(fontSize: 12, color: slateMuted)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  // Catalog Grid
                  Expanded(
                    child: GridView.builder(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 1.55,
                      ),
                      itemCount: _catalogProducts.length,
                      itemBuilder: (context, index) {
                        final p = _catalogProducts[index];
                        final stockKg = (p['stockGram'] as int) / 1000.0;
                        return InkWell(
                          borderRadius: BorderRadius.circular(10),
                          onLongPress: () {
                            _addItemToCart(p, 1000);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('⚡ Quick Add: +1.0 KG ${p['name']} langsung masuk keranjang!'),
                                backgroundColor: accentEmerald,
                                duration: const Duration(milliseconds: 1500),
                              ),
                            );
                          },
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: cardBorder),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        p['name'] as String,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                          color: primaryNavy,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF0FDF4),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: const Color(0xFFBBF7D0)),
                                      ),
                                      child: Text(
                                        '${stockKg.toStringAsFixed(1)} kg',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          color: accentEmerald,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                Row(
                                  children: const [
                                    Icon(Icons.bolt, size: 12, color: Color(0xFFD97706)),
                                    SizedBox(width: 2),
                                    Text('Tahan kartu: Quick Add 1kg', style: TextStyle(fontSize: 9, color: slateMuted)),
                                  ],
                                ),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Rp ${(p['pricePerKgRupiah'] as int).toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}/kg',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: primaryNavy,
                                      ),
                                    ),
                                    Row(
                                      children: [
                                        InkWell(
                                          onTap: () => _addItemToCart(p, 500),
                                          borderRadius: BorderRadius.circular(4),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFF1F5F9),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: const Text('+500g', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: primaryNavy)),
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        InkWell(
                                          onTap: () => _addItemToCart(p, 1000),
                                          borderRadius: BorderRadius.circular(4),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: primaryNavy,
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: const Text('+1kg', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Right side: Sticky Cart & Payment Summary
          Container(
            width: 380,
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(left: BorderSide(color: cardBorder)),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Keranjang Pesanan',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: primaryNavy),
                    ),
                    Text(
                      '${_cartItems.length} Item • ${(_totalWeightGram / 1000.0).toStringAsFixed(2)} kg',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: slateMuted),
                    ),
                  ],
                ),

                const Divider(height: 24, color: cardBorder),

                // Cart item list
                Expanded(
                  child: ListView.separated(
                    itemCount: _cartItems.length,
                    separatorBuilder: (_, __) => const Divider(height: 16, color: cardBorder),
                    itemBuilder: (context, i) {
                      final item = _cartItems[i];
                      final weightKg = (item['weightGram'] as int) / 1000.0;
                      final totalLine = ((item['weightGram'] as int) * (item['pricePerKgRupiah'] as int)) ~/ 1000;
                      return Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item['name'] as String,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: primaryNavy),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${weightKg.toStringAsFixed(2)} kg × Rp ${(item['pricePerKgRupiah'] as int)}',
                                  style: const TextStyle(fontSize: 11, color: slateMuted),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            'Rp ${totalLine.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: primaryNavy),
                          ),
                          const SizedBox(width: 8),
                          InkWell(
                            onTap: () {
                              setState(() {
                                _cartItems.removeAt(i);
                              });
                            },
                            child: const Icon(Icons.close, size: 16, color: slateMuted),
                          ),
                        ],
                      );
                    },
                  ),
                ),

                const Divider(height: 24, color: cardBorder),

                // Ongkir Toggle
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.local_shipping_outlined, size: 16, color: slateMuted),
                        SizedBox(width: 6),
                        Text('Gratis Ongkir Toko', style: TextStyle(fontSize: 12, color: primaryNavy)),
                      ],
                    ),
                    Switch.adaptive(
                      value: _isFreeShippingStrikethrough,
                      activeColor: accentEmerald,
                      onChanged: (v) => setState(() => _isFreeShippingStrikethrough = v),
                    ),
                  ],
                ),

                // Grand Total
                Container(
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: cardBorder),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total Pembayaran', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: slateMuted)),
                      Text(
                        'Rp ${_grandTotalRupiah.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: primaryNavy),
                      ),
                    ],
                  ),
                ),

                // Payment Method Selector
                Row(
                  children: [
                    _buildPaymentChip('CASH', 'Tunai'),
                    const SizedBox(width: 6),
                    _buildPaymentChip('TRANSFER', 'Transfer'),
                    const SizedBox(width: 6),
                    _buildPaymentChip('TEMPO', 'Tempo'),
                  ],
                ),

                if (_isTempoBlocked) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.error_outline, size: 14, color: alertRose),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Plafon kredit terlampaui! Butuh PIN owner.',
                            style: TextStyle(fontSize: 11, color: alertRose, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 12),

                // Ergonomic 44px+ Checkout Button
                SizedBox(
                  height: 46,
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isTempoBlocked
                        ? null
                        : () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Transaksi Berhasil Disimpan ke Ledger Lokal!'),
                                backgroundColor: accentEmerald,
                              ),
                            );
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryNavy,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Bayar & Terbitkan Faktur', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModeBtn(String mode, String label, IconData icon) {
    final isSel = _salesMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _salesMode = mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSel ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          boxShadow: isSel
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  )
                ]
              : null,
        ),
        child: Row(
          children: [
            Icon(icon, size: 14, color: isSel ? const Color(0xFF0F172A) : const Color(0xFF64748B)),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                color: isSel ? const Color(0xFF0F172A) : const Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentChip(String method, String label) {
    final isSel = _paymentMethod == method;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _paymentMethod = method),
        borderRadius: BorderRadius.circular(6),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSel ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: isSel ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0)),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isSel ? FontWeight.w700 : FontWeight.w600,
              color: isSel ? Colors.white : const Color(0xFF0F172A),
            ),
          ),
        ),
      ),
    );
  }
}
