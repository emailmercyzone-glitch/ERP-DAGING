import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../application/auth_service.dart';
import '../../pos/presentation/pos_screen.dart';

/// MOD-02: Layanan UI Login & PIN Pad 6-Digit (Modern B2B SaaS Enterprise)
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  String _selectedRole = 'SALES';
  final String _username = 'sales_banten_01';
  String _pin = '';
  bool _isLoading = false;
  String? _errorMessage;

  void _onKeypadTap(String value) {
    if (_pin.length < 6) {
      setState(() {
        _pin += value;
        _errorMessage = null;
      });
      if (_pin.length == 6) {
        _handleLogin();
      }
    }
  }

  void _onBackspace() {
    if (_pin.isNotEmpty) {
      setState(() {
        _pin = _pin.substring(0, _pin.length - 1);
        _errorMessage = null;
      });
    }
  }

  Future<void> _handleLogin() async {
    setState(() => _isLoading = true);
    final authService = ref.read(authServiceProvider.notifier);
    final success = await authService.login(
      username: _username,
      pin: _pin,
      deviceId: 'HP_${_selectedRole}_01',
    );

    setState(() => _isLoading = false);
    if (success && mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const PosScreen()),
      );
    } else {
      setState(() {
        _errorMessage = 'PIN tidak valid atau akun tidak terdaftar!';
        _pin = '';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryNavy = Color(0xFF0F172A);
    const slateMuted = Color(0xFF64748B);
    const cardBorder = Color(0xFFE2E8F0);
    const accentEmerald = Color(0xFF10B981);
    const alertRose = Color(0xFFEF4444);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: cardBorder),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Brand Logo & Title
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: primaryNavy,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.inventory_2_outlined,
                            color: Colors.white,
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              'SAMPORA BANTEN',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: primaryNavy,
                                letterSpacing: 0.5,
                              ),
                            ),
                            Text(
                              'ERP Cold-Chain V4.3',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: slateMuted,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Role Selector Tabs
                    Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          _buildRoleTab('SALES', 'Sales Lapangan'),
                          _buildRoleTab('CASHIER', 'Kasir Toko'),
                          _buildRoleTab('OWNER', 'Owner'),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Instructions
                    const Text(
                      'Masukkan 6-Digit PIN Anda',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: primaryNavy,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Otentikasi cepat offline-first terenkripsi SHA-256',
                      style: TextStyle(fontSize: 12, color: slateMuted),
                    ),

                    const SizedBox(height: 20),

                    // 6-Digit PIN Dots
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(6, (index) {
                        final isFilled = index < _pin.length;
                        return Container(
                          margin: const EdgeInsets.symmetric(horizontal: 6),
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isFilled ? accentEmerald : const Color(0xFFE2E8F0),
                            border: Border.all(
                              color: isFilled ? accentEmerald : const Color(0xFFCBD5E1),
                              width: 1.5,
                            ),
                          ),
                        );
                      }),
                    ),

                    if (_errorMessage != null) ...[
                      const SizedBox(height: 14),
                      Text(
                        _errorMessage!,
                        style: const TextStyle(
                          color: alertRose,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],

                    const SizedBox(height: 24),

                    // Ergonomic 44px+ Keypad Grid
                    if (_isLoading)
                      const SizedBox(
                        height: 220,
                        child: Center(
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor: AlwaysStoppedAnimation<Color>(primaryNavy),
                          ),
                        ),
                      )
                    else
                      Column(
                        children: [
                          _buildKeypadRow(['1', '2', '3']),
                          const SizedBox(height: 10),
                          _buildKeypadRow(['4', '5', '6']),
                          const SizedBox(height: 10),
                          _buildKeypadRow(['7', '8', '9']),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              const Expanded(child: SizedBox(height: 48)),
                              const SizedBox(width: 10),
                              Expanded(child: _buildKeypadButton('0')),
                              const SizedBox(width: 10),
                              Expanded(
                                child: InkWell(
                                  onTap: _onBackspace,
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    height: 48,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(
                                      Icons.backspace_outlined,
                                      size: 20,
                                      color: primaryNavy,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),

                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.lock_outline, size: 13, color: slateMuted),
                        SizedBox(width: 6),
                        Text(
                          'Sistem Terproteksi Ledger Drift SQLite',
                          style: TextStyle(fontSize: 11, color: slateMuted),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRoleTab(String role, String label) {
    final isSelected = _selectedRole == role;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedRole = role),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ]
                : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              color: isSelected ? const Color(0xFF0F172A) : const Color(0xFF64748B),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildKeypadRow(List<String> values) {
    return Row(
      children: [
        Expanded(child: _buildKeypadButton(values[0])),
        const SizedBox(width: 10),
        Expanded(child: _buildKeypadButton(values[1])),
        const SizedBox(width: 10),
        Expanded(child: _buildKeypadButton(values[2])),
      ],
    );
  }

  Widget _buildKeypadButton(String value) {
    return InkWell(
      onTap: () => _onKeypadTap(value),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        alignment: Alignment.center,
        child: Text(
          value,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0F172A),
          ),
        ),
      ),
    );
  }
}
