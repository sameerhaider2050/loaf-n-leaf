import React, { useState, useEffect } from 'react';
import { 
  Save, 
  RotateCcw, 
  Store, 
  Percent, 
  Receipt, 
  User, 
  Database,
  Check,
  AlertCircle
} from 'lucide-react';
import { Settings } from '../types';
import { api } from '../services/api';

interface SettingsViewProps {
  settings: Settings;
  onRefreshSettings: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefreshSettings,
}) => {
  const [formData, setFormData] = useState<Settings>({ ...settings });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);

  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSuccessMessage('');
      setErrorMessage('');
      await api.updateSettings(formData);
      setSuccessMessage('Settings updated successfully.');
      onRefreshSettings();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSales = async () => {
    if (window.confirm('Are you sure you want to reset all orders, kitchen tickets, and sales reports to ZERO? All tables will be freed and history cleared.')) {
      try {
        setIsResetting(true);
        const res = await api.resetSales();
        alert(res.message || 'Orders and sales have been reset to zero!');
        onRefreshSettings();
        window.location.reload();
      } catch (err: any) {
        alert(err.message || 'Failed to reset orders and sales');
      } finally {
        setIsResetting(false);
      }
    }
  };

  const handleResetDemoData = async () => {
    if (window.confirm('Are you sure you want to reset the database to factory settings? This will reset all system defaults.')) {
      try {
        setIsResetting(true);
        await api.resetDemoData();
        alert('Database reset successfully!');
        onRefreshSettings();
        window.location.reload();
      } catch (err: any) {
        alert(err.message || 'Failed to reset system');
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white border-b border-[#E5E7EB] p-4 shrink-0">
        <h2 className="text-sm font-bold text-[#171717] tracking-tight">
          System Settings
        </h2>
        <p className="text-xs text-[#737373]">
          Configure restaurant identity, provincial sales tax rates, receipt formatting, and operational shifts
        </p>
      </div>

      <div className="p-4 max-w-4xl space-y-4">
        {/* Alerts */}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Restaurant Details */}
          <div className="bg-white p-4 rounded border border-[#E5E7EB] shadow-subtle space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
              <Store className="w-4 h-4 text-[#2563EB]" />
              <h3 className="font-bold text-[#171717]">Restaurant Profile</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Restaurant Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.restaurant_name || ''}
                  onChange={(e) => handleChange('restaurant_name', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>

              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Tagline / Subheading
                </label>
                <input
                  type="text"
                  value={formData.restaurant_tagline || ''}
                  onChange={(e) => handleChange('restaurant_tagline', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-medium text-[#171717] mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>

              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Phone / Landline
                </label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>

              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  NTN / Tax Registration Number
                </label>
                <input
                  type="text"
                  value={formData.ntn_number || ''}
                  onChange={(e) => handleChange('ntn_number', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>
            </div>
          </div>

          {/* Tax & Financial Configuration */}
          <div className="bg-white p-4 rounded border border-[#E5E7EB] shadow-subtle space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
              <Percent className="w-4 h-4 text-[#2563EB]" />
              <h3 className="font-bold text-[#171717]">Tax & Currency</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Tax Authority / Label
                </label>
                <input
                  type="text"
                  value={formData.tax_name || ''}
                  onChange={(e) => handleChange('tax_name', e.target.value)}
                  placeholder="e.g. Sindh Sales Tax (SRB)"
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>

              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={formData.tax_rate || '13'}
                  onChange={(e) => handleChange('tax_rate', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>

              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={formData.currency_symbol || 'Rs.'}
                  onChange={(e) => handleChange('currency_symbol', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>
            </div>
          </div>

          {/* Cashier & Current Shift */}
          <div className="bg-white p-4 rounded border border-[#E5E7EB] shadow-subtle space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
              <User className="w-4 h-4 text-[#2563EB]" />
              <h3 className="font-bold text-[#171717]">Shift & Cashier Operator</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Active Cashier Name
                </label>
                <input
                  type="text"
                  value={formData.active_cashier || ''}
                  onChange={(e) => handleChange('active_cashier', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>

              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Active Shift Description
                </label>
                <input
                  type="text"
                  value={formData.active_shift || ''}
                  onChange={(e) => handleChange('active_shift', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>
            </div>
          </div>

          {/* Thermal Receipt Notes */}
          <div className="bg-white p-4 rounded border border-[#E5E7EB] shadow-subtle space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
              <Receipt className="w-4 h-4 text-[#2563EB]" />
              <h3 className="font-bold text-[#171717]">80mm Thermal Receipt Customization</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Receipt Header Note
                </label>
                <input
                  type="text"
                  value={formData.receipt_header || ''}
                  onChange={(e) => handleChange('receipt_header', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>

              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Receipt Footer Note
                </label>
                <input
                  type="text"
                  value={formData.receipt_footer || ''}
                  onChange={(e) => handleChange('receipt_footer', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>
            </div>
          </div>

          {/* Form Save Action */}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-leaf-800 hover:bg-leaf-900 rounded shadow-sm disabled:opacity-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>

        {/* Database Persistence & Demo Data Reset Box */}
        <div className="bg-white p-4 rounded border border-[#E5E7EB] shadow-subtle space-y-3 mt-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
            <Database className="w-4 h-4 text-[#737373]" />
            <h3 className="font-bold text-[#171717]">Database & Persistence</h3>
          </div>

          <div className="text-xs text-[#737373] space-y-1">
            <p>
              Storage Engine: <strong className="text-[#171717]">SQLite 3 (ACID Transactions Enabled)</strong>
            </p>
            <p>
              File Location: <code className="text-[11px] bg-[#F3F4F6] px-1.5 py-0.5 rounded text-[#171717]">server/data/restaurant.sqlite</code>
            </p>
            <p>
              All orders, products, payments, and table states are synchronously committed to disk.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResetSales}
              disabled={isResetting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Reset Orders, Kitchen Tickets & Sales to Zero</span>
            </button>

            <button
              type="button"
              onClick={handleResetDemoData}
              disabled={isResetting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FCA5A5] rounded transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Reset All System Defaults</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
