import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { PosView } from './views/PosView';
import { OrdersView } from './views/OrdersView';
import { MenuView } from './views/MenuView';
import { TablesView } from './views/TablesView';
import { QrStandeesView } from './views/QrStandeesView';
import { StaffView } from './views/StaffView';
import { ReportsView } from './views/ReportsView';
import { CustomerMenuView } from './views/CustomerMenuView';
import { SettingsView } from './views/SettingsView';
import { AuthorizedDevicesView } from './views/AuthorizedDevicesView';
import { AuthModal } from './components/AuthModal';
import { DeviceApprovalScreen } from './components/DeviceApprovalScreen';
import { SplashIntro } from './components/SplashIntro';
import { Product, Category, RestaurantTable, Settings, Order, User, DeviceStatus } from './types';
import { api } from './services/api';
import { deviceCrypto } from './services/deviceCrypto';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<NavTab>('counter');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [settings, setSettings] = useState<Settings>({
    restaurant_name: 'Loaf n Leaf',
    restaurant_tagline: 'Artisan Cafe & Charcoal Grill',
    address: 'Plot 12-C, 7th Zamzama Commercial, Clifton, Karachi',
    phone: '+92 21 3583 8920',
    ntn_number: '7829104-5',
    tax_name: 'Sindh Sales Tax (SRB)',
    tax_rate: '13',
    tax_enabled: 'true',
    currency_symbol: 'Rs.',
    receipt_header: 'TAX INVOICE',
    receipt_footer: 'Thank you for dining with us!',
    active_cashier: 'Ahmed Khan',
    active_shift: 'Evening Shift',
  });
  
  // Authentication & Current User State
  const [currentUser, setCurrentUser] = useState<User | null>({
    id: 'usr-admin-1',
    name: 'Restaurant Admin',
    email: 'admin@loafnleaf.com',
    username: 'admin',
    role: 'admin',
    pin: '1234',
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [customerActiveTable, setCustomerActiveTable] = useState<string>('T-01');

  // Device-Based Access Control State
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [deviceBlockState, setDeviceBlockState] = useState<{
    status: DeviceStatus | 'role_mismatch';
    fingerprint: string;
    message: string;
    permittedRoles?: string[];
    userRole?: string;
    deviceName?: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [activeOrderToLoad, setActiveOrderToLoad] = useState<Order | null>(null);

  // Check device authorization and cryptographic identity on boot
  useEffect(() => {
    let isMounted = true;

    const initDeviceAuth = async () => {
      try {
        const { identity } = await deviceCrypto.getOrCreateDeviceIdentity();
        if (!isMounted) return;
        setDeviceFingerprint(identity.fingerprint);

        // Check if there is an existing session
        const session = deviceCrypto.getStoredSession();
        if (session && session.user) {
          setCurrentUser(session.user);
        }

        // Verify device authorization status with backend
        const devStatus = await api.getDeviceStatus(identity.fingerprint);
        if (!isMounted) return;

        if (devStatus && devStatus.status) {
          if (devStatus.status === 'pending' || devStatus.status === 'revoked' || devStatus.status === 'rejected') {
            setDeviceBlockState({
              status: devStatus.status,
              fingerprint: identity.fingerprint,
              deviceName: devStatus.name || identity.deviceName,
              message: devStatus.message || `Terminal is currently ${devStatus.status}.`,
            });
          }
        }
      } catch (err: any) {
        console.error('Device authorization init error:', err);
      }
    };

    initDeviceAuth();

    // Listen to real-time device revocation events from API layer
    const handleDeviceRevoked = (e: any) => {
      deviceCrypto.clearSession();
      setDeviceBlockState({
        status: 'revoked',
        fingerprint: deviceFingerprint,
        message: e?.detail?.message || 'Terminal authorization has been revoked by an administrator.',
      });
    };

    window.addEventListener('lnl_device_revoked', handleDeviceRevoked);
    return () => {
      isMounted = false;
      window.removeEventListener('lnl_device_revoked', handleDeviceRevoked);
    };
  }, [deviceFingerprint]);

  // Check if opened via QR scan (#menu?table=T-03)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#menu')) {
        const match = hash.match(/table=([A-Za-z0-9-]+)/);
        if (match && match[1]) {
          setCustomerActiveTable(match[1].toUpperCase());
        }
        setActiveTab('customer_menu');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const [prodsData, catsData, tblsData, setsData] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getTables(),
        api.getSettings(),
      ]);

      setProducts(prodsData);
      setCategories(catsData);
      setTables(tblsData);
      if (setsData && Object.keys(setsData).length > 0) {
        setSettings(setsData);
      }
    } catch (err) {
      console.error('Failed to load initial restaurant data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // When cashier selects a table from TablesView to open/continue order
  const handleOpenTableOrder = async (table: RestaurantTable) => {
    if (table.current_order_id) {
      try {
        const fullOrder = await api.getOrder(table.current_order_id);
        setActiveOrderToLoad(fullOrder);
        setActiveTab('counter');
      } catch (err) {
        console.error('Could not fetch active order for table:', err);
        setActiveOrderToLoad({
          id: '',
          order_number: 0,
          order_type: 'dine_in',
          table_number: table.table_number,
          status: 'pending',
          subtotal: 0,
          discount: 0,
          discount_type: 'fixed',
          discount_value: 0,
          tax_rate: Number(settings.tax_rate) || 13,
          tax_amount: 0,
          grand_total: 0,
          cashier_name: currentUser?.name || 'Ahmed Khan',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: [],
        });
        setActiveTab('counter');
      }
    } else {
      setActiveOrderToLoad({
        id: '',
        order_number: 0,
        order_type: 'dine_in',
        table_number: table.table_number,
        status: 'pending',
        subtotal: 0,
        discount: 0,
        discount_type: 'fixed',
        discount_value: 0,
        tax_rate: Number(settings.tax_rate) || 13,
        tax_amount: 0,
        grand_total: 0,
        cashier_name: currentUser?.name || 'Ahmed Khan',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [],
      });
      setActiveTab('counter');
    }
  };

  const handleOpenCustomerMenuFromQr = (tableNumber: string) => {
    setCustomerActiveTable(tableNumber);
    setActiveTab('customer_menu');
  };

  const defaultTaxRate = Number(settings.tax_rate) || 13;

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8FAF8] text-primary-text">
        <div className="w-12 h-12 rounded-2xl bg-leaf-700 flex items-center justify-center text-white text-2xl shadow-md mb-3 animate-bounce">
          🌿
        </div>
        <h1 className="text-base font-extrabold text-leaf-950 tracking-tight">Loaf n Leaf</h1>
        <p className="text-xs text-secondary-text mt-1">Connecting to SQLite database...</p>
      </div>
    );
  }

  // Device-Based Access Control Gate
  if (deviceBlockState) {
    return (
      <DeviceApprovalScreen
        status={deviceBlockState.status}
        deviceFingerprint={deviceBlockState.fingerprint}
        initialDeviceName={deviceBlockState.deviceName}
        errorMessage={deviceBlockState.message}
        permittedRoles={deviceBlockState.permittedRoles}
        userRole={deviceBlockState.userRole}
        onApproved={() => {
          setDeviceBlockState(null);
          loadInitialData();
        }}
        onBackToLogin={() => {
          setDeviceBlockState(null);
          setIsAuthModalOpen(true);
        }}
      />
    );
  }

  // If in pure customer digital menu mode (e.g. from customer mobile scan)
  if (activeTab === 'customer_menu' && currentUser?.role === 'customer') {
    return (
      <div className="h-screen w-screen flex flex-col bg-[#F8FAF8] overflow-hidden">
        <CustomerMenuView
          products={products}
          categories={categories}
          initialTable={customerActiveTable}
          currentUser={currentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onBackToTerminal={() => setActiveTab('counter')}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          currentUser={currentUser}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            if (user.role !== 'customer') {
              setActiveTab('counter');
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F4F7F4]">
      {/* Animated Splash Screen on Load */}
      {showSplash && (
        <SplashIntro
          onComplete={() => setShowSplash(false)}
          restaurantName={settings.restaurant_name}
        />
      )}

      {/* Top Header */}
      <Header
        restaurantName={settings.restaurant_name || 'Loaf n Leaf'}
        restaurantAddress={settings.address}
        currentUser={currentUser}
        shiftName={settings.active_shift || 'Evening Shift'}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Workspace with Compact Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar Navigation */}
        <div className="hidden md:flex">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            shiftName={settings.active_shift || 'Evening Shift'}
          />
        </div>

        {/* Dynamic View Panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'counter' && (
            <PosView
              products={products}
              categories={categories}
              tables={tables}
              cashierName={currentUser?.name || settings.active_cashier || 'Ahmed Khan'}
              defaultTaxRate={defaultTaxRate}
              onRefreshData={loadInitialData}
              activeOrderToLoad={activeOrderToLoad}
              onClearActiveOrderToLoad={() => setActiveOrderToLoad(null)}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              settings={settings}
              onRefreshTrigger={loadInitialData}
            />
          )}

          {activeTab === 'menu' && (
            <MenuView
              products={products}
              categories={categories}
              currentUser={currentUser}
              onRefreshData={loadInitialData}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'tables' && (
            <TablesView
              tables={tables}
              onRefreshData={loadInitialData}
              onOpenTableOrderInPos={handleOpenTableOrder}
            />
          )}

          {activeTab === 'qr' && (
            <QrStandeesView
              tables={tables}
              onOpenCustomerMenu={handleOpenCustomerMenuFromQr}
            />
          )}

          {activeTab === 'staff' && (
            <StaffView />
          )}

          {activeTab === 'devices' && (
            <AuthorizedDevicesView currentAdminName={currentUser?.name} />
          )}

          {activeTab === 'reports' && (
            <ReportsView />
          )}

          {activeTab === 'customer_menu' && (
            <CustomerMenuView
              products={products}
              categories={categories}
              initialTable={customerActiveTable}
              currentUser={currentUser}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onBackToTerminal={() => setActiveTab('counter')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onRefreshSettings={loadInitialData}
            />
          )}
        </main>
      </div>

      {/* Authentication & Role Switcher Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'customer') {
            setActiveTab('customer_menu');
          }
        }}
        onDeviceBlocked={setDeviceBlockState}
      />
    </div>
  );
};

export default App;
