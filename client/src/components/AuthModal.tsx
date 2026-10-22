import React, { useState } from 'react';
import { 
  X, 
  KeyRound, 
  User as UserIcon, 
  ShieldCheck, 
  Lock, 
  AlertCircle,
  Check,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLoginSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'customer' | 'signup'>('staff');
  
  // Staff Login State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [usePinMode, setUsePinMode] = useState(true);

  // Customer State
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPassword, setCustomerPassword] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  // Preset demo accounts for quick one-click testing
  const demoAccounts = [
    { role: 'admin' as UserRole, name: 'Admin (Manager)', pin: '1234', pass: 'admin123', email: 'admin@loafnleaf.com' },
    { role: 'cashier' as UserRole, name: 'Ahmed Khan (Cashier)', pin: '5678', pass: 'cashier123', email: 'cashier@loafnleaf.com' },
    { role: 'cashier' as UserRole, name: 'Sara Malik (Cashier 2)', pin: '4321', pass: 'cashier123', email: 'sara@loafnleaf.com' },
  ];

  const handleQuickFill = (acc: typeof demoAccounts[0]) => {
    setIdentifier(acc.email);
    setPassword(acc.pass);
    setPinInput(acc.pin);
    setErrorMessage('');
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setErrorMessage('');
      const credentials = usePinMode
        ? { pin: pinInput.trim() }
        : { identifier: identifier.trim(), password: password.trim() };

      const user = await api.login(credentials);
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      // Simulate real Google OAuth popup return with pre-verified Google User profile
      const googleUser = await api.googleAuth({
        email: customerEmail || 'customer.guest@gmail.com',
        name: customerName || 'Loaf n Leaf Guest',
        google_id: 'google-sub-' + Date.now(),
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      });
      onLoginSuccess(googleUser);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setErrorMessage('');
      const user = await api.login({
        identifier: customerEmail.trim(),
        password: customerPassword.trim(),
      });
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Customer login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setErrorMessage('');
      const user = await api.signup({
        name: customerName.trim(),
        email: customerEmail.trim(),
        password: customerPassword.trim(),
        phone: customerPhone.trim(),
      });
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
      <div 
        className="bg-white rounded-xl border border-leaf-200 shadow-modal w-full max-w-md overflow-hidden animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header with Loaf n Leaf Brand */}
        <div className="bg-gradient-to-r from-leaf-800 to-leaf-700 text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-leaf-200 hover:text-white p-1 rounded hover:bg-leaf-600/40"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-leaf-600 flex items-center justify-center shadow-sm border border-leaf-400/40">
              <span className="text-xl">🌿</span>
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Loaf n Leaf Portal</h3>
              <p className="text-xs text-leaf-100">Select account access & authentication</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-2 gap-1 mt-4 p-0.5 bg-leaf-900/60 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setActiveTab('staff'); setErrorMessage(''); }}
              className={`py-1.5 rounded-md transition-colors ${
                activeTab === 'staff'
                  ? 'bg-white text-leaf-900 shadow-sm'
                  : 'text-leaf-200 hover:text-white'
              }`}
            >
              Staff (Admin / Cashier)
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('customer'); setErrorMessage(''); }}
              className={`py-1.5 rounded-md transition-colors ${
                activeTab !== 'staff'
                  ? 'bg-white text-leaf-900 shadow-sm'
                  : 'text-leaf-200 hover:text-white'
              }`}
            >
              Customer / User
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: STAFF (ADMIN / CASHIER) LOGIN                                      */}
          {/* ========================================================================= */}
          {activeTab === 'staff' && (
            <div className="space-y-4">
              {/* Quick Staff Switch Cards */}
              <div>
                <label className="block text-[11px] font-semibold text-secondary-text uppercase tracking-wider mb-2">
                  Select Staff Role to Sign In:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleQuickFill(acc)}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        identifier === acc.email || pinInput === acc.pin
                          ? 'border-leaf-600 bg-leaf-50 text-leaf-900 font-medium'
                          : 'border-border-color hover:bg-surface-subtle text-primary-text'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase text-leaf-700">
                        {acc.role}
                      </div>
                      <div className="text-xs font-semibold truncate leading-tight mt-0.5">
                        {acc.name.split(' ')[0]}
                      </div>
                      <div className="text-[10px] text-secondary-text mt-1">
                        PIN: <span className="font-mono font-bold text-primary-text">{acc.pin}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Toggle: Fast PIN or Password */}
              <div className="flex items-center justify-between border-t border-border-color pt-3 text-xs">
                <span className="font-medium text-secondary-text">Login Mode:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUsePinMode(true)}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${
                      usePinMode ? 'bg-leaf-700 text-white' : 'bg-surface-subtle text-secondary-text'
                    }`}
                  >
                    Quick PIN (4 Digits)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUsePinMode(false)}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${
                      !usePinMode ? 'bg-leaf-700 text-white' : 'bg-surface-subtle text-secondary-text'
                    }`}
                  >
                    Password
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleStaffLogin} className="space-y-3">
                {usePinMode ? (
                  <div>
                    <label className="block text-xs font-medium text-primary-text mb-1">
                      Enter 4-Digit Staff PIN
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="e.g. 1234 (Admin) or 5678 (Cashier)"
                      className="w-full text-center text-lg tracking-widest font-mono py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600 bg-surface-subtle"
                      autoFocus
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-primary-text mb-1">
                        Username or Email
                      </label>
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="admin or cashier@loafnleaf.com"
                        className="w-full px-3 py-2 text-xs border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-text mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 px-4 bg-leaf-700 hover:bg-leaf-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isLoading ? 'Verifying...' : 'Sign In to Terminal'}</span>
                </button>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2 & 3: CUSTOMER SIGN IN / GOOGLE AUTH / SIGN UP                       */}
          {/* ========================================================================= */}
          {activeTab !== 'staff' && (
            <div className="space-y-4">
              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-surface-subtle border border-border-color rounded-lg shadow-sm flex items-center justify-center gap-3 text-xs font-semibold text-primary-text transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-border-color w-full" />
                <span className="bg-white px-2 text-[11px] text-secondary-text uppercase font-semibold">
                  Or Email
                </span>
                <div className="border-t border-border-color w-full" />
              </div>

              {activeTab === 'customer' ? (
                /* Customer Login */
                <form onSubmit={handleCustomerLogin} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-primary-text mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3 py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-primary-text mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={customerPassword}
                      onChange={(e) => setCustomerPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2 bg-leaf-700 hover:bg-leaf-800 text-white font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </button>

                  <div className="text-center text-[11px] text-secondary-text pt-1">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('signup')}
                      className="text-leaf-700 font-semibold hover:underline"
                    >
                      Sign Up here
                    </button>
                  </div>
                </form>
              ) : (
                /* Customer Signup */
                <form onSubmit={handleCustomerSignup} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-primary-text mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Zainab Tariq"
                      className="w-full px-3 py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-primary-text mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="zainab@gmail.com"
                      className="w-full px-3 py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-primary-text mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={customerPassword}
                      onChange={(e) => setCustomerPassword(e.target.value)}
                      placeholder="Create a password"
                      className="w-full px-3 py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-primary-text mb-1">
                      Mobile Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+92 300 1234567"
                      className="w-full px-3 py-2 border border-border-color rounded-lg focus:outline-none focus:border-leaf-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2 bg-leaf-700 hover:bg-leaf-800 text-white font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </button>

                  <div className="text-center text-[11px] text-secondary-text pt-1">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('customer')}
                      className="text-leaf-700 font-semibold hover:underline"
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
