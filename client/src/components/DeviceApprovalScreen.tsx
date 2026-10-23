import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Smartphone, 
  RefreshCw, 
  Clock, 
  XCircle, 
  CheckCircle2, 
  Copy, 
  Check, 
  Lock, 
  ArrowLeft,
  Info,
  Server,
  KeyRound,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { api } from '../services/api';
import { deviceCrypto, getDevicePlatformInfo } from '../services/deviceCrypto';
import { DeviceStatus } from '../types';

interface DeviceApprovalScreenProps {
  status: DeviceStatus | 'role_mismatch' | 'unknown';
  deviceFingerprint: string;
  initialDeviceName?: string;
  errorMessage?: string;
  permittedRoles?: string[];
  userRole?: string;
  onApproved: () => void;
  onBackToLogin: () => void;
}

export const DeviceApprovalScreen: React.FC<DeviceApprovalScreenProps> = ({
  status: initialStatus,
  deviceFingerprint,
  initialDeviceName = '',
  errorMessage,
  permittedRoles = [],
  userRole,
  onApproved,
  onBackToLogin,
}) => {
  const [currentStatus, setCurrentStatus] = useState<DeviceStatus | 'role_mismatch' | 'unknown'>(initialStatus);
  const [deviceName, setDeviceName] = useState<string>(initialDeviceName);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Owner / Admin Elevation State
  const [isElevating, setIsElevating] = useState<boolean>(false);
  const [elevationMode, setElevationMode] = useState<'pin' | 'credentials'>('pin');
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminIdentInput, setAdminIdentInput] = useState<string>('admin');
  const [adminPassInput, setAdminPassInput] = useState<string>('');
  const [rolesToGrant, setRolesToGrant] = useState<string[]>(['admin', 'cashier', 'order_taker']);
  const [devLoading, setDevLoading] = useState<boolean>(false);

  const isLocalHost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const platformInfo = getDevicePlatformInfo();

  // Check device status periodically or manually
  const checkStatus = async () => {
    try {
      setIsChecking(true);
      const res = await api.getDeviceStatus(deviceFingerprint);
      if (res && res.status) {
        setCurrentStatus(res.status);
        if (res.name && !deviceName) {
          setDeviceName(res.name);
        }
        if (res.status === 'approved') {
          setFeedback('Device approved! Re-establishing session...');
          setTimeout(() => {
            onApproved();
          }, 1200);
        }
      }
    } catch (err: any) {
      console.error('Failed to check device status:', err);
    } finally {
      setIsChecking(false);
    }
  };

  // Owner / Admin Elevation Handler
  const handleOwnerAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsElevating(true);
      setFeedback(null);

      // 1. Get challenge nonce
      const challenge = await api.getDeviceChallenge(deviceFingerprint);

      // 2. Cryptographically sign challenge nonce with private key
      const signature = await deviceCrypto.signChallenge(challenge.nonce);
      const { identity } = await deviceCrypto.getOrCreateDeviceIdentity();

      // 3. Post to owner-authorize-terminal
      const payload: any = {
        deviceFingerprint,
        publicKeySpki: identity.publicKeySpki,
        challengeId: challenge.challengeId,
        signature,
        rolesToAuthorize: rolesToGrant,
        deviceName: deviceName.trim() || undefined,
      };

      if (elevationMode === 'pin') {
        if (!adminPinInput.trim()) {
          setFeedback('Please enter the administrator PIN');
          setIsElevating(false);
          return;
        }
        payload.adminPin = adminPinInput.trim();
      } else {
        if (!adminIdentInput.trim() || !adminPassInput.trim()) {
          setFeedback('Please enter administrator username and password');
          setIsElevating(false);
          return;
        }
        payload.adminIdentifier = adminIdentInput.trim();
        payload.adminPassword = adminPassInput.trim();
      }

      const res = await api.ownerAuthorizeTerminal(payload);

      // Store approved session
      deviceCrypto.saveSession({
        sessionToken: res.sessionToken,
        deviceId: res.device.id,
        deviceName: res.device.name,
        permittedRoles: res.device.permittedRoles,
        user: res.user,
        savedAt: new Date().toISOString(),
      });

      setFeedback(`Terminal authorized for Administrator access by ${res.user.name}! Opening Admin Dashboard...`);
      setTimeout(() => {
        onApproved();
      }, 1000);
    } catch (err: any) {
      setFeedback(err.message || 'Authorization failed. Please verify administrator credentials.');
    } finally {
      setIsElevating(false);
    }
  };

  // Dev-Only Helper
  const handleDevAuthorize = async () => {
    try {
      setDevLoading(true);
      const res = await api.devAuthorizeLocalTerminal(deviceFingerprint, deviceName);
      setFeedback(res.message + ' Please wait while session refreshes...');
      setTimeout(() => {
        checkStatus();
      }, 1000);
    } catch (err: any) {
      setFeedback(err.message || 'Dev authorization failed');
    } finally {
      setDevLoading(false);
    }
  };

  // Poll for status every 5 seconds while in pending state
  useEffect(() => {
    if (currentStatus === 'pending') {
      const interval = setInterval(checkStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [currentStatus, deviceFingerprint]);

  const handleCopyFingerprint = () => {
    navigator.clipboard.writeText(deviceFingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) return;
    try {
      await deviceCrypto.updateDeviceName(deviceName.trim());
      await api.requestDeviceApproval({
        deviceFingerprint,
        deviceName: deviceName.trim(),
        notes: notes.trim() || undefined,
      });
      setIsEditingName(false);
      setFeedback('Device label updated for administrator review.');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback(err.message || 'Failed to update device label.');
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#F4F7F4] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-leaf-200 overflow-hidden">
        {/* Top Status Banner */}
        <div className={`p-6 text-white ${
          currentStatus === 'pending' ? 'bg-amber-600' :
          currentStatus === 'revoked' ? 'bg-red-700' :
          currentStatus === 'rejected' ? 'bg-red-800' :
          currentStatus === 'role_mismatch' ? 'bg-orange-700' :
          'bg-leaf-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white">
              {currentStatus === 'pending' && <Clock className="w-6 h-6 animate-pulse" />}
              {currentStatus === 'revoked' && <XCircle className="w-6 h-6" />}
              {currentStatus === 'rejected' && <XCircle className="w-6 h-6" />}
              {currentStatus === 'role_mismatch' && <ShieldAlert className="w-6 h-6" />}
              {currentStatus === 'approved' && <CheckCircle2 className="w-6 h-6 text-emerald-300" />}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold opacity-90">
                Device Authorization System
              </div>
              <h1 className="text-lg font-bold tracking-tight">
                {currentStatus === 'pending' && 'Device Approval Pending'}
                {currentStatus === 'revoked' && 'Device Access Revoked'}
                {currentStatus === 'rejected' && 'Device Request Rejected'}
                {currentStatus === 'role_mismatch' && 'Role Not Permitted on Terminal'}
                {currentStatus === 'approved' && 'Device Authorized'}
              </h1>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* Status Message */}
          <div className={`p-4 rounded-xl text-sm border leading-relaxed ${
            currentStatus === 'pending' 
              ? 'bg-amber-50 border-amber-200 text-amber-900' 
              : currentStatus === 'revoked'
              ? 'bg-red-50 border-red-200 text-red-900'
              : currentStatus === 'role_mismatch'
              ? 'bg-orange-50 border-orange-200 text-orange-900'
              : 'bg-leaf-50 border-leaf-200 text-leaf-900'
          }`}>
            {currentStatus === 'pending' && (
              <p>
                <strong>Administrator verification required.</strong> This terminal is registered in the security vault with a non-extractable cryptographic key. An authorized restaurant administrator must approve this device in the <strong>Admin Dashboard &rarr; Authorized Devices</strong> before staff operations can proceed.
              </p>
            )}
            {currentStatus === 'revoked' && (
              <p>
                <strong>Access has been terminated.</strong> The restaurant administrator revoked this terminal&apos;s authorization. All active sessions and tokens have been invalidated on the server.
              </p>
            )}
            {currentStatus === 'rejected' && (
              <p>
                <strong>Device request was rejected.</strong> Contact the restaurant administrator or owner if this terminal is intended for restaurant duties.
              </p>
            )}
            {currentStatus === 'role_mismatch' && (
              <p>
                {errorMessage || `This terminal is only authorized for: [${permittedRoles.join(', ')}]. Your logged-in role is '${userRole}'. You cannot operate this interface from this terminal.`}
              </p>
            )}
          </div>

          {feedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium">
              {feedback}
            </div>
          )}

          {/* Owner / Administrator Role Authorization Section */}
          {(currentStatus === 'role_mismatch' || userRole === 'admin') && (
            <div className="bg-gradient-to-br from-[#FAFBF9] to-leaf-50/50 border border-leaf-300 rounded-xl p-4 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-leaf-950 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-leaf-700" />
                  Owner / Administrator Authorization
                </span>
                <span className="text-[10px] font-semibold bg-leaf-200/70 text-leaf-900 px-2 py-0.5 rounded-full">
                  Admin Control
                </span>
              </div>

              <p className="text-xs text-secondary-text leading-relaxed">
                If you are the restaurant owner or an authorized administrator, authenticate below to authorize this terminal for <strong>Administrator access</strong>.
              </p>

              <form onSubmit={handleOwnerAuthorize} className="space-y-3">
                <div className="flex gap-2 p-1 bg-leaf-100/70 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setElevationMode('pin')}
                    className={`flex-1 py-1 font-semibold rounded-md transition-colors ${
                      elevationMode === 'pin' ? 'bg-white text-leaf-950 shadow-xs' : 'text-leaf-800 hover:text-leaf-950'
                    }`}
                  >
                    Quick Admin PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => setElevationMode('credentials')}
                    className={`flex-1 py-1 font-semibold rounded-md transition-colors ${
                      elevationMode === 'credentials' ? 'bg-white text-leaf-950 shadow-xs' : 'text-leaf-800 hover:text-leaf-950'
                    }`}
                  >
                    Admin Password
                  </button>
                </div>

                {elevationMode === 'pin' ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-leaf-900 mb-1">
                      Administrator Master PIN
                    </label>
                    <input
                      type="password"
                      value={adminPinInput}
                      onChange={(e) => setAdminPinInput(e.target.value)}
                      placeholder="Enter Admin PIN (e.g. 2007 or 1234)"
                      maxLength={10}
                      className="w-full px-3 py-2 text-xs border border-leaf-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-leaf-600 bg-white"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-leaf-900 mb-1">
                        Admin Username / Email
                      </label>
                      <input
                        type="text"
                        value={adminIdentInput}
                        onChange={(e) => setAdminIdentInput(e.target.value)}
                        placeholder="admin"
                        className="w-full px-3 py-2 text-xs border border-leaf-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-leaf-600 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-leaf-900 mb-1">
                        Admin Password
                      </label>
                      <input
                        type="password"
                        value={adminPassInput}
                        onChange={(e) => setAdminPassInput(e.target.value)}
                        placeholder="Enter admin password (e.g. admin123)"
                        className="w-full px-3 py-2 text-xs border border-leaf-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-leaf-600 bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Roles to Grant */}
                <div>
                  <label className="block text-[11px] font-semibold text-leaf-900 mb-1.5">
                    Permitted Roles for this Terminal:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'admin', label: 'Admin' },
                      { id: 'cashier', label: 'Cashier' },
                      { id: 'order_taker', label: 'Waiter' },
                    ].map((role) => (
                      <label
                        key={role.id}
                        className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                          rolesToGrant.includes(role.id)
                            ? 'bg-leaf-800 text-white border-leaf-800 font-semibold'
                            : 'bg-white text-leaf-900 border-leaf-200 hover:bg-leaf-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={rolesToGrant.includes(role.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRolesToGrant([...rolesToGrant, role.id]);
                            } else {
                              if (rolesToGrant.length > 1) {
                                setRolesToGrant(rolesToGrant.filter((r) => r !== role.id));
                              }
                            }
                          }}
                          className="sr-only"
                        />
                        <CheckCircle2 className={`w-3.5 h-3.5 ${rolesToGrant.includes(role.id) ? 'text-white' : 'text-gray-300'}`} />
                        <span>{role.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isElevating}
                  className="w-full py-2.5 bg-leaf-800 hover:bg-leaf-900 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <KeyRound className="w-4 h-4 text-wheat-300" />
                  {isElevating ? 'Verifying Admin Signature...' : 'Authorize Terminal for Admin Access'}
                </button>
              </form>

              {/* Development-Only Local Helper */}
              {isLocalHost && (
                <div className="pt-2 border-t border-leaf-200/80 flex items-center justify-between">
                  <span className="text-[11px] text-leaf-700 font-medium flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    Dev Mode (Localhost):
                  </span>
                  <button
                    type="button"
                    onClick={handleDevAuthorize}
                    disabled={devLoading}
                    className="px-2.5 py-1 text-[11px] bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold rounded-lg transition-colors border border-amber-300 disabled:opacity-60"
                  >
                    {devLoading ? 'Authorizing...' : '⚡ 1-Click Authorize All Roles'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cryptographic Device Details Card */}
          <div className="bg-[#FAFBF9] border border-leaf-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-leaf-900 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-leaf-700" />
                Terminal Profile
              </span>
              <span className="text-[11px] font-mono bg-leaf-100 text-leaf-800 px-2 py-0.5 rounded-full font-medium">
                {platformInfo.os} &bull; {platformInfo.browser}
              </span>
            </div>

            {/* Device Name Field */}
            <div>
              <div className="text-[11px] text-secondary-text mb-1 font-medium">Device Label:</div>
              {isEditingName ? (
                <form onSubmit={handleUpdateName} className="flex gap-2">
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="e.g. Counter iPad 1, Waiter Tablet"
                    className="flex-1 px-3 py-1.5 text-xs border border-leaf-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-leaf-600 bg-white"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-leaf-700 text-white text-xs font-semibold rounded-lg hover:bg-leaf-800 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(false)}
                    className="px-2 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-leaf-200 text-xs">
                  <span className="font-semibold text-leaf-950">{deviceName || 'Unnamed Terminal'}</span>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-leaf-700 hover:text-leaf-900 text-[11px] font-medium underline"
                  >
                    Edit Label
                  </button>
                </div>
              )}
            </div>

            {/* Cryptographic Public Key Fingerprint */}
            <div>
              <div className="text-[11px] text-secondary-text mb-1 font-medium flex items-center justify-between">
                <span>Cryptographic Key Fingerprint (ECDSA P-256):</span>
                <span className="text-[10px] text-leaf-700 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Hardware/Vault Bound
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-leaf-200">
                <code className="text-[11px] font-mono text-leaf-900 flex-1 truncate select-all">
                  {deviceFingerprint}
                </code>
                <button
                  type="button"
                  onClick={handleCopyFingerprint}
                  title="Copy fingerprint"
                  className="p-1 hover:bg-leaf-100 rounded text-leaf-700 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={checkStatus}
              disabled={isChecking}
              className="w-full py-2.5 bg-leaf-800 hover:bg-leaf-900 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Checking Authorization...' : 'Check Approval Status'}
            </button>

            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full py-2.5 bg-white border border-leaf-200 hover:bg-leaf-50 text-leaf-900 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-leaf-700" />
              Return to Staff Login
            </button>
          </div>

          {/* Security Information Footer */}
          <div className="pt-2 border-t border-leaf-100 text-[11px] text-secondary-text flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-leaf-600 shrink-0 mt-0.5" />
            <span>
              Device identities are cryptographically signed using WebCrypto non-extractable keys. Random device IDs or cookies alone are not permitted to access Loaf n Leaf systems.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
