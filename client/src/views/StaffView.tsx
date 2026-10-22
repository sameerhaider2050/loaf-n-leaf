import React, { useState, useEffect } from 'react';
import { 
  Users, 
  KeyRound, 
  Plus, 
  ShieldCheck, 
  UserCheck, 
  Trash2, 
  Edit3, 
  Check, 
  AlertCircle,
  X,
  Lock,
  RefreshCw
} from 'lucide-react';
import { StaffMember } from '../types';
import { api } from '../services/api';
import { formatDateTime } from '../utils/formatters';

export const StaffView: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Modals
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');

  const [isAddStaffOpen, setIsAddStaffOpen] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffEmail, setNewStaffEmail] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<'admin' | 'cashier'>('cashier');
  const [newStaffPass, setNewStaffPass] = useState<string>('');
  const [newStaffPin, setNewStaffPin] = useState<string>('');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await api.getStaff();
      setStaffList(data);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Admin updates password or PIN of staff member
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (!newPassword.trim() && !newPin.trim()) {
      showNotification('Please enter at least a new password or PIN', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.updateStaffPassword(selectedStaff.id, newPassword.trim() || undefined, newPin.trim() || undefined);
      showNotification(`Credentials updated successfully for ${selectedStaff.name}`);
      setIsPasswordModalOpen(false);
      setNewPassword('');
      setNewPin('');
      fetchStaff();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update credentials', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin creates new staff account
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPass.trim()) {
      showNotification('Name, email, and password are required', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.createStaff({
        name: newStaffName.trim(),
        email: newStaffEmail.trim(),
        role: newStaffRole,
        password: newStaffPass.trim(),
        pin: newStaffPin.trim() || undefined,
      });
      showNotification(`New ${newStaffRole.toUpperCase()} account created successfully!`);
      setIsAddStaffOpen(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPass('');
      setNewStaffPin('');
      fetchStaff();
    } catch (err: any) {
      showNotification(err.message || 'Failed to create staff account', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin deletes staff account
  const handleDeleteStaff = async (staff: StaffMember) => {
    if (window.confirm(`Are you sure you want to remove ${staff.name} (${staff.role.toUpperCase()})?`)) {
      try {
        await api.deleteStaff(staff.id);
        showNotification(`Staff member ${staff.name} removed`);
        fetchStaff();
      } catch (err: any) {
        showNotification(err.message || 'Failed to delete staff member', 'error');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAF8] overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white border-b border-border-color p-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-primary-text tracking-tight">
              Staff & Password Management
            </h2>
            <span className="text-[10px] font-semibold text-leaf-800 bg-leaf-100 px-2 py-0.5 rounded-full border border-leaf-300">
              Admin Control
            </span>
          </div>
          <p className="text-xs text-secondary-text mt-0.5">
            Configure accounts, roles, access PINs, and set passwords for Admins and Cashiers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddStaffOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-leaf-700 hover:bg-leaf-800 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Staff Member</span>
          </button>
          <button
            type="button"
            onClick={fetchStaff}
            className="p-1.5 rounded-lg border border-border-color hover:bg-surface-subtle text-secondary-text"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className="p-4">
          <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            notification.type === 'success' 
              ? 'bg-leaf-50 border-leaf-300 text-leaf-800' 
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}>
            {notification.type === 'success' ? (
              <Check className="w-4 h-4 text-leaf-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Staff Table */}
      <div className="p-4">
        <div className="bg-white rounded-xl border border-border-color shadow-subtle overflow-hidden">
          <div className="px-4 py-3 border-b border-border-color bg-surface-subtle flex items-center justify-between">
            <span className="text-xs font-bold text-primary-text">Active Restaurant Staff</span>
            <span className="text-xs text-secondary-text">{staffList.length} Accounts Registered</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFBF9] border-b border-border-color text-secondary-text font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Staff Name</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Email / Login</th>
                <th className="py-2.5 px-4">Terminal PIN</th>
                <th className="py-2.5 px-4">Created Date</th>
                <th className="py-2.5 px-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-secondary-text">
                    Loading staff records...
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-surface-subtle transition-colors">
                    {/* Staff Name */}
                    <td className="py-3 px-4 font-semibold text-primary-text">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          staff.role === 'admin'
                            ? 'bg-loaf-100 text-loaf-800 border border-loaf-300'
                            : 'bg-leaf-100 text-leaf-800 border border-leaf-300'
                        }`}>
                          {staff.name.charAt(0)}
                        </div>
                        <div>
                          <div>{staff.name}</div>
                          <div className="text-[10px] text-secondary-text font-mono">@{staff.username}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border uppercase ${
                        staff.role === 'admin'
                          ? 'bg-loaf-50 text-loaf-800 border-loaf-200'
                          : 'bg-leaf-50 text-leaf-800 border-leaf-200'
                      }`}>
                        {staff.role === 'admin' ? <ShieldCheck className="w-3 h-3 text-loaf-700" /> : <UserCheck className="w-3 h-3 text-leaf-700" />}
                        <span>{staff.role}</span>
                      </span>
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4 text-secondary-text font-medium">
                      {staff.email}
                    </td>

                    {/* PIN */}
                    <td className="py-3 px-4">
                      {staff.pin ? (
                        <span className="font-mono font-bold text-primary-text bg-surface-subtle px-2 py-0.5 rounded border border-border-color">
                          {staff.pin}
                        </span>
                      ) : (
                        <span className="text-secondary-text italic text-[11px]">No PIN set</span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-4 text-secondary-text text-[11px]">
                      {formatDateTime(staff.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStaff(staff);
                            setNewPassword('');
                            setNewPin(staff.pin || '');
                            setIsPasswordModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-leaf-800 bg-leaf-50 hover:bg-leaf-100 border border-leaf-300 rounded-md transition-colors flex items-center gap-1"
                          title="Set Password & PIN"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Set Password / PIN</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(staff)}
                          className="p-1 text-secondary-text hover:text-rose-600 hover:bg-rose-50 rounded border border-border-color transition-colors"
                          title="Remove Staff Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Set Password / PIN Modal */}
      {isPasswordModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
          <div 
            className="bg-white rounded-xl border border-leaf-200 shadow-modal w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-color bg-leaf-50">
              <div>
                <h3 className="text-xs font-bold text-leaf-900">Set Password & PIN</h3>
                <p className="text-[10px] text-leaf-700">For {selectedStaff.name} ({selectedStaff.role.toUpperCase()})</p>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-secondary-text hover:text-primary-text p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-primary-text mb-1">
                  New Password (Optional if only setting PIN)
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="e.g. cashier2026 or newSecret123"
                  className="w-full px-3 py-1.5 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600 font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-medium text-primary-text mb-1">
                  4-Digit Terminal Quick PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="e.g. 5678"
                  className="w-full px-3 py-1.5 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600 font-mono tracking-widest text-center text-sm"
                />
                <p className="text-[10px] text-secondary-text mt-1">
                  Used by cashiers to sign into the register with 1 tap.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-secondary-text border border-border-color rounded-lg hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-leaf-700 hover:bg-leaf-800 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Save Password & PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Member Modal */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
          <div 
            className="bg-white rounded-xl border border-leaf-200 shadow-modal w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-color bg-leaf-50">
              <h3 className="text-sm font-bold text-leaf-900">Add New Staff Member</h3>
              <button
                onClick={() => setIsAddStaffOpen(false)}
                className="text-secondary-text hover:text-primary-text p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-primary-text mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full px-3 py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-primary-text mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    placeholder="tariq@loafnleaf.com"
                    className="w-full px-3 py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
                  />
                </div>

                <div>
                  <label className="block font-medium text-primary-text mb-1">
                    Role *
                  </label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600 bg-white"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="admin">Admin / Manager</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-primary-text mb-1">
                    Password *
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaffPass}
                    onChange={(e) => setNewStaffPass(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-primary-text mb-1">
                    Quick PIN (4 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value)}
                    placeholder="e.g. 7890"
                    className="w-full px-3 py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600 font-mono tracking-widest text-center"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-secondary-text border border-border-color rounded-lg hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-leaf-700 hover:bg-leaf-800 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
