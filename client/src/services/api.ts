import { 
  Product, Category, RestaurantTable, Order, Settings, 
  ReceiptData, SalesReportSummary, OrderStatus, TableStatus,
  User, StaffMember, AuthorizedDevice, DeviceAuditLog, DevicePolicySettings
} from '../types';
import { fallbackStore } from './fallbackStore';
import { deviceCrypto } from './deviceCrypto';

const BASE_URL = '/api';
let isLocalFallback = false;

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (isLocalFallback) {
    throw new Error('FALLBACK_MODE');
  }

  try {
    const url = `${BASE_URL}${endpoint}`;
    const session = deviceCrypto.getStoredSession();
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> || {}),
    };
    if (session?.sessionToken) {
      reqHeaders['x-device-session-token'] = session.sessionToken;
    }

    const response = await fetch(url, {
      ...options,
      headers: reqHeaders,
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      isLocalFallback = true;
      throw new Error('FALLBACK_MODE');
    }

    const data = await response.json();
    if (!response.ok || data.success === false) {
      if (data.code === 'DEVICE_REVOKED') {
        window.dispatchEvent(new CustomEvent('lnl_device_revoked', { detail: data }));
      }
      const err: any = new Error(data.error || data.message || `HTTP error ${response.status}`);
      err.code = data.code;
      err.status = data.status;
      err.data = data;
      throw err;
    }
    return data.data !== undefined ? data.data : data;
  } catch (err: any) {
    if (err?.message === 'FALLBACK_MODE' || err?.message?.includes('fetch') || err?.message?.includes('NetworkError') || err?.name === 'TypeError') {
      isLocalFallback = true;
    }
    throw err;
  }
}

