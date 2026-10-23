class OrderItem {
  final String id;
  final String? productId;
  final String productName;
  final double unitPrice;
  final int quantity;
  final double lineTotal;
  final String? specialInstructions;

  OrderItem({
    required this.id,
    this.productId,
    required this.productName,
    required this.unitPrice,
    required this.quantity,
    required this.lineTotal,
    this.specialInstructions,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      id: json['id'] ?? '',
      productId: json['product_id'],
      productName: json['product_name_snapshot'] ?? json['name'] ?? '',
      unitPrice: (json['unit_price_snapshot'] is num) 
          ? (json['unit_price_snapshot'] as num).toDouble() 
          : double.tryParse(json['unit_price_snapshot']?.toString() ?? '0') ?? 0.0,
      quantity: json['quantity'] ?? 1,
      lineTotal: (json['line_total'] is num) 
          ? (json['line_total'] as num).toDouble() 
          : double.tryParse(json['line_total']?.toString() ?? '0') ?? 0.0,
      specialInstructions: json['special_instructions'] ?? json['notes'],
    );
  }
}

class Order {
  final String id;
  final int orderNumber;
  final String orderType; // 'dine_in' or 'takeaway'
  final String? tableId;
  final String? tableNumber;
  final String employeeId;
  final String orderStatus; // 'pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'
  final String paymentStatus; // 'unpaid', 'partially_paid', 'paid', 'refunded'
  final double subtotal;
  final double discountAmount;
  final double taxRate;
  final double taxAmount;
  final double grandTotal;
  final String? customerName;
  final String? customerPhone;
  final String? specialInstructions;
  final DateTime createdAt;
  final List<OrderItem> items;

  Order({
    required this.id,
    required this.orderNumber,
    required this.orderType,
    this.tableId,
    this.tableNumber,
    required this.employeeId,
    required this.orderStatus,
    required this.paymentStatus,
    required this.subtotal,
    this.discountAmount = 0.0,
    this.taxRate = 13.0,
    required this.taxAmount,
    required this.grandTotal,
    this.customerName,
    this.customerPhone,
    this.specialInstructions,
    required this.createdAt,
    this.items = const [],
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    var rawItems = json['items'] as List? ?? [];
    List<OrderItem> parsedItems = rawItems.map((i) => OrderItem.fromJson(i)).toList();

    return Order(
      id: json['id'] ?? '',
      orderNumber: json['order_number'] ?? 0,
      orderType: json['order_type'] ?? 'dine_in',
      tableId: json['table_id'],
      tableNumber: json['table_number'],
      employeeId: json['employee_id'] ?? '',
      orderStatus: json['order_status'] ?? json['status'] ?? 'pending',
      paymentStatus: json['payment_status'] ?? 'unpaid',
      subtotal: (json['subtotal'] is num) ? (json['subtotal'] as num).toDouble() : double.tryParse(json['subtotal'].toString()) ?? 0.0,
      discountAmount: (json['discount_amount'] is num) ? (json['discount_amount'] as num).toDouble() : double.tryParse(json['discount_amount']?.toString() ?? '0') ?? 0.0,
      taxRate: (json['tax_rate'] is num) ? (json['tax_rate'] as num).toDouble() : 13.0,
      taxAmount: (json['tax_amount'] is num) ? (json['tax_amount'] as num).toDouble() : double.tryParse(json['tax_amount']?.toString() ?? '0') ?? 0.0,
      grandTotal: (json['grand_total'] is num) ? (json['grand_total'] as num).toDouble() : double.tryParse(json['grand_total'].toString()) ?? 0.0,
      customerName: json['customer_name'],
      customerPhone: json['customer_phone'],
      specialInstructions: json['special_instructions'] ?? json['notes'],
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at']) : DateTime.now(),
      items: parsedItems,
    );
  }

  bool get isDineIn => orderType == 'dine_in';
  bool get isPaid => paymentStatus == 'paid';
}
