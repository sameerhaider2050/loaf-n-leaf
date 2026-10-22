import { 
  Product, Category, RestaurantTable, Order, Settings, 
  ReceiptData, SalesReportSummary, User, StaffMember, OrderStatus 
} from '../types';

const STORAGE_KEY_PRODUCTS = 'loafnleaf_products';
const STORAGE_KEY_ORDERS = 'loafnleaf_orders';
const STORAGE_KEY_TABLES = 'loafnleaf_tables';
const STORAGE_KEY_SETTINGS = 'loafnleaf_settings';
const STORAGE_KEY_STAFF = 'loafnleaf_staff';

const defaultCategories: Category[] = [
  { id: 'cat-1', name: 'All Items', slug: 'all', sort_order: 0 },
  { id: 'cat-2', name: 'Burgers', slug: 'burgers', sort_order: 1 },
  { id: 'cat-3', name: 'Pizza', slug: 'pizza', sort_order: 2 },
  { id: 'cat-4', name: 'BBQ & Grills', slug: 'bbq', sort_order: 3 },
  { id: 'cat-5', name: 'Drinks', slug: 'drinks', sort_order: 4 },
  { id: 'cat-6', name: 'Desserts', slug: 'desserts', sort_order: 5 },
];

const defaultTables: RestaurantTable[] = [
  { id: 'tbl-1', table_number: 'T-01', name: 'Table 1', capacity: 2, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
  { id: 'tbl-2', table_number: 'T-02', name: 'Table 2', capacity: 2, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
  { id: 'tbl-3', table_number: 'T-03', name: 'Table 3', capacity: 4, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
  { id: 'tbl-4', table_number: 'T-04', name: 'Table 4', capacity: 4, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
  { id: 'tbl-5', table_number: 'T-05', name: 'Table 5', capacity: 4, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
  { id: 'tbl-6', table_number: 'T-06', name: 'Table 6', capacity: 6, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
  { id: 'tbl-7', table_number: 'T-07', name: 'Table 7', capacity: 6, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
  { id: 'tbl-8', table_number: 'T-08', name: 'Table 8', capacity: 8, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
  { id: 'tbl-9', table_number: 'T-09', name: 'Family Booth 1', capacity: 6, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
  { id: 'tbl-10', table_number: 'T-10', name: 'Family Booth 2', capacity: 6, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
  { id: 'tbl-11', table_number: 'T-11', name: 'Outdoor Terrace 1', capacity: 4, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
  { id: 'tbl-12', table_number: 'T-12', name: 'Outdoor Terrace 2', capacity: 4, status: 'available', current_order_id: null, updated_at: new Date().toISOString() },
];

const defaultSettings: Settings = {
  restaurant_name: 'Loaf n Leaf',
  restaurant_tagline: 'Artisan Cafe & Charcoal Grill',
  address: 'loaf n leaf river garden gujrat',
  phone: '+92 21 3583 8920',
  ntn_number: '7829104-5',
  tax_name: 'Sindh Sales Tax (SRB)',
  tax_rate: '13',
  tax_enabled: 'true',
  currency_symbol: 'Rs.',
  receipt_header: 'LOAF N LEAF RESTAURANT\nTax Invoice',
  receipt_footer: 'Thank you for dining with Loaf n Leaf!\nArtisan Restaurant & Table Service',
  active_cashier: 'Ahmed Khan',
  active_shift: 'Evening Shift (04:00 PM - 12:00 AM)',
};

const defaultStaff: StaffMember[] = [
  { id: 'usr-admin-1', name: 'Restaurant Admin', email: 'admin@loafnleaf.com', username: 'admin', role: 'admin', pin: '1234', phone: '+92 300 1234567', is_active: 1, created_at: new Date().toISOString() },
  { id: 'usr-cashier-1', name: 'Ahmed Khan (Cashier)', email: 'cashier@loafnleaf.com', username: 'cashier1', role: 'cashier', pin: '5678', phone: '+92 301 9876543', is_active: 1, created_at: new Date().toISOString() },
  { id: 'usr-cashier-2', name: 'Sara Malik (Shift 2)', email: 'sara@loafnleaf.com', username: 'cashier2', role: 'cashier', pin: '4321', phone: '+92 302 5551234', is_active: 1, created_at: new Date().toISOString() },
];

function getStored<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.error('Local storage write error:', err);
  }
}

export const fallbackStore = {
  getProducts(): Product[] {
    return getStored<Product[]>(STORAGE_KEY_PRODUCTS, []);
  },

  createProduct(prod: Partial<Product>): Product {
    const prods = this.getProducts();
    const newProd: Product = {
      id: 'prod-' + Date.now(),
      code: prod.code || 'PRD-' + Math.floor(100 + Math.random() * 900),
      name: prod.name || '',
      category: prod.category || 'All Items',
      price: Number(prod.price) || 0,
      cost: Number(prod.cost) || 0,
      image: prod.image || '',
      available: prod.available !== undefined ? Number(prod.available) : 1,
      description: prod.description || '',
      created_at: new Date().toISOString(),
    };
    prods.unshift(newProd);
    setStored(STORAGE_KEY_PRODUCTS, prods);
    return newProd;
  },

  updateProduct(id: string, updates: Partial<Product>): Product {
    const prods = this.getProducts();
    const idx = prods.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Product not found');
    prods[idx] = { ...prods[idx], ...updates };
    setStored(STORAGE_KEY_PRODUCTS, prods);
    return prods[idx];
  },

  toggleProductAvailability(id: string, available?: boolean): Product {
    const prods = this.getProducts();
    const idx = prods.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Product not found');
    const newAvail = available !== undefined ? (available ? 1 : 0) : (prods[idx].available ? 0 : 1);
    prods[idx].available = newAvail;
    setStored(STORAGE_KEY_PRODUCTS, prods);
    return prods[idx];
  },

  deleteProduct(id: string): { success: boolean } {
    let prods = this.getProducts();
    prods = prods.filter(p => p.id !== id);
    setStored(STORAGE_KEY_PRODUCTS, prods);
    return { success: true };
  },

  getCategories(): Category[] {
    return defaultCategories;
  },

  getTables(): RestaurantTable[] {
    return getStored<RestaurantTable[]>(STORAGE_KEY_TABLES, defaultTables);
  },

  createTable(data: { table_number: string; name: string; capacity: number }): RestaurantTable {
    const tables = this.getTables();
    const newTbl: RestaurantTable = {
      id: 'tbl-' + Date.now(),
      table_number: data.table_number,
      name: data.name,
      capacity: data.capacity,
      status: 'available',
      current_order_id: null,
      updated_at: new Date().toISOString(),
    };
    tables.push(newTbl);
    setStored(STORAGE_KEY_TABLES, tables);
    return newTbl;
  },

  deleteTable(id: string): { success: boolean } {
    let tables = this.getTables();
    tables = tables.filter(t => t.id !== id);
    setStored(STORAGE_KEY_TABLES, tables);
    return { success: true };
  },

  updateTableStatus(idOrNumber: string, status: any): RestaurantTable {
    const tables = this.getTables();
    const table = tables.find(t => t.id === idOrNumber || t.table_number === idOrNumber);
    if (!table) throw new Error('Table not found');
    table.status = status;
    table.updated_at = new Date().toISOString();
    setStored(STORAGE_KEY_TABLES, tables);
    return table;
  },

  getOrders(): Order[] {
    return getStored<Order[]>(STORAGE_KEY_ORDERS, []);
  },

  getOrder(id: string): Order {
    const orders = this.getOrders();
    const ord = orders.find(o => o.id === id);
    if (!ord) throw new Error('Order not found');
    return ord;
  },

  createOrder(orderData: any): Order {
    const orders = this.getOrders();
    const orderNum = orders.length + 1001;
    const now = new Date().toISOString();

    let calcSubtotal = 0;
    const items = (orderData.items || []).map((it: any) => {
      const qty = Number(it.quantity || it.qty || 1);
      const price = Number(it.unit_price || it.price || 0);
      const total = Number(it.total_price || (price * qty));
      calcSubtotal += total;
      return {
        product_id: it.product_id || it.id || '',
        product_name: it.product_name || it.name || '',
        unit_price: price,
        quantity: qty,
        total_price: total,
        notes: it.notes || '',
      };
    });

    const subtotal = (orderData.subtotal !== undefined && Number(orderData.subtotal) > 0)
      ? Number(orderData.subtotal)
      : calcSubtotal;
    const discount = Number(orderData.discount || 0);
    const taxable = Math.max(0, subtotal - discount);
    const taxRate = Number(orderData.tax_rate) || 13;
    const taxAmount = (orderData.tax_amount !== undefined && Number(orderData.tax_amount) > 0)
      ? Number(orderData.tax_amount)
      : Math.round(taxable * (taxRate / 100));
    const grandTotal = (orderData.grand_total !== undefined && Number(orderData.grand_total) > 0)
      ? Number(orderData.grand_total)
      : taxable + taxAmount;

    const newOrder: Order = {
      id: 'ord-' + Date.now(),
      order_number: orderNum,
      order_type: orderData.order_type || 'dine_in',
      table_number: orderData.table_number || null,
      status: orderData.status || 'pending',
      subtotal,
      discount,
      discount_type: orderData.discount_type || 'fixed',
      discount_value: orderData.discount_value || 0,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      cashier_name: orderData.cashier_name || 'Staff',
      customer_name: orderData.customer_name || 'Guest',
      notes: orderData.notes || '',
      created_at: now,
      updated_at: now,
      items,
    };
    orders.unshift(newOrder);
    setStored(STORAGE_KEY_ORDERS, orders);

    if (newOrder.table_number) {
      const tables = this.getTables();
      const t = tables.find(tbl => tbl.table_number === newOrder.table_number);
      if (t) {
        t.status = 'occupied';
        t.current_order_id = newOrder.id;
        setStored(STORAGE_KEY_TABLES, tables);
      }
    }

    return newOrder;
  },

  updateOrderStatus(id: string, status: OrderStatus): Order {
    const orders = this.getOrders();
    const ord = orders.find(o => o.id === id);
    if (!ord) throw new Error('Order not found');
    ord.status = status;
    ord.updated_at = new Date().toISOString();
    setStored(STORAGE_KEY_ORDERS, orders);
    return ord;
  },

  checkout(payload: any): { order: Order; receipt: ReceiptData } {
    let targetOrder: Order;
    const orders = this.getOrders();

    const paidSubtotal = Number(payload.subtotal) || 0;
    const paidDiscount = Number(payload.discount) || 0;
    const paidTaxRate = Number(payload.tax_rate) || 13;
    const paidTaxAmount = Number(payload.tax_amount) || 0;
    const paidGrandTotal = Number(payload.grand_total) || 0;
    const paidReceived = Number(payload.received_amount) || paidGrandTotal;
    const changeGiven = Math.max(0, paidReceived - paidGrandTotal);
    const txnRef = payload.transaction_ref || ('CSH-' + Date.now().toString().slice(-4));
    const now = new Date().toISOString();

    if (payload.order_id) {
      const existing = orders.find(o => o.id === payload.order_id);
      if (!existing) throw new Error('Order not found');
      existing.status = 'completed';
      if (paidSubtotal > 0) existing.subtotal = paidSubtotal;
      existing.discount = paidDiscount;
      existing.tax_rate = paidTaxRate;
      if (paidTaxAmount > 0) existing.tax_amount = paidTaxAmount;
      if (paidGrandTotal > 0) existing.grand_total = paidGrandTotal;
      if (payload.cashier_name) existing.cashier_name = payload.cashier_name;
      existing.updated_at = now;
      existing.payment_method = payload.payment_method || 'cash';
      existing.payments = [{
        id: 'pay-' + Date.now(),
        order_id: existing.id,
        payment_method: payload.payment_method || 'cash',
        amount_paid: existing.grand_total,
        received_amount: paidReceived,
        change_given: changeGiven,
        transaction_ref: txnRef,
        cashier_name: payload.cashier_name || 'Staff',
        created_at: now,
      }];
      targetOrder = existing;
    } else {
      targetOrder = this.createOrder({
        ...payload,
        status: 'completed',
      });
      targetOrder.status = 'completed';
      targetOrder.payment_method = payload.payment_method || 'cash';
      targetOrder.payments = [{
        id: 'pay-' + Date.now(),
        order_id: targetOrder.id,
        payment_method: payload.payment_method || 'cash',
        amount_paid: targetOrder.grand_total,
        received_amount: paidReceived,
        change_given: changeGiven,
        transaction_ref: txnRef,
        cashier_name: payload.cashier_name || 'Staff',
        created_at: now,
      }];
    }

    setStored(STORAGE_KEY_ORDERS, orders);

    if (payload.table_number) {
      const tables = this.getTables();
      const tbl = tables.find(t => t.table_number === payload.table_number);
      if (tbl) {
        tbl.status = 'available';
        tbl.current_order_id = null;
        setStored(STORAGE_KEY_TABLES, tables);
      }
    }

    const settings = this.getSettings();
    const itemsList = targetOrder.items || [];
    const receipt: ReceiptData = {
      restaurant: {
        name: settings.restaurant_name || 'Loaf n Leaf',
        tagline: settings.restaurant_tagline || 'Artisan Cafe & Charcoal Grill',
        address: settings.address || 'loaf n leaf river garden gujrat',
        phone: settings.phone || '+92 21 3583 8920',
        ntn: settings.ntn_number || '7829104-5',
        header: settings.receipt_header || 'Tax Invoice',
        footer: settings.receipt_footer || 'Thank you for dining with Loaf n Leaf!',
      },
      order: {
        id: targetOrder.id,
        order_number: targetOrder.order_number,
        order_type: targetOrder.order_type === 'dine_in' ? 'DINE IN' : 'TAKEAWAY',
        table_number: targetOrder.table_number || 'N/A',
        created_at: new Date().toISOString(),
        cashier: targetOrder.cashier_name || 'Cashier',
      },
      items: itemsList.map((it: any) => ({
        name: it.product_name || it.name,
        qty: it.quantity || it.qty || 1,
        unit_price: Number(it.unit_price) || 0,
        total: (Number(it.unit_price) || 0) * (it.quantity || it.qty || 1),
      })),
      summary: {
        subtotal: targetOrder.subtotal,
        discount: targetOrder.discount,
        tax_rate: targetOrder.tax_rate,
        tax_amount: targetOrder.tax_amount,
        grand_total: targetOrder.grand_total,
        payment_method: (payload.payment_method || 'cash').toUpperCase(),
        received_amount: payload.received_amount || targetOrder.grand_total,
        change_given: Math.max(0, (payload.received_amount || targetOrder.grand_total) - targetOrder.grand_total),
        transaction_ref: payload.transaction_ref || 'CSH-' + targetOrder.order_number,
      },
    };

    return { order: targetOrder, receipt };
  },

  getReportsSummary(): SalesReportSummary {
    const orders = this.getOrders().filter(o => o.status === 'completed');
    const totalSales = orders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
    const totalOrders = orders.length;
    const avg = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

    return {
      period: 'today',
      start: new Date().toISOString(),
      end: new Date().toISOString(),
      metrics: {
        totalSales,
        totalOrders,
        averageOrderValue: avg,
        cashSales: totalSales,
        cardSales: 0,
        otherSales: 0,
        totalTax: 0,
        totalDiscount: 0,
      },
      trend: Array.from({ length: 24 }, (_, i) => ({
        label: `${i < 10 ? '0' : ''}${i}:00`,
        sales: i === 14 ? totalSales : 0,
      })),
      topItems: [],
      recentOrders: orders.slice(0, 5),
    };
  },

  getReportsHistory(): any[] {
    return this.getOrders();
  },

  getSettings(): Settings {
    return getStored<Settings>(STORAGE_KEY_SETTINGS, defaultSettings);
  },

  updateSettings(updates: Partial<Settings>): Settings {
    const current = this.getSettings();
    const updated: Settings = { ...current };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) {
        updated[k] = String(v);
      }
    }
    setStored(STORAGE_KEY_SETTINGS, updated);
    return updated;
  },

  resetSales(): { success: boolean; message: string } {
    setStored(STORAGE_KEY_ORDERS, []);
    const tables = this.getTables().map(t => ({ ...t, status: 'available' as const, current_order_id: null }));
    setStored(STORAGE_KEY_TABLES, tables);
    return { success: true, message: 'All orders, tickets, and sales reset to zero.' };
  },

  resetDemoData(): { success: boolean; message: string } {
    setStored(STORAGE_KEY_PRODUCTS, []);
    setStored(STORAGE_KEY_ORDERS, []);
    setStored(STORAGE_KEY_TABLES, defaultTables);
    setStored(STORAGE_KEY_SETTINGS, defaultSettings);
    return { success: true, message: 'Reset to clean system defaults.' };
  },

  getStaffMembers(): StaffMember[] {
    return getStored<StaffMember[]>(STORAGE_KEY_STAFF, defaultStaff);
  },

  login(creds: { identifier?: string; password?: string; pin?: string }): User {
    const staff = this.getStaffMembers();
    if (creds.pin) {
      const match = staff.find(s => s.pin === creds.pin);
      if (match) {
        return {
          id: match.id,
          name: match.name,
          email: match.email,
          username: match.username,
          role: match.role as any,
          phone: match.phone,
          is_active: match.is_active,
        };
      }
    }
    const admin = staff[0];
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      username: admin.username,
      role: admin.role as any,
      phone: admin.phone,
      is_active: admin.is_active,
    };
  },

  googleAuth(profile: { email: string; name?: string; google_id?: string; avatar?: string }): User {
    return {
      id: 'usr-google-' + Date.now(),
      name: profile.name || 'Loaf n Leaf Guest',
      email: profile.email,
      role: 'customer',
      avatar: profile.avatar,
      is_active: 1,
    };
  },
};
