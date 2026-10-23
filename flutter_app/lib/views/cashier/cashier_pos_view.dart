import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/pos_provider.dart';
import '../../models/order.dart';
import '../../models/product.dart';

class CashierPosView extends StatefulWidget {
  const CashierPosView({super.key});

  @override
  State<CashierPosView> createState() => _CashierPosViewState();
}

class _CashierPosViewState extends State<CashierPosView> {
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CatalogProvider>(context, listen: false).loadCatalog();
      Provider.of<PosProvider>(context, listen: false).fetchUnpaidOrders();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final pos = Provider.of<PosProvider>(context);
    final catalog = Provider.of<CatalogProvider>(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        elevation: 0,
        title: Row(
          children: [
            const Icon(Icons.point_of_sale, color: AppColors.wheat, size: 22),
            const SizedBox(width: 10),
            const Text(
              'LOAF N LEAF CASHIER POS',
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
                'Cashier: ${auth.currentUser?.fullName ?? "Cashier"}',
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            tooltip: 'Refresh Floor Orders',
            onPressed: () => pos.fetchUnpaidOrders(),
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            tooltip: 'Logout',
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      body: Row(
        children: [
          // Left Column (65% width): Catalog & Floor Active Orders
          Expanded(
            flex: 65,
            child: Column(
              children: [
                // Unsettled Orders Bar
                _buildUnpaidOrdersBanner(context, pos),

                // Search & Filter Toolbar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          onChanged: (q) => catalog.setSearchQuery(q),
                          decoration: InputDecoration(
                            hintText: 'Search menu by name or item code...',
                            prefixIcon: const Icon(Icons.search),
                            filled: true,
                            fillColor: Colors.white,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: AppColors.border),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Category Chips
                SizedBox(
                  height: 42,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: const Text('All Items'),
                          selected: catalog.selectedCategoryId == null,
                          onSelected: (_) => catalog.selectCategory(null),
                        ),
                      ),
                      ...catalog.categories.map((c) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(c.name),
                          selected: catalog.selectedCategoryId == c.id,
                          onSelected: (_) => catalog.selectCategory(c.id),
                        ),
                      )),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // Products Grid
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                      maxCrossAxisExtent: 190,
                      childAspectRatio: 1.05,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                    ),
                    itemCount: catalog.products.length,
                    itemBuilder: (ctx, idx) {
                      final product = catalog.products[idx];
                      return _buildProductCard(context, product, pos);
                    },
                  ),
                ),
              ],
            ),
          ),

