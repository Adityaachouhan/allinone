/**
 * super-admin/src/lib/api.ts
 * Typed API client for the Super Admin backend.
 * All calls go to /superadmin/api/* (proxied to Express in dev).
 */

const TOKEN_KEY = 'sa_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t: string) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/superadmin/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export type SAAdmin = { id: string; email: string; name: string; role: string };

export async function login(email: string, password: string) {
  const data = await apiFetch<{ token: string; admin: SAAdmin }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export async function seedOwner(name: string, email: string, password: string) {
  const data = await apiFetch<{ token: string; admin: SAAdmin }>('/auth/seed-owner', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setToken(data.token);
  return data;
}

export async function getMe() {
  return apiFetch<SAAdmin>('/auth/me');
}

// ── Tenants ───────────────────────────────────────────────────────────────────
export type TenantStatus = 'active' | 'trial' | 'suspended' | 'cancelled' | 'provisioning' | 'provisioning_failed';

export interface Tenant {
  id: string;
  business_name: string;
  slug: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  domain: string;
  db_host: string;
  db_port: number;
  db_name: string;
  db_user: string;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
  subscriptions?: Subscription[];
  domainProvisionings?: DomainProvisioning[];
  adminPassword?: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string | null;
  start_date: string;
  next_billing_date: string | null;
  status: string;
  payment_method: string;
  notes?: string;
  plan?: Plan;
}

export interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
}

export interface DomainProvisioning {
  id: string;
  tenant_id: string;
  domain: string;
  purchased_at: string | null;
  dns_configured: boolean;
  ssl_issued: boolean;
  ssl_expires_at: string | null;
  registrar: string | null;
  notes: string | null;
}

export interface Stats {
  total: number;
  active: number;
  trial: number;
  suspended: number;
  cancelled: number;
  provisioning_failed: number;
  mrr: number;
}

export interface ProvisionResult {
  tenant: Tenant;
  credentials: { loginUrl: string; adminEmail: string; adminTempPassword: string };
}

export const tenantsApi = {
  list:  ()     => apiFetch<Tenant[]>('/tenants'),
  stats: ()     => apiFetch<Stats>('/tenants/stats'),
  get:   (id: string) => apiFetch<Tenant>(`/tenants/${id}`),
  patch: (id: string, body: Partial<Tenant>) =>
    apiFetch<Tenant>(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string, hard = false) =>
    apiFetch<{ ok: boolean; deleted: boolean; status?: string }>(`/tenants/${id}?hard=${hard}`, { method: 'DELETE' }),
  provision: (body: {
    businessName: string; ownerName: string; ownerPhone: string;
    ownerEmail: string; domain: string; initialStatus?: string; planId?: string; adminPassword?: string;
  }) => apiFetch<ProvisionResult>('/tenants', { method: 'POST', body: JSON.stringify(body) }),
  setCredentials: (id: string, newEmail?: string, newPassword?: string) =>
    apiFetch<{ adminEmail: string; adminPassword: string }>(`/tenants/${id}/set-credentials`, {
      method: 'POST',
      body: JSON.stringify({ newEmail, newPassword })
    }),
  audit: (id: string) => apiFetch<AuditLog[]>(`/tenants/${id}/audit`),
  allAudit: () => apiFetch<AuditLog[]>('/tenants/audit/all'),
  plans:    () => apiFetch<Plan[]>('/tenants/plans/list'),
  assignPlan: (tenantId: string, planId: string, paymentMethod?: string) =>
    apiFetch<Subscription>(`/tenants/${tenantId}/subscriptions`, {
      method: 'POST',
      body: JSON.stringify({ planId, paymentMethod }),
    }),
  notify: (tenantId: string, title: string, message: string) =>
    apiFetch<{ ok: boolean }>(`/tenants/${tenantId}/notify`, {
      method: 'POST',
      body: JSON.stringify({ title, message }),
    }),
};

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_tenant_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
