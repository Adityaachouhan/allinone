import { Leaf, MapPin, Phone, Mail, Facebook, Instagram, Twitter, ShieldCheck, Truck } from 'lucide-react';
import { useNavigate } from '@/lib/router';
import type { Category } from '@/types';
import { getCategoryIcon } from '@/components/CategoryIcon';
import { useStoreSettings } from '@/context/StoreContext';

export function Footer({ categories }: { categories: Category[] }) {
  const navigate = useNavigate();
  const { storeSettings, loading } = useStoreSettings();

  const storeName = storeSettings.store_name || (loading ? '' : 'Grocery Mart');
  const phone = storeSettings.phone || '';
  const email = storeSettings.email || '';
  const address = storeSettings.address || '';

  return (
    <footer className="mt-12 border-t border-gray-200 bg-white">
      {/* Trust badges */}
      <div className="hidden border-b border-gray-100 sm:block">
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
            {storeSettings.logo_url ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white p-0.5 border border-gray-200 shadow-sm overflow-hidden">
                <img
                  src={storeSettings.logo_url}
                  alt={storeName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
                <Leaf size={20} />
              </div>
            )}
            <div>
              <span className="block font-heading text-lg font-bold leading-none text-primary-700">
                {loading && !storeSettings.store_name ? (
                  <span className="inline-block h-5 w-28 rounded bg-gray-200 animate-pulse mt-0.5" />
                ) : (
                  storeName
                )}
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                {loading && !storeSettings.tagline ? (
                  <span className="inline-block h-3 w-20 rounded bg-gray-100 animate-pulse" />
                ) : (
                  storeSettings.tagline
                )}
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-600">
            Your neighbourhood grocery mart, now online. Fresh fruits, vegetables, dairy and
            daily essentials delivered to your doorstep.
          </p>
          {storeSettings.delivery_areas && (
            <div className="mt-3 flex items-start gap-1.5 text-xs text-primary-700 bg-primary-50 p-2.5 rounded-lg border border-primary-100">
              <Truck size={14} className="shrink-0 mt-0.5" />
              <span>Delivering to: {storeSettings.delivery_areas}</span>
            </div>
          )}
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
              <span>{address}</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone size={18} className="shrink-0 text-primary-600" />
              <a
                href={`tel:${phone ? (phone.startsWith('+') ? phone : `+91${phone.replace(/\s+/g, '')}`) : ''}`}
                className="hover:text-primary-700"
              >
                {phone ? (phone.startsWith('+') ? phone : `+91 ${phone}`) : ''}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail size={18} className="shrink-0 text-primary-600" />
              <a href={`mailto:${email}`} className="hover:text-primary-700">
                {email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Compliance Footer section */}
      {(storeSettings.gstin || storeSettings.return_policy || storeSettings.grievance_officer) && (
        <div className="border-t border-gray-100 bg-gray-50/50 py-4 px-4">
          <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500">
            {storeSettings.gstin && (
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-primary-600 shrink-0" />
                <span>
                  <strong>GSTIN:</strong> {storeSettings.gstin}
                </span>
              </div>
            )}
            {storeSettings.return_policy && (
              <div>
                <strong>Return Policy:</strong> {storeSettings.return_policy}
              </div>
            )}
            {storeSettings.grievance_officer && (
              <div className="whitespace-pre-line">
                <strong>Grievance Redressal:</strong> {storeSettings.grievance_officer}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 py-4">
        <p className="text-center text-xs text-gray-500">
          © {new Date().getFullYear()} {storeName} Grocery Mart.
        </p>
        <p className="mt-1 text-center text-xs text-gray-500">Developed by Aditya</p>
      </div>
    </footer>
  );
}
