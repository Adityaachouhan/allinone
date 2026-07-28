import { Leaf, MapPin, Phone, Mail, Facebook, Instagram, Twitter } from 'lucide-react';
import { useNavigate } from '@/lib/router';
import type { Category } from '@/types';
import { getCategoryIcon } from '@/components/CategoryIcon';

export function Footer({ categories }: { categories: Category[] }) {
  const navigate = useNavigate();

  return (
    <footer className="mt-12 border-t border-gray-200 bg-white">
      {/* Trust badges */}
      <div className="border-b border-gray-100">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4">
          {[
            { title: 'Fresh Products', desc: 'Hand-picked daily' },
            { title: 'Fast Delivery', desc: 'Within 2 hours' },
            { title: 'Secure Payments', desc: 'UPI, Card & COD' },
            { title: 'Easy Returns', desc: 'Hassle-free refunds' },
          ].map((b) => (
            <div key={b.title} className="text-center sm:text-left">
              <p className="text-sm font-semibold text-gray-900">{b.title}</p>
              <p className="text-xs text-gray-500">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
              <Leaf size={20} />
            </div>
            <span className="font-heading text-lg font-bold text-primary-700">All In One</span>
          </div>
          <p className="mt-3 text-sm text-gray-600">
            Your neighbourhood grocery mart, now online. Fresh fruits, vegetables, dairy and
            daily essentials delivered to your doorstep.
          </p>
          <div className="mt-4 flex gap-3">
            {[Facebook, Instagram, Twitter].map((Icon, i) => (
              <a
                key={i}
                href="#"
                onClick={(e) => e.preventDefault()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-primary-100 hover:text-primary-700"
                aria-label="Social link"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Shop by Category</h4>
          <ul className="mt-3 space-y-2">
            {categories.slice(0, 6).map((cat) => {
              const Icon = getCategoryIcon(cat.icon_name);
              return (
                <li key={cat.id}>
                  <button
                    onClick={() => navigate(`/category/${cat.slug}`)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-700"
                  >
                    <Icon size={14} /> {cat.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Quick links */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Quick Links</h4>
          <ul className="mt-3 space-y-2">
            {[
              { label: 'My Orders', path: '/account' },
              { label: 'My Cart', path: '/cart' },
              { label: 'Login / Sign Up', path: '/login' },
              { label: "Today's Deals", path: '/' },
            ].map((link) => (
              <li key={link.label}>
                <button
                  onClick={() => navigate(link.path)}
                  className="text-sm text-gray-600 hover:text-primary-700"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Contact Us</h4>
          <ul className="mt-3 space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <MapPin size={18} className="mt-0.5 shrink-0 text-primary-600" />
              <span>Kagalnagar, Sonari, Jamshedpur, Jharkhand 831011</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone size={18} className="shrink-0 text-primary-600" />
              <a href="tel:+918340461426" className="hover:text-primary-700">+91 8340461426</a>
            </li>
            <li className="flex items-center gap-2">
              <Mail size={18} className="shrink-0 text-primary-600" />
              <a href="mailto:hello@allinone.shop" className="hover:text-primary-700">hello@allinone.shop</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-100 py-4">
        <p className="text-center text-xs text-gray-500">
          © {new Date().getFullYear()} All In One Grocery Mart.
        </p>
        <p className="mt-1 text-center text-xs text-gray-500">
          Developed by Aditya
        </p>
      </div>
    </footer>
  );
}
