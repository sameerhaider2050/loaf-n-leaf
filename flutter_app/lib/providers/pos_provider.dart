import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../models/order.dart';
import '../models/product.dart';
import '../models/payment.dart';

class PosCartItem {
  final Product product;
  int quantity;
  String? notes;

  PosCartItem({
    required this.product,
    this.quantity = 1,
    this.notes,
  });

  double get lineTotal => product.price * quantity;
}

class PosProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();
  final Uuid _uuid = const Uuid();

  // Active Unsettled Orders for Cashier Floor
  List<Order> _unpaidOrders = [];
  bool _isLoadingOrders = false;

  // POS Order Entry Cart
  final List<PosCartItem> _cart = [];
  String _orderType = 'dine_in'; // 'dine_in' or 'takeaway'
  String? _selectedTableId;
  String? _selectedTableNumber;
  String? _customerName;
  String? _customerPhone;
  String? _orderNotes;
  double _discountPercent = 0.0;
  double _discountAmount = 0.0;

  // Active Order undergoing Checkout
  Order? _checkoutOrder;
  double _receivedAmount = 0.0;
  String _paymentMethod = 'cash'; // 'cash', 'card', 'other'
  bool _isProcessingCheckout = false;
  Payment? _lastCompletedPayment;
  Map<String, dynamic>? _lastReceiptData;
  String? _errorMessage;

  List<Order> get unpaidOrders => _unpaidOrders;
  bool get isLoadingOrders => _isLoadingOrders;
  List<PosCartItem> get cart => _cart;
  String get orderType => _orderType;
  String? get selectedTableId => _selectedTableId;
  String? get selectedTableNumber => _selectedTableNumber;
  String? get customerName => _customerName;
  String? get customerPhone => _customerPhone;
  String? get orderNotes => _orderNotes;
  Order? get checkoutOrder => _checkoutOrder;
  double get receivedAmount => _receivedAmount;
  String get paymentMethod => _paymentMethod;
  bool get isProcessingCheckout => _isProcessingCheckout;
  Payment? get lastCompletedPayment => _lastCompletedPayment;
  Map<String, dynamic>? get lastReceiptData => _lastReceiptData;
  String? get errorMessage => _errorMessage;

  // Cart Calculations
  double get cartSubtotal => _cart.fold(0.0, (sum, item) => sum + item.lineTotal);
  double get calculatedDiscount => _discountPercent > 0
      ? (cartSubtotal * (_discountPercent / 100.0))
      : _discountAmount;
  double get taxableAmount => (cartSubtotal - calculatedDiscount).clamp(0.0, double.infinity);
  double get cartTax => taxableAmount * 0.13; // 13% tax
  double get cartGrandTotal => taxableAmount + cartTax;

  // Checkout Change Calculation
  double get changeGiven {
    final total = _checkoutOrder != null ? _checkoutOrder!.grandTotal : cartGrandTotal;
    if (_paymentMethod == 'cash' && _receivedAmount >= total) {
      return _receivedAmount - total;
    }
    return 0.0;
  }

  void setOrderType(String type) {
    _orderType = type;
    if (type == 'takeaway') {
      _selectedTableId = null;
      _selectedTableNumber = null;
    }
    notifyListeners();
  }

  void setSelectedTable(String? id, String? number) {
    _selectedTableId = id;
    _selectedTableNumber = number;
    notifyListeners();
  }

  void setCustomerInfo({String? name, String? phone}) {
    _customerName = name;
    _customerPhone = phone;
    notifyListeners();
  }

  void setOrderNotes(String? notes) {
    _orderNotes = notes;
    notifyListeners();
  }

  void setDiscountPercent(double pct) {
    _discountPercent = pct;
    _discountAmount = 0.0;
    notifyListeners();
  }

  void setDiscountAmount(double amt) {
    _discountAmount = amt;
    _discountPercent = 0.0;
    notifyListeners();
  }

  void addToCart(Product product) {
    final idx = _cart.indexWhere((item) => item.product.id == product.id);
    if (idx != -1) {
      _cart[idx].quantity += 1;
    } else {
      _cart.add(PosCartItem(product: product, quantity: 1));
    }
    notifyListeners();
  }

  void updateQuantity(String productId, int quantity) {
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
    _discountPercent = 0.0;
    _discountAmount = 0.0;
    _customerName = null;
    _customerPhone = null;
    _orderNotes = null;
    _selectedTableId = null;
    _selectedTableNumber = null;
    notifyListeners();
  }

  Future<void> fetchUnpaidOrders() async {
    _isLoadingOrders = true;
    notifyListeners();
    try {
      final res = await _api.get('${ApiEndpoints.orders}?payment_status=unpaid');
      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        _unpaidOrders = list.map((o) => Order.fromJson(o)).toList();
      }
    } catch (e) {
      _errorMessage = 'Failed to fetch unpaid orders: $e';
    } finally {
      _isLoadingOrders = false;
      notifyListeners();
    }
  }

  Future<Order?> submitCartOrder() async {
    if (_cart.isEmpty) {
      _errorMessage = 'Cannot submit an empty cart';
      notifyListeners();
      return null;
    }

    try {
      final orderPayload = {
        'order_type': _orderType,
        'table_id': _selectedTableId,
        'customer_name': _customerName,
        'customer_phone': _customerPhone,
        'special_instructions': _orderNotes,
        'items': _cart.map((item) => {
          'product_id': item.product.id,
          'quantity': item.quantity,
          'special_instructions': item.notes,
        }).toList(),
      };

      final res = await _api.post(ApiEndpoints.orders, body: orderPayload);
      if (res.statusCode == 201) {
        final newOrder = Order.fromJson(jsonDecode(res.body));
        clearCart();
        await fetchUnpaidOrders();
        return newOrder;
      } else {
        final err = jsonDecode(res.body);
        _errorMessage = err['detail'] ?? 'Failed to submit order';
        notifyListeners();
        return null;
      }
    } catch (e) {
      _errorMessage = 'Order submission error: $e';
      notifyListeners();
      return null;
    }
  }

  void selectOrderForCheckout(Order order) {
    _checkoutOrder = order;
    _receivedAmount = order.grandTotal;
    _paymentMethod = 'cash';
    _errorMessage = null;
    notifyListeners();
  }

  void setReceivedAmount(double amt) {
    _receivedAmount = amt;
    notifyListeners();
  }

  void setPaymentMethod(String method) {
    _paymentMethod = method;
    if (method != 'cash' && _checkoutOrder != null) {
      _receivedAmount = _checkoutOrder!.grandTotal;
    }
    notifyListeners();
  }

  Future<bool> processPayment() async {
    if (_checkoutOrder == null) return false;

    _isProcessingCheckout = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final idempotencyKey = _uuid.v4();
      final body = {
        'order_id': _checkoutOrder!.id,
        'payment_method': _paymentMethod,
        'received_amount': _receivedAmount,
        'idempotency_key': idempotencyKey,
      };

      final res = await _api.post(ApiEndpoints.checkout, body: body);
      if (res.statusCode == 201 || res.statusCode == 200) {
        _lastCompletedPayment = Payment.fromJson(jsonDecode(res.body));
        // Fetch receipt
        await fetchReceipt(_checkoutOrder!.id);
        _checkoutOrder = null;
        await fetchUnpaidOrders();
        return true;
      } else {
        final err = jsonDecode(res.body);
        _errorMessage = err['detail'] ?? 'Payment failed';
        return false;
      }
    } catch (e) {
      _errorMessage = 'Payment error: $e';
      return false;
    } finally {
      _isProcessingCheckout = false;
      notifyListeners();
    }
  }

  Future<void> fetchReceipt(String orderId) async {
    try {
      final res = await _api.get('${ApiEndpoints.receipt}/$orderId');
      if (res.statusCode == 200) {
        _lastReceiptData = jsonDecode(res.body);
        notifyListeners();
      }
    } catch (_) {}
  }
}
