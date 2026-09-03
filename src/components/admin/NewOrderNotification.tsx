/**
 * src/components/admin/NewOrderNotification.tsx
 *
 * Reusable real-time order notification popup for the Admin Dashboard.
 * Displayed whenever a new order arrives via the SSE stream.
 *
 * Features:
 *  - Stacks multiple simultaneous notifications
 *  - Auto-dismisses each notification after 5 seconds with a countdown bar
 *  - Deduplication is handled by the parent (AdminLayout) via a Set of seen IDs
 *  - Sound & browser notifications are triggered in AdminLayout, not here
 */

import { useEffect, useRef, useState } from 'react';
import { Bell, X, ShoppingBag, ChevronRight } from 'lucide-react';
import { useNavigate } from '@/lib/router';

export type OrderNotification = {
  /** Unique order ID — used by parent for deduplication */
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  createdAt: string;
};

// ── Individual notification card ──────────────────────────────────────────────

function NotificationCard({
  notification,
  onClose,
}: {
  notification: OrderNotification;
  onClose: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION_MS = 5000;
  const TICK_MS = 50;

  useEffect(() => {
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / DURATION_MS) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        onClose(notification.id);
      }
    }, TICK_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification.id]);

  const handleViewOrder = () => {
    onClose(notification.id);
    navigate('/admin/orders');
  };

  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(notification.total);

  return (
    <div
      className="notification-card"
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid rgba(99,179,237,0.2)',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
        overflow: 'hidden',
        minWidth: '320px',
        maxWidth: '380px',
        animation: 'slideInRight 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
      }}
    >
      {/* Glowing top accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
        }}
      />

      <div style={{ padding: '16px 16px 0 16px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {/* Bell icon */}
          <div
            style={{
              flexShrink: 0,
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(59,130,246,0.4)',
            }}
          >
            <Bell size={20} color="white" style={{ animation: 'bellRing 0.6s ease-in-out' }} />
          </div>

          {/* Title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60a5fa' }}>
              🔔 New Order Received
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '17px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
              {notification.orderNumber}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={() => onClose(notification.id)}
            style={{
              flexShrink: 0,
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '8px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#94a3b8',
              transition: 'background 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
              (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
            }}
            aria-label="Close notification"
          >
            <X size={14} />
          </button>
        </div>

        {/* Order details */}
        <div
          style={{
            marginTop: '14px',
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Customer</span>
            <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>{notification.customerName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Amount</span>
            <span
              style={{
                fontSize: '16px',
                color: '#4ade80',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {formattedAmount}
            </span>
          </div>
        </div>

        {/* View Order button */}
        <button
          onClick={handleViewOrder}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%',
            marginTop: '12px',
            padding: '10px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            border: 'none',
            borderRadius: '10px',
            color: 'white',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.2s, transform 0.1s',
            boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)'; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        >
          <ShoppingBag size={14} />
          View Order
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Countdown progress bar */}
      <div style={{ marginTop: '14px', height: '3px', background: 'rgba(255,255,255,0.06)' }}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
            transition: `width ${TICK_MS}ms linear`,
            borderRadius: '0 2px 2px 0',
          }}
        />
      </div>
    </div>
  );
}

// ── Notification stack container ──────────────────────────────────────────────

export function NewOrderNotificationStack({
  notifications,
  onClose,
}: {
  notifications: OrderNotification[];
  onClose: (id: string) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <>
      {/* Keyframe styles injected once */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(110%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes bellRing {
          0%   { transform: rotate(0deg); }
          20%  { transform: rotate(-15deg); }
          40%  { transform: rotate(15deg); }
          60%  { transform: rotate(-10deg); }
          80%  { transform: rotate(10deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>

      {/* Fixed container — top-right, above everything */}
      <div
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          pointerEvents: 'none',
        }}
      >
        {notifications.map((n) => (
          <div key={n.id} style={{ pointerEvents: 'all' }}>
            <NotificationCard notification={n} onClose={onClose} />
          </div>
        ))}
      </div>
    </>
  );
}
