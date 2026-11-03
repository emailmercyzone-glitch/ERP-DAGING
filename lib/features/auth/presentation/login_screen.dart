import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../application/auth_service.dart';

/// MOD-02: Layanan UI Login & PIN Pad 6-Digit (Praktis Ala Lapangan)
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  String _selectedRole = 'SALES';
  String _username = 'sales_banten_01';
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
    if (!success) {
      setState(() {
        _errorMessage = 'PIN salah atau akun tidak aktif!';
        _pin = '';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo & Brand
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFDC2626), Color(0xFF881337)],
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFDC2626).withOpacity(0.3),
                          blurRadius: 16,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.egg_alt_outlined, color: Colors.white, size: 36),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'ERP DAGING IMPORT',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const Text(
                    'Sampora Banten • V4.3 Production Ready',
                    style: TextStyle(color: Colors.white60, fontSize: 12),
                  ),
                  const SizedBox(height: 24),

                  // Role Selector
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        _buildRoleChip('SALES', 'Sales Lapangan', 'sales_banten_01'),
                        _buildRoleChip('ADMIN', 'Admin Gudang', 'admin_gudang'),
                        _buildRoleChip('OWNER', 'Owner Sampora', 'owner_sampora'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),

                  // PIN Indicators (6 Bullets)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(6, (index) {
                      final isFilled = index < _pin.length;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        margin: const EdgeInsets.symmetric(horizontal: 6),
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isFilled ? const Color(0xFFEF4444) : const Color(0xFF334155),
                          border: Border.all(
                            color: isFilled ? const Color(0xFFF87171) : Colors.transparent,
                            width: 1.5,
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 12),

                  if (_errorMessage != null)
                    Text(
                      _errorMessage!,
                      style: const TextStyle(color: Color(0xFFF87171), fontSize: 13, fontWeight: FontWeight.w600),
                    )
                  else
                    const Text('Masukkan PIN 6-Digit Anda', style: TextStyle(color: Colors.white54, fontSize: 12)),
                  const SizedBox(height: 24),

                  // Keypad Numeric 3x4
                  _buildNumericKeypad(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRoleChip(String role, String label, String defaultUser) {
    final isSelected = _selectedRole == role;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _selectedRole = role;
            _username = defaultUser;
            _pin = '';
            _errorMessage = null;
          });
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFDC2626) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Text(
            role,
            style: TextStyle(
              color: isSelected ? Colors.white : Colors.white60,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNumericKeypad() {
    return Column(
      children: [
        Row(children: [_keypadBtn('1'), _keypadBtn('2'), _keypadBtn('3')]),
        const SizedBox(height: 12),
        Row(children: [_keypadBtn('4'), _keypadBtn('5'), _keypadBtn('6')]),
        const SizedBox(height: 12),
        Row(children: [_keypadBtn('7'), _keypadBtn('8'), _keypadBtn('9')]),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextButton(
                onPressed: () => setState(() => _pin = ''),
                child: const Text('Clear', style: TextStyle(color: Colors.white54)),
              ),
            ),
            _keypadBtn('0'),
            Expanded(
              child: IconButton(
                onPressed: _onBackspace,
                icon: const Icon(Icons.backspace_outlined, color: Colors.white70),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _keypadBtn(String digit) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6.0),
        child: Material(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => _onKeypadTap(digit),
            child: Container(
              height: 56,
              alignment: Alignment.center,
              child: Text(
                digit,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
