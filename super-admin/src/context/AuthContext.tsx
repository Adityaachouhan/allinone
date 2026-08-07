import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { getMe, login as apiLogin, clearToken, getToken, seedOwner as apiSeedOwner, type SAAdmin } from '../lib/api';

interface AuthCtx {
  admin: SAAdmin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  seedOwner: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin]   = useState<SAAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    getMe().then(setAdmin).catch(() => clearToken()).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    setAdmin(data.admin);
  };

  const seedOwner = async (name: string, email: string, password: string) => {
    const data = await apiSeedOwner(name, email, password);
    setAdmin(data.admin);
  };

  const logout = () => { clearToken(); setAdmin(null); };

  return <Ctx.Provider value={{ admin, loading, login, logout, seedOwner }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
