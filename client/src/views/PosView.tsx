import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Percent, 
  Utensils, 
  ShoppingBag, 
  X, 
  Save, 
  RotateCcw,
  Tag,
  AlertCircle,
  FileText
} from 'lucide-react';
import { Product, Category, RestaurantTable, OrderItem, ReceiptData, Order } from '../types';
import { formatCurrency } from '../utils/formatters';
import { CheckoutModal } from '../components/CheckoutModal';
import { ThermalReceiptModal } from '../components/ThermalReceiptModal';

interface PosViewProps {
  products: Product[];
  categories: Category[];
  tables: RestaurantTable[];
  cashierName: string;
  defaultTaxRate: number;
  onRefreshData: () => void;
  activeOrderToLoad?: Order | null;
  onClearActiveOrderToLoad?: () => void;
}

export const PosView: React.FC<PosViewProps> = ({
  products,
  categories,
  tables,
  cashierName,
  defaultTaxRate,
  onRefreshData,
  activeOrderToLoad,
  onClearActiveOrderToLoad,
}) => {
  // Navigation / filtering state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart / Current Order state
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [selectedTable, setSelectedTable] = useState<string>('T-01');
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [showDiscountInput, setShowDiscountInput] = useState<boolean>(false);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);

  // Modals state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [completedReceipt, setCompletedReceipt] = useState<ReceiptData | null>(null);
  const [mobileCartDrawerOpen, setMobileCartDrawerOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Keyboard shortcut: '/' focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load order if passed from Tables or Orders view
  useEffect(() => {
    if (activeOrderToLoad) {
      setExistingOrderId(activeOrderToLoad.id);
      setOrderType(activeOrderToLoad.order_type);
      if (activeOrderToLoad.table_number) {
        setSelectedTable(activeOrderToLoad.table_number);
      }
      setDiscountType(activeOrderToLoad.discount_type || 'fixed');
      setDiscountValue(activeOrderToLoad.discount_value || activeOrderToLoad.discount || 0);
      setOrderNotes(activeOrderToLoad.notes || '');

      if (activeOrderToLoad.items && activeOrderToLoad.items.length > 0) {
        setCartItems(activeOrderToLoad.items.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name,
          unit_price: it.unit_price,
          quantity: it.quantity,
          total_price: it.total_price,
          notes: it.notes || '',
        })));
      }
      if (onClearActiveOrderToLoad) {
        onClearActiveOrderToLoad();
      }
    }
  }, [activeOrderToLoad, onClearActiveOrderToLoad]);

  // Filter products by category & search term
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = 
        selectedCategory === 'all' || 
        p.category.toLowerCase() === selectedCategory.toLowerCase();
      
      const matchesSearch = 
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Add product to cart immediately on click
  const handleAddToCart = (product: Product) => {
    if (product.available === 0) return;

    setCartItems((prevItems) => {
      const existingIdx = prevItems.findIndex(
        (it) => it.product_id === product.id || it.product_name === product.name
      );

      if (existingIdx > -1) {
        const updated = [...prevItems];
        const item = updated[existingIdx];
        const newQty = item.quantity + 1;
        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          total_price: newQty * item.unit_price,
        };
        return updated;
      } else {
        const newItem: OrderItem = {
          product_id: product.id,
          product_name: product.name,
          unit_price: product.price,
          quantity: 1,
          total_price: product.price,
          notes: '',
        };
        return [...prevItems, newItem];
      }
    });
  };

  // Update item quantity
  const handleUpdateQuantity = (index: number, delta: number) => {
    setCartItems((prevItems) => {
      const updated = [...prevItems];
      const item = updated[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }

      updated[index] = {
        ...item,
        quantity: newQty,
        total_price: newQty * item.unit_price,
      };
      return updated;
    });
  };

  // Remove item from cart
  const handleRemoveItem = (index: number) => {
    setCartItems((prevItems) => prevItems.filter((_, i) => i !== index));
  };

  // Clear entire cart
  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    if (window.confirm('Clear all items from the current order?')) {
      setCartItems([]);
      setDiscountValue(0);
      setOrderNotes('');
      setExistingOrderId(null);
    }
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.total_price, 0);
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if (subtotal === 0) return 0;
    if (discountType === 'percent') {
      return Math.round((subtotal * Math.min(100, Math.max(0, discountValue))) / 100);
    }
    return Math.min(subtotal, Math.max(0, discountValue));
  }, [subtotal, discountType, discountValue]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round(taxableAmount * (defaultTaxRate / 100));
  const grandTotal = taxableAmount + taxAmount;
  const totalItemCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  // Save/Hold Order (Send to Kitchen without completing payment)
  const handleHoldOrder = async () => {
    if (cartItems.length === 0) return;
    try {
      const payload = {
        order_type: orderType,
        table_number: orderType === 'dine_in' ? selectedTable : null,
        items: cartItems,
        subtotal,
        discount: discountAmount,
        discount_type: discountType,
        discount_value: discountValue,
        tax_rate: defaultTaxRate,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        cashier_name: cashierName,
        notes: orderNotes,
        status: 'preparing',
      };

      let res;
      if (existingOrderId) {
        res = await fetch(`/api/orders/${existingOrderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save order');
      }

      showNotification(`Order #${data.data.order_number} saved & sent to kitchen.`);
      setCartItems([]);
      setDiscountValue(0);
      setOrderNotes('');
      setExistingOrderId(null);
      setMobileCartDrawerOpen(false);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error saving order');
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Called after payment completes in CheckoutModal
  const handlePaymentComplete = (receipt: ReceiptData) => {
    setIsCheckoutOpen(false);
    setCompletedReceipt(receipt);
    setCartItems([]);
    setDiscountValue(0);
    setOrderNotes('');
    setExistingOrderId(null);
    setMobileCartDrawerOpen(false);
    onRefreshData();
  };

  // Category filter tabs
  const categoryFilters = [
    { slug: 'all', name: 'All Items' },
    ...categories.filter(c => c.slug !== 'all'),
  ];

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#F4F7F4]">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 right-6 z-50 bg-[#092215] text-white px-4 py-2 rounded-xl text-xs shadow-lg flex items-center gap-2 border border-emerald-700 animate-in fade-in">
          <span>{notification}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEFT COLUMN: Menu & Products Catalog                                      */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-[#E2EAE2]">
        {/* Top Controls: Search Bar & Categories */}
        <div className="bg-white border-b border-border-color p-3 space-y-2.5 shrink-0">
          {/* Compact Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-secondary-text" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes by name or code... (Press '/' to focus)"
              className="w-full pl-9 pr-8 py-2 text-xs bg-surface-subtle border border-border-color rounded-lg focus:bg-white focus:outline-none focus:border-leaf-600 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-secondary-text hover:text-primary-text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Horizontal Category Filters with Leaf/Food Icons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {categoryFilters.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.slug.toLowerCase();
              const catIcons: Record<string, string> = {
                all: '🌿',
                burgers: '🍔',
                pizza: '🍕',
                bbq: '🍢',
                bakery: '🥖',
                drinks: '🍹',
                desserts: '🍰',
              };
              const icon = catIcons[cat.slug.toLowerCase()] || '🍽️';

              return (
                <button
                  key={cat.slug}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-700 to-emerald-800 text-white shadow-sm ring-2 ring-emerald-600/30'
                      : 'bg-[#F2F7F2] text-emerald-900 hover:bg-emerald-100/70 border border-emerald-200/60'
                  }`}
                >
                  <span className="text-sm">{icon}</span>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-secondary-text">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl shadow-xs mb-3 border border-emerald-200">
                🥖
              </div>
              <p className="text-sm font-bold text-gray-900">No Dishes in Menu Yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">
                All dummy items have been removed. Head to <strong className="text-emerald-800">Menu Management</strong> in the sidebar to add your custom dishes!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.available === 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    disabled={isOutOfStock}
                    className={`group bg-white rounded-2xl border p-3 text-left flex flex-col justify-between transition-all duration-150 shadow-xs ${
                      isOutOfStock
                        ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200'
                        : 'border-[#DDE8DD] hover:border-emerald-600 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]'
                    }`}
                  >
                    <div>
                      {/* Product Header / Code & Stock Badge */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {product.code}
                        </span>
                        {isOutOfStock ? (
                          <span className="text-[9px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 capitalize">
                            {product.category}
                          </span>
                        )}
                      </div>

                      {/* Product Title */}
                      <h4 className="text-xs font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-emerald-800 transition-colors">
                        {product.name}
                      </h4>

                      {/* Optional Short Description */}
                      {product.description && (
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Price & Add Indicator */}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#EDF3ED]">
                      <span className="text-xs font-black text-emerald-950">
                        {formatCurrency(product.price)}
                      </span>
                      {!isOutOfStock && (
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs group-hover:bg-emerald-700 group-hover:text-white transition-all shadow-2xs font-bold">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: Persistent Order Panel (Desktop)                             */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex w-[380px] xl:w-[420px] bg-white flex-col h-full shrink-0 border-l border-[#E5E7EB]">
        {/* Render Order Panel contents */}
        {renderOrderPanelContent()}
      </div>

      {/* ========================================================================= */}
      {/* MOBILE STICKY BOTTOM BAR (Small Screens)                                 */}
      {/* ========================================================================= */}
      <div className="lg:hidden bg-white border-t border-[#E5E7EB] p-3 flex items-center justify-between shrink-0 shadow-sm">
        <div>
          <div className="text-[11px] text-[#737373]">
            {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
          </div>
          <div className="text-base font-bold text-[#171717]">
            {formatCurrency(grandTotal)}
          </div>
        </div>

        <button
          onClick={() => setMobileCartDrawerOpen(true)}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2.5 rounded text-xs font-semibold shadow-sm active:bg-[#1D4ED8]"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>View Order ({totalItemCount})</span>
        </button>
      </div>

      {/* Mobile Cart Drawer */}
      {mobileCartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-md bg-white h-full ml-auto flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
              <span className="font-semibold text-sm text-[#171717]">Current Order</span>
              <button
                onClick={() => setMobileCartDrawerOpen(false)}
                className="p-1 rounded text-[#737373] hover:text-[#171717]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              {renderOrderPanelContent()}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        grandTotal={grandTotal}
        subtotal={subtotal}
        discount={discountAmount}
        discountType={discountType}
        discountValue={discountValue}
        taxRate={defaultTaxRate}
        taxAmount={taxAmount}
        orderType={orderType}
        tableNumber={orderType === 'dine_in' ? selectedTable : null}
        items={cartItems}
        orderId={existingOrderId}
        cashierName={cashierName}
        onPaymentComplete={handlePaymentComplete}
      />

      {/* Thermal Receipt Modal */}
      <ThermalReceiptModal
        isOpen={!!completedReceipt}
        onClose={() => setCompletedReceipt(null)}
        receipt={completedReceipt}
      />
    </div>
  );

  // Helper function to render order panel body (shared between desktop & mobile drawer)
  function renderOrderPanelContent() {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {/* Ticket Top Branding */}
        <div className="px-4 py-3 bg-[#092215] text-white flex items-center justify-between border-b border-[#143B25] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-800/80 border border-emerald-600/40 flex items-center justify-center text-sm shadow-xs">
              🌿
            </div>
            <div>
              <div className="text-xs font-black text-emerald-100 tracking-wider uppercase">Active Order Ticket</div>
              <div className="text-[10px] text-emerald-300/70">Loaf n Leaf Cashier Check</div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono font-extrabold bg-emerald-950 text-amber-300 border border-emerald-700/60 px-2 py-0.5 rounded-full">
              {orderType === 'dine_in' ? `TABLE ${selectedTable}` : 'TAKEAWAY'}
            </span>
          </div>
        </div>

        {/* Order Header / Order Type & Table Selector */}
        <div className="p-3 border-b border-[#E2EAE2] bg-[#F4F8F4] space-y-2.5 shrink-0">
          {/* Order Type Toggle: Dine In / Takeaway */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#E2ECE2] rounded-xl border border-[#D0DFD0]">
            <button
              type="button"
              onClick={() => setOrderType('dine_in')}
              className={`py-1.5 text-xs font-bold rounded-lg text-center transition-all flex items-center justify-center gap-1.5 ${
                orderType === 'dine_in'
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'text-emerald-900/70 hover:text-emerald-950'
              }`}
            >
              <span>🍽️</span>
              <span>Dine In</span>
            </button>
            <button
              type="button"
              onClick={() => setOrderType('takeaway')}
              className={`py-1.5 text-xs font-bold rounded-lg text-center transition-all flex items-center justify-center gap-1.5 ${
                orderType === 'takeaway'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-emerald-900/70 hover:text-emerald-950'
              }`}
            >
              <span>🛍️</span>
              <span>Takeaway</span>
            </button>
          </div>

          {/* Table Selector (when Dine In is selected) */}
          {orderType === 'dine_in' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-emerald-900 shrink-0">
                Seating Table:
              </label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="flex-1 bg-white text-xs border border-emerald-200 rounded-lg px-2.5 py-1.5 font-bold text-gray-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
              >
                {tables.map((tbl) => (
                  <option key={tbl.id} value={tbl.table_number}>
                    {tbl.table_number} — {tbl.name} ({tbl.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {existingOrderId && (
            <div className="bg-leaf-50 border border-leaf-200 px-2.5 py-1 rounded text-[11px] text-leaf-900 flex items-center justify-between">
              <span>Editing Active Order</span>
              <button 
                onClick={() => {
                  setExistingOrderId(null);
                  setCartItems([]);
                }}
                className="font-medium underline hover:text-leaf-700"
              >
                New Order
              </button>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F3F4F6] p-3 space-y-2">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#737373]">
              <ShoppingBag className="w-8 h-8 text-[#D1D5DB] mb-2" />
              <p className="text-xs font-medium text-[#171717]">Current order is empty</p>
              <p className="text-[11px] text-[#737373] mt-0.5">
                Select products from the left menu to start an order
              </p>
            </div>
          ) : (
            cartItems.map((item, index) => (
              <div key={index} className="pt-2 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 overflow-hidden">
                    <div className="text-xs font-semibold text-[#171717] truncate leading-tight">
                      {item.product_name}
                    </div>
                    <div className="text-[11px] text-[#737373] mt-0.5">
                      {formatCurrency(item.unit_price)} each
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-[#171717]">
                      {formatCurrency(item.total_price)}
                    </div>
                  </div>
                </div>

                {/* Controls: Qty Buttons, Notes & Delete */}
                <div className="flex items-center justify-between mt-2 pt-1">
                  {/* Quantity Controls */}
                  <div className="flex items-center border border-[#E5E7EB] rounded bg-[#F8F9FA]">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(index, -1)}
                      className="w-6 h-6 flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#E5E7EB] transition-colors rounded-l"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-xs font-bold text-[#171717]">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(index, 1)}
                      className="w-6 h-6 flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#E5E7EB] transition-colors rounded-r"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Item Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-[#737373] hover:text-[#DC2626] p-1 rounded hover:bg-[#FEF2F2] transition-colors"
                      title="Remove Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Order Summary & Totals */}
        <div className="p-3.5 border-t border-[#E5E7EB] bg-[#F8F9FA] space-y-2 shrink-0">
          {/* Subtotal */}
          <div className="flex justify-between text-xs text-[#737373]">
            <span>Subtotal:</span>
            <span className="font-medium text-[#171717]">{formatCurrency(subtotal)}</span>
          </div>

          {/* Discount Section */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs text-[#737373]">
              <button
                type="button"
                onClick={() => setShowDiscountInput(!showDiscountInput)}
                className="text-[11px] font-medium text-leaf-800 hover:underline flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                <span>{discountAmount > 0 ? 'Edit Discount' : '+ Add Discount'}</span>
              </button>
              {discountAmount > 0 && (
                <span className="font-medium text-[#16A34A]">
                  -{formatCurrency(discountAmount)}
                </span>
              )}
            </div>

            {showDiscountInput && (
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded border border-[#E5E7EB]">
                <div className="flex rounded border border-[#E5E7EB] overflow-hidden text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`px-2 py-0.5 ${discountType === 'fixed' ? 'bg-[#171717] text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Rs.
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-2 py-0.5 ${discountType === 'percent' ? 'bg-[#171717] text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    %
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder={discountType === 'percent' ? '10%' : 'Rs. 100'}
                  className="flex-1 text-xs border-0 focus:ring-0 p-1 font-medium text-right focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Sales Tax */}
          <div className="flex justify-between text-xs text-[#737373]">
            <span>Tax ({defaultTaxRate}%):</span>
            <span className="font-medium text-[#171717]">{formatCurrency(taxAmount)}</span>
          </div>

          {/* Grand Total Ticket Card */}
          <div className="bg-[#092215] text-white p-3.5 rounded-2xl border border-[#143B25] shadow-inner mt-2">
            <div className="flex justify-between items-center text-xs text-emerald-300 mb-1">
              <span className="uppercase tracking-widest font-black text-[10px] flex items-center gap-1">
                <span>🍃</span>
                <span>Grand Total (PKR)</span>
              </span>
              <span className="text-[10px] font-bold bg-emerald-900/90 text-amber-300 px-2 py-0.5 rounded-full border border-emerald-700/60">
                {orderType === 'dine_in' ? `Table ${selectedTable}` : 'Takeaway'}
              </span>
            </div>
            <div className="text-2xl font-black text-amber-400 tracking-tight">
              {formatCurrency(grandTotal)}
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl shadow-md flex items-center justify-between transition-all tracking-wider uppercase border border-emerald-600/30"
            >
              <span className="flex items-center gap-1.5">
                <span>⚡</span>
                <span>Charge / Checkout</span>
              </span>
              <span className="text-amber-300 font-extrabold text-sm">{formatCurrency(grandTotal)}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={cartItems.length === 0}
                onClick={handleHoldOrder}
                className="py-2 px-2.5 bg-white hover:bg-emerald-50 border border-emerald-200 disabled:opacity-40 text-xs font-bold text-emerald-900 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                title="Send ticket to kitchen without collecting payment"
              >
                <Save className="w-3.5 h-3.5 text-emerald-700" />
                <span>Hold / Kitchen</span>
              </button>

              <button
                type="button"
                disabled={cartItems.length === 0}
                onClick={handleClearCart}
                className="py-2 px-2.5 bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-300 disabled:opacity-40 text-xs font-bold text-rose-700 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
};
