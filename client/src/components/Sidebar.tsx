import React from 'react';
import { 
  ShoppingBag, 
  ClipboardList, 
  UtensilsCrossed, 
  Grid2X2, 
  BarChart3, 
  Settings as SettingsIcon,
  QrCode, 
  ShieldAlert, 
  Smartphone, 
  Lock, 
  LogOut,
  Sparkles,
  Wheat,
  Leaf
} from 'lucide-react';
import { User, UserRole } from '../types';

export type NavTab = 'counter' | 'orders' | 'menu' | 'tables' | 'qr' | 'staff' | 'devices' | 'reports' | 'customer_menu' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentUser: User | null;
  onOpenAuthModal: () => void;
  shiftName: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenAuthModal,
  shiftName,
}) => {
  const userRole: UserRole = currentUser?.role || 'admin';

  // Navigation items with role permissions
  const navItems: Array<{ 
    id: NavTab; 
    label: string; 
    icon: React.ReactNode; 
    adminOnly?: boolean;
    badge?: string;
  }> = [
    { id: 'counter', label: 'Order Counter', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'orders', label: 'Orders & Kitchen', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'menu', label: 'Menu Management', icon: <UtensilsCrossed className="w-4 h-4" /> },
    { id: 'tables', label: 'Table Seating', icon: <Grid2X2 className="w-4 h-4" /> },
    { id: 'qr', label: 'Table QR Standees', icon: <QrCode className="w-4 h-4 text-amber-400" />, badge: 'Barcodes' },
    { id: 'staff', label: 'Staff & Passwords', icon: <ShieldAlert className="w-4 h-4" />, adminOnly: true },
    { id: 'devices', label: 'Authorized Devices', icon: <Smartphone className="w-4 h-4 text-emerald-400" />, adminOnly: true },
    { id: 'reports', label: 'Sales & Revenue', icon: <BarChart3 className="w-4 h-4" />, adminOnly: true },
    { id: 'customer_menu', label: 'Digital Guest Menu', icon: <Smartphone className="w-4 h-4 text-emerald-400" />, badge: 'QR View' },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" />, adminOnly: true },
  ];

  return (
    <aside className="w-64 bg-[#092215] text-white border-r border-[#143B25] flex flex-col justify-between shrink-0 select-none shadow-xl">
      <div>
        {/* Brand Header with Rich Botanical Leaf & Loaf Identity */}
        <div className="h-20 flex items-center px-5 border-b border-[#143B25] gap-3 bg-gradient-to-b from-[#0F3521] to-[#092215] relative overflow-hidden">
          {/* Subtle background ambient leaf glow */}
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-[#0A522A] flex items-center justify-center text-white shrink-0 shadow-lg border border-emerald-400/30 relative">
            <span className="text-xl filter drop-shadow">🌿</span>
          </div>

          <div className="overflow-hidden">
            <div className="font-extrabold text-base text-emerald-50 tracking-tight leading-tight">
              Loaf n Leaf
            </div>
            <div className="text-[11px] text-emerald-300/80 font-medium tracking-wide truncate flex items-center gap-1 mt-0.5">
              <span>Bakery & Charcoal Grill</span>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="px-3 pt-4 pb-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/60 px-3 mb-2">
            Operations Menu
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const isLocked = item.adminOnly && userRole !== 'admin';

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isLocked) {
                      onOpenAuthModal();
                    } else {
                      onSelectTab(item.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left group ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-700 to-emerald-800 text-white shadow-md border-l-4 border-amber-400 font-bold'
                      : isLocked
                      ? 'text-emerald-300/40 hover:bg-[#0E2F1E] hover:text-emerald-200'
                      : 'text-emerald-100/90 hover:bg-[#0E2F1E] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`transition-transform duration-150 group-hover:scale-110 ${
                      isActive ? 'text-amber-300' : 'text-emerald-400'
                    }`}>
                      {item.icon}
                    </span>
                    <span className="tracking-wide">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {item.badge && (
                      <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}

                    {isLocked && (
                      <span className="text-[9px] bg-emerald-950/80 text-emerald-300/60 border border-emerald-800/40 px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Admin</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User & Shift Footer Card */}
      <div className="p-3 m-3 rounded-2xl bg-[#0D2D1C] border border-[#16472D] shadow-inner space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
              userRole === 'admin' 
                ? 'bg-amber-400 text-amber-950 font-black' 
                : userRole === 'cashier'
                ? 'bg-emerald-500 text-emerald-950 font-black'
                : 'bg-teal-400 text-teal-950 font-black'
            }`}>
              {userRole === 'admin' ? '👑' : userRole === 'cashier' ? '🏷️' : '👤'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-emerald-50 truncate leading-tight">
                {currentUser?.name || 'Ahmed Khan'}
              </div>
              <div className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 mt-0.5">
                <span className={`px-1.5 py-0.2 rounded text-[9px] ${
                  userRole === 'admin' 
                    ? 'bg-amber-500/30 text-amber-300' 
                    : 'bg-emerald-500/30 text-emerald-300'
                }`}>
                  {userRole.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Switch Account Button */}
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="p-1.5 rounded-lg border border-[#1E5437] bg-[#0A2417] hover:bg-[#123E27] text-emerald-300 hover:text-white transition-all shadow-xs"
            title="Switch Account / Login"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-[10px] text-emerald-300/70 border-t border-[#16472D] pt-2 flex justify-between items-center">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Shift:</span>
          </span>
          <span className="font-semibold text-emerald-100">{shiftName}</span>
        </div>
      </div>
    </aside>
  );
};
