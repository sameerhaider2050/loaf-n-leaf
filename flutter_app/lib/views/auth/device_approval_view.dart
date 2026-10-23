import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';

class DeviceApprovalView extends StatefulWidget {
  const DeviceApprovalView({super.key});

  @override
  State<DeviceApprovalView> createState() => _DeviceApprovalViewState();
}

class _DeviceApprovalViewState extends State<DeviceApprovalView> {
  final _terminalNameController = TextEditingController();
  final _contactController = TextEditingController();
  bool _isSubmitting = false;
  String? _successMsg;

  @override
  void initState() {
    super.initState();
    _terminalNameController.text = 'Station Terminal';
  }

  Future<void> _submitRequest() async {
    setState(() {
      _isSubmitting = true;
      _successMsg = null;
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.submitDeviceApprovalRequest(
      terminalName: _terminalNameController.text.trim(),
      contactInfo: _contactController.text.trim(),
    );

    setState(() {
      _isSubmitting = false;
      if (success) {
        _successMsg = 'Approval request sent to manager! Please ask the administrator to approve this device in the Admin Dashboard.';
      }
    });
  }

  Color _getStatusColor(String? status) {
    switch (status) {
      case 'approved':
        return AppColors.success;
      case 'rejected':
      case 'revoked':
        return AppColors.danger;
      default:
        return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final status = auth.deviceStatus ?? 'pending';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        title: const Text('Device Security Authorization', style: TextStyle(color: Colors.white, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            tooltip: 'Logout',
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 520),
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                )
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _getStatusColor(status).withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    status == 'revoked' || status == 'rejected'
                        ? Icons.gpp_bad
                        : Icons.security,
                    size: 48,
                    color: _getStatusColor(status),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  status == 'revoked'
                      ? 'Device Access Revoked'
                      : status == 'rejected'
                          ? 'Device Authorization Rejected'
                          : 'Terminal Approval Required',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'This restaurant terminal must be authorized by an administrator before accessing Loaf n Leaf POS orders.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
                ),
                const SizedBox(height: 24),

                // Device Fingerprint Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'CRYPTOGRAPHIC HARDWARE FINGERPRINT',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textSecondary,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 6),
                      SelectableText(
                        auth.deviceFingerprint ?? 'Generating...',
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          const Text('Status: ', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: _getStatusColor(status).withOpacity(0.15),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              status.toUpperCase(),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: _getStatusColor(status),
                              ),
                            ),
                          ),
                          const Spacer(),
                          Text(
                            'User: ${auth.currentUser?.fullName ?? "Staff"}',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                if (_successMsg != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.success.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.success.withOpacity(0.3)),
                    ),
                    child: Text(
                      _successMsg!,
                      style: const TextStyle(color: AppColors.success, fontSize: 13),
                    ),
                  ),

                // Request Inputs
                TextField(
                  controller: _terminalNameController,
                  decoration: InputDecoration(
                    labelText: 'Terminal Friendly Name',
                    hintText: 'e.g. Counter 1 Windows POS, Waiter Tablet 2',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _contactController,
                  decoration: InputDecoration(
                    labelText: 'Staff Contact Note (Optional)',
                    hintText: 'e.g. Extension 104, Table Floor',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _submitRequest,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: _isSubmitting
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text(
                            'SUBMIT APPROVAL REQUEST',
                            style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1),
                          ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: OutlinedButton(
                    onPressed: () => auth.logout(),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textPrimary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Back to Login'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
