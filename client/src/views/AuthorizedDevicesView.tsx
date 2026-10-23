import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  UserCheck, 
  Trash2, 
  Sliders, 
  History, 
  X, 
  Lock, 
  Check, 
  Copy,
  AlertCircle
} from 'lucide-react';
import { AuthorizedDevice, StaffMember, DeviceAuditLog, DevicePolicySettings } from '../types';
import { api } from '../services/api';
import { formatDateTime } from '../utils/formatters';

interface AuthorizedDevicesViewProps {
  currentAdminName?: string;
}

export const AuthorizedDevicesView: React.FC<AuthorizedDevicesViewProps> = ({
  currentAdminName = 'Restaurant Admin',
}) => {
  const [devices, setDevices] = useState<AuthorizedDevice[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<DeviceAuditLog[]>([]);
  const [policy, setPolicy] = useState<DevicePolicySettings>({ maxDevicesPerEmployee: 2 });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modals & Panels
  const [selectedDevice, setSelectedDevice] = useState<AuthorizedDevice | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState<boolean>(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);

  // Approve Modal Form State
  const [assignedUserId, setAssignedUserId] = useState<string>('');
  const [permittedRoles, setPermittedRoles] = useState<string[]>(['order_taker']);
  const [customDeviceName, setCustomDeviceName] = useState<string>('');

  // Revoke / Reject Reason State
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);

  // Limit policy state
  const [newMaxLimit, setNewMaxLimit] = useState<number>(2);

  // Notification Toast
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState<string | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [devs, staff, policyData] = await Promise.all([
        api.getAdminDevices(),
        api.getStaff(),
        api.getDevicePolicySettings(),
      ]);
      setDevices(devs || []);
      setStaffList(staff || []);
      if (policyData) {
        setPolicy(policyData);
        setNewMaxLimit(policyData.maxDevicesPerEmployee);
      }
    } catch (err: any) {
      console.error('Failed to load device management data:', err);
      showNotification('Failed to load registered devices', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const loadAuditLogs = async () => {
    try {
      const logs = await api.getDeviceAuditLogs();
      setAuditLogs(logs || []);
      setIsAuditModalOpen(true);
    } catch (err: any) {
      showNotification('Could not retrieve audit history', 'error');
    }
  };

  // Open Approval Dialog
  const handleOpenApprove = (dev: AuthorizedDevice) => {
    setSelectedDevice(dev);
    setCustomDeviceName(dev.device_name);
    setAssignedUserId(dev.assigned_user_id || (staffList.length > 0 ? staffList[0].id : ''));
    setPermittedRoles(dev.permitted_roles && dev.permitted_roles.length > 0 ? dev.permitted_roles : ['order_taker']);
    setIsApproveModalOpen(true);
  };

  // Submit Approval
  const handleSubmitApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    if (permittedRoles.length === 0) {
      showNotification('Select at least one permitted role for this terminal', 'error');
      return;
    }

    try {
      setActionLoading(true);
      await api.approveDevice(selectedDevice.id, {
        assignedUserId: assignedUserId || undefined,
        permittedRoles,
        deviceName: customDeviceName.trim() || undefined,
        adminName: currentAdminName,
      });
      showNotification(`Terminal '${customDeviceName || selectedDevice.device_name}' approved successfully`);
      setIsApproveModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to approve device', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Reject Dialog
  const handleOpenReject = (dev: AuthorizedDevice) => {
    setSelectedDevice(dev);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;

    try {
      setActionLoading(true);
      await api.rejectDevice(selectedDevice.id, {
        reason: rejectReason.trim() || undefined,
        adminName: currentAdminName,
      });
      showNotification(`Device '${selectedDevice.device_name}' rejected`);
      setIsRejectModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to reject device', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Revoke Dialog
  const handleOpenRevoke = (dev: AuthorizedDevice) => {
    setSelectedDevice(dev);
    setRevokeReason('Administrator authorization revoked.');
    setIsRevokeModalOpen(true);
  };

  const handleSubmitRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;

    try {
      setActionLoading(true);
      await api.revokeDevice(selectedDevice.id, {
        reason: revokeReason.trim() || undefined,
        adminName: currentAdminName,
      });
      showNotification(`Device '${selectedDevice.device_name}' revoked. All sessions terminated immediately.`);
      setIsRevokeModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to revoke device', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Device Record
  const handleDeleteDevice = async (dev: AuthorizedDevice) => {
    if (!window.confirm(`Permanently remove '${dev.device_name}' from the security registry?`)) {
      return;
    }

    try {
      setActionLoading(true);
      await api.deleteDevice(dev.id);
      showNotification(`Terminal '${dev.device_name}' deleted`);
      loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete device', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Policy Limit
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await api.updateDevicePolicySettings(newMaxLimit);
      setPolicy({ maxDevicesPerEmployee: newMaxLimit });
      showNotification(`Device policy updated: max ${newMaxLimit} devices per employee`);
      setIsPolicyModalOpen(false);
    } catch (err: any) {
      showNotification(err.message || 'Failed to update policy', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFingerprint(text);
    setTimeout(() => setCopiedFingerprint(null), 2000);
  };

  // Counters
  const pendingCount = devices.filter(d => d.status === 'pending').length;
  const approvedCount = devices.filter(d => d.status === 'approved').length;
  const revokedCount = devices.filter(d => d.status === 'revoked' || d.status === 'rejected').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F4F7F4] overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-leaf-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-leaf-950 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-leaf-700" />
              Authorized Devices
            </h1>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-500 text-white text-[11px] font-bold rounded-full animate-pulse">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-secondary-text mt-0.5">
            Cryptographic hardware authorization &bull; Restrict terminals to specific staff roles
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPolicyModalOpen(true)}
            className="px-3 py-1.5 bg-white border border-leaf-200 hover:bg-leaf-50 text-leaf-900 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-leaf-700" />
            Device Policy (Max: {policy.maxDevicesPerEmployee})
          </button>

          <button
            type="button"
            onClick={loadAuditLogs}
            className="px-3 py-1.5 bg-white border border-leaf-200 hover:bg-leaf-50 text-leaf-900 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-leaf-700" />
            Audit Logs
          </button>

          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className="p-2 bg-leaf-100 hover:bg-leaf-200 text-leaf-800 rounded-lg transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`mx-6 mt-4 p-3 rounded-xl text-xs font-medium flex items-center justify-between shadow-sm border ${
          notification.type === 'error'
            ? 'bg-red-50 text-red-800 border-red-200'
            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-600" /> : <Check className="w-4 h-4 text-emerald-600" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Summary Pill Bar */}
      <div className="px-6 pt-4 pb-2 flex items-center gap-4 text-xs font-medium text-secondary-text">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Approved: <strong className="text-leaf-950 font-bold">{approvedCount}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Pending Approval: <strong className="text-leaf-950 font-bold">{pendingCount}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          Revoked/Rejected: <strong className="text-leaf-950 font-bold">{revokedCount}</strong>
        </span>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white border border-leaf-200 rounded-2xl shadow-sm overflow-hidden">
          {devices.length === 0 ? (
            <div className="p-12 text-center text-secondary-text">
              <Smartphone className="w-10 h-10 text-leaf-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-leaf-950">No Devices Registered Yet</h3>
              <p className="text-xs text-secondary-text max-w-sm mx-auto mt-1">
                When employees log in from cashier stations, waiter handhelds, or admin laptops, authorization requests will appear here for verification.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAFBF9] border-b border-leaf-200 text-leaf-800 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3 px-4">Device Name & Fingerprint</th>
                    <th className="py-3 px-4">Assigned Employee</th>
                    <th className="py-3 px-4">Permitted Roles</th>
                    <th className="py-3 px-4">Approval Status</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-leaf-100 font-sans">
                  {devices.map((dev) => {
                    const isPending = dev.status === 'pending';
                    const isApproved = dev.status === 'approved';
                    const isRevoked = dev.status === 'revoked';
                    const isRejected = dev.status === 'rejected';

                    return (
                      <tr key={dev.id} className="hover:bg-leaf-50/50 transition-colors">
                        {/* Device Name & Fingerprint */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isApproved ? 'bg-emerald-100 text-emerald-800' :
                              isPending ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              <Smartphone className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-leaf-950 text-xs flex items-center gap-1.5">
                                {dev.device_name}
                                {dev.active_sessions_count && dev.active_sessions_count > 0 ? (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active session online" />
                                ) : null}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] font-mono text-secondary-text mt-0.5">
                                <span>{dev.device_fingerprint_hash.substring(0, 12)}...</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(dev.device_fingerprint_hash)}
                                  className="text-leaf-600 hover:text-leaf-900 p-0.5"
                                  title="Copy fingerprint"
                                >
                                  {copiedFingerprint === dev.device_fingerprint_hash ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Assigned Employee */}
                        <td className="py-3.5 px-4">
                          {dev.assigned_employee_name ? (
                            <div className="font-semibold text-leaf-950">
                              {dev.assigned_employee_name}
                              {dev.assigned_employee_role && (
                                <span className="block text-[10px] text-secondary-text uppercase tracking-wider font-normal">
                                  Role: {dev.assigned_employee_role}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-secondary-text italic text-[11px]">Unassigned (Any Permitted Staff)</span>
                          )}
                        </td>

                        {/* Permitted Roles */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {dev.permitted_roles && dev.permitted_roles.map((r) => (
                              <span
                                key={r}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                  r === 'admin'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : r === 'cashier'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {r === 'order_taker' ? 'Waiter / Order' : r}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Approval Status */}
                        <td className="py-3.5 px-4">
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Approved
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                              <Clock className="w-3 h-3" /> Pending Review
                            </span>
                          )}
                          {isRevoked && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                              <XCircle className="w-3 h-3" /> Revoked
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                              <XCircle className="w-3 h-3" /> Rejected
                            </span>
                          )}
                        </td>

                        {/* Last Activity */}
                        <td className="py-3.5 px-4 text-secondary-text text-[11px]">
                          {dev.last_active_at ? formatDateTime(dev.last_active_at) : 'Never'}
                          {dev.ip_address && (
                            <span className="block text-[10px] text-gray-400 font-mono">
                              IP: {dev.ip_address}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenApprove(dev)}
                                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" /> Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReject(dev)}
                                  className="px-2.5 py-1 bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {isApproved && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenApprove(dev)}
                                  className="px-2 py-1 bg-white border border-leaf-200 hover:bg-leaf-50 text-leaf-800 rounded-lg text-xs font-medium"
                                  title="Change roles or assigned user"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenRevoke(dev)}
                                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition-colors"
                                  title="Immediately revoke device and terminate sessions"
                                >
                                  Revoke
                                </button>
                              </>
                            )}

                            {(isRevoked || isRejected) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenApprove(dev)}
                                  className="px-2.5 py-1 bg-leaf-700 hover:bg-leaf-800 text-white rounded-lg text-xs font-semibold transition-colors"
                                >
                                  Re-Authorize
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDevice(dev)}
                                  className="p-1 text-gray-400 hover:text-red-700 transition-colors"
                                  title="Delete device"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. APPROVE / REASSIGN DEVICE MODAL                       */}
      {/* ========================================================= */}
      {isApproveModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-leaf-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-leaf-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-tight">Authorize Terminal Device</h3>
              </div>
              <button onClick={() => setIsApproveModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmitApprove} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-leaf-950 mb-1">Device Friendly Name</label>
                <input
                  type="text"
                  value={customDeviceName}
                  onChange={(e) => setCustomDeviceName(e.target.value)}
                  placeholder="e.g. Counter POS Terminal 1, Floor Waiter Tablet"
                  className="w-full px-3 py-2 text-xs border border-leaf-300 rounded-xl focus:ring-2 focus:ring-leaf-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-leaf-950 mb-1">
                  Assign to Employee (Optional / Shared Terminal)
                </label>
                <select
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-leaf-300 rounded-xl focus:ring-2 focus:ring-leaf-600 focus:outline-none bg-white"
                >
                  <option value="">All Authorized Staff (Shared Terminal)</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.role === 'order_taker' ? 'Waiter' : st.role})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-secondary-text mt-0.5 block">
                  Enforces device limit policy (max {policy.maxDevicesPerEmployee} devices per employee).
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-leaf-950 mb-1.5">
                  Permitted Interface Roles on this Device
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2.5 border border-leaf-200 rounded-xl hover:bg-leaf-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permittedRoles.includes('order_taker')}
                      onChange={(e) => {
                        if (e.target.checked) setPermittedRoles([...permittedRoles, 'order_taker']);
                        else setPermittedRoles(permittedRoles.filter(r => r !== 'order_taker'));
                      }}
                      className="rounded text-leaf-700 focus:ring-leaf-600"
                    />
                    <div className="text-xs">
                      <strong className="text-leaf-950 font-bold block">Waiter / Order Taker Interface</strong>
                      <span className="text-[11px] text-secondary-text">Allows order taking and table assignment from mobile/tablet</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 border border-leaf-200 rounded-xl hover:bg-leaf-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permittedRoles.includes('cashier')}
                      onChange={(e) => {
                        if (e.target.checked) setPermittedRoles([...permittedRoles, 'cashier']);
                        else setPermittedRoles(permittedRoles.filter(r => r !== 'cashier'));
                      }}
                      className="rounded text-leaf-700 focus:ring-leaf-600"
                    />
                    <div className="text-xs">
                      <strong className="text-leaf-950 font-bold block">Cashier POS Interface</strong>
                      <span className="text-[11px] text-secondary-text">Allows billing, payment processing, and receipt printing</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 border border-leaf-200 rounded-xl hover:bg-leaf-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permittedRoles.includes('admin')}
                      onChange={(e) => {
                        if (e.target.checked) setPermittedRoles([...permittedRoles, 'admin']);
                        else setPermittedRoles(permittedRoles.filter(r => r !== 'admin'));
                      }}
                      className="rounded text-leaf-700 focus:ring-leaf-600"
                    />
                    <div className="text-xs">
                      <strong className="text-leaf-950 font-bold block">Administrator Dashboard</strong>
                      <span className="text-[11px] text-secondary-text">Full management, sales reports, and device authorization access</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-leaf-100">
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(false)}
                  className="px-4 py-2 border border-leaf-200 rounded-xl text-xs font-semibold text-leaf-800 hover:bg-leaf-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-leaf-800 hover:bg-leaf-900 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-60"
                >
                  {actionLoading ? 'Saving Authorization...' : 'Confirm Authorization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. REVOKE DEVICE CONFIRMATION MODAL                      */}
      {/* ========================================================= */}
      {isRevokeModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-md w-full overflow-hidden">
            <div className="p-5 bg-red-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-200" />
                <h3 className="font-bold text-sm tracking-tight">Revoke Terminal Access</h3>
              </div>
              <button onClick={() => setIsRevokeModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmitRevoke} className="p-6 space-y-4">
              <p className="text-xs text-red-900 leading-relaxed bg-red-50 p-3 rounded-xl border border-red-200 font-medium">
                Are you sure you want to revoke <strong>{selectedDevice.device_name}</strong>?
                This will immediately invalidate all active sessions and block this terminal from querying or posting orders.
              </p>

              <div>
                <label className="block text-xs font-semibold text-leaf-950 mb-1">Reason for Revocation</label>
                <input
                  type="text"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. Device lost, employee shift ended, unauthorized terminal"
                  className="w-full px-3 py-2 text-xs border border-leaf-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-leaf-100">
                <button
                  type="button"
                  onClick={() => setIsRevokeModalOpen(false)}
                  className="px-4 py-2 border border-leaf-200 rounded-xl text-xs font-semibold text-leaf-800 hover:bg-leaf-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-60"
                >
                  {actionLoading ? 'Revoking Access...' : 'Revoke Device Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. REJECT REQUEST MODAL                                  */}
      {/* ========================================================= */}
      {isRejectModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden">
            <div className="p-5 bg-gray-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-tight">Reject Device Request</h3>
              <button onClick={() => setIsRejectModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmitReject} className="p-6 space-y-4">
              <p className="text-xs text-secondary-text leading-relaxed">
                Reject authorization request from <strong>{selectedDevice.device_name}</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-leaf-950 mb-1">Reason (Optional)</label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Unknown hardware, personal device not permitted"
                  className="w-full px-3 py-2 text-xs border border-leaf-300 rounded-xl focus:ring-2 focus:ring-leaf-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-leaf-100">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 border border-leaf-200 rounded-xl text-xs font-semibold text-leaf-800 hover:bg-leaf-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold"
                >
                  Reject Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. AUDIT LOGS MODAL                                      */}
      {/* ========================================================= */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-leaf-200 max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-leaf-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-tight">Device Authorization Audit History</h3>
              </div>
              <button onClick={() => setIsAuditModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto divide-y divide-leaf-100 text-xs">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-secondary-text">No audit events recorded yet.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.action.includes('APPROVED') ? 'bg-emerald-100 text-emerald-800' :
                          log.action.includes('REVOKED') || log.action.includes('BLOCKED') ? 'bg-red-100 text-red-800' :
                          log.action.includes('REGISTERED') ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {log.action}
                        </span>
                        {log.device_name && (
                          <span className="font-bold text-leaf-950">{log.device_name}</span>
                        )}
                      </div>
                      <p className="text-secondary-text mt-1">{log.details || 'No additional details'}</p>
                    </div>
                    <div className="text-right text-[11px] text-gray-400 shrink-0 font-mono">
                      {formatDateTime(log.created_at)}
                      {log.ip_address && <div className="text-[10px]">IP: {log.ip_address}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-[#FAFBF9] border-t border-leaf-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2 bg-leaf-800 text-white rounded-xl text-xs font-semibold hover:bg-leaf-900"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. POLICY SETTINGS MODAL                                 */}
      {/* ========================================================= */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-leaf-200 max-w-sm w-full overflow-hidden">
            <div className="p-5 bg-leaf-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-tight">Device Limit Policy</h3>
              </div>
              <button onClick={() => setIsPolicyModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <form onSubmit={handleSavePolicy} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-leaf-950 mb-1">
                  Maximum Authorized Devices Per Employee
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newMaxLimit}
                  onChange={(e) => setNewMaxLimit(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-xs border border-leaf-300 rounded-xl focus:ring-2 focus:ring-leaf-600 focus:outline-none"
                  required
                />
                <span className="text-[11px] text-secondary-text mt-1 block">
                  Prevents staff from authorizing unlimited personal devices. Exceeding this limit prevents approval unless an old device is revoked.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-leaf-100">
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="px-4 py-2 border border-leaf-200 rounded-xl text-xs font-semibold text-leaf-800 hover:bg-leaf-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-leaf-800 hover:bg-leaf-900 text-white rounded-xl text-xs font-bold"
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