export const api = {
  // Products
  async getProducts(params?: { category?: string; search?: string; available?: boolean }): Promise<Product[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.append('category', params.category);
      if (params?.search) searchParams.append('search', params.search);
      if (params?.available !== undefined) searchParams.append('available', String(params.available));
      const query = searchParams.toString();
      return await request<Product[]>(`/products${query ? `?${query}` : ''}`);
    } catch {
      return fallbackStore.getProducts();
    }
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    try {
      return await request<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(product),
      });
    } catch {
      return fallbackStore.createProduct(product);
    }
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    try {
      return await request<Product>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(product),
      });
    } catch {
      return fallbackStore.updateProduct(id, product);
    }
  },

  async toggleProductAvailability(id: string, available?: boolean): Promise<Product> {
    try {
      return await request<Product>(`/products/${id}/toggle-availability`, {
        method: 'PUT',
        body: JSON.stringify(available !== undefined ? { available: available ? 1 : 0 } : {}),
      });
    } catch {
      return fallbackStore.toggleProductAvailability(id, available);
    }
  },

  async deleteProduct(id: string): Promise<{ success: boolean }> {
    try {
      return await request<{ success: boolean }>(`/products/${id}`, {
        method: 'DELETE',
      });
    } catch {
      return fallbackStore.deleteProduct(id);
    }
  },

  // Categories
  async getCategories(): Promise<Category[]> {
    try {
      return await request<Category[]>('/categories');
    } catch {
      return fallbackStore.getCategories();
    }
  },

  // Tables
  async getTables(): Promise<RestaurantTable[]> {
    try {
      return await request<RestaurantTable[]>('/tables');
    } catch {
      return fallbackStore.getTables();
    }
  },

  async createTable(data: { table_number: string; name: string; capacity: number }): Promise<RestaurantTable> {
    try {
      return await request<RestaurantTable>('/tables', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      return fallbackStore.createTable(data);
    }
  },

  async deleteTable(id: string): Promise<{ success: boolean }> {
    try {
      return await request<{ success: boolean }>(`/tables/${id}`, {
        method: 'DELETE',
      });
    } catch {
      return fallbackStore.deleteTable(id);
    }
  },

  async updateTableStatus(id: string, status: TableStatus): Promise<RestaurantTable> {
    try {
      return await request<RestaurantTable>(`/tables/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch {
      return fallbackStore.updateTableStatus(id, status);
    }
  },

  // Orders
  async getOrders(params?: { status?: OrderStatus | string; date?: string; search?: string }): Promise<Order[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.append('status', params.status);
      if (params?.date) searchParams.append('date', params.date);
      if (params?.search) searchParams.append('search', params.search);
      const query = searchParams.toString();
      return await request<Order[]>(`/orders${query ? `?${query}` : ''}`);
    } catch {
      return fallbackStore.getOrders();
    }
  },

  async getOrder(id: string): Promise<Order> {
    try {
      return await request<Order>(`/orders/${id}`);
    } catch {
      return fallbackStore.getOrder(id);
    }
  },

  async createOrder(order: any): Promise<Order> {
    try {
      return await request<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(order),
      });
    } catch {
      return fallbackStore.createOrder(order);
    }
  },

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    try {
      return await request<Order>(`/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch {
      return fallbackStore.updateOrderStatus(id, status);
    }
  },

  async updateOrder(id: string, updates: any): Promise<Order> {
    try {
      return await request<Order>(`/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } catch {
      return fallbackStore.updateOrderStatus(id, updates.status || 'pending');
    }
  },

  async cancelOrder(id: string): Promise<{ success: boolean }> {
    try {
      return await request<{ success: boolean }>(`/orders/${id}`, {
        method: 'DELETE',
      });
    } catch {
      fallbackStore.updateOrderStatus(id, 'cancelled');
      return { success: true };
    }
  },

  // Checkout (Transactional)
  async checkout(checkoutPayload: any): Promise<{ order: Order; receipt: ReceiptData }> {
    try {
      return await request<{ order: Order; receipt: ReceiptData }>('/checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutPayload),
      });
    } catch {
      return fallbackStore.checkout(checkoutPayload);
    }
  },

  // Reports
  async getReportsSummary(params?: { period?: string; from?: string; to?: string }): Promise<SalesReportSummary> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.period) searchParams.append('period', params.period);
      if (params?.from) searchParams.append('from', params.from);
      if (params?.to) searchParams.append('to', params.to);
      const query = searchParams.toString();
      return await request<SalesReportSummary>(`/reports/summary${query ? `?${query}` : ''}`);
    } catch {
      return fallbackStore.getReportsSummary();
    }
  },

  async getReportsHistory(params?: { period?: string; from?: string; to?: string; payment_method?: string; search?: string }): Promise<any[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.period) searchParams.append('period', params.period);
      if (params?.from) searchParams.append('from', params.from);
      if (params?.to) searchParams.append('to', params.to);
      if (params?.payment_method) searchParams.append('payment_method', params.payment_method);
      if (params?.search) searchParams.append('search', params.search);
      const query = searchParams.toString();
      return await request<any[]>(`/reports/history${query ? `?${query}` : ''}`);
    } catch {
      return fallbackStore.getReportsHistory();
    }
  },

  // Settings
  async getSettings(): Promise<Settings> {
    try {
      return await request<Settings>('/settings');
    } catch {
      return fallbackStore.getSettings();
    }
  },

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    try {
      return await request<Settings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    } catch {
      return fallbackStore.updateSettings(settings);
    }
  },

  async resetSales(): Promise<{ success: boolean; message: string }> {
    try {
      return await request<{ success: boolean; message: string }>('/settings/reset-sales', {
        method: 'POST',
      });
    } catch {
      return fallbackStore.resetSales();
    }
  },

  async resetDemoData(): Promise<{ success: boolean; message: string }> {
    try {
      return await request<{ success: boolean; message: string }>('/settings/reset-demo', {
        method: 'POST',
      });
    } catch {
      return fallbackStore.resetDemoData();
    }
  },

  // Auth & Roles
  async login(credentials: { identifier?: string; password?: string; pin?: string }): Promise<User> {
    try {
      return await request<User>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
    } catch {
      return fallbackStore.login(credentials);
    }
  },

  async googleAuth(profile: { email: string; name?: string; google_id?: string; avatar?: string }): Promise<User> {
    try {
      return await request<User>('/auth/google', {
        method: 'POST',
        body: JSON.stringify(profile),
      });
    } catch {
      return fallbackStore.googleAuth(profile);
    }
  },

  async signup(customerData: { name: string; email: string; password: string; phone?: string }): Promise<User> {
    try {
      return await request<User>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(customerData),
      });
    } catch {
      return {
        id: 'usr-cust-' + Date.now(),
        name: customerData.name,
        email: customerData.email,
        role: 'customer',
        phone: customerData.phone || '',
        is_active: 1,
      };
    }
  },

  async getStaffUsers(): Promise<User[]> {
    try {
      return await request<User[]>('/auth/users');
    } catch {
      const staff = fallbackStore.getStaffMembers();
      return staff.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        username: s.username,
        role: s.role as any,
        phone: s.phone,
        is_active: s.is_active,
      }));
    }
  },

  // Staff Management (Admin Only)
  async getStaff(): Promise<StaffMember[]> {
    try {
      return await request<StaffMember[]>('/staff');
    } catch {
      return fallbackStore.getStaffMembers();
    }
  },

  async createStaff(staffData: { name: string; email: string; username?: string; password: string; pin?: string; role?: 'admin' | 'cashier'; phone?: string }): Promise<StaffMember> {
    return request<StaffMember>('/staff', {
      method: 'POST',
      body: JSON.stringify(staffData),
    });
  },

  async updateStaffPassword(id: string, password?: string, pin?: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/staff/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password, pin }),
    });
  },

  async updateStaff(id: string, updates: Partial<StaffMember>): Promise<StaffMember> {
    return request<StaffMember>(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteStaff(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/staff/${id}`, {
      method: 'DELETE',
    });
  },

  // Customer Self-Ordering (Table QR)
  async submitCustomerOrder(orderPayload: { table_number: string; customer_name?: string; customer_phone?: string; items: any[]; notes?: string }): Promise<any> {
    try {
      return await request<any>('/customer/orders', {
        method: 'POST',
        body: JSON.stringify(orderPayload),
      });
    } catch {
      return fallbackStore.createOrder(orderPayload);
    }
  },

  async getCustomerTableOrder(tableNumber: string): Promise<{ active_order: any }> {
    try {
      return await request<{ active_order: any }>(`/customer/orders/table/${tableNumber}`);
    } catch {
      const orders = fallbackStore.getOrders();
      const active = orders.find(o => o.table_number === tableNumber && (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready'));
      return { active_order: active || null };
    }
  },

  // -------------------------------------------------------------
  // Cryptographic Device Authentication & Authorization
  // -------------------------------------------------------------
  async getDeviceChallenge(deviceFingerprint: string): Promise<{ challengeId: string; nonce: string; timestamp: number; expiresIn: number }> {
    try {
      return await request<{ challengeId: string; nonce: string; timestamp: number; expiresIn: number }>('/device/challenge', {
        method: 'POST',
        body: JSON.stringify({ deviceFingerprint }),
      });
    } catch (err) {
      return fallbackStore.getDeviceChallenge(deviceFingerprint);
    }
  },

  async verifyDeviceAndLogin(payload: {
    identifier?: string;
    password?: string;
    pin?: string;
    deviceFingerprint: string;
    publicKeySpki: string;
    challengeId: string;
    signature: string;
    deviceName: string;
    deviceInfo?: any;
    requestedRole?: string;
  }): Promise<{ user: User; sessionToken: string; device: any }> {
    try {
      return await request<{ user: User; sessionToken: string; device: any }>('/device/verify-and-login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      if (err?.message === 'FALLBACK_MODE' || isLocalFallback) {
        return fallbackStore.verifyDeviceAndLogin(payload);
      }
      throw err;
    }
  },

  async getDeviceStatus(fingerprint: string): Promise<any> {
    try {
      return await request<any>(`/device/status/${fingerprint}`);
    } catch {
      return fallbackStore.getDeviceStatus(fingerprint);
    }
  },

  async requestDeviceApproval(payload: {
    deviceFingerprint: string;
    deviceName?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      return await request<{ success: boolean; message: string }>('/device/request-approval', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return fallbackStore.requestDeviceApproval(payload);
    }
  },

  async ownerAuthorizeTerminal(payload: {
    adminIdentifier?: string;
    adminPassword?: string;
    adminPin?: string;
    deviceFingerprint: string;
    publicKeySpki: string;
    challengeId: string;
    signature: string;
    rolesToAuthorize?: string[];
    deviceName?: string;
  }): Promise<{ user: User; sessionToken: string; device: any }> {
    return await request<{ user: User; sessionToken: string; device: any }>('/device/owner-authorize-terminal', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async devAuthorizeLocalTerminal(deviceFingerprint: string, deviceName?: string): Promise<{ success: boolean; message: string; permittedRoles: string[] }> {
    return await request<{ success: boolean; message: string; permittedRoles: string[] }>('/device/dev/authorize-local-terminal', {
      method: 'POST',
      body: JSON.stringify({ deviceFingerprint, deviceName }),
    });
  },

  // Admin Device Management
  async getAdminDevices(): Promise<AuthorizedDevice[]> {
    try {
      return await request<AuthorizedDevice[]>('/device/admin/devices');
    } catch {
      return fallbackStore.getAdminDevices();
    }
  },

  async approveDevice(id: string, payload: {
    assignedUserId?: string;
    permittedRoles: string[];
    adminName?: string;
    deviceName?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      return await request<{ success: boolean; message: string }>(`/device/admin/devices/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return fallbackStore.approveDevice(id, payload);
    }
  },

  async rejectDevice(id: string, payload: {
    reason?: string;
    adminName?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      return await request<{ success: boolean; message: string }>(`/device/admin/devices/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return fallbackStore.rejectDevice(id, payload);
    }
  },

  async revokeDevice(id: string, payload: {
    reason?: string;
    adminName?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      return await request<{ success: boolean; message: string }>(`/device/admin/devices/${id}/revoke`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return fallbackStore.revokeDevice(id, payload);
    }
  },

  async deleteDevice(id: string): Promise<{ success: boolean; message: string }> {
    try {
      return await request<{ success: boolean; message: string }>(`/device/admin/devices/${id}`, {
        method: 'DELETE',
      });
    } catch {
      return fallbackStore.deleteDevice(id);
    }
  },

  async getDeviceAuditLogs(): Promise<DeviceAuditLog[]> {
    try {
      return await request<DeviceAuditLog[]>('/device/admin/audit-logs');
    } catch {
      return fallbackStore.getDeviceAuditLogs();
    }
  },

  async getDevicePolicySettings(): Promise<DevicePolicySettings> {
    try {
      return await request<DevicePolicySettings>('/device/admin/settings');
    } catch {
      return fallbackStore.getDevicePolicySettings();
    }
  },

  async updateDevicePolicySettings(maxDevicesPerEmployee: number): Promise<{ success: boolean; message: string }> {
    try {
      return await request<{ success: boolean; message: string }>('/device/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ maxDevicesPerEmployee }),
      });
    } catch {
      return fallbackStore.updateDevicePolicySettings(maxDevicesPerEmployee);
    }
  },
};
