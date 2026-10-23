import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../models/category.dart';
import '../models/product.dart';

class CatalogProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<Category> _categories = [];
  List<Product> _products = [];
  String? _selectedCategoryId;
  String _searchQuery = '';
  bool _isLoading = false;
  String? _errorMessage;

  List<Category> get categories => _categories;
  List<Product> get products => _filteredProducts();
  String? get selectedCategoryId => _selectedCategoryId;
  String get searchQuery => _searchQuery;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> loadCatalog() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final catRes = await _api.get(ApiEndpoints.categories);
      final prodRes = await _api.get(ApiEndpoints.products);

      if (catRes.statusCode == 200 && prodRes.statusCode == 200) {
        final List catList = jsonDecode(catRes.body);
        final List prodList = jsonDecode(prodRes.body);

        _categories = catList.map((c) => Category.fromJson(c)).toList();
        _products = prodList.map((p) => Product.fromJson(p)).toList();
      } else {
        _errorMessage = 'Failed to load menu catalog from restaurant server';
      }
    } catch (e) {
      _errorMessage = 'Error loading catalog: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void selectCategory(String? categoryId) {
    _selectedCategoryId = categoryId;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  List<Product> _filteredProducts() {
    return _products.where((p) {
      final matchesCategory = _selectedCategoryId == null || _selectedCategoryId == 'all' || p.categoryId == _selectedCategoryId;
      final matchesQuery = _searchQuery.isEmpty ||
          p.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          (p.code != null && p.code!.toLowerCase().contains(_searchQuery.toLowerCase()));
      return matchesCategory && matchesQuery;
    }).toList();
  }

  Future<bool> toggleProductAvailability(String productId) async {
    try {
      final res = await _api.put('${ApiEndpoints.products}/$productId/toggle-availability');
      if (res.statusCode == 200) {
        final updatedJson = jsonDecode(res.body);
        final idx = _products.indexWhere((p) => p.id == productId);
        if (idx != -1) {
          _products[idx] = Product.fromJson(updatedJson);
          notifyListeners();
        }
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}
