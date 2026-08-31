import { type ReactNode } from 'react';
import {
  LayoutDashboard, Package, Tags, ShoppingBag, Users, Image, Truck,
  LogOut, Leaf, Menu, Settings, Bell, X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useRoute } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/context/StoreContext';

const navItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/categories', label: 'Categories', icon: Tags },
  { path: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/admin/customers', label: 'Customers', icon: Users },
  { path: '/admin/banners', label: 'Banners', icon: Image },
  { path: '/admin/delivery', label: 'Delivery', icon: Truck },
  { path: '/admin/store-settings', label: 'Store Settings', icon: Settings },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const route = useRoute();
  const { profile, signOut } = useAuth();
  const { storeSettings } = useStoreSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    navigate('/');
    await signOut();
  };

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  useEffect(() => {
    // Only connect if user is admin
    const profileRole = (profile as { role?: string })?.role;
    if (profile?.app_role !== 'admin' && profileRole !== 'owner' && profileRole !== 'staff') {
      return;
    }

    const eventSource = new EventSource('/api/admin/notifications/stream');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'new_order') {
          setToast({ message: `New Order Received: #${data.orderNumber}`, visible: true });
          // Auto hide after 5 seconds
          setTimeout(() => {
            setToast((t) => t ? { ...t, visible: false } : null);
          }, 5000);
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [profile]);

  const Sidebar = (
    <div className="flex h-full flex-col bg-gray-900 text-gray-300">
      <div className="flex items-center gap-2 border-b border-gray-800 p-5">
        {storeSettings.logo_url ? (
          <img src={storeSettings.logo_url} alt="Logo" className="h-9 w-9 rounded-lg object-cover border border-gray-700" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
            <Leaf size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-white truncate">{storeSettings.store_name || 'All In One'}</p>
          <p className="text-xs text-gray-400">Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = route.path === item.path;
          return (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={18} /> {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-white">
            {profile?.full_name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{profile?.full_name || 'Admin'}</p>
            <p className="truncate text-xs text-gray-400">{profile?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">{Sidebar}</aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-60 animate-slide-down">
            {Sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-60">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <span className="font-heading font-bold text-primary-700">Admin</span>
          <div className="w-6" />
        </div>

        <main className="p-4 sm:p-6">{children}</main>
      </div>

      {/* Floating Toast Notification */}
      {toast && toast.visible && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className="flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-white shadow-lg border border-gray-700">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/20 text-primary-400">
              <Bell size={18} className="animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-medium">{toast.message}</p>
              <button onClick={() => { navigate('/admin/orders'); setToast({ ...toast, visible: false }); }} className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                View Order →
              </button>
            </div>
            <button onClick={() => setToast({ ...toast, visible: false })} className="ml-2 text-gray-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
