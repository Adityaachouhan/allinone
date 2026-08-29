import { useEffect, useState } from 'react';
import { tenantsApi, type Tenant, type AuditLog, type Plan, type TenantStatus } from '../lib/api';
import {
  ArrowLeft, Globe, Database, Mail, Phone, Calendar, RefreshCw,
  Key, Power, PowerOff, Copy, Check, ExternalLink, Shield,
} from 'lucide-react';

interface Props { tenantId: string; onBack: () => void; }

export function TenantDetailPage({ tenantId, onBack }: Props) {
  const [tenant, setTenant]   = useState<Tenant | null>(null);
  const [audit, setAudit]     = useState<AuditLog[]>([]);
  const [plans, setPlans]     = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState('');
  const [editCreds, setEditCreds] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [copied, setCopied]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, a, p] = await Promise.all([
        tenantsApi.get(tenantId),
        tenantsApi.audit(tenantId),
        tenantsApi.plans(),
      ]);
      setTenant(t); setAudit(a); setPlans(p);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tenantId]);

  const handleStatusChange = async (status: TenantStatus) => {
    if (!tenant) return;
    setBusy('status');
    try {
      const updated = await tenantsApi.patch(tenant.id, { status });
      setTenant(updated);
    } finally { setBusy(''); }
  };

  const handleUpdateCredentials = async () => {
    if (!tenant) return;
    setBusy('password');
    try {
      await tenantsApi.setCredentials(tenant.id, newEmail || tenant.owner_email, newPassword);
      setEditCreds(false);
      setNewPassword('');
      setNewEmail('');
      await load();
    } finally { setBusy(''); }
  };

  const handleAssignPlan = async (planId: string) => {
    if (!tenant) return;
    setBusy('plan');
    try { await tenantsApi.assignPlan(tenant.id, planId, 'manual'); await load(); }
    finally { setBusy(''); }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!tenant) return <div className="text-slate-400">Tenant not found.</div>;

  const sub = tenant.subscriptions?.[0];
  const domain = tenant.domainProvisionings?.[0];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{tenant.business_name}</h1>
            <span className={`badge-${tenant.status} text-xs font-medium px-2.5 py-1 rounded-full`}>{tenant.status}</span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5 font-mono">{tenant.domain}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.open(`https://${tenant.domain}`, '_blank')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <ExternalLink size={13} /> Visit
          </button>
          <button onClick={load} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Info card */}
        <div className="col-span-2 space-y-5">
          <div className="glass rounded-2xl border border-white/8 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Shop Information</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Shield, label: 'Owner', value: tenant.owner_name },
                { icon: Mail, label: 'Email', value: tenant.owner_email },
                { icon: Phone, label: 'Phone', value: tenant.owner_phone || '—' },
                { icon: Globe, label: 'Domain', value: tenant.domain },
                { icon: Database, label: 'Database', value: tenant.db_name, mono: true },
                { icon: Calendar, label: 'Created', value: new Date(tenant.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) },
              ].map(({ icon: Icon, label, value, mono }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center mt-0.5 shrink-0">
                    <Icon size={14} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">{label}</div>
                    <div className={`text-sm text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Domain Provisioning */}
          <div className="glass rounded-2xl border border-white/8 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Domain & SSL</h2>
            {domain ? (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'DNS Configured', value: domain.dns_configured },
                  { label: 'SSL Issued', value: domain.ssl_issued },
                  { label: 'Registrar', value: domain.registrar || 'Manual', bool: false },
                ].map(({ label, value, bool }) => (
                  <div key={label} className="bg-surface-800/50 rounded-xl p-4">
                    <div className="text-xs text-slate-500 mb-2">{label}</div>
                    {bool === false ? (
                      <div className="text-sm text-white">{String(value)}</div>
                    ) : (
                      <div className={`text-sm font-semibold ${value ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {value ? '✓ Yes' : '✗ No'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-slate-500">No domain provisioning record.</div>}
          </div>

          {/* Audit log */}
          <div className="glass rounded-2xl border border-white/8 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Audit Log</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {audit.slice(0, 20).map((log) => (
                <div key={log.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-300 font-mono">{log.action}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{log.actor_email} · {new Date(log.created_at).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              ))}
              {audit.length === 0 && <div className="text-sm text-slate-500">No audit entries yet.</div>}
            </div>
          </div>
        </div>

        {/* Actions sidebar */}
        <div className="space-y-4">
          {/* Subscription */}
          <div className="glass rounded-2xl border border-white/8 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Subscription</h3>
            {sub ? (
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Plan</span>
                  <span className="text-white font-medium">{sub.plan?.name || '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Status</span>
                  <span className={`badge-${sub.status} px-2 py-0.5 rounded-full text-[10px]`}>{sub.status}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Next billing</span>
                  <span className="text-white">{sub.next_billing_date || '—'}</span>
                </div>
              </div>
            ) : <p className="text-xs text-slate-500 mb-4">No active subscription.</p>}
            <div className="space-y-2">
              {plans.map((p) => (
                <button key={p.id} onClick={() => handleAssignPlan(p.id)} disabled={busy === 'plan'}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs text-slate-300 hover:text-white flex justify-between items-center">
                  <span>{p.name}</span>
                  <span className="text-slate-500">₹{p.price_monthly}/mo</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status Actions */}
          <div className="glass rounded-2xl border border-white/8 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Status</h3>
            <div className="space-y-2">
              {tenant.status !== 'active' && (
                <button onClick={() => handleStatusChange('active')} disabled={busy === 'status'}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-all text-sm font-medium">
                  <Power size={14} /> Activate
                </button>
              )}
              {tenant.status !== 'suspended' && (
                <button onClick={() => handleStatusChange('suspended')} disabled={busy === 'status'}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 hover:bg-amber-500/25 transition-all text-sm font-medium">
                  <PowerOff size={14} /> Suspend
                </button>
              )}
            </div>
          </div>

          {/* Admin Credentials */}
          <div className="glass rounded-2xl border border-white/8 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Admin Credentials</h3>
            
            {editCreds ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Email</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={tenant.owner_email} className="w-full bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/60" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">New Password</label>
                  <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to auto-generate" className="w-full bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/60" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditCreds(false)} className="flex-1 py-2 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5 transition-colors">Cancel</button>
                  <button onClick={handleUpdateCredentials} disabled={busy === 'password'} className="flex-1 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-all">Save</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-surface-800 rounded-xl p-3">
                  <div className="text-xs text-slate-500 mb-1">Email</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-white font-mono flex-1 truncate">{tenant.owner_email}</div>
                    <button onClick={() => copyText(tenant.owner_email)} className="text-slate-400 hover:text-white transition-colors shrink-0">
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
                <div className="bg-surface-800 rounded-xl p-3">
                  <div className="text-xs text-slate-500 mb-1">Password</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-emerald-400 font-mono flex-1 break-all">{tenant.adminPassword || '••••••••'}</div>
                    <button onClick={() => copyText(tenant.adminPassword || '')} className="text-slate-400 hover:text-white transition-colors shrink-0">
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <button onClick={() => { setEditCreds(true); setNewEmail(tenant.owner_email); setNewPassword(''); }} className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-all text-xs font-medium">
                  <Key size={13} /> Update Credentials
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
