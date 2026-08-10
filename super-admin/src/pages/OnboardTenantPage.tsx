import { useState } from 'react';
import { tenantsApi } from '../lib/api';
import { ArrowLeft, Store, CheckCircle, Copy, Check, AlertTriangle } from 'lucide-react';

interface Props {
  onBack: () => void;
  onSuccess: (tenantId: string) => void;
}

type Step = 'form' | 'provisioning' | 'done' | 'error';

interface FormData {
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  domain: string;
  initialStatus: string;
  adminPassword?: string;
}

const Field = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">{label}</label>
    <input {...props} className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors" />
  </div>
);

export function OnboardTenantPage({ onBack, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<FormData>({
    businessName: '', ownerName: '', ownerPhone: '', ownerEmail: '', domain: '', initialStatus: 'trial', adminPassword: ''
  });
  const [result, setResult] = useState<{ tenant: { id: string; business_name: string }; credentials: { loginUrl: string; adminEmail: string; adminTempPassword: string } } | null>(null);
  const [error, setError]   = useState('');
  const [copied, setCopied] = useState(false);

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('provisioning');
    try {
      const res = await tenantsApi.provision(form);
      setResult(res);
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Provisioning failed');
      setStep('error');
    }
  };

  const copyPass = () => {
    if (result) navigator.clipboard.writeText(result.credentials.adminTempPassword)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // ── Step: Form ────────────────────────────────────────────────────────────
  if (step === 'form') return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-2xl font-bold text-white">Onboard New Shop</h1>
          <p className="text-sm text-slate-400 mt-1">Fill in the details to provision a new tenant store</p>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/8 p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center gap-3 p-4 bg-brand-500/5 border border-brand-500/15 rounded-xl mb-6">
            <Store className="w-5 h-5 text-brand-400 shrink-0" />
            <p className="text-xs text-slate-400 leading-relaxed">
              This will create a fully isolated PostgreSQL database, provision a tenant admin account, and register the shop in the master database. This action can be rolled back from the tenant detail page if anything goes wrong.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Business Name *" placeholder="e.g. Bhardwaj Mart" value={form.businessName} onChange={set('businessName')} required />
            <Field label="Owner Name *" placeholder="e.g. Rajesh Bhardwaj" value={form.ownerName} onChange={set('ownerName')} required />
            <Field label="Owner Email *" type="email" placeholder="owner@business.com" value={form.ownerEmail} onChange={set('ownerEmail')} required />
            <Field label="Owner Phone" placeholder="+91 98765 43210" value={form.ownerPhone} onChange={set('ownerPhone')} />
            <div className="col-span-2">
              <Field label="Domain *" placeholder="e.g. bhardwajmart.com" value={form.domain} onChange={set('domain')} required />
              <p className="text-[11px] text-slate-600 mt-1.5">Enter the full domain without http://. DNS and SSL setup is done separately.</p>
            </div>
            <div className="col-span-2">
              <Field label="Admin Password (Optional)" placeholder="Leave blank to auto-generate" value={form.adminPassword} onChange={set('adminPassword')} />
              <p className="text-[11px] text-slate-600 mt-1.5">Manually set the shop owner's initial login password, or let the system generate a secure one.</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Initial Status</label>
            <select value={form.initialStatus} onChange={set('initialStatus')}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/60 transition-colors">
              <option value="trial">Trial</option>
              <option value="active">Active</option>
            </select>
          </div>

          <button type="submit"
            className="w-full mt-4 bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2">
            <Store size={16} /> Provision Shop
          </button>
        </form>
      </div>
    </div>
  );

  // ── Step: Provisioning ────────────────────────────────────────────────────
  if (step === 'provisioning') return (
    <div className="max-w-lg mx-auto mt-20 text-center space-y-6">
      <div className="w-20 h-20 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center mx-auto animate-glow">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">Provisioning Shop…</h2>
        <p className="text-sm text-slate-400 mt-2">Creating isolated database, applying schema, setting up admin account.</p>
        <p className="text-xs text-slate-600 mt-1">This may take 10–30 seconds.</p>
      </div>
      <div className="flex flex-col gap-2 mt-4">
        {['Creating PostgreSQL database', 'Applying schema template', 'Setting up admin login', 'Registering in master DB'].map((s, i) => (
          <div key={s} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-800/50 text-left" style={{ animationDelay: `${i * 0.3}s` }}>
            <div className="w-4 h-4 border border-brand-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-300">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Step: Done ────────────────────────────────────────────────────────────
  if (step === 'done' && result) return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="glass rounded-2xl border border-emerald-500/20 p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Shop Provisioned! 🎉</h2>
          <p className="text-sm text-slate-400 mt-2">
            <strong className="text-white">{result.tenant.business_name}</strong> is ready.
          </p>
        </div>

        <div className="bg-surface-800 rounded-xl p-5 text-left space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Credentials to hand to the shop owner</div>
          {[
            { label: 'Login URL', value: result.credentials.loginUrl },
            { label: 'Admin Email', value: result.credentials.adminEmail },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs text-slate-500 mb-0.5">{label}</div>
              <div className="text-sm text-white font-mono">{value}</div>
            </div>
          ))}
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Temp Password <span className="text-amber-400">(shown once only)</span></div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-emerald-400 font-mono flex-1 break-all">{result.credentials.adminTempPassword}</div>
              <button onClick={copyPass} className="text-slate-400 hover:text-white transition-colors shrink-0 p-1">
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-amber-400 flex items-center justify-center gap-1.5">
          <AlertTriangle size={12} /> Save these credentials now. The temp password won't be shown again.
        </p>

        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-white/5 transition-colors">
            Back to Shops
          </button>
          <button onClick={() => onSuccess(result.tenant.id)} className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all">
            View Shop →
          </button>
        </div>
      </div>
    </div>
  );

  // ── Step: Error ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="glass rounded-2xl border border-rose-500/20 p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Provisioning Failed</h2>
        <p className="text-sm text-rose-300 font-mono bg-rose-500/10 rounded-lg px-4 py-3">{error}</p>
        <p className="text-xs text-slate-500">The tenant has been marked as <code className="text-rose-400">provisioning_failed</code> in the master DB. No data was left in a partial state.</p>
        <button onClick={() => { setStep('form'); setError(''); }} className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-all">
          Try Again
        </button>
      </div>
    </div>
  );
}
