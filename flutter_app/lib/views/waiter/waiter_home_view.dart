import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/waiter_provider.dart';
import '../../models/table.dart';
import '../../models/product.dart';
import '../../models/order.dart';

class WaiterHomeView extends StatefulWidget {
  const WaiterHomeView({super.key});

  @override
  State<WaiterHomeView> createState() => _WaiterHomeViewState();
}

class _WaiterHomeViewState extends State<WaiterHomeView> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CatalogProvider>(context, listen: false).loadCatalog();
      Provider.of<WaiterProvider>(context, listen: false).refreshFloorAndOrders();
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
    final waiter = Provider.of<WaiterProvider>(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        elevation: 0,
        title: Row(
          children: [
            const Icon(Icons.restaurant_menu, color: AppColors.wheat, size: 20),
            const SizedBox(width: 8),
            Text(
              'Floor Order Taker: ${auth.currentUser?.fullName ?? "Waiter"}',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            tooltip: 'Refresh Floor',
            onPressed: () => waiter.refreshFloorAndOrders(),
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
            const Tab(icon: Icon(Icons.table_restaurant), text: 'Dine-In Tables'),
            const Tab(icon: Icon(Icons.takeout_dining), text: 'Takeaway Order'),
            Tab(
              icon: const Icon(Icons.soup_kitchen),
              text: 'Active Orders (${waiter.activeOrders.length})',
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Offline Resiliency Banner
          if (waiter.offlineQueueCount > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: AppColors.warning,
              child: Row(
                children: [
                  const Icon(Icons.cloud_off, color: Colors.white, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Offline Mode: ${waiter.offlineQueueCount} orders queued locally.',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ),
                  TextButton(
                    onPressed: () => waiter.processOfflineQueue(),
                    style: TextButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.warning,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    ),
                    child: const Text('SYNC NOW', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),

          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildTablesGrid(context, waiter),
                _buildTakeawaySection(context, waiter),
                _buildActiveOrdersList(context, waiter),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // TAB 1: Tables Floor Plan
  // -------------------------------------------------------------
  Widget _buildTablesGrid(BuildContext context, WaiterProvider waiter) {
    if (waiter.isLoading && waiter.tables.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (waiter.tables.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.table_bar, size: 64, color: AppColors.textMuted),
            const SizedBox(height: 12),
            const Text('No tables configured in system', style: TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => waiter.refreshFloorAndOrders(),
              child: const Text('Reload Tables'),
            )
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => waiter.refreshFloorAndOrders(),
      child: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: 220,
          childAspectRatio: 1.1,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
        ),
        itemCount: waiter.tables.length,
        itemBuilder: (context, index) {
          final table = waiter.tables[index];
          final isOccupied = table.isOccupied;
          final activeOrder = waiter.getActiveOrderByTable(table.id);

          return InkWell(
            onTap: () {
              if (isOccupied) {
                _showActiveTableDialog(context, waiter, table, activeOrder);
              } else {
                _startDineInOrder(context, waiter, table);
              }
            },
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isOccupied ? const Color(0xFFFEF2F2) : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isOccupied ? AppColors.danger.withOpacity(0.5) : AppColors.success.withOpacity(0.5),
                  width: 2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 8,
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
                      Text(
                        'Table ${table.tableNumber}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isOccupied ? AppColors.danger : AppColors.success,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          isOccupied ? 'OCCUPIED' : 'OPEN',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (isOccupied && activeOrder != null) ...[
                    Text(
                      'Bill #${activeOrder.orderNumber}',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                    Text(
                      'Rs. ${activeOrder.grandTotal.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ] else ...[
                    Text(
                      'Capacity: ${table.capacity} Guests',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                    const Row(
                      children: [
                        Icon(Icons.add_circle_outline, size: 16, color: AppColors.success),
                        SizedBox(width: 4),
                        Text(
                          'Tap to Order',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.success),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // Active Occupied Table Bill Modal
  void _showActiveTableDialog(
    BuildContext context,
    WaiterProvider waiter,
    RestaurantTable table,
    Order? activeOrder,
  ) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.receipt_long, color: AppColors.primary),
              const SizedBox(width: 8),
              Text('Table ${table.tableNumber} - Active Bill'),
            ],
          ),
          content: SizedBox(
            width: 420,
            child: activeOrder == null
                ? const Text('Loading active order details...')
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Order #${activeOrder.orderNumber}', style: const TextStyle(fontWeight: FontWeight.bold)),
                          Text(
                            activeOrder.orderStatus.toUpperCase(),
                            style: const TextStyle(color: AppColors.warning, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const Divider(height: 20),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 240),
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: activeOrder.items.length,
                          itemBuilder: (c, idx) {
                            final item = activeOrder.items[idx];
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: Row(
                                children: [
                                  Text('${item.quantity}x ', style: const TextStyle(fontWeight: FontWeight.bold)),
                                  Expanded(child: Text(item.productName)),
                                  Text('Rs. ${item.lineTotal.toStringAsFixed(2)}'),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                      const Divider(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Total (incl. tax):', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          Text(
                            'Rs. ${activeOrder.grandTotal.toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.primary),
                          ),
                        ],
                      ),
                    ],
                  ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close'),
            ),
            if (activeOrder != null)
              ElevatedButton.icon(
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Add Items to Bill'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  _openItemSelector(context, waiter, isAppend: true, targetOrderId: activeOrder.id);
                },
              ),
          ],
        );
      },
    );
  }

  void _startDineInOrder(BuildContext context, WaiterProvider waiter, RestaurantTable table) {
    waiter.selectTable(table);
    _openItemSelector(context, waiter, isAppend: false);
  }

  // -------------------------------------------------------------
  // TAB 2: Takeaway Ordering
  // -------------------------------------------------------------
  Widget _buildTakeawaySection(BuildContext context, WaiterProvider waiter) {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.takeout_dining, size: 64, color: AppColors.primary),
            ),
            const SizedBox(height: 20),
            const Text(
              'New Takeaway Order',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            const Text(
              'Punch orders for walk-in takeaway, customer collection, or phone pickup.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.add_shopping_cart),
                label: const Text('START TAKEAWAY ORDER', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  waiter.setOrderType('takeaway');
                  _openItemSelector(context, waiter, isAppend: false);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // Item Selector Sheet (for both New Order and Append to Bill)
  // -------------------------------------------------------------
  void _openItemSelector(BuildContext context, WaiterProvider waiter, {required bool isAppend, String? targetOrderId}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return _ItemSelectionModal(
          isAppend: isAppend,
          targetOrderId: targetOrderId,
        );
      },
    );
  }

  // -------------------------------------------------------------
  // TAB 3: Active Orders & Kitchen Preparation Status
  // -------------------------------------------------------------
  Widget _buildActiveOrdersList(BuildContext context, WaiterProvider waiter) {
    if (waiter.activeOrders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_outline, size: 64, color: AppColors.success),
            const SizedBox(height: 12),
            const Text('All orders cleared! Kitchen is idle.', style: TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => waiter.refreshFloorAndOrders(),
              child: const Text('Refresh Orders'),
            )
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: waiter.activeOrders.length,
      itemBuilder: (context, index) {
        final order = waiter.activeOrders[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          elevation: 2,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Order #${order.orderNumber} (${order.isDineIn ? "Table ${order.tableNumber ?? ''}" : "Takeaway"})',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    _buildStatusChip(order.orderStatus),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '${order.items.length} items • Grand Total: Rs. ${order.grandTotal.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.w500, color: AppColors.primary),
                ),
                const Divider(height: 16),
                ...order.items.map((i) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text('• ${i.quantity}x ${i.productName}'),
                )),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (order.orderStatus == 'pending')
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.warning, foregroundColor: Colors.white),
                        onPressed: () => waiter.updateOrderStatus(order.id, 'preparing'),
                        child: const Text('Start Preparing'),
                      ),
                    if (order.orderStatus == 'preparing')
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.info, foregroundColor: Colors.white),
                        onPressed: () => waiter.updateOrderStatus(order.id, 'ready'),
                        child: const Text('Mark Ready'),
                      ),
                    if (order.orderStatus == 'ready')
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.success, foregroundColor: Colors.white),
                        onPressed: () => waiter.updateOrderStatus(order.id, 'served'),
                        child: const Text('Mark Served'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatusChip(String status) {
    Color bg = Colors.grey;
    if (status == 'pending') bg = Colors.orange;
    if (status == 'preparing') bg = Colors.blue;
    if (status == 'ready') bg = Colors.green;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(
        status.toUpperCase(),
        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
      ),
    );
  }
}

// -------------------------------------------------------------
// Interactive Bottom Sheet for Menu Item Selection & Cart
// -------------------------------------------------------------
class _ItemSelectionModal extends StatefulWidget {
  final bool isAppend;
  final String? targetOrderId;

  const _ItemSelectionModal({required this.isAppend, this.targetOrderId});

  @override
  State<_ItemSelectionModal> createState() => _ItemSelectionModalState();
}

class _ItemSelectionModalState extends State<_ItemSelectionModal> {
  final _searchController = TextEditingController();
  final _customerNameCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final catalog = Provider.of<CatalogProvider>(context);
    final waiter = Provider.of<WaiterProvider>(context);

    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppColors.primaryDark,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.isAppend
                        ? 'Append Items to Active Bill'
                        : waiter.orderType == 'dine_in'
                            ? 'New Dine-In: Table ${waiter.selectedTable?.tableNumber}'
                            : 'New Takeaway Order',
                    style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          // Search & Category Chips
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              onChanged: (q) => catalog.setSearchQuery(q),
              decoration: InputDecoration(
                hintText: 'Search menu by name or code...',
                prefixIcon: const Icon(Icons.search),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),

          // Categories bar
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
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
          const SizedBox(height: 8),

          // Product List Grid
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.all(12),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 180,
                childAspectRatio: 0.95,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: catalog.products.length,
              itemBuilder: (ctx, idx) {
                final product = catalog.products[idx];
                final inCart = waiter.cart.any((item) => item.product.id == product.id);

                return InkWell(
                  onTap: product.isAvailable ? () => waiter.addItemToCart(product) : null,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: product.isAvailable ? Colors.white : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: inCart ? AppColors.primary : AppColors.border,
                        width: inCart ? 2 : 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
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
                              style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                            ),
                            Icon(
                              inCart ? Icons.check_circle : Icons.add_circle,
                              color: product.isAvailable ? AppColors.primary : Colors.grey,
                              size: 22,
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

          // Cart Summary Bottom Bar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceMuted,
              border: const Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${waiter.cart.length} unique items (${waiter.cart.fold(0, (sum, i) => sum + i.quantity)} total)',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      'Subtotal: Rs. ${waiter.cartSubtotal.toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.primary),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: waiter.cart.isEmpty
                        ? null
                        : () async {
                            bool success;
                            if (widget.isAppend && widget.targetOrderId != null) {
                              success = await waiter.appendItemsToExistingOrder(widget.targetOrderId!);
                            } else {
                              success = await waiter.submitOrder();
                            }
                            if (success && mounted) {
                              Navigator.pop(context);
                            }
                          },
                    child: Text(
                      widget.isAppend ? 'CONFIRM APPEND TO BILL' : 'PUNCH & SEND TO KITCHEN',
                      style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