          // Right Column (35% width): Cart / Active Bill Drawer
          Expanded(
            flex: 35,
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(left: BorderSide(color: AppColors.border, width: 1.5)),
              ),
              child: _buildCartPanel(context, pos),
            ),
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // Unsettled Orders Bar
  // -------------------------------------------------------------
  Widget _buildUnpaidOrdersBanner(BuildContext context, PosProvider pos) {
    if (pos.unpaidOrders.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        color: AppColors.surfaceMuted,
        child: const Row(
          children: [
            Icon(Icons.check_circle, size: 16, color: AppColors.success),
            SizedBox(width: 8),
            Text('All tables and orders are paid up.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
        ),
      );
    }

    return Container(
      height: 52,
      color: const Color(0xFFFEF3C7),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          const Icon(Icons.pending_actions, size: 20, color: AppColors.warning),
          const SizedBox(width: 8),
          Text(
            'Unpaid Bills (${pos.unpaidOrders.length}):',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF92400E)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: pos.unpaidOrders.length,
              itemBuilder: (ctx, idx) {
                final order = pos.unpaidOrders[idx];
                final isSelected = pos.checkoutOrder?.id == order.id;

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                  child: ActionChip(
                    backgroundColor: isSelected ? AppColors.primary : Colors.white,
                    label: Text(
                      '#${order.orderNumber} ${order.isDineIn ? "(T-${order.tableNumber})" : "(Takeaway)"} • Rs. ${order.grandTotal.toStringAsFixed(0)}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isSelected ? Colors.white : AppColors.textPrimary,
                      ),
                    ),
                    onPressed: () {
                      pos.selectOrderForCheckout(order);
                    },
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
  // Product Card
  // -------------------------------------------------------------
  Widget _buildProductCard(BuildContext context, Product product, PosProvider pos) {
    return InkWell(
      onTap: product.isAvailable ? () => pos.addToCart(product) : null,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: product.isAvailable ? Colors.white : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 4,
              offset: const Offset(0, 2),
            )
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (product.code != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceMuted,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      product.code!,
                      style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: AppColors.textSecondary),
                    ),
                  ),
                if (!product.isAvailable)
                  const Text('86 OUT', style: TextStyle(color: AppColors.danger, fontSize: 10, fontWeight: FontWeight.bold)),
              ],
            ),
            Text(
              product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: product.isAvailable ? AppColors.textPrimary : Colors.grey,
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Rs. ${product.price.toStringAsFixed(0)}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.primary),
                ),
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.add, size: 16, color: AppColors.primary),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // Right Column: Cart Panel & Checkout
  // -------------------------------------------------------------
  Widget _buildCartPanel(BuildContext context, PosProvider pos) {
    final activeCheckoutOrder = pos.checkoutOrder;

    return Column(
      children: [
        // Panel Header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: AppColors.surfaceMuted,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                activeCheckoutOrder != null
                    ? 'SETTLING BILL #${activeCheckoutOrder.orderNumber}'
                    : 'CURRENT ORDER',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
              ),
              if (activeCheckoutOrder != null)
                TextButton(
                  onPressed: () => pos.selectOrderForCheckout(pos.unpaidOrders.first),
                  child: const Text('Back to Cart', style: TextStyle(fontSize: 12)),
                )
              else
                TextButton(
                  onPressed: pos.cart.isEmpty ? null : () => pos.clearCart(),
                  child: const Text('Clear', style: TextStyle(color: AppColors.danger, fontSize: 12)),
                ),
            ],
          ),
        ),

        // Items List
        Expanded(
          child: activeCheckoutOrder != null
              ? ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: activeCheckoutOrder.items.length,
                  itemBuilder: (ctx, idx) {
                    final item = activeCheckoutOrder.items[idx];
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          Text('${item.quantity}x ', style: const TextStyle(fontWeight: FontWeight.bold)),
                          Expanded(child: Text(item.productName)),
                          Text('Rs. ${item.lineTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                        ],
                      ),
                    );
                  },
                )
              : pos.cart.isEmpty
                  ? const Center(
                      child: Text(
                        'Cart is empty.\nTap items on the left to add.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: pos.cart.length,
                      itemBuilder: (ctx, idx) {
                        final item = pos.cart[idx];
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(item.product.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                    Text('Rs. ${item.product.price.toStringAsFixed(0)} each', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.remove_circle_outline, size: 18),
                                onPressed: () => pos.updateQuantity(item.product.id, item.quantity - 1),
                              ),
                              Text('${item.quantity}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              IconButton(
                                icon: const Icon(Icons.add_circle_outline, size: 18),
                                onPressed: () => pos.updateQuantity(item.product.id, item.quantity + 1),
                              ),
                              SizedBox(
                                width: 70,
                                child: Text(
                                  'Rs. ${item.lineTotal.toStringAsFixed(0)}',
                                  textAlign: TextAlign.right,
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
        ),

        // Financial Totals Box
        Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: AppColors.surfaceMuted,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: Column(
            children: [
              _buildSummaryRow(
                'Subtotal',
                activeCheckoutOrder != null
                    ? activeCheckoutOrder.subtotal
                    : pos.cartSubtotal,
              ),
              const SizedBox(height: 4),
              _buildSummaryRow(
                'Tax (13% VAT)',
                activeCheckoutOrder != null
                    ? activeCheckoutOrder.taxAmount
                    : pos.cartTax,
              ),
              const Divider(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Grand Total', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  Text(
                    'Rs. ${(activeCheckoutOrder != null ? activeCheckoutOrder.grandTotal : pos.cartGrandTotal).toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.payments_outlined),
                  label: Text(
                    activeCheckoutOrder != null
                        ? 'TENDER PAYMENT (F4)'
                        : 'SUBMIT & TENDER ORDER',
                    style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () async {
                    if (activeCheckoutOrder != null) {
                      _showCheckoutModal(context, pos);
                    } else if (pos.cart.isNotEmpty) {
                      final newOrder = await pos.submitCartOrder();
                      if (newOrder != null && mounted) {
                        pos.selectOrderForCheckout(newOrder);
                        _showCheckoutModal(context, pos);
                      }
                    }
                  },
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryRow(String label, double amount) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        Text('Rs. ${amount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
      ],
    );
  }

  // -------------------------------------------------------------
  // Rapid Checkout Modal Dialog
  // -------------------------------------------------------------
  void _showCheckoutModal(BuildContext context, PosProvider pos) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return _CheckoutModalDialog();
      },
    );
  }
}

// -------------------------------------------------------------
// Dedicated Rapid Checkout Dialog
// -------------------------------------------------------------
class _CheckoutModalDialog extends StatefulWidget {
  @override
  State<_CheckoutModalDialog> createState() => _CheckoutModalDialogState();
}

class _CheckoutModalDialogState extends State<_CheckoutModalDialog> {
  final _amountController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final pos = Provider.of<PosProvider>(context, listen: false);
    final total = pos.checkoutOrder?.grandTotal ?? 0.0;
    _amountController.text = total.toStringAsFixed(0);
    pos.setReceivedAmount(total);
  }

  void _onQuickCash(double amt) {
    setState(() {
      _amountController.text = amt.toStringAsFixed(0);
    });
    Provider.of<PosProvider>(context, listen: false).setReceivedAmount(amt);
  }

  @override
  Widget build(BuildContext context) {
    final pos = Provider.of<PosProvider>(context);
    final total = pos.checkoutOrder?.grandTotal ?? 0.0;
    final change = pos.changeGiven;

    return AlertDialog(
      title: Row(
        children: [
          const Icon(Icons.point_of_sale, color: AppColors.primary),
          const SizedBox(width: 8),
          Text('Tender Settlement: Bill #${pos.checkoutOrder?.orderNumber}'),
        ],
      ),
      content: SizedBox(
        width: 440,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Payment method selector
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Center(child: Text('CASH')),
                    selected: pos.paymentMethod == 'cash',
                    onSelected: (_) => pos.setPaymentMethod('cash'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    label: const Center(child: Text('CARD')),
                    selected: pos.paymentMethod == 'card',
                    onSelected: (_) => pos.setPaymentMethod('card'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    label: const Center(child: Text('OTHER')),
                    selected: pos.paymentMethod == 'other',
                    onSelected: (_) => pos.setPaymentMethod('other'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Due Amount
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total Bill Due:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  Text(
                    'Rs. ${total.toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: AppColors.primary),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            if (pos.paymentMethod == 'cash') ...[
              // Tendered Cash Input
              TextField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                onChanged: (val) {
                  final amt = double.tryParse(val) ?? 0.0;
                  pos.setReceivedAmount(amt);
                },
                decoration: InputDecoration(
                  labelText: 'Cash Received From Customer (Rs.)',
                  prefixText: 'Rs. ',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 10),

              // Fast Cash Increment Pills
              Wrap(
                spacing: 8,
                children: [
                  ActionChip(label: const Text('Exact'), onPressed: () => _onQuickCash(total)),
                  ActionChip(label: const Text('Rs. 500'), onPressed: () => _onQuickCash(500)),
                  ActionChip(label: const Text('Rs. 1,000'), onPressed: () => _onQuickCash(1000)),
                  ActionChip(label: const Text('Rs. 2,000'), onPressed: () => _onQuickCash(2000)),
                  ActionChip(label: const Text('Rs. 5,000'), onPressed: () => _onQuickCash(5000)),
                ],
              ),
              const SizedBox(height: 16),

              // Change to Return Display Box
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: change >= 0 ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: change >= 0 ? AppColors.success : AppColors.danger,
                    width: 1.5,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      change >= 0 ? 'CHANGE TO RETURN:' : 'SHORTAGE:',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: change >= 0 ? AppColors.success : AppColors.danger,
                      ),
                    ),
                    Text(
                      'Rs. ${change.abs().toStringAsFixed(2)}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 22,
                        color: change >= 0 ? AppColors.success : AppColors.danger,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          ),
          onPressed: pos.isProcessingCheckout
              ? null
              : () async {
                  final ok = await pos.processPayment();
                  if (ok && mounted) {
                    Navigator.pop(context);
                    _showReceiptDialog(context, pos);
                  }
                },
          child: pos.isProcessingCheckout
              ? const CircularProgressIndicator(color: Colors.white)
              : const Text('COMPLETE PAYMENT & PRINT', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  void _showReceiptDialog(BuildContext context, PosProvider pos) {
    showDialog(
      context: context,
      builder: (ctx) {
        final data = pos.lastReceiptData;
        final receiptText = data?['thermal_formatted_text'] ?? 'Receipt data loading...';

        return AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.print, color: AppColors.primary),
              SizedBox(width: 8),
              Text('80mm Thermal Receipt'),
            ],
          ),
          content: Container(
            width: 360,
            constraints: const BoxConstraints(maxHeight: 460),
            padding: const EdgeInsets.all(16),
            color: const Color(0xFFFBFBFB),
            child: SingleChildScrollView(
              child: Text(
                receiptText,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 12,
                  height: 1.3,
                  color: Colors.black87,
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Done'),
            ),
            ElevatedButton.icon(
              icon: const Icon(Icons.print),
              label: const Text('Print (ESC/POS)'),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
              onPressed: () {
                // Trigger print
                Navigator.pop(ctx);
              },
            ),
          ],
        );
      },
    );
  }
}
