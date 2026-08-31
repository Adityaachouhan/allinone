import { useState } from 'react';
import { ShieldCheck, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from '@/lib/router';
import { useStoreSettings } from '@/context/StoreContext';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { storeSettings } = useStoreSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      // Store token using the same key api() reads for all subsequent requests
      localStorage.setItem('aio_token', data.token);
      localStorage.setItem('aio_session', JSON.stringify({ user: { id: data.admin.id, email: data.admin.email }, isAdmin: true }));
      window.location.href = '/admin/dashboard';
    } catch {
      setError('Incorrect email or password.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            {storeSettings.logo_url ? (
              <img src={storeSettings.logo_url} alt="Logo" className="h-14 w-14 rounded-xl object-cover border" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-white font-bold">
                <ShieldCheck size={28} />
              </div>
            )}
            <h1 className="mt-3 font-heading text-xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500">{storeSettings.store_name || 'All In One'} — Staff Login</p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="label">Admin Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="admin@allinone.shop"
                  required
                />
              </div>
            </div>
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
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-600">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In to Admin Panel'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-500">
            Demo: admin@allinone.shop / admin123
          </p>

          <button
            onClick={() => navigate('/')}
            className="mt-5 flex w-full items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft size={14} /> Back to store
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Authorized staff only. Connected to PostgreSQL.
        </p>
      </div>
    </div>
  );
}
