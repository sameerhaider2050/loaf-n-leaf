class Category {
  final String id;
  final String name;
  final String slug;
  final int sortOrder;
  final bool isActive;

  Category({
    required this.id,
    required this.name,
    required this.slug,
    this.sortOrder = 0,
    this.isActive = true,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      slug: json['slug'] ?? '',
      sortOrder: json['sort_order'] ?? 0,
      isActive: json['is_active'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'slug': slug,
      'sort_order': sortOrder,
      'is_active': isActive,
    };
  }
}
