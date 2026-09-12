import { useEffect, useState, useCallback } from 'react';
import { tenantsApi, type Tenant, type AuditLog, type Plan, type TenantStatus, type Subscription } from '../lib/api';
import {
  ArrowLeft, Globe, Database, Mail, Phone, Calendar, RefreshCw,
  Key, Power, PowerOff, Copy, Check, ExternalLink, Shield,
  Bell, Send, X, AlertTriangle, CreditCard, Clock,
} from 'lucide-react';

interface Props { tenantId: string; onBack: () => void; }

// ── helpers ───────────────────────────────────────────────────────────────────
function addOneYear(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Notify Modal ──────────────────────────────────────────────────────────────
interface NotifyModalProps {
  tenant: Tenant;
  onClose: () => void;
}
function NotifyModal({ tenant, onClose }: NotifyModalProps) {
  const [title,   setTitle]   = useState('Message from SaaS Admin');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const send = async () => {
    if (!message.trim()) { setError('Message is required.'); return; }
    setSending(true); setError('');
    try {
      await tenantsApi.notify(tenant.id, title.trim() || 'Message from SaaS Admin', message.trim());
      setSent(true);
      setTimeout(onClose, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send.');
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-surface-900 border border-brand-500/30 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center">
            <Bell size={18} className="text-brand-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Send Popup Notification</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sends a 10-second alert to <span className="font-mono text-slate-400">{tenant.domain}</span> admin panel
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/60 transition-colors"
              placeholder="Notification title"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/60 transition-colors resize-none"
              placeholder="Write your message to the shop admin…"
            />
          </div>
        </div>

        <p className="mt-2 text-[11px] text-slate-600 flex items-center gap-1">
          <AlertTriangle size={10} className="text-amber-500" />
          The popup lasts 10 seconds and is shown max 2× per day to the admin.
        </p>

        {error && <p className="mt-2 text-xs text-rose-400 flex items-center gap-1.5"><AlertTriangle size={12} />{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white transition-all">
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending || sent}
            className={`flex-1 flex items-center justify-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-60 ${sent ? 'bg-emerald-600' : 'bg-brand-500 hover:bg-brand-600'}`}
          >
            {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : sent ? <Check size={14} /> : <Send size={14} />}
            {sent ? 'Sent!' : sending ? 'Sending…' : 'Send Notification'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Subscription Card ─────────────────────────────────────────────────────────
function SubscriptionCard({
  sub,
  plans,
  busy,
  onAssignPlan,
}: {
  sub: Subscription | undefined;
  plans: Plan[];
  busy: string;
  onAssignPlan: (planId: string) => void;
}) {
  // Compute expiry from start_date + 1 year
  const expiryDate  = sub?.start_date ? addOneYear(sub.start_date) : null;
  const daysLeft    = expiryDate ? daysUntil(expiryDate) : null;
  const totalDays   = 365;
  const usedDays    = daysLeft !== null ? Math.max(0, totalDays - daysLeft) : 0;
  const pct         = Math.min(100, Math.round((usedDays / totalDays) * 100));
  const isExpired   = daysLeft !== null && daysLeft <= 0;
  const isWarning   = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

  const barColor = isExpired ? '#ef4444' : isWarning ? '#f59e0b' : '#6366f1';

  return (
    <div className="glass rounded-2xl border border-white/8 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <CreditCard size={14} className="text-brand-400" /> Subscription
      </h3>

      {sub ? (
        <>
          {/* Plan name + status */}
          <div className="bg-surface-800/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Plan</span>
              <span className="text-xs font-bold text-white">{sub.plan?.name || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Status</span>
              <span className={`badge-${sub.status} text-[10px] px-2 py-0.5 rounded-full`}>{sub.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Started</span>
              <span className="text-xs text-white">{formatDate(sub.start_date)}</span>
            </div>
          </div>

          {/* 1-year expiry bar */}
          {expiryDate && (
            <div className="bg-surface-800/60 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={10} /> Expires</span>
                <span className={`text-xs font-semibold ${isExpired ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {isExpired ? 'Expired' : `${daysLeft}d left`}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-600 mt-1.5">
                <span>{formatDate(sub.start_date)}</span>
                <span>{formatDate(expiryDate)}</span>
              </div>
              {isExpired && (
                <p className="mt-2 text-[11px] text-rose-400 text-center">⚠ Subscription has expired — renew below</p>
              )}
              {isWarning && !isExpired && (
                <p className="mt-2 text-[11px] text-amber-400 text-center">Expiring soon — consider renewing</p>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-500">No active subscription.</p>
      )}

      {/* Plan picker */}
      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-500 mb-1">Assign / Change Plan (1-year term):</p>
        {plans.map((p) => (
          <button
            key={p.id}
            onClick={() => onAssignPlan(p.id)}
            disabled={busy === 'plan'}
            className="w-full text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-brand-500/10 hover:border-brand-500/30 border border-white/8 transition-all text-xs text-slate-300 hover:text-white flex justify-between items-center group"
          >
            <span className="font-medium">{p.name}</span>
            <span className="text-slate-500 group-hover:text-brand-400 transition-colors">₹{Number(p.price_monthly).toLocaleString('en-IN')}/mo</span>
          </button>
        ))}
        {plans.length === 0 && <p className="text-xs text-slate-600 text-center py-2">No plans configured.</p>}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function TenantDetailPage({ tenantId, onBack }: Props) {
  const [tenant, setTenant]   = useState<Tenant | null>(null);
  const [audit,  setAudit]    = useState<AuditLog[]>([]);
  const [plans,  setPlans]    = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy,   setBusy]     = useState('');
  const [editCreds,  setEditCreds]  = useState(false);
  const [newEmail,   setNewEmail]   = useState('');
  const [newPassword,setNewPassword]= useState('');
  const [copiedEmail, setCopiedEmail]   = useState(false);
  const [copiedPass,  setCopiedPass]    = useState(false);
  const [showNotify, setShowNotify] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, a, p] = await Promise.all([
        tenantsApi.get(tenantId),
        tenantsApi.audit(tenantId),
        tenantsApi.plans(),
      ]);
      setTenant(t); setAudit(a); setPlans(p);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

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

  const copyEmail = () => {
    if (!tenant) return;
    navigator.clipboard.writeText(tenant.owner_email).then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    });
  };

  const copyPassword = () => {
    if (!tenant) return;
    navigator.clipboard.writeText(tenant.adminPassword || '').then(() => {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!tenant) return <div className="text-slate-400">Tenant not found.</div>;

  const sub    = tenant.subscriptions?.[0];
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
          {/* Send Notification button */}
          <button
            onClick={() => setShowNotify(true)}
            className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-white bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 hover:border-brand-500/40 px-3 py-2 rounded-lg transition-all"
          >
            <Bell size={13} /> Send Notification
          </button>
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
                { icon: Shield,   label: 'Owner',    value: tenant.owner_name },
                { icon: Mail,     label: 'Email',    value: tenant.owner_email },
                { icon: Phone,    label: 'Phone',    value: tenant.owner_phone || '—' },
                { icon: Globe,    label: 'Domain',   value: tenant.domain },
                { icon: Database, label: 'Database', value: tenant.db_name, mono: true },
                { icon: Calendar, label: 'Created',  value: formatDate(tenant.created_at) },
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
                  { label: 'SSL Issued',     value: domain.ssl_issued },
                  { label: 'Registrar',      value: domain.registrar || 'Manual', bool: false },
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
          {/* Subscription card */}
          <SubscriptionCard
            sub={sub}
            plans={plans}
            busy={busy}
            onAssignPlan={handleAssignPlan}
          />

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
                {/* Email row */}
                <div className="bg-surface-800 rounded-xl p-3">
                  <div className="text-xs text-slate-500 mb-1">Email</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-white font-mono flex-1 truncate">{tenant.owner_email}</div>
                    <button
                      onClick={copyEmail}
                      title="Copy email"
                      className="text-slate-400 hover:text-white transition-colors shrink-0 p-1 rounded hover:bg-white/10"
                    >
                      {copiedEmail ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                {/* Password row */}
                <div className="bg-surface-800 rounded-xl p-3">
                  <div className="text-xs text-slate-500 mb-1">Password</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-emerald-400 font-mono flex-1 break-all">{tenant.adminPassword || '••••••••'}</div>
                    <button
                      onClick={copyPassword}
                      title="Copy password"
                      className="text-slate-400 hover:text-white transition-colors shrink-0 p-1 rounded hover:bg-white/10"
                    >
                      {copiedPass ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => { setEditCreds(true); setNewEmail(tenant.owner_email); setNewPassword(''); }}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-all text-xs font-medium"
                >
                  <Key size={13} /> Update Credentials
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notify Modal */}
      {showNotify && <NotifyModal tenant={tenant} onClose={() => setShowNotify(false)} />}
    </div>
  );
}
