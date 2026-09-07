import { useEffect, useState } from 'react';
import * as db from '@/lib/db';
import type { StoreSettings } from '@/types';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { useStoreSettings } from '@/context/StoreContext';
import { Store, CheckCircle, RefreshCw, Eye, Sparkles, MapPin, Phone, FileText } from 'lucide-react';

const EMPTY: StoreSettings = {
  store_name: '', tagline: '', logo_url: '', phone: '', email: '',
  address: '', gstin: '', return_policy: '', grievance_officer: '', delivery_areas: '',
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  textarea?: boolean;
  placeholder?: string;
}

function Field({ label, value, onChange, textarea, placeholder }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      )}
    </div>
  );
}

export function AdminStoreSettingsPage() {
  const { updateStoreSettings: syncContextStoreSettings } = useStoreSettings();
  const [form, setForm] = useState<StoreSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  const loadSettings = () => {
    db.getStoreSettings()
      .then((d) => { setForm({ ...EMPTY, ...d }); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Auto-refresh when server broadcasts a store settings change via SSE
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.type === 'store_settings') loadSettings();
    };
    window.addEventListener('admin-data-changed', handler);
    return () => window.removeEventListener('admin-data-changed', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettingsToDbAndContext = async (updatedData: StoreSettings) => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      // Instantly update backend database AND global StoreContext
      await syncContextStoreSettings(updatedData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettingsToDbAndContext(form);
  };

  const set = (key: keyof StoreSettings) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Quick Preset Actions
  const handleLoadDefaults = () => {
    const defaultData: StoreSettings = {
      store_name: 'Bhardwaj Mart',
      tagline: 'Fresh Groceries Delivered Daily',
      logo_url: form.logo_url || '',
      phone: '+91 8340461426',
      email: 'contact@bhardwajmart.com',
      address: 'Kagalnagar, Sonari, Jamshedpur, Jharkhand 831011',
      gstin: '20AAAAA0000A1Z5',
      return_policy: 'Easy 48-hour return policy for non-perishable items. Immediate replacement for damaged products.',
      grievance_officer: 'Name: Rajesh Bhardwaj\nEmail: grievance@bhardwajmart.com\nPhone: +91 8340461426\nAvailable: Mon-Fri, 10am-6pm',
      delivery_areas: 'Sonari, Kagalnagar, Kadma, Bistupur, Sakchi',
    };
    setForm(defaultData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Store className="w-6 h-6 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Configure your store branding, heading tagline, contact details, and compliance footer. Changes take effect instantly upon saving.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadDefaults}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title="Populate recommended default store info"
          >
            <Sparkles size={14} className="text-amber-500" /> Quick Defaults
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              showPreview ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Eye size={14} /> {showPreview ? 'Hide Live Preview' : 'Show Live Preview'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Branding */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            Branding & Visual Identity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field
              label="Store Name"
              value={form.store_name}
              onChange={set('store_name')}
              placeholder="e.g. Bhardwaj Mart"
            />
            <Field
              label="Tagline / Heading Subtitle"
              value={form.tagline || ''}
              onChange={set('tagline')}
              placeholder="e.g. Grocery Mart"
            />
            <div>
              <ImageUpload
                label="Store Logo"
                value={form.logo_url}
                onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))}
                previewClass="h-20 w-20"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-gray-800">Contact & Operational Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Phone Number"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+91 98765 43210"
            />
            <Field
              label="Support Email"
              value={form.email}
              onChange={set('email')}
              placeholder="store@example.com"
            />
          </div>
          <Field
            label="Store Address"
            value={form.address}
            onChange={set('address')}
            textarea
            placeholder="Full physical address of the shop"
          />
          <Field
            label="Covered Delivery Areas"
            value={form.delivery_areas}
            onChange={set('delivery_areas')}
            placeholder="e.g. Sonari, Kadma, Bistupur, Sakchi…"
          />
        </div>

        {/* Legal & Compliance */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <div>
            <h2 className="font-semibold text-gray-800">Legal & Regulatory Compliance</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Required under Consumer Protection (E-Commerce) Rules 2020 and DPDP Act 2023. Displayed in store footer.
            </p>
          </div>
          <Field
            label="GSTIN"
            value={form.gstin}
            onChange={set('gstin')}
            placeholder="20AAAAA0000A1Z5"
          />
          <Field
            label="Return & Refund Policy"
            value={form.return_policy}
            onChange={set('return_policy')}
            textarea
            placeholder="Describe your return and refund terms…"
          />
          <Field
            label="Grievance Redressal Officer"
            value={form.grievance_officer}
            onChange={set('grievance_officer')}
            textarea
            placeholder="Name: Rajesh Bhardwaj&#10;Email: grievance@bhardwajmart.com&#10;Available: Mon-Fri, 10am-6pm"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Submit button */}
        <div className="sticky bottom-4 z-10 bg-white/90 backdrop-blur border border-gray-200 p-4 rounded-xl shadow-lg flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {saving ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-5 h-5 text-white" />
            ) : (
              <Store className="w-5 h-5" />
            )}
            {saved ? '✓ Settings Saved & Synced Live!' : saving ? 'Saving & Syncing…' : 'Save & Sync Settings'}
          </button>
        </div>
      </form>

      {/* Live Preview Card */}
      {showPreview && (
        <div className="bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
              <Eye size={16} className="text-green-400" /> Live Storefront Preview (Instant Real-time Mockup)
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider text-green-400 bg-green-950 px-2 py-0.5 rounded border border-green-800">
              Live Sync
            </span>
          </div>

          <div className="bg-white text-gray-900 rounded-xl p-4 space-y-4 shadow-inner">
            {/* Header Preview */}
            <div className="border-b border-gray-200 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-cover border" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center font-bold text-xs">
                    {(form.store_name || 'A')[0]}
                  </div>
                )}
                <div>
                  <span className="block font-bold text-green-700 text-base leading-none">{form.store_name || 'All In One'}</span>
                  <span className="text-[10px] text-gray-500">{form.tagline || 'Grocery Mart'}</span>
                </div>
              </div>
              <span className="text-xs text-gray-500">📞 {form.phone || '+91 8340461426'}</span>
            </div>

            {/* Footer Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
              <div>
                <p className="font-semibold text-gray-900 flex items-center gap-1 mb-1">
                  <MapPin size={12} className="text-green-600" /> Address & Areas
                </p>
                <p>{form.address || 'Kagalnagar, Sonari, Jamshedpur'}</p>
                {form.delivery_areas && (
                  <p className="mt-1 text-[11px] text-green-700 font-medium">Areas: {form.delivery_areas}</p>
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 flex items-center gap-1 mb-1">
                  <Phone size={12} className="text-green-600" /> Contact Info
                </p>
                <p>Phone: {form.phone || '+91 8340461426'}</p>
                <p>Email: {form.email || 'hello@allinone.shop'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 flex items-center gap-1 mb-1">
                  <FileText size={12} className="text-green-600" /> Legal Compliance
                </p>
                <p>GSTIN: {form.gstin || 'Not specified'}</p>
                {form.return_policy && <p className="truncate">Policy: {form.return_policy}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
