import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../models/order.dart';
import '../models/product.dart';
import '../models/table.dart';

class WaiterCartItem {
  final Product product;
  int quantity;
  String? notes;

  WaiterCartItem({
    required this.product,
    this.quantity = 1,
    this.notes,
  });

  double get lineTotal => product.price * quantity;
}

class WaiterProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<RestaurantTable> _tables = [];
  List<Order> _activeOrders = [];
  bool _isLoading = false;
  String? _errorMessage;

  // Ordering State
  RestaurantTable? _selectedTable;
  String _orderType = 'dine_in'; // 'dine_in' or 'takeaway'
  String? _customerName;
  String? _customerPhone;
  String? _specialInstructions;
  final List<WaiterCartItem> _cart = [];

  // Offline Buffer for resilient network operations
  final List<Map<String, dynamic>> _offlineQueue = [];

  List<RestaurantTable> get tables => _tables;
  List<Order> get activeOrders => _activeOrders;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  RestaurantTable? get selectedTable => _selectedTable;
  String get orderType => _orderType;
  String? get customerName => _customerName;
  String? get customerPhone => _customerPhone;
  String? get specialInstructions => _specialInstructions;
  List<WaiterCartItem> get cart => _cart;
  int get offlineQueueCount => _offlineQueue.length;

  double get cartSubtotal => _cart.fold(0.0, (sum, item) => sum + item.lineTotal);

  Future<void> refreshFloorAndOrders() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final tablesRes = await _api.get(ApiEndpoints.tables);
      if (tablesRes.statusCode == 200) {
        final List list = jsonDecode(tablesRes.body);
        _tables = list.map((t) => RestaurantTable.fromJson(t)).toList();
      }

      final ordersRes = await _api.get(ApiEndpoints.orders);
      if (ordersRes.statusCode == 200) {
        final List list = jsonDecode(ordersRes.body);
        _activeOrders = list
            .map((o) => Order.fromJson(o))
            .where((o) => o.orderStatus != 'completed' && o.orderStatus != 'cancelled')
            .toList();
      }

      // If we have offline queued items, attempt sync
      if (_offlineQueue.isNotEmpty) {
        await processOfflineQueue();
      }
    } catch (e) {
      _errorMessage = 'Offline or Server Unreachable: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void selectTable(RestaurantTable? table) {
    _selectedTable = table;
    _orderType = 'dine_in';
    notifyListeners();
  }

  void setOrderType(String type) {
    _orderType = type;
    if (type == 'takeaway') {
      _selectedTable = null;
    }
    notifyListeners();
  }

  void setCustomerInfo({String? name, String? phone, String? notes}) {
    _customerName = name;
    _customerPhone = phone;
    _specialInstructions = notes;
    notifyListeners();
  }

  void addItemToCart(Product product) {
    final idx = _cart.indexWhere((item) => item.product.id == product.id);
    if (idx != -1) {
      _cart[idx].quantity += 1;
    } else {
      _cart.add(WaiterCartItem(product: product, quantity: 1));
    }
    notifyListeners();
  }

  void updateItemQuantity(String productId, int quantity) {
    final idx = _cart.indexWhere((item) => item.product.id == productId);
    if (idx != -1) {
      if (quantity <= 0) {
        _cart.removeAt(idx);
      } else {
        _cart[idx].quantity = quantity;
      }
      notifyListeners();
    }
  }

  void updateItemNotes(String productId, String? notes) {
    final idx = _cart.indexWhere((item) => item.product.id == productId);
    if (idx != -1) {
      _cart[idx].notes = notes;
      notifyListeners();
    }
  }

  void clearCart() {
    _cart.clear();
    _customerName = null;
    _customerPhone = null;
    _specialInstructions = null;
    notifyListeners();
  }

  Order? getActiveOrderByTable(String tableId) {
    try {
      return _activeOrders.firstWhere(
        (o) => o.tableId == tableId && o.paymentStatus != 'paid',
      );
    } catch (_) {
      return null;
    }
  }

  Future<bool> submitOrder() async {
    if (_cart.isEmpty) {
      _errorMessage = 'Cannot submit empty order';
      notifyListeners();
      return false;
    }

    final payload = {
      'order_type': _orderType,
      'table_id': _selectedTable?.id,
      'customer_name': _customerName,
      'customer_phone': _customerPhone,
      'special_instructions': _specialInstructions,
      'items': _cart.map((i) => {
        'product_id': i.product.id,
        'quantity': i.quantity,
        'special_instructions': i.notes,
      }).toList(),
    };

    try {
      final res = await _api.post(ApiEndpoints.orders, body: payload);
      if (res.statusCode == 201) {
        clearCart();
        await refreshFloorAndOrders();
        return true;
      } else {
        final err = jsonDecode(res.body);
        _errorMessage = err['detail'] ?? 'Failed to submit order';
        notifyListeners();
        return false;
      }
    } catch (e) {
      // Buffer offline
      _offlineQueue.add({'type': 'create', 'payload': payload});
      clearCart();
      _errorMessage = 'Server offline. Order saved locally to offline queue.';
      notifyListeners();
      return true;
    }
  }

  Future<bool> appendItemsToExistingOrder(String orderId) async {
    if (_cart.isEmpty) {
      _errorMessage = 'No items to append';
      notifyListeners();
      return false;
    }

    final payload = {
      'items': _cart.map((i) => {
        'product_id': i.product.id,
        'quantity': i.quantity,
        'special_instructions': i.notes,
      }).toList(),
    };

    try {
      final res = await _api.post('${ApiEndpoints.orders}/$orderId/append', body: payload);
      if (res.statusCode == 200) {
        clearCart();
        await refreshFloorAndOrders();
        return true;
      } else {
        final err = jsonDecode(res.body);
        _errorMessage = err['detail'] ?? 'Failed to append items';
        notifyListeners();
        return false;
      }
    } catch (e) {
      _offlineQueue.add({'type': 'append', 'orderId': orderId, 'payload': payload});
      clearCart();
      _errorMessage = 'Server offline. Items saved to offline queue.';
      notifyListeners();
      return true;
    }
  }

  Future<bool> updateOrderStatus(String orderId, String newStatus) async {
    try {
      final res = await _api.put(
        '${ApiEndpoints.orders}/$orderId/status',
        body: {'order_status': newStatus},
      );
      if (res.statusCode == 200) {
        await refreshFloorAndOrders();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<void> processOfflineQueue() async {
    final List<Map<String, dynamic>> remaining = [];
    for (final item in _offlineQueue) {
      try {
        if (item['type'] == 'create') {
          final res = await _api.post(ApiEndpoints.orders, body: item['payload']);
          if (res.statusCode != 201) remaining.add(item);
        } else if (item['type'] == 'append') {
          final res = await _api.post('${ApiEndpoints.orders}/${item['orderId']}/append', body: item['payload']);
          if (res.statusCode != 200) remaining.add(item);
        }
      } catch (_) {
        remaining.add(item);
      }
    }
    _offlineQueue.clear();
    _offlineQueue.addAll(remaining);
    notifyListeners();
  }
}
