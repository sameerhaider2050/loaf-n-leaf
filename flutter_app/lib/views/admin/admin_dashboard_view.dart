import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/admin_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../models/device.dart';
import '../../models/employee.dart';
import '../../models/product.dart';

class AdminDashboardView extends StatefulWidget {
  const AdminDashboardView({super.key});

  @override
  State<AdminDashboardView> createState() => _AdminDashboardViewState();
}

class _AdminDashboardViewState extends State<AdminDashboardView> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AdminProvider>(context, listen: false).loadDashboardData();
      Provider.of<CatalogProvider>(context, listen: false).loadCatalog();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final admin = Provider.of<AdminProvider>(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        elevation: 0,
        title: Row(
          children: [
            const Icon(Icons.admin_panel_settings, color: AppColors.wheat, size: 22),
            const SizedBox(width: 10),
            const Text(
              'LOAF N LEAF RESTAURANT ADMINISTRATION',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1),
            ),
            const SizedBox(width: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                'Admin: ${auth.currentUser?.fullName ?? "Administrator"}',
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            tooltip: 'Reload Admin Data',
            onPressed: () => admin.loadDashboardData(),
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            tooltip: 'Logout',
            onPressed: () => auth.logout(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.wheat,
          indicatorWeight: 3,
          labelColor: AppColors.wheat,
          unselectedLabelColor: Colors.white70,
          tabs: [
            const Tab(icon: Icon(Icons.insights), text: 'Sales & Reports'),
            Tab(
              icon: const Icon(Icons.devices_other),
              text: 'Authorized Devices (${admin.devices.where((d) => d.isPending).length} Pending)',
            ),
            const Tab(icon: Icon(Icons.people_outline), text: 'Staff Accounts'),
            const Tab(icon: Icon(Icons.restaurant_menu), text: 'Menu & Availability (86)'),
            const Tab(icon: Icon(Icons.security), text: 'Security Audit Logs'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildSalesReportsTab(context, admin),
          _buildDevicesTab(context, admin),
          _buildStaffTab(context, admin),
          _buildMenuTab(context),
          _buildAuditLogsTab(context, admin),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // TAB 1: Sales & Reports
  // -------------------------------------------------------------
  Widget _buildSalesReportsTab(BuildContext context, AdminProvider admin) {
    final summary = admin.salesSummary;
    final metrics = summary?['metrics'];
    final topItems = summary?['top_items'] as List? ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Period Selector Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Financial Performance & Sales Analytics',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              Row(
                children: [
                  _buildPeriodChip('today', 'Today', admin),
                  _buildPeriodChip('week', '7 Days', admin),
                  _buildPeriodChip('month', '30 Days', admin),
                  _buildPeriodChip('all', 'All Time', admin),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Metrics KPI Cards
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(
                  title: 'TOTAL REVENUE',
                  value: 'Rs. ${(metrics?['total_sales'] ?? 0).toString()}',
                  icon: Icons.payments,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildMetricCard(
                  title: 'COMPLETED ORDERS',
                  value: '${metrics?['total_orders'] ?? 0}',
                  icon: Icons.shopping_bag_outlined,
                  color: AppColors.info,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildMetricCard(
                  title: 'AVERAGE TICKET',
                  value: 'Rs. ${(metrics?['average_order_value'] ?? 0).toString()}',
                  icon: Icons.trending_up,
                  color: AppColors.wheat,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildMetricCard(
                  title: 'TAX COLLECTED',
                  value: 'Rs. ${(metrics?['total_tax'] ?? 0).toString()}',
                  icon: Icons.account_balance,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Payment Breakdown & Top Selling Items
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Payment Breakdown
              Expanded(
                flex: 40,
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Payment Method Breakdown',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      const Divider(height: 24),
                      _buildPaymentRow('Cash Sales', metrics?['cash_sales'] ?? 0, Icons.money),
                      const SizedBox(height: 12),
                      _buildPaymentRow('Card Sales', metrics?['card_sales'] ?? 0, Icons.credit_card),
                      const SizedBox(height: 12),
                      _buildPaymentRow('Other / Digital', metrics?['other_sales'] ?? 0, Icons.devices),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 20),

              // Top Selling Products
              Expanded(
                flex: 60,
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Top Selling Menu Items',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      const Divider(height: 24),
                      if (topItems.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(16.0),
                          child: Text('No orders recorded in this period.', style: TextStyle(color: AppColors.textMuted)),
                        )
                      else
                        ...topItems.map((item) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8.0),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withOpacity(0.08),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Icon(Icons.fastfood, size: 16, color: AppColors.primary),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  item['product_name'] ?? 'Unknown Item',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                              ),
                              Text(
                                '${item['quantity_sold']} Sold',
                                style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                              ),
                              const SizedBox(width: 24),
                              Text(
                                'Rs. ${item['total_revenue']}',
                                style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                              ),
                            ],
                          ),
                        )),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodChip(String id, String label, AdminProvider admin) {
    final isSelected = admin.selectedPeriod == id;
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => admin.fetchSalesSummary(id),
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary, letterSpacing: 0.5),
              ),
              Icon(icon, size: 20, color: color),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentRow(String label, dynamic amount, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.textSecondary),
        const SizedBox(width: 10),
        Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w500))),
        Text('Rs. $amount', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
      ],
    );
  }

  // -------------------------------------------------------------
  // TAB 2: Authorized Devices (Core DBAC Management)
  // -------------------------------------------------------------
  Widget _buildDevicesTab(BuildContext context, AdminProvider admin) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Cryptographic Device Authorization Management',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  Text(
                    'Enforces hardware/browser-bound non-extractable keys (DBAC + RBAC). Only authorized devices can access POS.',
                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                ],
              ),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh Devices'),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                onPressed: () => admin.fetchDevices(),
              ),
            ],
          ),
          const SizedBox(height: 20),

          Expanded(
            child: admin.devices.isEmpty
                ? const Center(child: Text('No devices registered in the cryptographic vault yet.'))
                : ListView.builder(
                    itemCount: admin.devices.length,
                    itemBuilder: (ctx, idx) {
                      final device = admin.devices[idx];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 1,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Icon(
                                device.isApproved
                                    ? Icons.laptop_windows
                                    : device.isPending
                                        ? Icons.device_unknown
                                        : Icons.block,
                                size: 36,
                                color: device.isApproved
                                    ? AppColors.primary
                                    : device.isPending
                                        ? AppColors.warning
                                        : AppColors.danger,
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          device.name,
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                        ),
                                        const SizedBox(width: 8),
                                        _buildStatusBadge(device.status),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Fingerprint: ${device.fingerprint}',
                                      style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: AppColors.textMuted),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Permitted Roles: ${device.permittedRoles.isEmpty ? "None" : device.permittedRoles.join(", ")}'
                                      ' • Assigned: ${device.assignedEmployeeName ?? "Unassigned"}',
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),

                              // Action Buttons
                              if (device.isPending) ...[
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.success,
                                    foregroundColor: Colors.white,
                                  ),
                                  onPressed: () => _showApproveDialog(context, admin, device),
                                  child: const Text('APPROVE'),
                                ),
                                const SizedBox(width: 8),
                                OutlinedButton(
                                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
                                  onPressed: () => admin.rejectDevice(device.id),
                                  child: const Text('REJECT'),
                                ),
                              ] else if (device.isApproved) ...[
                                OutlinedButton(
                                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
                                  onPressed: () => admin.revokeDevice(device.id),
                                  child: const Text('REVOKE ACCESS'),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = Colors.grey;
    if (status == 'approved') bg = AppColors.success;
    if (status == 'pending') bg = AppColors.warning;
    if (status == 'rejected' || status == 'revoked') bg = AppColors.danger;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: bg),
      ),
    );
  }

  void _showApproveDialog(BuildContext context, AdminProvider admin, AuthorizedDevice device) {
    final selectedRoles = <String>['cashier', 'order_taker'];
    String? assignedEmployeeId;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (c, setStateDialog) {
            return AlertDialog(
              title: Text('Approve Terminal: ${device.name}'),
              content: SizedBox(
                width: 420,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Assign Permitted Roles:', style: TextStyle(fontWeight: FontWeight.bold)),
                    CheckboxListTile(
                      title: const Text('Order Taker / Waiter (Mobile Floor)'),
                      value: selectedRoles.contains('order_taker'),
                      onChanged: (val) {
                        setStateDialog(() {
                          val == true ? selectedRoles.add('order_taker') : selectedRoles.remove('order_taker');
                        });
                      },
                    ),
                    CheckboxListTile(
                      title: const Text('Cashier POS (Tender & Checkout)'),
                      value: selectedRoles.contains('cashier'),
                      onChanged: (val) {
                        setStateDialog(() {
                          val == true ? selectedRoles.add('cashier') : selectedRoles.remove('cashier');
                        });
                      },
                    ),
                    CheckboxListTile(
                      title: const Text('Administrator (Back-office & Reports)'),
                      value: selectedRoles.contains('admin'),
                      onChanged: (val) {
                        setStateDialog(() {
                          val == true ? selectedRoles.add('admin') : selectedRoles.remove('admin');
                        });
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.success, foregroundColor: Colors.white),
                  onPressed: () async {
                    await admin.approveDevice(
                      deviceId: device.id,
                      permittedRoles: selectedRoles,
                      assignedEmployeeId: assignedEmployeeId,
                    );
                    Navigator.pop(ctx);
                  },
                  child: const Text('CONFIRM APPROVAL'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // -------------------------------------------------------------
  // TAB 3: Staff Accounts
  // -------------------------------------------------------------
  Widget _buildStaffTab(BuildContext context, AdminProvider admin) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Employee Accounts & Access Roles', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  Text('Only administrators can create staff accounts and assign roles.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                ],
              ),
              ElevatedButton.icon(
                icon: const Icon(Icons.person_add, size: 18),
                label: const Text('Create Staff Account'),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                onPressed: () => _showCreateStaffDialog(context, admin),
              ),
            ],
          ),
          const SizedBox(height: 20),

          Expanded(
            child: ListView.builder(
              itemCount: admin.staffList.length,
              itemBuilder: (ctx, idx) {
                final emp = admin.staffList[idx];
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppColors.primary.withOpacity(0.1),
                      child: Text(emp.fullName.isNotEmpty ? emp.fullName[0].toUpperCase() : 'S'),
                    ),
                    title: Text(emp.fullName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('${emp.username} • ${emp.email}'),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primaryDark,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        emp.role.toUpperCase(),
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showCreateStaffDialog(BuildContext context, AdminProvider admin) {
    final userCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final pinCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    String selectedRole = 'cashier';

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (c, setStateDialog) {
            return AlertDialog(
              title: const Text('Create New Staff Member'),
              content: SizedBox(
                width: 420,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextField(controller: userCtrl, decoration: const InputDecoration(labelText: 'Username')),
                      const SizedBox(height: 10),
                      TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Full Name')),
                      const SizedBox(height: 10),
                      TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email Address')),
                      const SizedBox(height: 10),
                      DropdownButtonFormField<String>(
                        value: selectedRole,
                        decoration: const InputDecoration(labelText: 'System Role'),
                        items: const [
                          DropdownMenuItem(value: 'admin', child: Text('Admin')),
                          DropdownMenuItem(value: 'cashier', child: Text('Cashier')),
                          DropdownMenuItem(value: 'order_taker', child: Text('Order Taker / Waiter')),
                        ],
                        onChanged: (val) => setStateDialog(() => selectedRole = val ?? 'cashier'),
                      ),
                      const SizedBox(height: 10),
                      TextField(controller: pinCtrl, decoration: const InputDecoration(labelText: 'Quick Login PIN (e.g. 1234)')),
                      const SizedBox(height: 10),
                      TextField(controller: passCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                  onPressed: () async {
                    if (userCtrl.text.isNotEmpty && nameCtrl.text.isNotEmpty) {
                      await admin.createStaff(
                        username: userCtrl.text.trim(),
                        fullName: nameCtrl.text.trim(),
                        email: emailCtrl.text.trim(),
                        role: selectedRole,
                        pin: pinCtrl.text.trim().isNotEmpty ? pinCtrl.text.trim() : null,
                        password: passCtrl.text.trim().isNotEmpty ? passCtrl.text.trim() : null,
                      );
                      Navigator.pop(ctx);
                    }
                  },
                  child: const Text('CREATE ACCOUNT'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // -------------------------------------------------------------
  // TAB 4: Menu Availability (86 Toggle)
  // -------------------------------------------------------------
  Widget _buildMenuTab(BuildContext context) {
    final catalog = Provider.of<CatalogProvider>(context);

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Catalog & Kitchen 86 Availability Toggle', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Text('Quickly 86 items when ingredients run out. Prevents order takers from adding unavailable food.', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          const SizedBox(height: 20),

          Expanded(
            child: ListView.builder(
              itemCount: catalog.products.length,
              itemBuilder: (ctx, idx) {
                final product = catalog.products[idx];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(product.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('Price: Rs. ${product.price.toStringAsFixed(0)} • Code: ${product.code ?? "N/A"}'),
                    trailing: Switch(
                      value: product.isAvailable,
                      activeColor: AppColors.primary,
                      onChanged: (_) => catalog.toggleProductAvailability(product.id),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // TAB 5: Security Audit Logs
  // -------------------------------------------------------------
  Widget _buildAuditLogsTab(BuildContext context, AdminProvider admin) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Device Security Audit Logs', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              IconButton(icon: const Icon(Icons.refresh), onPressed: () => admin.fetchAuditLogs()),
            ],
          ),
          const SizedBox(height: 20),

          Expanded(
            child: admin.auditLogs.isEmpty
                ? const Center(child: Text('No audit log entries recorded.'))
                : ListView.builder(
                    itemCount: admin.auditLogs.length,
                    itemBuilder: (ctx, idx) {
                      final log = admin.auditLogs[idx];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: const Icon(Icons.security, color: AppColors.primary),
                          title: Text(log['action'] ?? 'AUDIT_ACTION', style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('${log['details'] ?? ""} • IP: ${log['ip_address'] ?? "local"}'),
                          trailing: Text(
                            log['created_at'] != null ? log['created_at'].toString().substring(0, 19) : '',
                            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
