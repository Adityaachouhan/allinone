import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Store, PlusCircle, ScrollText, LogOut, Shield,
} from 'lucide-react';

type Page = 'dashboard' | 'tenants' | 'tenant-detail' | 'onboard' | 'audit';

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'tenants',   label: 'All Shops',   icon: Store },
  { id: 'onboard',   label: 'Onboard Shop', icon: PlusCircle },
  { id: 'audit',     label: 'Audit Log',   icon: ScrollText },
];

interface Props {
  page: Page;
  onNavigate: (p: Page) => void;
  children: ReactNode;
}

export function SuperAdminLayout({ page, onNavigate, children }: Props) {
  const { admin, logout } = useAuth();
  return (
    <div className="flex h-screen bg-surface-900 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-white/5 glass">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center animate-glow">
              <Shield className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">SaaS Admin</div>
              <div className="text-[11px] text-slate-500">Control Panel</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${page === id
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* Admin info */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-brand-500/30 border border-brand-500/40 flex items-center justify-center text-brand-400 font-bold text-sm">
              {admin?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{admin?.name}</div>
              <div className="text-[10px] text-slate-500 truncate">{admin?.role}</div>
            </div>
            <button onClick={logout} className="text-slate-500 hover:text-rose-400 transition-colors" title="Logout">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 animate-fade-in-up">
          {children}
        </div>
      </main>
    </div>
  );
}
