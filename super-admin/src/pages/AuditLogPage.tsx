import { useEffect, useState } from 'react';
import { tenantsApi, type AuditLog } from '../lib/api';
import { ScrollText, RefreshCw } from 'lucide-react';

const ACTION_COLOR: Record<string, string> = {
  'tenant.provisioned':         'bg-emerald-500',
  'tenant.provisioning_failed': 'bg-rose-500',
  'tenant.status_changed':      'bg-amber-500',
  'tenant.admin_password_reset':'bg-indigo-500',
  'tenant.subscription_assigned':'bg-blue-500',
  'superadmin.owner_seeded':    'bg-purple-500',
};

export function AuditLogPage() {
  const [logs, setLogs]   = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    tenantsApi.allAudit().then(setLogs).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-sm text-slate-400 mt-1">All Super Admin actions recorded here</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="glass rounded-2xl border border-white/8 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500">
            <ScrollText size={24} className="mb-2" />
            <p className="text-sm">No audit entries yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-white/3 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${ACTION_COLOR[log.action] || 'bg-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-sm font-mono text-white">{log.action}</span>
                      {log.actor_email && <span className="text-xs text-slate-500 ml-2">by {log.actor_email}</span>}
                    </div>
                    <div className="text-xs text-slate-600 shrink-0">
                      {new Date(log.created_at).toLocaleString('en-IN')}
                    </div>
                  </div>
                  {Object.keys(log.details).length > 0 && (
                    <div className="mt-1.5 text-xs text-slate-500 font-mono bg-surface-800/50 rounded-lg px-3 py-1.5 inline-block max-w-full truncate">
                      {JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
