class Employee {
  final String id;
  final String username;
  final String email;
  final String fullName;
  final String role; // 'admin', 'cashier', 'order_taker'
  final String? phone;
  final bool isActive;

  Employee({
    required this.id,
    required this.username,
    required this.email,
    required this.fullName,
    required this.role,
    this.phone,
    this.isActive = true,
  });

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      id: json['id'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      fullName: json['full_name'] ?? json['name'] ?? '',
      role: json['role'] ?? 'order_taker',
      phone: json['phone'],
      isActive: json['is_active'] == true || json['is_active'] == 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'full_name': fullName,
      'role': role,
      'phone': phone,
      'is_active': isActive,
    };
  }

  bool get isAdmin => role == 'admin';
  bool get isCashier => role == 'cashier' || role == 'admin';
  bool get isWaiter => role == 'order_taker' || role == 'admin';
}
