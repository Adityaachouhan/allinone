import { useState, useEffect } from 'react';
import { Leaf, Mail, Lock, User as UserIcon, Phone, Loader2, ArrowLeft } from 'lucide-react';
import * as db from '@/lib/db';
import { useNavigate, useRoute } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/context/StoreContext';

export function AuthPage() {
  const navigate = useNavigate();
  const route = useRoute();
  const { session, refreshProfile } = useAuth();
  const { storeSettings } = useStoreSettings();
  const redirect = route.query.redirect || '/account';

  // Redirect to account if already logged in
  useEffect(() => {
    if (session) {
      navigate(redirect);
    }
  }, [session, redirect, navigate]);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (!fullName.trim()) throw new Error('Please enter your name.');
        if (!/^\d{10}$/.test(phone)) throw new Error('Phone must be 10 digits.');
        await db.signUp({ phone, password, full_name: fullName, email });
        await refreshProfile();
        navigate(redirect);
      } else {
        if (!/^\d{10}$/.test(phone)) throw new Error('Phone must be 10 digits.');
        await db.signIn(phone, password);
        await refreshProfile();
        navigate(redirect);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(
        msg.includes('Invalid')
          ? 'Incorrect phone number or password.'
          : msg.includes('already registered')
            ? 'This phone number is already registered. Try logging in.'
            : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4 py-8 animate-fade-in">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center text-center">
            {storeSettings.logo_url ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white p-1 border border-gray-200 shadow-sm overflow-hidden">
                <img src={storeSettings.logo_url} alt={storeSettings.store_name || 'Logo'} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-white font-bold">
                <Leaf size={28} />
              </div>
            )}
            <h1 className="mt-3 font-heading text-2xl font-bold text-gray-900">
              {storeSettings.store_name || 'Grocery Mart'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {mode === 'login' ? 'Sign in to access your account & orders' : 'Create an account to start shopping'}
            </p>
          </div>

          {/* Tabs */}
          <div className="mt-6 grid grid-cols-2 rounded-xl bg-gray-100 p-1">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); }}
                className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
                  mode === m ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input pl-10"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <label className="label">Phone Number</label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="input pl-10"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  required
                />
              </div>
            </div>
            {mode === 'signup' && (
              <div>
                <label className="label">Email (optional)</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-gray-500">Minimum 6 characters.</p>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-error-50 px-3 py-2 text-sm font-medium text-error-600">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base font-semibold shadow-md">
              {loading ? <Loader2 size={18} className="animate-spin" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center justify-center gap-1.5 w-full text-sm font-medium text-gray-600 hover:text-primary-700 transition-colors"
            >
              <ArrowLeft size={16} /> Back to Store
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
