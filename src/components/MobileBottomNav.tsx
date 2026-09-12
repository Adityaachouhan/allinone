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
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: ShoppingCart, label: 'Cart', path: '/cart', badge: itemCount },
    { icon: User, label: session ? 'Account' : 'Login', path: session ? '/account' : '/login' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex">
        {items.map((item) => {
          const active = route.path === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                active ? 'text-primary-600' : 'text-gray-500'
              }`}
            >
              {/* Active indicator line at top */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary-600" />
              )}
              <div className="relative">
                <Icon size={22} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-500 px-1 text-[9px] font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </div>
              <span className={active ? 'font-semibold' : ''}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

