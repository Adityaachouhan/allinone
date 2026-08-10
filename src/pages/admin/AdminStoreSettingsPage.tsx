import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/admin/ImageUpload';

interface StoreSettings {
  id?: string;
  store_name: string;
  logo_url: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  return_policy: string;
  grievance_officer: string;
  delivery_areas: string;
}

const EMPTY: StoreSettings = {
  store_name: '', logo_url: '', phone: '', email: '',
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
  const [form, setForm]     = useState<StoreSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    api<StoreSettings>('/store-settings').then((d) => {
      setForm({ ...EMPTY, ...d });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(''); setSaved(false);
    try {
      await api('/store-settings', { method: 'PATCH', body: JSON.stringify(form) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally { setSaving(false); }
  };

  const set = (key: keyof StoreSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );



  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure your store's branding, contact info, and legal details</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Branding */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Branding</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Store Name" value={form.store_name} onChange={set('store_name')} placeholder="e.g. Bhardwaj Mart" />
            <ImageUpload label="Store Logo" value={form.logo_url} onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))} />
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Contact Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
            <Field label="Email" value={form.email} onChange={set('email')} placeholder="store@example.com" />
          </div>
          <Field label="Address" value={form.address} onChange={set('address')} textarea placeholder="Full store address" />
          <Field label="Delivery Areas" value={form.delivery_areas} onChange={set('delivery_areas')} placeholder="Sector 15, Sector 16, Noida…" />
        </div>

        {/* Legal (Consumer Protection Rules 2020 + DPDP Act 2023) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Legal & Compliance</h2>
          <p className="text-xs text-gray-400">Required under Consumer Protection (E-Commerce) Rules 2020 and DPDP Act 2023. Each field is displayed in your store's footer.</p>
          <Field label="GSTIN" value={form.gstin} onChange={set('gstin')} placeholder="22AAAAA0000A1Z5" />
          <Field label="Return Policy" value={form.return_policy} onChange={set('return_policy')} textarea placeholder="Describe your return and refund policy…" />
          <Field label="Grievance Officer" value={form.grievance_officer} onChange={set('grievance_officer')} textarea
            placeholder="Name: Rajesh Bhardwaj&#10;Email: grievance@bhardwajmart.com&#10;Available: Mon–Fri, 10am–6pm" />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          {saved ? '✓ Settings Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
