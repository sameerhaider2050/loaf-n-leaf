class Payment {
  final String id;
  final String orderId;
  final String paymentMethod; // 'cash', 'card', 'other'
  final double amountPaid;
  final double receivedAmount;
  final double changeGiven;
  final String? transactionRef;
  final String cashierId;
  final DateTime createdAt;

  Payment({
    required this.id,
    required this.orderId,
    required this.paymentMethod,
    required this.amountPaid,
    required this.receivedAmount,
    this.changeGiven = 0.0,
    this.transactionRef,
    required this.cashierId,
    required this.createdAt,
  });

  factory Payment.fromJson(Map<String, dynamic> json) {
    return Payment(
      id: json['id'] ?? '',
      orderId: json['order_id'] ?? '',
      paymentMethod: json['payment_method'] ?? 'cash',
      amountPaid: (json['amount_paid'] is num) ? (json['amount_paid'] as num).toDouble() : double.tryParse(json['amount_paid'].toString()) ?? 0.0,
      receivedAmount: (json['received_amount'] is num) ? (json['received_amount'] as num).toDouble() : double.tryParse(json['received_amount'].toString()) ?? 0.0,
      changeGiven: (json['change_given'] is num) ? (json['change_given'] as num).toDouble() : double.tryParse(json['change_given']?.toString() ?? '0') ?? 0.0,
      transactionRef: json['transaction_ref'],
      cashierId: json['cashier_id'] ?? '',
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at']) : DateTime.now(),
    );
  }
}
