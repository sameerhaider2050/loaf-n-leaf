import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  UtensilsCrossed,
  ShieldAlert,
  Sparkles,
  Check,
  AlertCircle
} from 'lucide-react';
import { Product, Category, User } from '../types';
import { formatCurrency } from '../utils/formatters';
import { api } from '../services/api';
import { ProductFormModal } from '../components/ProductFormModal';

interface MenuViewProps {
  products: Product[];
  categories: Category[];
  currentUser: User | null;
  onRefreshData: () => void;
  onOpenAuthModal: () => void;
}

export const MenuView: React.FC<MenuViewProps> = ({
  products,
  categories,
  currentUser,
  onRefreshData,
  onOpenAuthModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch = 
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleToggleAvailability = async (product: Product) => {
    try {
      await api.toggleProductAvailability(product.id);
      showNotification(`Availability updated for "${product.name}"`);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle availability');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!isAdmin) {
      alert('Only Administrators can delete menu items. Please switch to Admin.');
      onOpenAuthModal();
      return;
    }

    if (window.confirm(`Are you sure you want to permanently remove "${product.name}" from the Loaf n Leaf menu?`)) {
      try {
        await api.deleteProduct(product.id);
        showNotification(`"${product.name}" removed from the menu.`);
        onRefreshData();
      } catch (err: any) {
        alert(err.message || 'Failed to delete product');
      }
    }
  };

  const handleSaveProduct = async (productData: Partial<Product>) => {
    if (!isAdmin) {
      alert('Only Administrators can add or edit menu items.');
      onOpenAuthModal();
      return;
    }

    if (editingProduct) {
      await api.updateProduct(editingProduct.id, productData);
      showNotification(`Updated item "${productData.name}"`);
    } else {
      await api.createProduct(productData);
      showNotification(`New item "${productData.name}" added to menu!`);
    }
    onRefreshData();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAF8] overflow-hidden">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 right-6 z-50 bg-leaf-900 text-white px-4 py-2 rounded-lg text-xs shadow-lg flex items-center gap-2 border border-leaf-700 animate-in fade-in">
          <Check className="w-4 h-4 text-leaf-300" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="bg-white border-b border-border-color p-4 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-primary-text tracking-tight">
                Menu Management
              </h2>
              {isAdmin ? (
                <span className="text-[10px] font-bold text-leaf-800 bg-leaf-100 px-2 py-0.5 rounded-full border border-leaf-300">
                  Admin Edit & Remove Enabled
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-secondary-text bg-surface-subtle px-2 py-0.5 rounded-full border border-border-color">
                  View Only (Admin required to add/remove)
                </span>
              )}
            </div>
            <p className="text-xs text-secondary-text mt-0.5">
              Add new dishes, set prices in PKR, adjust food costs, and mark stock availability
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!isAdmin) {
                alert('Please sign in as Admin to add items to the menu.');
                onOpenAuthModal();
                return;
              }
              setEditingProduct(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-leaf-700 hover:bg-leaf-800 rounded-lg shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Product</span>
          </button>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-secondary-text" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes by name or code..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-subtle border border-border-color rounded-lg focus:bg-white focus:outline-none focus:border-leaf-600"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-leaf-800 text-white shadow-sm'
                  : 'bg-surface-subtle text-secondary-text hover:text-primary-text'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.filter(c => c.slug !== 'all').map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors capitalize ${
                  selectedCategory.toLowerCase() === cat.slug.toLowerCase()
                    ? 'bg-leaf-800 text-white shadow-sm'
                    : 'bg-surface-subtle text-secondary-text hover:text-primary-text'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-xl border border-border-color overflow-hidden shadow-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFBF9] border-b border-border-color text-secondary-text font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Code</th>
                <th className="py-2.5 px-4">Product Name</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Selling Price (PKR)</th>
                <th className="py-2.5 px-4">Food Cost</th>
                <th className="py-2.5 px-4">Live Stock</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto px-4">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-100/90 text-emerald-800 flex items-center justify-center text-3xl shadow-sm mb-3 border border-emerald-200">
                        🌿
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 tracking-tight">Your Restaurant Menu is Clean & Ready</h3>
                      <p className="text-xs text-gray-500 mt-1 mb-5">
                        All dummy menu items have been cleared. As Administrator, you have complete power to add your signature dishes, customize prices in PKR, and manage stock.
                      </p>
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(null);
                            setIsModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 rounded-xl shadow-md transition-all uppercase tracking-wider"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add First Dish to Menu</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onOpenAuthModal}
                          className="px-4 py-2 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-xl transition-colors"
                        >
                          Log in as Admin (PIN: 1234) to Add Dishes
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isAvailable = p.available === 1;
                  return (
                    <tr key={p.id} className="hover:bg-surface-subtle transition-colors">
                      {/* Code */}
                      <td className="py-3 px-4 font-mono font-medium text-secondary-text">
                        {p.code}
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-primary-text">{p.name}</div>
                        {p.description && (
                          <div className="text-[11px] text-secondary-text line-clamp-1 mt-0.5">{p.description}</div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="capitalize font-semibold text-leaf-800 bg-leaf-50 px-2 py-0.5 rounded-full border border-leaf-200 text-[11px]">
                          {p.category}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 font-bold text-primary-text">
                        {formatCurrency(p.price)}
                      </td>

                      {/* Cost */}
                      <td className="py-3 px-4 text-secondary-text">
                        {formatCurrency(p.cost || 0)}
                      </td>

                      {/* Stock Toggle Switch */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(p)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                            isAvailable
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                          }`}
                        >
                          {isAvailable ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>In Stock</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Out of Stock</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (!isAdmin) {
                                alert('Admin credentials required to edit menu items.');
                                onOpenAuthModal();
                                return;
                              }
                              setEditingProduct(p);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-secondary-text hover:text-leaf-800 hover:bg-leaf-50 rounded-lg border border-border-color transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 text-secondary-text hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-border-color transition-colors"
                            title="Delete / Remove Product (Admin Only)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        product={editingProduct}
        categories={categories}
      />
    </div>
  );
};
