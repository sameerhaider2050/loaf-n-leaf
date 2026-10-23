class RestaurantTable {
  final String id;
  final String tableNumber;
  final String name;
  final int capacity;
  final String status; // 'available', 'occupied', 'reserved'
  final String? activeOrderId;

  RestaurantTable({
    required this.id,
    required this.tableNumber,
    required this.name,
    this.capacity = 4,
    this.status = 'available',
    this.activeOrderId,
  });

  factory RestaurantTable.fromJson(Map<String, dynamic> json) {
    return RestaurantTable(
      id: json['id'] ?? '',
      tableNumber: json['table_number'] ?? '',
      name: json['name'] ?? json['table_number'] ?? '',
      capacity: json['capacity'] ?? 4,
      status: json['status'] ?? 'available',
      activeOrderId: json['active_order_id'] ?? json['current_order_id'],
    );
  }

  bool get isAvailable => status == 'available';
  bool get isOccupied => status == 'occupied';
  bool get isReserved => status == 'reserved';
}
