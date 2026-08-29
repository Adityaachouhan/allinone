# Multi-Tenant Grocery SaaS — Project Brief

## 1. Project Overview

Convert the existing single-store grocery website (`allinone`) into a **multi-tenant SaaS platform**. Each tenant gets:

- Their own **custom domain** (e.g. `bhardwajmart.com`)
- Their own **isolated database** (fully separate, zero data sharing)
- Their own **admin dashboard** (manage products, orders, customers)
- Their own **customer-facing storefront**
- Access via login credentials created by the Super Admin

The Super Admin has a separate control panel to create tenants, assign domains, monitor subscriptions, and manage billing.

**Non-negotiable: strict data isolation.** Database-per-tenant. No `tenant_id` shared-table model.

---

## 2. Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS (existing)
- **Backend:** Node.js + Express (existing)
- **ORM:** Sequelize
- **Database:** PostgreSQL — one DB per tenant + one master/control DB (`saas_master`)
- **Auth:** JWT — **separate secrets** for Super Admin vs per-tenant users
- **Process manager:** PM2 (production)
- **Reverse proxy:** Nginx (production, domain routing)
- **SSL:** Let's Encrypt / Certbot (Phase 8+)

---

## 3. Architecture

```
┌─────────────────────────┐
│   SUPER ADMIN PANEL      │
│  (superadmin.yoursaas.com)│
└───────────┬──────────────┘
            │
            ▼
┌─────────────────────────┐
│     MASTER DATABASE      │
│  (saas_master)           │
│  tenants, subscriptions, │
│  domains, billing, logs  │
└───────────┬──────────────┘
            │
  ┌─────────┼──────────┐
  ▼         ▼          ▼
Tenant 1  Tenant 2  Tenant 3
Own DB    Own DB    Own DB
```

---

## 4. Build Order

1. Master DB + Super Admin auth
2. Tenant provisioning backend (DB creation + schema migration)
3. Domain-aware routing middleware (`tenant-resolver.js`)
4. **Isolation test** — must pass before UI work begins
5. Super Admin dashboard UI (`super-admin/`)
6. Tenant admin dashboard refactor (use `req.tenantModels`)
7. Customer storefront hardening (scoped auth, store_settings branding)
8. Domain registrar API + DNS automation
9. SSL automation (Certbot)

---

## 5. Key Rules (see GUARDRAILS.md for full list)

- Every tenant-facing query must use `req.tenantModels`, never a global/hardcoded connection
- Never store DB passwords in plain text — encrypt with `MASTER_ENCRYPTION_KEY`
- Never commit `.env` or secrets to git
- Super Admin JWT secret (`SUPERADMIN_JWT_SECRET`) is completely separate from tenant `JWT_SECRET`
- Provisioning failures must set `status = 'provisioning_failed'` — no silent half-states
