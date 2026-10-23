class Product {
  final String id;
  final String name;
  final String categoryId;
  final double price;
  final double cost;
  final String? code;
  final String? imageUrl;
  final bool isAvailable;
  final String? description;

  Product({
    required this.id,
    required this.name,
    required this.categoryId,
    required this.price,
    this.cost = 0.0,
    this.code,
    this.imageUrl,
    this.isAvailable = true,
    this.description,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      categoryId: json['category_id'] ?? json['category'] ?? '',
      price: (json['price'] is num) ? (json['price'] as num).toDouble() : double.tryParse(json['price'].toString()) ?? 0.0,
      cost: (json['cost'] is num) ? (json['cost'] as num).toDouble() : 0.0,
      code: json['code'],
      imageUrl: json['image_url'] ?? json['image'],
      isAvailable: json['is_available'] == true || json['available'] == 1,
      description: json['description'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category_id': categoryId,
      'price': price,
      'cost': cost,
      'code': code,
      'image_url': imageUrl,
      'is_available': isAvailable,
      'description': description,
    };
  }
}
