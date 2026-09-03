/**
 * src/components/admin/AdminLayout.tsx
 *
 * Wraps all admin pages with the sidebar + top-bar shell.
 * Also owns the real-time SSE connection for new-order notifications.
 *
 * Real-time flow:
 *  1. Admin logs in → AdminLayout mounts → EventSource connects to
 *     /api/admin/notifications/stream?token=<jwt>
 *     (token in query param because EventSource cannot send custom headers)
 *  2. Backend emits `new_order` SSE event after every successful order creation
 *  3. AdminLayout receives the event → deduplicate → push notification to stack
 *  4. NewOrderNotificationStack renders each card (auto-dismiss after 5 s)
 *  5. A 'new-order' CustomEvent is dispatched on window so any mounted
 *     AdminOrdersPage / AdminDashboardPage can refresh itself without a page reload
 *  6. Optional: plays a soft chime (Web Audio API) & fires browser Notification
 */

import { type ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard, Package, Tags, ShoppingBag, Users, Image, Truck,
  LogOut, Leaf, Menu, Settings,
} from 'lucide-react';
import { useNavigate, useRoute } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/context/StoreContext';
import { getToken } from '@/lib/api';
import {
  NewOrderNotificationStack,
  type OrderNotification,
} from '@/components/admin/NewOrderNotification';

const navItems = [
  { path: '/admin/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { path: '/admin/products',       label: 'Products',       icon: Package },
  { path: '/admin/categories',     label: 'Categories',     icon: Tags },
  { path: '/admin/orders',         label: 'Orders',         icon: ShoppingBag },
  { path: '/admin/customers',      label: 'Customers',      icon: Users },
  { path: '/admin/banners',        label: 'Banners',        icon: Image },
  { path: '/admin/delivery',       label: 'Delivery',       icon: Truck },
  { path: '/admin/store-settings', label: 'Store Settings', icon: Settings },
];

// ── Sound helper (Web Audio API, no extra dependency) ─────────────────────────

function playNewOrderChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const playNote = (freq: number, startTime: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Simple three-note ascending chime
    const now = ctx.currentTime;
    playNote(523.25, now,        0.25, 0.3); // C5
    playNote(659.25, now + 0.15, 0.25, 0.3); // E5
    playNote(783.99, now + 0.30, 0.45, 0.3); // G5
  } catch {
    // Autoplay restriction or unsupported — silently ignore
  }
}

// ── Browser notification helper ───────────────────────────────────────────────

let browserNotifPermission: NotificationPermission | null = null;

async function requestBrowserNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    browserNotifPermission = await Notification.requestPermission();
  } else {
    browserNotifPermission = Notification.permission;
  }
}

function fireBrowserNotification(orderNumber: string, customerName: string, total: string) {
  if (!('Notification' in window)) return;
  if ((browserNotifPermission ?? Notification.permission) !== 'granted') return;
  try {
    new Notification('🔔 New Order Received', {
      body: `${orderNumber} · ${customerName} · ${total}`,
      icon: '/favicon.ico',
      tag:  orderNumber, // prevents duplicate browser notifications for same order
    });
  } catch {
    // Some environments block Notification construction — silently ignore
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const route = useRoute();
  const { profile, signOut } = useAuth();
  const { storeSettings } = useStoreSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Notification stack state ─────────────────────────────────────────────
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  // Track seen order IDs to prevent duplicate notifications
  const seenOrderIds = useRef<Set<string>>(new Set());
  // Track the active EventSource instance to close on cleanup
  const eventSourceRef = useRef<EventSource | null>(null);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleSignOut = async () => {
    // Close SSE stream before signing out
    eventSourceRef.current?.close();
    navigate('/');
    await signOut();
  };

  // ── SSE connection ────────────────────────────────────────────────────────
  useEffect(() => {
    // Only connect when profile confirms this is a tenant_admin
    if (!profile || profile.app_role !== 'admin') return;

    const token = getToken();
    if (!token) return;

    // Request browser notification permission once
    requestBrowserNotifPermission();

    // Build the SSE URL with token as query param
    // (EventSource cannot send Authorization headers)
    const url = `/api/admin/notifications/stream?token=${encodeURIComponent(token)}`;

    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('[SSE] Admin notification stream connected');
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.event !== 'new_order') return;

          // ── Duplicate prevention ─────────────────────────────────────────
          const notifId: string = data.id ?? data.orderNumber;
          if (seenOrderIds.current.has(notifId)) {
            console.log(`[SSE] Duplicate new_order event suppressed for ${notifId}`);
            return;
          }
          seenOrderIds.current.add(notifId);

          console.log(`[SSE] New order notification received: ${data.orderNumber}`);

          const notification: OrderNotification = {
            id:           notifId,
            orderNumber:  data.orderNumber,
            customerName: data.customerName ?? 'Customer',
            total:        Number(data.total) || 0,
            createdAt:    data.createdAt ?? new Date().toISOString(),
          };

          // Add to notification stack
          setNotifications((prev) => [notification, ...prev].slice(0, 5)); // cap at 5 visible

          // Play sound
          playNewOrderChime();

          // Browser notification
          const formattedTotal = new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0,
          }).format(notification.total);
          fireBrowserNotification(notification.orderNumber, notification.customerName, formattedTotal);

          // Dispatch window event so mounted Order/Dashboard pages can refresh
          window.dispatchEvent(new CustomEvent('new-order', { detail: notification }));

        } catch (err) {
          console.error('[SSE] Failed to parse notification event:', err);
        }
      };

      es.onerror = () => {
        // Log but don't crash — the dashboard keeps working without SSE
        console.warn('[SSE] Notification stream error. EventSource will auto-reconnect.');
      };
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      console.log('[SSE] Admin notification stream disconnected');
    };
  }, [profile]);

  // ── Sidebar JSX ──────────────────────────────────────────────────────────

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

      {/* ── Real-time order notification stack ── */}
      <NewOrderNotificationStack
        notifications={notifications}
        onClose={dismissNotification}
      />
    </div>
  );
}
