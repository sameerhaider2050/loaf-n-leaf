export type OrderType = 'dine_in' | 'takeaway';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'other';
export type TableStatus = 'available' | 'occupied' | 'reserved';
export type DiscountType = 'fixed' | 'percent';

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  image?: string;
  available: number; // 1 or 0
  description?: string;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface RestaurantTable {
  id: string;
  table_number: string;
  name: string;
  capacity: number;
  status: TableStatus;
  current_order_id: string | null;
  active_order_number?: number;
  active_order_total?: number;
  active_order_status?: OrderStatus;
  active_order_time?: string;
  updated_at?: string;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id?: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  notes?: string;
}

export interface Payment {
  id: string;
  order_id: string;
  payment_method: PaymentMethod;
  amount_paid: number;
  received_amount: number;
  change_given: number;
  transaction_ref?: string;
  cashier_name: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  order_type: OrderType;
  table_number: string | null;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  discount_type: DiscountType;
  discount_value: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  cashier_name: string;
  customer_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  item_count?: number;
  item_summary?: string;
  payment_method?: PaymentMethod;
  paid_at?: string;
  items?: OrderItem[];
  payments?: Payment[];
}

export interface Settings {
  restaurant_name: string;
  restaurant_tagline: string;
  address: string;
  phone: string;
  ntn_number: string;
  tax_name: string;
  tax_rate: string;
  tax_enabled: string;
  currency_symbol: string;
  receipt_header: string;
  receipt_footer: string;
  active_cashier: string;
  active_shift: string;
  [key: string]: string;
}

export interface ReceiptData {
  restaurant: {
    name: string;
    tagline: string;
    address: string;
    phone: string;
    ntn: string;
    header: string;
    footer: string;
  };
  order: {
    id: string;
    order_number: number;
    order_type: string;
    table_number: string;
    created_at: string;
    cashier: string;
  };
  items: Array<{
    name: string;
    qty: number;
    unit_price: number;
    total: number;
  }>;
  summary: {
    subtotal: number;
    discount: number;
    tax_rate: number;
    tax_amount: number;
    grand_total: number;
    payment_method: string;
    received_amount: number;
    change_given: number;
    transaction_ref: string;
  };
}

export interface SalesReportSummary {
  period: string;
  start: string;
  end: string;
  metrics: {
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    cashSales: number;
    cardSales: number;
    otherSales: number;
    totalTax: number;
    totalDiscount: number;
  };
  trend: Array<{ label: string; sales: number }>;
  topItems: Array<{ product_name: string; total_qty: number; total_revenue: number }>;
  recentOrders: Order[];
}

export type UserRole = 'admin' | 'cashier' | 'order_taker' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: UserRole;
  pin?: string;
  phone?: string;
  avatar?: string;
  is_active?: number;
  created_at?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'admin' | 'cashier' | 'order_taker';
  pin?: string;
  phone?: string;
  is_active: number;
  created_at: string;
}

// Device-Based Access Control Types
export type DeviceStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export interface AuthorizedDevice {
  id: string;
  device_fingerprint_hash: string;
  device_name: string;
  assigned_user_id: string | null;
  assigned_employee_name?: string;
  assigned_employee_role?: string;
  permitted_roles: string[];
  status: DeviceStatus;
  device_info?: string;
  ip_address?: string;
  last_active_at?: string;
  approved_by?: string;
  approved_at?: string;
  revoked_by?: string;
  revoked_at?: string;
  created_at: string;
  active_sessions_count?: number;
}

export interface DeviceApprovalRequest {
  id: string;
  device_id: string;
  user_id: string;
  requested_role: string;
  device_name: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface DeviceAuditLog {
  id: string;
  device_id: string | null;
  device_name?: string;
  user_id: string | null;
  user_name?: string;
  action: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface DevicePolicySettings {
  maxDevicesPerEmployee: number;
}
