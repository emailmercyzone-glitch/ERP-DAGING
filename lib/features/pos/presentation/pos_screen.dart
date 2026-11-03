import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// MOD-04: Layanan UI POS Unified Dual-Mode (Mode Kasir Toko & Mode Sales Lapangan)
/// Menangani Catch Weight Gram, Struk Coret Ongkir (BR-040), dan Validasi Plafon Piutang
class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  // Mode Operasi: KASIR_TOKO atau SALES_LAPANGAN
  String _salesMode = 'KASIR_TOKO';
  String _paymentMethod = 'CASH'; // CASH, TRANSFER, TEMPO
  bool _isFreeShippingStrikethrough = true;
  final int _shippingFeeRupiah = 25000;

  // Pelanggan Terpilih
  String _customerName = 'Hotel Grand Serang';
  int _creditLimitRupiah = 25000000;
  int _currentReceivableRupiah = 12500000;

  // Item Dummy Keranjang
  final List<Map<String, dynamic>> _cartItems = [
    {
      'sku': 'SKU-RIBEYE-AUS',
      'name': 'Ribeye Meltique Australia (Primal)',
      'weightGram': 1850,
      'pricePerKgRupiah': 240000,
    },
    {
      'sku': 'SKU-TETELAN-SP',
      'name': 'Tetelan Rawon Super Sampora',
      'weightGram': 4500,
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

  int get _grandTotalRupiah {
    final effectiveShipping = _isFreeShippingStrikethrough ? 0 : _shippingFeeRupiah;
    return _subtotalRupiah + effectiveShipping;
  }

  bool get _isTempoBlocked {
    if (_paymentMethod != 'TEMPO') return false;
    if (_creditLimitRupiah == 0) return true; // Cash only
    return (_currentReceivableRupiah + _grandTotalRupiah) > _creditLimitRupiah;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'POS DAGING IMPORT',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              'INV-HP01-261102-0042 • Validasi <50ms',
              style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11),
            ),
          ],
        ),
        actions: [
          // Dual-Mode Toggle
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: const Color(0xFF334155),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                _buildModeBtn('KASIR_TOKO', 'Kasir Toko', Icons.storefront_outlined),
                _buildModeBtn('SALES_LAPANGAN', 'Sales Lapangan', Icons.directions_bike_outlined),
              ],
            ),
          ),
        ],
      ),
      body: Row(
        children: [
          // Sisi Kiri: Katalog Daging & Timbangan
          Expanded(
            flex: 3,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // CRM Mini Header
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF334155)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.between,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.person_pin_circle_outlined, color: Color(0xFFF87171)),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(_customerName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                                Text('Plafon: Rp ${(_creditLimitRupiah / 1000000).toStringAsFixed(1)}jt | Piutang: Rp ${(_currentReceivableRupiah / 1000000).toStringAsFixed(1)}jt',
                                    style: const TextStyle(color: Colors.white60, fontSize: 11)),
                              ],
                            ),
                          ],
                        ),
                        ElevatedButton.icon(
                          onPressed: () {},
                          icon: const Icon(Icons.swap_horiz, size: 16),
                          label: const Text('Ganti Pelanggan', style: TextStyle(fontSize: 11)),
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF334155), foregroundColor: Colors.white),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Header List Item
                  const Text('Daftar Timbangan Daging (Catch Weight)', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(height: 8),

                  // List Item Cart
                  Expanded(
                    child: ListView.separated(
                      itemCount: _cartItems.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final item = _cartItems[index];
                        final subtotal = ((item['weightGram'] as int) * (item['pricePerKgRupiah'] as int)) ~/ 1000;
                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFF334155)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(item['name'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                                    Text('Rp ${item['pricePerKgRupiah']} / kg', style: const TextStyle(color: Colors.white60, fontSize: 11)),
                                  ],
                                ),
                              ),
                              // Gram Counter
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0F172A),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '${item['weightGram']} Gram (${(item['weightGram'] / 1000).toStringAsFixed(2)} kg)',
                                  style: const TextStyle(color: Color(0xFFF87171), fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                              ),
                              const SizedBox(width: 16),
                              Text(
                                'Rp $subtotal',
                                style: const TextStyle(color: Color(0xFF4ADE80), fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),

                  // Ongkir Coret Bar
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.between,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.local_shipping_outlined, color: Colors.blueAccent),
                            SizedBox(width: 8),
                            Text('Gratis Ongkir (Coret Struk BR-040)', style: TextStyle(color: Colors.white, fontSize: 12)),
                          ],
                        ),
                        Switch(
                          value: _isFreeShippingStrikethrough,
                          onChanged: (val) => setState(() => _isFreeShippingStrikethrough = val),
                          activeColor: const Color(0xFFEF4444),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Sisi Kanan: Checkout Panel
          Container(
            width: 320,
            color: const Color(0xFF1E293B),
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Rangkuman Pembayaran', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 16),
                _buildSummaryRow('Subtotal Daging:', 'Rp $_subtotalRupiah'),
                _buildSummaryRow(
                  'Biaya Pengiriman:',
                  _isFreeShippingStrikethrough ? 'Rp 0 (Dicoret)' : 'Rp $_shippingFeeRupiah',
                  isGreen: _isFreeShippingStrikethrough,
                ),
                const Divider(color: Colors.white24, height: 24),
                _buildSummaryRow('Grand Total:', 'Rp $_grandTotalRupiah', isBold: true),
                const SizedBox(height: 20),

                // Pilihan Metode Bayar
                const Text('Metode Bayar:', style: TextStyle(color: Colors.white70, fontSize: 12)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _buildPaymentChip('CASH'),
                    const SizedBox(width: 6),
                    _buildPaymentChip('TRANSFER'),
                    const SizedBox(width: 6),
                    _buildPaymentChip('TEMPO'),
                  ],
                ),
                const SizedBox(height: 16),

                // Warning Plafon jika Tempo
                if (_isTempoBlocked)
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF7F1D1D).withOpacity(0.4),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFEF4444)),
                    ),
                    child: const Text(
                      'Plafon Piutang Terlampaui! Memerlukan persetujuan PIN Owner.',
                      style: TextStyle(color: Color(0xFFFCA5A5), fontSize: 11),
                    ),
                  ),

                const Spacer(),

                // Tombol Eksekusi
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isTempoBlocked ? null : () {},
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFDC2626),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text('Terbitkan Faktur ($_paymentMethod)', style: const TextStyle(fontWeight: FontWeight.bold)),
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
    final isSelected = _salesMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _salesMode = mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFDC2626) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(icon, size: 14, color: isSelected ? Colors.white : Colors.white60),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(color: isSelected ? Colors.white : Colors.white60, fontSize: 11, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentChip(String method) {
    final isSelected = _paymentMethod == method;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _paymentMethod = method),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFDC2626) : const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isSelected ? Colors.transparent : Colors.white24),
          ),
          alignment: Alignment.center,
          child: Text(
            method,
            style: TextStyle(color: isSelected ? Colors.white : Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false, bool isGreen = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.between,
        children: [
          Text(label, style: TextStyle(color: isBold ? Colors.white : Colors.white60, fontSize: isBold ? 13 : 12, fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
          Text(
            value,
            style: TextStyle(
              color: isGreen ? const Color(0xFF4ADE80) : isBold ? const Color(0xFFF87171) : Colors.white,
              fontSize: isBold ? 15 : 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}
