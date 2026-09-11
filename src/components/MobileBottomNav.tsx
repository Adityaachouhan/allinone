import { Home, Search, ShoppingCart, User } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, useRoute } from '@/lib/router';

export function MobileBottomNav() {
  const navigate = useNavigate();
  const route = useRoute();
  const { itemCount } = useCart();
  const { session } = useAuth();

  const items = [
    { icon: Home,         label: 'Home',                           path: '/' },
    { icon: Search,       label: 'Search',                         path: '/search' },
    { icon: ShoppingCart, label: 'Cart',  badge: itemCount,        path: '/cart' },
    { icon: User,         label: session ? 'Account' : 'Login',    path: session ? '/account' : '/login' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex">
        {items.map((item) => {
          const active = route.path === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              // 48px min-height meets Apple HIG minimum touch target guideline
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors"
              style={{ minHeight: 56 }}
              aria-label={item.label}
            >
              {/* Active indicator dot above icon */}
              {active && (
                <span
                  className="absolute top-1.5 left-1/2 -translate-x-1/2 h-1 w-5 rounded-full bg-primary-600"
                  style={{ background: 'linear-gradient(90deg,#16a34a,#22c55e)' }}
                />
              )}

              <div className="relative">
                <Icon
                  size={22}
                  className={active ? 'text-primary-700' : 'text-gray-500'}
                  strokeWidth={active ? 2.2 : 1.7}
                />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-500 px-1 text-[9px] font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </div>

              <span
                className="text-[10px] font-medium"
                style={{ color: active ? '#15803d' : '#6b7280' }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

