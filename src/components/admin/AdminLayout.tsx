/**
 * src/components/admin/AdminLayout.tsx
 *
 * Wraps all admin pages with the sidebar + top-bar shell.
 * Also owns the real-time SSE connection for new-order notifications.
 *
 * Notification Bell Button (top-right header):
 *  - Shows an animated badge with the count of unread notifications
 *  - Clicking the bell opens a dropdown panel showing notification history
 *  - Clicking "Mark all read" clears the badge
 *  - Clicking any notification item navigates to /admin/orders
 *
 * Real-time flow:
 *  1. Admin logs in → AdminLayout mounts → EventSource connects to
 *     /api/admin/notifications/stream?token=<jwt>
 *  2. Backend emits `new_order` SSE event after every order creation
 *  3. AdminLayout receives the event → deduplicate → push to toast stack + history
 *  4. NewOrderNotificationStack renders each card (auto-dismiss after 5 s)
 *  5. A 'new-order' CustomEvent is dispatched on window so pages can refresh
 *  6. Optional: plays a chime & fires browser Notification
 */

import { type ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard, Package, Tags, ShoppingBag, Users, Image, Truck,
  LogOut, Leaf, Menu, Settings, Bell, X, ChevronRight, Clock,
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

// ── Notification history item type ────────────────────────────────────────────
type NotificationHistoryItem = OrderNotification & { read: boolean };

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
    const now = ctx.currentTime;
    playNote(523.25, now,        0.25, 0.3);
    playNote(659.25, now + 0.15, 0.25, 0.3);
    playNote(783.99, now + 0.30, 0.45, 0.3);
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
      tag: orderNumber,
    });
  } catch {
    // silently ignore
  }
}

// ── Time ago helper ───────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Notification Bell Dropdown ────────────────────────────────────────────────

