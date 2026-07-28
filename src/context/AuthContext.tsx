import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as db from '@/lib/db';
import type { LocalSession } from '@/lib/db';
import type { AppRole, Profile } from '@/types';

type AuthContextValue = {
  session: LocalSession | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<LocalSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const p = await db.getProfile(uid);
    setProfile(p);
  };

  useEffect(() => {
    const existing = db.getSession();
    setSessionState(existing);
    if (existing) {
      loadProfile(existing.user.id).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const refreshProfile = async () => {
    const current = db.getSession();
    setSessionState(current);
    if (current) await loadProfile(current.user.id);
    else setProfile(null);
  };

  const signOut = async () => {
    db.signOut();
    setProfile(null);
    setSessionState(null);
  };

  const role = profile?.app_role ?? null;
  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider
      value={{ session: session, profile, role, loading, isAdmin, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
