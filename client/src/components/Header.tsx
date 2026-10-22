import React, { useState, useEffect } from 'react';
import { Menu, X, Clock, Wifi, User as UserIcon, Shield, Sparkles, Smartphone, QrCode, MapPin, ChevronRight } from 'lucide-react';
import { NavTab } from './Sidebar';
import { User } from '../types';

interface HeaderProps {
  restaurantName: string;
  restaurantAddress?: string;
  currentUser: User | null;
  shiftName: string;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  restaurantName,
  restaurantAddress,
  currentUser,
  shiftName,
  activeTab,
  onSelectTab,
  onOpenAuthModal,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('en-PK', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Karachi',
      }).format(now);
      setCurrentTime(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const tabLabels: Record<NavTab, string> = {
    counter: 'Order Counter & Billing',
    orders: 'Kitchen Orders & Status',
    menu: 'Menu Catalog Management',
    tables: 'Restaurant Floor & Tables',
    qr: 'Table Barcode & QR Standees',
    staff: 'Staff Accounts & Passwords',
    reports: 'Financial Reports & Analytics',
    customer_menu: 'Customer Digital Menu',
    settings: 'Restaurant System Settings',
  };

  const role = currentUser?.role || 'admin';

  return (
    <header className="h-16 bg-white border-b border-[#E1E7E1] px-4 md:px-6 flex items-center justify-between shrink-0 select-none z-20 shadow-xs relative">
      {/* Top botanical leaf gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-700 via-amber-500 to-emerald-700" />

      {/* Left: Mobile hamburger & Active Section Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center text-sm shadow-sm md:hidden">
            🌿
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-800/80 font-medium">
              <span className="font-bold text-emerald-900">{restaurantName || 'Loaf n Leaf'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-semibold text-gray-700">{tabLabels[activeTab]}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
              <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[280px]">
                {restaurantAddress || 'Zamzama Commercial, Clifton, Karachi'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Controls: Quick Actions, Live Clock & Role Switcher */}
      <div className="flex items-center gap-2.5 text-xs">
        {/* Quick Shortcut Pills */}
        <div className="hidden xl:flex items-center gap-1.5">
          <button
            onClick={() => onSelectTab('qr')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              activeTab === 'qr'
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-amber-600" />
            <span>Table Standees</span>
          </button>

          <button
            onClick={() => onSelectTab('customer_menu')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              activeTab === 'customer_menu'
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span>Guest QR Menu</span>
          </button>
        </div>

        {/* Live Karachi Time Clock */}
        <div className="hidden lg:flex items-center gap-2 bg-[#F2F7F2] border border-[#D5E3D5] px-3 py-1.5 rounded-xl font-medium text-gray-700 text-xs shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <Clock className="w-3.5 h-3.5 text-emerald-700" />
          <span className="font-mono text-[11px] font-semibold">{currentTime || 'Karachi Time'}</span>
        </div>

        {/* User Role Pill Button (Click to Switch Account) */}
        <button
          onClick={onOpenAuthModal}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-semibold text-xs shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] ${
            role === 'admin'
              ? 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
              : role === 'cashier'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100'
              : 'bg-teal-50 text-teal-950 border-teal-300 hover:bg-teal-100'
          }`}
          title="Click to Switch User / Role"
        >
          <span className="text-sm">
            {role === 'admin' ? '👑' : role === 'cashier' ? '🏷️' : '👤'}
          </span>
          <div className="text-left leading-tight hidden sm:block">
            <div className="font-bold text-[11px] truncate max-w-[110px]">
              {currentUser?.name?.split(' ')[0] || 'User'}
            </div>
            <div className="text-[9px] uppercase font-black tracking-wider opacity-75">
              [{role}] • SWITCH
            </div>
          </div>
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-[#092215] border-b border-[#143B25] p-3 shadow-xl z-50 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { id: 'counter' as NavTab, label: 'Order Counter' },
              { id: 'orders' as NavTab, label: 'Orders' },
              { id: 'menu' as NavTab, label: 'Menu Management' },
              { id: 'tables' as NavTab, label: 'Tables' },
              { id: 'qr' as NavTab, label: 'QR Standees' },
              { id: 'staff' as NavTab, label: 'Staff Passwords' },
              { id: 'reports' as NavTab, label: 'Sales Reports' },
              { id: 'customer_menu' as NavTab, label: 'Digital Menu' },
              { id: 'settings' as NavTab, label: 'Settings' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onSelectTab(m.id);
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-lg text-left font-semibold text-xs transition-colors ${
                  activeTab === m.id
                    ? 'bg-emerald-700 text-white'
                    : 'text-emerald-100 bg-[#0F3521] hover:bg-[#14422B]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
