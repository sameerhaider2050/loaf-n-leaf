import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';

class LoginView extends StatefulWidget {
  const LoginView({super.key});

  @override
  State<LoginView> createState() => _LoginViewState();
}

class _LoginViewState extends State<LoginView> {
  bool _usePasswordMode = false;
  String _enteredPin = '';
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();

  void _onPinDigit(String digit) {
    if (_enteredPin.length < 6) {
      setState(() {
        _enteredPin += digit;
      });
      if (_enteredPin.length == 4 || _enteredPin.length == 6) {
        // Auto-submit 4-digit PIN for super fast waiter/cashier entry
        if (_enteredPin.length == 4) {
          _submitPin();
        }
      }
    }
  }

  void _onPinBackspace() {
    if (_enteredPin.isNotEmpty) {
      setState(() {
        _enteredPin = _enteredPin.substring(0, _enteredPin.length - 1);
      });
    }
  }

  void _onPinClear() {
    setState(() {
      _enteredPin = '';
    });
  }

  Future<void> _submitPin() async {
    if (_enteredPin.isEmpty) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.loginWithPin(_enteredPin);
    if (!success && mounted) {
      _onPinClear();
    }
  }

  Future<void> _submitCredentials() async {
    final user = _usernameController.text.trim();
    final pass = _passwordController.text.trim();
    if (user.isEmpty || pass.isEmpty) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    await auth.loginWithCredentials(user, pass);
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width > 768;

    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Container(
            width: isDesktop ? 480 : double.infinity,
            padding: const EdgeInsets.all(32.0),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.35),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                )
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Brand Header
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primaryDark,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.local_cafe, color: AppColors.wheat, size: 24),
                      SizedBox(width: 10),
                      Text(
                        'LOAF N LEAF',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Staff Point of Sale & Terminal',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 24),

                if (auth.errorMessage != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.danger.withOpacity(0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            auth.errorMessage!,
                            style: const TextStyle(color: AppColors.danger, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),

                // PIN Mode vs Password Mode Toggle
                if (!_usePasswordMode) ...[
                  // PIN Display Dots
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(4, (index) {
                      final isFilled = index < _enteredPin.length;
                      return Container(
                        margin: const EdgeInsets.symmetric(horizontal: 8),
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isFilled ? AppColors.primary : Colors.transparent,
                          border: Border.all(
                            color: isFilled ? AppColors.primary : AppColors.border,
                            width: 2,
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 24),

                  // Numeric Keypad for fast pin entry
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 3,
                    childAspectRatio: 1.5,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    children: [
                      ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(
                        (num) => _buildKeypadButton(num, () => _onPinDigit(num)),
                      ),
                      _buildKeypadActionButton(
                        icon: Icons.clear_all,
                        label: 'C',
                        onTap: _onPinClear,
                        color: Colors.grey.shade700,
                      ),
                      _buildKeypadButton('0', () => _onPinDigit('0')),
                      _buildKeypadActionButton(
                        icon: Icons.backspace_outlined,
                        onTap: _onPinBackspace,
                        color: Colors.grey.shade700,
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (auth.status == AuthStatus.authenticating)
                    const Padding(
                      padding: EdgeInsets.all(8.0),
                      child: CircularProgressIndicator(color: AppColors.primary),
                    ),
                ] else ...[
                  // Username / Password mode
                  TextField(
                    controller: _usernameController,
                    decoration: InputDecoration(
                      labelText: 'Username or Email',
                      prefixIcon: const Icon(Icons.person_outline),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: auth.status == AuthStatus.authenticating
                          ? null
                          : _submitCredentials,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: auth.status == AuthStatus.authenticating
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Text(
                              'SIGN IN',
                              style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1),
                            ),
                    ),
                  ),
                ],

                const SizedBox(height: 16),
                // Toggle mode button
                TextButton(
                  onPressed: () {
                    setState(() {
                      _usePasswordMode = !_usePasswordMode;
                      _enteredPin = '';
                    });
                  },
                  child: Text(
                    _usePasswordMode ? 'Switch to Quick PIN Pad' : 'Admin / Staff Password Login',
                    style: const TextStyle(
                      color: AppColors.primaryAccent,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),

                const Divider(height: 32),
                // Cryptographic Device Identity Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.borderSubtle),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.verified_user, size: 14, color: AppColors.textMuted),
                      const SizedBox(width: 6),
                      Text(
                        'Device Fingerprint: ${auth.deviceFingerprint?.substring(0, 12) ?? 'Unknown'}...',
                        style: const TextStyle(
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildKeypadButton(String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(10),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ),
    );
  }

  Widget _buildKeypadActionButton({
    IconData? icon,
    String? label,
    required VoidCallback onTap,
    required Color color,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted.withOpacity(0.5),
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(10),
        ),
        alignment: Alignment.center,
        child: icon != null
            ? Icon(icon, color: color, size: 24)
            : Text(
                label ?? '',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color),
              ),
      ),
    );
  }
}