function NotificationBellButton({
  history,
  unreadCount,
  onMarkAllRead,
  onNavigate,
}: {
  history: NotificationHistoryItem[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onNavigate: (orderNumber?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) onMarkAllRead();
  };

  const formatAmount = (total: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(total);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        style={{
          position: 'relative',
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: open ? 'rgba(99,102,241,0.12)' : 'rgba(0,0,0,0.04)',
          border: open ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          color: open ? '#6366f1' : '#374151',
        }}
        onMouseEnter={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.07)';
            (e.currentTarget as HTMLButtonElement).style.color = '#111827';
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)';
            (e.currentTarget as HTMLButtonElement).style.color = '#374151';
          }
        }}
      >
        <Bell size={19} />
        {/* Badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '18px',
              height: '18px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid white',
              boxShadow: '0 2px 8px rgba(239,68,68,0.5)',
              animation: 'badgePulse 2s ease-in-out infinite',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '360px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
            zIndex: 9998,
            overflow: 'hidden',
            animation: 'dropdownSlide 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid #f1f5f9',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bell size={14} color="white" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                  Notifications
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                  {history.length === 0 ? 'No notifications yet' : `${history.length} total`}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {history.length > 0 && (
                <button
                  onClick={onMarkAllRead}
                  style={{
                    fontSize: '11px',
                    color: '#6366f1',
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.05)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {history.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#9ca3af',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <Bell size={22} color="#d1d5db" />
                </div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#6b7280' }}>
                  No notifications yet
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                  New orders will appear here in real-time
                </p>
              </div>
            ) : (
              history.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => { setOpen(false); onNavigate(item.orderNumber); }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    background: item.read ? 'white' : 'rgba(99,102,241,0.04)',
                    border: 'none',
                    borderBottom: idx < history.length - 1 ? '1px solid #f8fafc' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = item.read ? 'white' : 'rgba(99,102,241,0.04)'; }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      flexShrink: 0,
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: item.read
                        ? 'linear-gradient(135deg, #e0e7ff, #c7d2fe)'
                        : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ShoppingBag size={16} color={item.read ? '#6366f1' : 'white'} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.orderNumber}
                      </p>
                      <span style={{ flexShrink: 0, fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>
                        {formatAmount(item.total)}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                      {item.customerName}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <Clock size={10} color="#9ca3af" />
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>{timeAgo(item.createdAt)}</span>
                      {!item.read && (
                        <span
                          style={{
                            marginLeft: '4px',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#6366f1',
                            display: 'inline-block',
                          }}
                        />
                      )}
                    </div>
                  </div>

                  <ChevronRight size={14} color="#d1d5db" style={{ flexShrink: 0, marginTop: '2px' }} />
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {history.length > 0 && (
            <div
              style={{
                padding: '10px 16px',
                borderTop: '1px solid #f1f5f9',
                background: '#fafafa',
              }}
            >
              <button
                onClick={() => { setOpen(false); onNavigate(); /* View all */}}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  border: 'none',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <ShoppingBag size={14} />
                View All Orders
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const route = useRoute();
  const { profile, signOut } = useAuth();
  const { storeSettings } = useStoreSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Notification stack state (toast popups) ──────────────────────────────
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);

  // ── Notification history (bell dropdown) ─────────────────────────────────
  const [notifHistory, setNotifHistory] = useState<NotificationHistoryItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Track seen order IDs to prevent duplicate notifications
  const seenOrderIds = useRef<Set<string>>(new Set());
  // Track the active EventSource instance to close on cleanup
  const eventSourceRef = useRef<EventSource | null>(null);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifHistory((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const handleSignOut = async () => {
    eventSourceRef.current?.close();
    navigate('/');
    await signOut();
  };

  // ── SSE connection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile || profile.app_role !== 'admin') return;

    const token = getToken();
    if (!token) return;

    requestBrowserNotifPermission();

    const url = `/api/admin/notifications/stream?token=${encodeURIComponent(token)}`;

    function connect() {
      if (eventSourceRef.current) eventSourceRef.current.close();

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('[SSE] Admin notification stream connected');
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event !== 'new_order') return;

          const notifId: string = data.id ?? data.orderNumber;
          if (seenOrderIds.current.has(notifId)) {
            console.log(`[SSE] Duplicate suppressed for ${notifId}`);
            return;
          }
          seenOrderIds.current.add(notifId);

          console.log(`[SSE] New order: ${data.orderNumber}`);

          const notification: OrderNotification = {
            id:           notifId,
            orderNumber:  data.orderNumber,
            customerName: data.customerName ?? 'Customer',
            total:        Number(data.total) || 0,
            createdAt:    data.createdAt ?? new Date().toISOString(),
          };

          // Add to toast stack (auto-dismiss popups)
          setNotifications((prev) => [notification, ...prev].slice(0, 5));

          // Add to history dropdown (newest first, keep last 50)
          setNotifHistory((prev) => [{ ...notification, read: false }, ...prev].slice(0, 50));
          setUnreadCount((c) => c + 1);

          // Sound
          playNewOrderChime();

          // Browser notification
          const formattedTotal = new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0,
          }).format(notification.total);
          fireBrowserNotification(notification.orderNumber, notification.customerName, formattedTotal);

          // Let other pages refresh
          window.dispatchEvent(new CustomEvent('new-order', { detail: notification }));

        } catch (err) {
          console.error('[SSE] Failed to parse notification:', err);
        }
      };

      es.onerror = () => {
        console.warn('[SSE] Stream error — EventSource will auto-reconnect.');
      };
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
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
          <p className="font-heading font-bold text-white truncate">{storeSettings.store_name || 'Grocery Mart'}</p>
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
              onClick={() => { navigate(item.path); setSidebarOpen(false); }}
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

  // ── Page title from current route ────────────────────────────────────────
  const currentPageLabel = navItems.find((n) => n.path === route.path)?.label ?? 'Admin';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">{Sidebar}</aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-60 animate-slide-down">{Sidebar}</div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-60">

        {/* ── Top header bar (both mobile & desktop) ── */}
        <div
          className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          {/* Left: hamburger (mobile) + page title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div className="hidden lg:block">
              <p className="text-xs text-gray-400 font-medium">Admin Panel</p>
              <p className="text-base font-bold text-gray-800 leading-tight">{currentPageLabel}</p>
            </div>
            <span className="font-heading font-bold text-primary-700 lg:hidden">Admin</span>
          </div>

          {/* Right: notification bell */}
          <div className="flex items-center gap-2">
            {/* Keyframes injected once */}
            <style>{`
              @keyframes badgePulse {
                0%, 100% { transform: scale(1); }
                50%       { transform: scale(1.15); }
              }
              @keyframes dropdownSlide {
                from { opacity: 0; transform: translateY(-8px) scale(0.97); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>

            <NotificationBellButton
              history={notifHistory}
              unreadCount={unreadCount}
              onMarkAllRead={markAllRead}
              onNavigate={(orderNumber) =>
                navigate(orderNumber ? `/admin/orders?order=${encodeURIComponent(orderNumber)}` : '/admin/orders')
              }
            />
          </div>
        </div>

        <main className="p-4 sm:p-6">{children}</main>
      </div>

      {/* ── Real-time order toast stack ── */}
      <NewOrderNotificationStack
        notifications={notifications}
        onClose={dismissNotification}
      />
    </div>
  );
}
