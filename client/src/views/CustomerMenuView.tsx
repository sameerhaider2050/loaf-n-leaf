import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  Utensils, 
  CheckCircle2, 
  Clock, 
  X, 
  Search, 
  ArrowLeft,
  Sparkles,
  Phone,
  User as UserIcon,
  BellRing
} from 'lucide-react';
import { Product, Category, User } from '../types';
import { formatCurrency } from '../utils/formatters';
import { api } from '../services/api';

interface CustomerMenuViewProps {
  products: Product[];
  categories: Category[];
  initialTable?: string;
  currentUser: User | null;
  onOpenAuthModal: () => void;
  onBackToTerminal?: () => void;
}

export const CustomerMenuView: React.FC<CustomerMenuViewProps> = ({
  products,
  categories,
  initialTable = 'T-01',
  currentUser,
  onOpenAuthModal,
  onBackToTerminal,
}) => {
  const [selectedTable, setSelectedTable] = useState<string>(initialTable);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>(currentUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(currentUser?.phone || '');
  const [specialInstructions, setSpecialInstructions] = useState<string>('');

  // Customer Cart
  const [cartItems, setCartItems] = useState<Array<{ product: Product; qty: number; note: string }>>([]);
  const [isTrayOpen, setIsTrayOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Placed Order State
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);
  const [orderProgress, setOrderProgress] = useState<'pending' | 'preparing' | 'ready'>('pending');

  useEffect(() => {
    if (currentUser?.name) {
      setCustomerName(currentUser.name);
    }
  }, [currentUser]);

  // Read URL query parameter for ?table=T-03 if available
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('table=')) {
      const match = hash.match(/table=([A-Za-z0-9-]+)/);
      if (match && match[1]) {
        setSelectedTable(match[1].toUpperCase());
      }
    }
  }, []);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch = 
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleAddToCart = (product: Product) => {
    if (product.available === 0) return;
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1, note: '' }];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ product: Product; qty: number; note: string }>;
    });
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  }, [cartItems]);

  const taxAmount = Math.round(subtotal * 0.13); // 13% SRB Tax
  const grandTotal = subtotal + taxAmount;
  const totalItemCount = cartItems.reduce((c, i) => c + i.qty, 0);

  const handleSubmitOrder = async () => {
    if (cartItems.length === 0) return;
    try {
      setIsSubmitting(true);
      const itemsPayload = cartItems.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        unit_price: item.product.price,
        quantity: item.qty,
        total_price: item.product.price * item.qty,
        notes: item.note,
      }));

      const response = await api.submitCustomerOrder({
        table_number: selectedTable,
        customer_name: customerName.trim() || 'Table Guest',
        customer_phone: customerPhone.trim(),
        items: itemsPayload,
        notes: specialInstructions.trim(),
      });

      setPlacedOrder(response?.data || response);
      setCartItems([]);
      setIsTrayOpen(false);
      setOrderProgress('pending');

      // Simulate live order progress for the customer
      setTimeout(() => setOrderProgress('preparing'), 4000);
      setTimeout(() => setOrderProgress('ready'), 14000);
    } catch (err: any) {
      alert(err.message || 'Failed to send order to kitchen');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAF8] overflow-y-auto">
      {/* Customer Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border-color px-4 py-3 shadow-subtle flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBackToTerminal && (
            <button
              onClick={onBackToTerminal}
              className="p-1.5 rounded-lg border border-border-color hover:bg-surface-subtle text-secondary-text"
              title="Return to Staff Order Counter"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-leaf-700 flex items-center justify-center text-white text-base shadow-sm">
              🌿
            </div>
            <div>
              <div className="font-bold text-sm text-primary-text leading-tight flex items-center gap-2">
                <span>Loaf n Leaf</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-leaf-100 text-leaf-800 border border-leaf-300">
                  {selectedTable}
                </span>
              </div>
              <div className="text-[10px] text-secondary-text">Digital Table Menu</div>
            </div>
          </div>
        </div>

        {/* User / Sign In Pill */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-leaf-50 border border-leaf-200 px-2.5 py-1 rounded-full text-xs text-leaf-900 font-semibold">
              <span className="w-2 h-2 rounded-full bg-leaf-600" />
              <span>{currentUser.name}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-3 py-1.5 text-xs font-semibold text-leaf-800 bg-leaf-50 hover:bg-leaf-100 border border-leaf-300 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In / Google</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto w-full p-4 space-y-4 pb-24">
        {/* Active Order Tracker (if an order has been placed) */}
        {placedOrder && (
          <div className="bg-gradient-to-r from-leaf-900 via-leaf-800 to-leaf-900 text-white rounded-2xl p-5 shadow-lg border border-leaf-600 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-leaf-700 pb-3">
              <div>
                <span className="text-xs text-leaf-200 font-medium">Order #{placedOrder.order_number} Active</span>
                <h3 className="text-base font-bold text-white tracking-tight">Table {placedOrder.table_number} — Sent to Kitchen</h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-leaf-300">Total Bill</span>
                <div className="text-lg font-bold text-loaf-300">{formatCurrency(placedOrder.grand_total)}</div>
              </div>
            </div>

            {/* Live Progress Tracker */}
            <div className="py-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {/* Step 1 */}
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-leaf-600 border-2 border-white flex items-center justify-center text-xs font-bold shadow-sm">
                    ✓
                  </div>
                  <span className="font-semibold mt-1.5 text-white">Received</span>
                  <span className="text-[10px] text-leaf-200">Kitchen Synced</span>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    orderProgress === 'preparing' || orderProgress === 'ready'
                      ? 'bg-loaf-500 border-white text-white animate-pulse'
                      : 'bg-leaf-800 border-leaf-600 text-leaf-400'
                  }`}>
                    🍳
                  </div>
                  <span className={`font-semibold mt-1.5 ${orderProgress !== 'pending' ? 'text-white' : 'text-leaf-400'}`}>
                    Preparing
                  </span>
                  <span className="text-[10px] text-leaf-200">In Kitchen</span>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    orderProgress === 'ready'
                      ? 'bg-emerald-500 border-white text-white'
                      : 'bg-leaf-800 border-leaf-600 text-leaf-400'
                  }`}>
                    🍽️
                  </div>
                  <span className={`font-semibold mt-1.5 ${orderProgress === 'ready' ? 'text-emerald-300' : 'text-leaf-400'}`}>
                    Ready
                  </span>
                  <span className="text-[10px] text-leaf-200">Serving Table</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-leaf-700 text-xs">
              <button
                type="button"
                onClick={() => alert('Server notified! A waiter is coming to Table ' + selectedTable)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-leaf-800/80 hover:bg-leaf-700 border border-leaf-600 rounded-lg text-leaf-100 font-medium transition-colors"
              >
                <BellRing className="w-3.5 h-3.5 text-loaf-400" />
                <span>Call Waiter</span>
              </button>

              <button
                type="button"
                onClick={() => setPlacedOrder(null)}
                className="text-leaf-200 hover:text-white underline text-xs"
              >
                Order More Items
              </button>
            </div>
          </div>
        )}

        {/* Search & Category Pills */}
        <div className="bg-white p-3.5 rounded-xl border border-border-color shadow-subtle space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-secondary-text" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search burgers, pizzas, grills, drinks..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-surface-subtle border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
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

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map((product) => {
            const isOutOfStock = product.available === 0;
            const inCart = cartItems.find((i) => i.product.id === product.id);

            return (
              <div
                key={product.id}
                className={`bg-white rounded-xl border p-3.5 flex flex-col justify-between shadow-subtle transition-all ${
                  isOutOfStock ? 'opacity-50 border-border-color bg-surface-subtle' : 'border-leaf-100 hover:border-leaf-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-secondary-text">{product.code}</span>
                    <span className="text-[10px] font-semibold text-leaf-800 bg-leaf-50 px-2 py-0.5 rounded-full border border-leaf-200 capitalize">
                      {product.category}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-primary-text leading-snug">
                    {product.name}
                  </h4>

                  {product.description && (
                    <p className="text-[11px] text-secondary-text mt-1 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-border-color flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-primary-text block">
                      {formatCurrency(product.price)}
                    </span>
                    <span className="text-[9px] text-secondary-text">+13% Tax</span>
                  </div>

                  {isOutOfStock ? (
                    <span className="text-[10px] text-rose-600 font-semibold">Sold Out</span>
                  ) : inCart ? (
                    <div className="flex items-center border border-leaf-600 rounded-lg bg-leaf-50">
                      <button
                        onClick={() => handleUpdateQty(product.id, -1)}
                        className="w-7 h-7 flex items-center justify-center text-leaf-800 hover:bg-leaf-200 rounded-l-lg"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-leaf-900">{inCart.qty}</span>
                      <button
                        onClick={() => handleUpdateQty(product.id, 1)}
                        className="w-7 h-7 flex items-center justify-center text-leaf-800 hover:bg-leaf-200 rounded-r-lg"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-leaf-700 hover:bg-leaf-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Bottom Cart Bar */}
      {totalItemCount > 0 && !isTrayOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom duration-200">
          <button
            type="button"
            onClick={() => setIsTrayOpen(true)}
            className="w-full bg-gradient-to-r from-leaf-800 to-leaf-700 text-white px-5 py-3.5 rounded-xl shadow-xl flex items-center justify-between border border-leaf-500/40"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-leaf-600 flex items-center justify-center font-bold text-xs">
                {totalItemCount}
              </div>
              <div className="text-left">
                <span className="text-xs font-bold block">View Table Order</span>
                <span className="text-[10px] text-leaf-200">Table {selectedTable}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-bold block">{formatCurrency(grandTotal)}</span>
              <span className="text-[10px] text-leaf-200">Includes Tax</span>
            </div>
          </button>
        </div>
      )}

      {/* Tray / Order Drawer */}
      {isTrayOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]">
          <div 
            className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 bg-leaf-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Table Order Tray</h3>
                <p className="text-xs text-leaf-200">Loaf n Leaf • Table {selectedTable}</p>
              </div>
              <button
                onClick={() => setIsTrayOpen(false)}
                className="p-1 rounded text-leaf-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-border-color space-y-3">
              {cartItems.map((item, idx) => (
                <div key={idx} className="pt-3 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-xs text-primary-text">{item.product.name}</div>
                      <div className="text-[11px] text-secondary-text">{formatCurrency(item.product.price)} each</div>
                    </div>
                    <div className="text-xs font-bold text-primary-text">
                      {formatCurrency(item.product.price * item.qty)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-border-color rounded-lg bg-surface-subtle">
                      <button
                        onClick={() => handleUpdateQty(item.product.id, -1)}
                        className="w-6 h-6 flex items-center justify-center text-secondary-text hover:text-primary-text"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-primary-text">{item.qty}</span>
                      <button
                        onClick={() => handleUpdateQty(item.product.id, 1)}
                        className="w-6 h-6 flex items-center justify-center text-secondary-text hover:text-primary-text"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleUpdateQty(item.product.id, -item.qty)}
                      className="text-secondary-text hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Guest Details & Special Requests */}
              <div className="pt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-primary-text mb-1">
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Zainab Tariq"
                    className="w-full px-3 py-1.5 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
                  />
                </div>

                <div>
                  <label className="block font-medium text-primary-text mb-1">
                    Kitchen Notes / Dietary Requests
                  </label>
                  <textarea
                    rows={2}
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="e.g. Extra napkins, less spicy, sauces on side"
                    className="w-full px-3 py-1.5 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Drawer Footer & Checkout */}
            <div className="p-4 border-t border-border-color bg-surface-subtle space-y-2 text-xs">
              <div className="flex justify-between text-secondary-text">
                <span>Subtotal:</span>
                <span className="font-semibold text-primary-text">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-secondary-text">
                <span>Sales Tax (13%):</span>
                <span className="font-semibold text-primary-text">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-primary-text border-t border-border-color pt-2">
                <span>Grand Total:</span>
                <span className="text-leaf-800">{formatCurrency(grandTotal)}</span>
              </div>

              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={isSubmitting || cartItems.length === 0}
                className="w-full py-3 bg-leaf-700 hover:bg-leaf-800 disabled:opacity-50 text-white rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2 mt-2"
              >
                <span>{isSubmitting ? 'Sending to Kitchen...' : 'Send Order to Kitchen'}</span>
                <span>• {formatCurrency(grandTotal)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
