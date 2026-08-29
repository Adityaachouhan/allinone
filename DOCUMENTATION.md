# Multi-Tenant Grocery SaaS Platform — Full Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Design](#4-database-design)
5. [How a Request Works (Lifecycle)](#5-how-a-request-works-lifecycle)
6. [Codebase Structure](#6-codebase-structure)
7. [Backend Layers Explained](#7-backend-layers-explained)
8. [Frontend Applications](#8-frontend-applications)
9. [Security Model](#9-security-model)
10. [API Reference](#10-api-reference)
11. [Running the Project](#11-running-the-project)
12. [Deployment Guide](#12-deployment-guide)
13. [What Was Built — Phase by Phase](#13-what-was-built--phase-by-phase)

---

## 1. Project Overview

This project converts a **single-store grocery website** into a **multi-tenant SaaS platform**. Instead of one store, you now run a platform where many different grocery shops can subscribe and get their own completely isolated online store — all powered by a single backend codebase.

### What "Multi-Tenant" Means Here

| Before (Single Store) | After (Multi-Tenant SaaS) |
|-----------------------|--------------------------|
| One database | One database **per shop** |
| One admin login | One admin login **per shop** + a Super Admin for all shops |
| One domain | Each shop gets its **own custom domain** (e.g. `bhardwajmart.com`) |
| Products/orders from one business | Completely isolated — Shop A can never see Shop B's data |

### Key Roles

| Role | Who | Access |
|------|-----|--------|
| **Super Admin** | You (the SaaS owner) | `http://localhost:5174` — control panel for all shops |
| **Tenant Admin** | The shop owner | `http://shopname.com/admin` — manage their own store |
| **Customer** | End shoppers | `http://shopname.com` — buy groceries |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        THE INTERNET                              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
            ┌───────────▼───────────┐
            │    Nginx (Reverse      │  ← Routes custom domains to Express
            │    Proxy / SSL)        │    Handles SSL certificates
            └───────────┬───────────┘
                        │
            ┌───────────▼───────────────────────────────┐
            │           Express.js Server               │
            │                                           │
            │  ┌────────────────┐ ┌──────────────────┐  │
            │  │ /superadmin/*  │ │   /api/*          │  │
            │  │ (SA routes)    │ │   (Tenant routes) │  │
            │  └───────┬────────┘ └────────┬─────────┘  │
            │          │                   │             │
            │          │          ┌────────▼──────────┐  │
            │          │          │  tenantResolver    │  │
            │          │          │  middleware        │  │
            │          │          │  (reads Host:)     │  │
            │          │          └────────┬──────────┘  │
            └──────────┼───────────────────┼─────────────┘
                       │                   │
          ┌────────────▼─────┐    ┌────────▼──────────────┐
          │  saas_master DB  │    │  LRU Connection Pool  │
          │  (PostgreSQL)    │◄───│  (domain → Sequelize) │
          │                  │    └────────┬──────────────┘
          │  - tenants       │             │
          │  - subscriptions │    ┌────────▼──────────────────────┐
          │  - audit_logs    │    │  Per-Tenant PostgreSQL DBs    │
          │  - plans         │    │                               │
          └──────────────────┘    │  tenant_bhardwajmart          │
                                  │  tenant_freshmart             │
                                  │  tenant_greengrocer           │
                                  │  ...one DB per shop...        │
                                  └───────────────────────────────┘
```

### Three Separate Applications

| App | Port | Purpose |
|-----|------|---------|
| **Express API** | `9095` | Backend — serves all APIs and the React SPA in production |
| **Tenant Storefront (Vite)** | `5173` | Dev server for the customer-facing grocery store |
| **Super Admin Dashboard (Vite)** | `5174` | Dev server for the SaaS control panel |

---

## 3. Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Backend framework** | Express.js | Existing stack — kept as-is |
| **Database** | PostgreSQL | Existing stack — one DB per tenant |
| **ORM** | Sequelize v6 | Existing stack — models built dynamically per-tenant |
| **Frontend** | React 18 + TypeScript | Existing stack |
| **Build tool** | Vite | Existing stack — used for both storefronts |
| **CSS** | Tailwind CSS | Existing stack |
| **Auth** | JSON Web Tokens (JWT) | Separate secret per tenant + separate SA secret |
| **Encryption** | Node.js `crypto` (AES-256-GCM) | Encrypts tenant DB passwords stored in master DB |
| **Password hashing** | bcryptjs | Customer and admin passwords |

---

## 4. Database Design

### 4a. Master Database (`saas_master`)

This is the **control plane** — it knows about all tenants but contains **zero business data** (no products, no orders, no customer information).

```
saas_master
│
├── superadmins          → People who can log into the control panel
│     id, name, email, password_hash, role
│
├── tenants              → One row = one grocery shop
│     id, business_name, slug, domain
│     db_host, db_name, db_user, db_password_encrypted   ← credentials, encrypted
│     jwt_secret_encrypted                               ← per-tenant JWT secret
│     status  (provisioning → active / trial / suspended / cancelled)
│     owner_name, owner_email, owner_phone
│
├── plans                → Subscription tiers (Basic, Pro, Enterprise)
│     id, name, price_monthly, price_yearly, features[]
│
├── subscriptions        → Which plan each tenant is on
│     tenant_id, plan_id, status, start_date, next_billing_date
│
├── domain_provisioning  → DNS & SSL tracking per tenant
│     tenant_id, domain, dns_configured, ssl_issued, ssl_expires_at
│
└── audit_logs           → Every SA action recorded here
      actor_email, action, target_tenant_id, details, created_at
```

### 4b. Tenant Database (one per shop)

Every provisioned shop gets its own completely isolated PostgreSQL database. The schema is cloned from a template:

```
tenant_<shopname>
│
├── admin_users          → The shop's own staff logins
├── store_settings       → Shop name, logo, contact info, legal details
├── categories           → Product categories for this shop only
├── products             → This shop's product catalog
├── banners              → Homepage banners for this shop
├── users                → Customer accounts for this shop
├── profiles             → Customer profile details
├── addresses            → Customer delivery addresses
├── orders               → Orders placed on this shop
├── order_items          → Line items per order
└── delivery_settings    → Pincode → delivery charge mapping
```

> **Isolation guarantee:** There are no foreign keys, shared tables, or any connection between two tenant databases. They are physically separate databases on PostgreSQL.

---

## 5. How a Request Works (Lifecycle)

### Customer visits `bhardwajmart.com/api/products`

```
1. Browser sends: GET /api/products
   Host: bhardwajmart.com

2. Express receives the request
   → It hits the tenantResolver middleware

3. tenantResolver reads req.hostname → "bhardwajmart.com"

4. Queries saas_master:
   SELECT * FROM tenants WHERE domain = 'bhardwajmart.com'

5. Checks tenant status:
   - "active"    → proceed ✅
   - "suspended" → return 402 page ❌
   - "cancelled" → return 410 page ❌
   - not found   → return 404 page ❌

6. Decrypts tenant's DB password (AES-256-GCM, in memory only)

7. Gets or creates a Sequelize connection from the LRU pool
   → Pool is keyed by domain — "bhardwajmart.com" NEVER gets
     the connection for "freshmart.com"

8. Attaches to request:
   req.tenant        → { id, domain, business_name, status }
   req.tenantModels  → { Product, Category, Order, User, ... }
   req.tenantDb      → the Sequelize instance
   req.tenantJwtSecret → decrypted, for this request only

9. Handler runs:
   const { Product, Category } = req.tenantModels;
   const products = await Product.findAll(...);
   → Queries ONLY bhardwajmart's database

10. Response sent with bhardwajmart's products only
```

### Super Admin visits `/superadmin/api/tenants`

```
1. Request hits Express
   → SA routes are registered BEFORE tenantResolver
   → tenantResolver NEVER runs for SA routes
   → No tenant DB is ever touched

2. requireSuperAdmin middleware verifies the SA JWT
   (Uses SUPERADMIN_JWT_SECRET — different from all tenant secrets)

3. Handler queries saas_master directly
   → Lists tenants, no customer/product data ever returned
```

---

## 6. Codebase Structure

```
allinone/
│
├── .env                          ← Environment variables
├── package.json                  ← Root scripts
├── PROJECT_BRIEF.md              ← Original project requirements
├── GUARDRAILS.md                 ← Isolation rules (read before coding)
├── DOCUMENTATION.md              ← This file
│
├── server/                       ← Express.js backend
│   ├── index.js                  ← Main entry point — wires everything together
│   ├── superadmin-auth.js        ← SA login, JWT, requireSuperAdmin middleware
│   │
│   ├── master-db/                ← Control plane (saas_master database)
│   │   ├── schema.sql            ← Master DB table definitions
│   │   ├── models.js             ← Sequelize models for saas_master
│   │   ├── crypto.js             ← AES-256-GCM encrypt/decrypt
│   │   ├── create-db.js          ← One-time: creates saas_master database
│   │   └── migrate.js            ← Idempotent: applies schema to saas_master
│   │
│   ├── provisioning/             ← Tenant creation logic
│   │   ├── provision-tenant.js   ← 9-step orchestration with rollback
│   │   ├── routes.js             ← SA-only REST API for tenant management
│   │   └── tenant-schema-template.sql ← Schema cloned into each new tenant DB
│   │
│   ├── middleware/               ← THE isolation layer
│   │   ├── tenant-resolver.js    ← Host header → master DB → req.tenantModels
│   │   ├── connection-pool.js    ← LRU pool of per-tenant Sequelize instances
│   │   └── tenant-model-factory.js ← Builds Sequelize models for a given DB
│   │
│   ├── routes/
│   │   └── tenant-api.js         ← All customer/admin API routes
│   │
│   └── tests/
│       └── isolation.test.js     ← 8-point isolation verification test
│
├── src/                          ← Tenant Storefront (React/TypeScript)
│   ├── App.tsx                   ← Router
│   ├── lib/
│   │   ├── api.ts                ← fetch wrapper (adds JWT header, prefixes /api)
│   │   ├── db.ts                 ← Data-fetching functions
│   │   └── queries.ts            ← Higher-level data queries
│   ├── context/                  ← React Context (auth, cart)
│   ├── components/               ← Reusable UI components
│   └── pages/
│       ├── HomePage.tsx
│       ├── ProductListingPage.tsx
│       ├── ProductDetailPage.tsx
│       ├── CartPage.tsx
│       ├── CheckoutPage.tsx
│       ├── AuthPage.tsx
│       ├── AccountPage.tsx
│       ├── OrderConfirmationPage.tsx
│       └── admin/
│           ├── AdminLoginPage.tsx
│           ├── AdminDashboardPage.tsx
│           ├── AdminProductsPage.tsx
│           ├── AdminCategoriesPage.tsx
│           ├── AdminOrdersPage.tsx
│           ├── AdminCustomersPage.tsx
│           ├── AdminBannersPage.tsx
│           ├── AdminDeliveryPage.tsx
│           └── AdminStoreSettingsPage.tsx
│
└── super-admin/                  ← Super Admin Dashboard (separate Vite app)
    ├── package.json              ← Separate dependencies (port 5174)
    ├── vite.config.ts            ← Proxies /superadmin/api → Express
    └── src/
        ├── App.tsx
        ├── lib/api.ts            ← SA-specific API client
        ├── context/AuthContext.tsx
        ├── components/
        │   └── SuperAdminLayout.tsx
        └── pages/
            ├── LoginPage.tsx
            ├── DashboardPage.tsx
            ├── TenantsListPage.tsx
            ├── TenantDetailPage.tsx
            ├── OnboardTenantPage.tsx
            └── AuditLogPage.tsx
```

---

## 7. Backend Layers Explained

### Layer 1: `server/index.js` — The Router

This is where all traffic enters. It has two completely separate paths:

```
SA traffic:
  POST /superadmin/api/auth/login   → saAuthRouter
  GET  /superadmin/api/tenants      → provisioningRouter
  (tenantResolver NEVER runs here)

Tenant traffic:
  *   /api/*   → tenantResolver → requireTenant → tenantApiRouter
  *   /*       → serves built React SPA (index.html)
```

### Layer 2: `tenant-resolver.js` — The Isolation Enforcer

This middleware runs for every `/api/*` request. It:

1. Reads `req.hostname` from the `Host` HTTP header
2. Looks up that hostname in `saas_master.tenants`
3. Validates the tenant's status (blocks suspended/cancelled)
4. Decrypts the tenant DB password in memory (never logged, never sent)
5. Gets a pooled Sequelize connection for that domain
6. Attaches `req.tenantModels` so route handlers can query the correct DB

### Layer 3: `connection-pool.js` — The LRU Pool

Creating a new Sequelize connection for every request would be very slow. The LRU pool solves this:

- **Key:** domain name (e.g. `"bhardwajmart.com"`)
- **Value:** Sequelize instance + built model set
- **Max size:** 100 connections (configurable via `TENANT_POOL_MAX`)
- **TTL:** 30 minutes of inactivity (configurable via `TENANT_POOL_TTL_MS`)
- **Eviction:** When pool is full, the Least Recently Used connection is closed
- **Safety:** Domain key means a connection can never bleed between tenants

### Layer 4: `tenant-model-factory.js` — Dynamic Models

Normal Sequelize apps define models once globally. Here, models are built fresh for each Sequelize instance so they are bound to that specific database:

```js
const { Product, Order } = buildTenantModels(tenantSequelizeInstance);
```

### Layer 5: `tenant-api.js` — Route Handlers

All routes follow one rule: **only use `req.tenantModels.*`**, never global imports.

```js
// ✅ CORRECT — uses the isolated tenant models
router.get('/api/products', async (req, res) => {
  const { Product, Category } = req.tenantModels;
  const rows = await Product.findAll({ include: [{ model: Category }] });
  res.json(rows);
});

// ❌ WRONG — this would break isolation
import { Product } from '../models/index.js';
```

### Layer 6: `provision-tenant.js` — Tenant Creation

When a new shop is onboarded, 9 steps run in sequence. If any step fails, all previous steps are rolled back:

| Step | Action | Rollback |
|------|--------|---------|
| 1 | Create tenant record in master DB (status: `provisioning`) | Delete record |
| 2 | Create PostgreSQL database `tenant_<slug>` | Drop database |
| 3 | Create PostgreSQL role with limited privileges | Drop role |
| 4 | Grant role access to the new database | Revoke grant |
| 5 | Apply schema template to new database | Drop database |
| 6 | Generate & encrypt JWT secret | — |
| 7 | Create initial admin user in tenant DB | — |
| 8 | Store encrypted password + JWT secret in master record | — |
| 9 | Set status to `active` (or `trial`) | Set status to `provisioning_failed` |

---

## 8. Frontend Applications

### 8a. Tenant Storefront (`src/`)

The customer-facing grocery shopping website. Each tenant shares the **same React code** — the data is different because API calls go to a domain-specific backend that returns only that tenant's data.

| Page | Path | What it does |
|------|------|-------------|
| Home | `/` | Banners, featured products, categories, deals |
| Product Listing | `/category/:slug` | Products filtered by category |
| Product Detail | `/product/:slug` | Single product with related items |
| Cart | `/cart` | Shopping cart with quantity controls |
| Checkout | `/checkout` | Address, delivery slot, payment, order placement |
| Order Confirmation | `/order/:number` | Order success page |
| Auth | `/auth` | Customer sign up / sign in |
| My Account | `/account` | Profile, order history, addresses |
| Admin Login | `/admin/login` | Tenant admin login |
| Admin Dashboard | `/admin` | Sales stats, recent orders |
| Admin Products | `/admin/products` | Add/edit/delete products |
| Admin Categories | `/admin/categories` | Manage categories |
| Admin Orders | `/admin/orders` | View & update order statuses |
| Admin Customers | `/admin/customers` | Customer list |
| Admin Banners | `/admin/banners` | Homepage banner management |
| Admin Delivery | `/admin/delivery` | Pincode → delivery charge settings |
| Admin Store Settings | `/admin/store-settings` | Branding, contact info, legal compliance |

### 8b. Super Admin Dashboard (`super-admin/`)

The SaaS control panel. Runs on port 5174 with its own Vite config and auth flow.

| Page | What it does |
|------|-------------|
| Login | SA login. First-time "owner setup" creates the first SA account |
| Dashboard | MRR, tenant counts by status, recent shops table |
| All Shops | Searchable, filterable list of all tenants with status badges |
| Shop Detail | Full shop info, DNS/SSL status, subscription plan, activate/suspend, password reset |
| Onboard Shop | Multi-step: form → provisioning animation → credentials display |
| Audit Log | Timestamped log of all SA actions |

---

## 9. Security Model

### JWT Architecture — Three Separate Secrets

```
SUPERADMIN_JWT_SECRET  (in .env)
  └── Used ONLY for Super Admin tokens
  └── Completely separate from all tenant tokens

Per-Tenant JWT Secret  (stored encrypted in saas_master.tenants)
  └── Generated randomly when tenant is provisioned
  └── Encrypted with MASTER_ENCRYPTION_KEY before storage
  └── Decrypted per-request, attached as req.tenantJwtSecret
  └── Never the same between two tenants
```

### Encryption

- **Algorithm:** AES-256-GCM (authenticated encryption — detects tampering)
- **Key:** `MASTER_ENCRYPTION_KEY` — 256-bit key stored in `.env`
- **What's encrypted:** Tenant DB passwords + tenant JWT secrets in `saas_master`
- **When decrypted:** Only in memory, never logged, never returned to client

### Data Isolation Guarantees

| Threat | Mitigation |
|--------|-----------|
| Shop A reading Shop B's products | Physically separate databases |
| Shared connection bleeding between tenants | Pool is keyed strictly by domain |
| Token from Shop A working on Shop B | Each shop has a unique JWT secret |
| SA token working on tenant API | SA tokens rejected by tenant middleware |
| Partial provisioning leaving orphan DB | Rollback pattern cleans up on any failure |

### Isolation Test

Run anytime to verify the isolation is intact:

```bash
npm run test:isolation
# Last verified: 8/8 assertions passed ✅
```

---

## 10. API Reference

### Super Admin API (`/superadmin/api/*`)

All routes require `Authorization: Bearer <sa_token>` except login/seed-owner.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/superadmin/api/auth/login` | SA login |
| `POST` | `/superadmin/api/auth/seed-owner` | Create first SA account (one-time) |
| `GET` | `/superadmin/api/auth/me` | Get current SA profile |
| `GET` | `/superadmin/api/tenants` | List all tenants |
| `POST` | `/superadmin/api/tenants` | Provision a new tenant shop |
| `GET` | `/superadmin/api/tenants/stats` | Counts by status + MRR |
| `GET` | `/superadmin/api/tenants/audit/all` | All audit log entries |
| `GET` | `/superadmin/api/tenants/plans/list` | All subscription plans |
| `GET` | `/superadmin/api/tenants/:id` | Single tenant details |
| `PATCH` | `/superadmin/api/tenants/:id` | Update tenant (status, etc.) |
| `POST` | `/superadmin/api/tenants/:id/reset-password` | Reset tenant admin password |
| `GET` | `/superadmin/api/tenants/:id/audit` | Audit log for one tenant |
| `POST` | `/superadmin/api/tenants/:id/subscriptions` | Assign subscription plan |

### Tenant API (`/api/*`)

All routes require the `Host` header to match a known tenant domain.

#### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/signup` | None | Customer registration |
| `POST` | `/api/auth/signin` | None | Customer login |
| `GET` | `/api/auth/me` | Customer | Get own profile |
| `POST` | `/api/admin/auth/login` | None | Tenant admin login |
| `GET` | `/api/admin/auth/me` | Admin | Get admin profile |

#### Storefront (Public)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/store` | Store name, logo, contact info |
| `GET` | `/api/categories` | All categories |
| `GET` | `/api/products` | All products |
| `GET` | `/api/products/slug/:slug` | Single product |
| `GET` | `/api/banners` | Active banners |
| `GET` | `/api/delivery-settings` | Pincode → delivery charge |

#### Customer (Auth Required)

| Method | Path | Description |
|--------|------|-------------|
| `GET/POST/DELETE` | `/api/addresses` | Saved addresses |
| `GET/POST` | `/api/orders` | Order history / place order |
| `GET` | `/api/order-items?orderId=` | Items in an order |
| `PATCH` | `/api/profiles/me` | Update my profile |

#### Admin (Admin Token Required)

| Method | Path | Description |
|--------|------|-------------|
| `POST/PATCH/DELETE` | `/api/categories/:id` | Manage categories |
| `POST/PATCH/DELETE` | `/api/products/:id` | Manage products |
| `POST/PATCH/DELETE` | `/api/banners/:id` | Manage banners |
| `POST/PATCH/DELETE` | `/api/delivery-settings/:id` | Manage delivery zones |
| `GET` | `/api/orders` | All orders |
| `PATCH` | `/api/orders/:id` | Update order status |
| `GET` | `/api/customers` | All customers |
| `GET/PATCH` | `/api/store-settings` | Store configuration |

---

## 11. Running the Project

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally
- Git

### Environment Variables (`.env`)

```bash
# ── Master Database ────────────────────────────────────────────────
MASTER_DB_HOST=localhost
MASTER_DB_PORT=5432
MASTER_DB_USER=postgres
MASTER_DB_PASSWORD=your_postgres_password
MASTER_DB_NAME=saas_master

# ── Encryption Key ────────────────────────────────────────────────
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
MASTER_ENCRYPTION_KEY=<64 hex chars>

# ── Super Admin JWT Secret ────────────────────────────────────────
SUPERADMIN_JWT_SECRET=<long random string>

# ── Server ────────────────────────────────────────────────────────
PORT=9095
TENANT_POOL_MAX=100
TENANT_POOL_TTL_MS=1800000
```

### First-Time Setup

```bash
# 1. Install root dependencies
npm install

# 2. Install Super Admin dependencies
cd super-admin && npm install && cd ..

# 3. Create and migrate the master database
npm run master:setup

# 4. Verify isolation is working
npm run test:isolation
# Expected: "8/8 tests passed ✅"
```

### Starting (Development)

**Terminal 1 — Backend + Tenant Storefront:**
```bash
npm run dev
# Express API    → http://localhost:9095
# Tenant SPA     → http://localhost:5173
```

**Terminal 2 — Super Admin Dashboard:**
```bash
cd super-admin
npm run dev
# Super Admin UI → http://localhost:5174
```

### First Login (Super Admin)

1. Open **http://localhost:5174**
2. Click **"First time? Set up owner account →"**
3. Enter your name, email, and a password (min 8 characters)
4. You are now logged in as Super Admin

### Testing with a Local Tenant

1. In the Super Admin dashboard, click **Onboard Shop**
2. Fill in details, use `testshop.local` as the domain
3. After provisioning, copy the temporary admin password shown
4. Add to `C:\Windows\System32\drivers\etc\hosts` (as Administrator):
   ```
   127.0.0.1   testshop.local
   ```
5. Visit `http://testshop.local:9095` — see the tenant's storefront
6. Visit `http://testshop.local:9095/admin/login` — log in with provisioned credentials

### Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start backend + tenant storefront |
| `npm run server` | Start backend only |
| `npm run master:setup` | Create + migrate `saas_master` (run once) |
| `npm run master:migrate` | Re-apply master schema (idempotent) |
| `npm run test:isolation` | Run the 8-point isolation test |
| `npm run build` | Build tenant SPA to `dist/` |

---

## 12. Deployment Guide

### Nginx Configuration

```nginx
# Catch ALL tenant custom domains → proxy to Express
server {
    listen 80;
    server_name ~^.+$;

    location / {
        proxy_pass http://localhost:9095;
        proxy_set_header Host $host;         # ← Critical for domain routing
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Super Admin Panel
server {
    listen 80;
    server_name superadmin.yourdomain.com;
    root /var/www/super-admin-dist;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```

### Production Checklist

- [ ] Generate a new `MASTER_ENCRYPTION_KEY` for production (never reuse dev key)
- [ ] Set a strong `SUPERADMIN_JWT_SECRET`
- [ ] Confirm `.env` is in `.gitignore` and not committed
- [ ] Build both frontends: `npm run build` and `cd super-admin && npm run build`
- [ ] Set up Nginx reverse proxy
- [ ] Obtain SSL certificates (Let's Encrypt wildcard recommended)
- [ ] Run `npm run test:isolation` on the production server
- [ ] Disable or IP-restrict `/superadmin/api/auth/seed-owner` after first use
- [ ] Set `NODE_ENV=production` in environment

---

## 13. What Was Built — Phase by Phase

### Phase 0 — Project Foundation
Created `PROJECT_BRIEF.md` with all requirements and `GUARDRAILS.md` with strict isolation rules. Created `feature/multi-tenant` branch to keep all work isolated from `main`.

### Phase 1 — Master Database
Designed the `saas_master` control plane schema (6 tables). Built Sequelize models for the master DB using a completely separate Sequelize instance that is never mixed with tenant connections. Added AES-256-GCM encryption for tenant credentials. Added Super Admin authentication with its own JWT secret (separate from all tenant JWT secrets).

### Phase 2 — Tenant Provisioning
Designed the per-tenant DB schema template (9 tables covering the full grocery store domain). Built `provision-tenant.js` with 9 atomic steps and full rollback on failure — if anything goes wrong mid-provisioning, no partial or broken tenant state is left behind. Built the Super Admin REST API covering the complete tenant lifecycle: create, read, update status, reset password, assign subscription plans, view audit logs.

### Phase 3 — Isolation Middleware (The Core)
This is the most critical and novel part of the system:

- **`connection-pool.js`**: An LRU cache (max 100 entries) mapping each tenant domain to its own Sequelize instance. Evicts by LRU overflow and by 30-minute inactivity TTL. Domain is the only key — a connection for `bhardwajmart.com` can never serve `freshmart.com`.
- **`tenant-model-factory.js`**: A factory function that takes a Sequelize instance and returns a full set of Sequelize models bound to that instance. This is the single canonical source of tenant model definitions.
- **`tenant-resolver.js`**: The request-level isolation enforcer. Reads `Host` header → queries master DB → validates status → decrypts credentials in memory → gets pooled connection → attaches `req.tenantModels`. Fails closed (4xx/5xx) for any error condition.
- **`tenant-api.js`**: All ~40 tenant-facing API routes rewritten to use `req.tenantModels` exclusively. Zero global Sequelize imports.
- **`server/index.js`**: Rewired as a multi-tenant router. SA routes are registered before `tenantResolver` so they never trigger tenant DB lookups.

### Phase 4 — Verification
Built `server/tests/isolation.test.js`. The test provisions two real PostgreSQL databases, inserts a product into Tenant A, then queries Tenant B and asserts it returns zero products. **Result: 8/8 assertions passed. Zero cross-tenant data leakage confirmed.**

### Phase 5 — Super Admin Dashboard
Built a complete separate Vite + React + TypeScript app in `super-admin/`. Design: premium dark-mode glassmorphism with Inter font. Six pages covering the full tenant management lifecycle. The Vite dev server proxies `/superadmin/api` to the Express backend so there is no CORS configuration needed in development.

### Phase 6 — Tenant Admin Enhancements
Added `AdminStoreSettingsPage.tsx` covering store branding (name, logo), contact information, and legal compliance fields (GSTIN, return policy, grievance officer contact) as required by Consumer Protection (E-Commerce) Rules 2020 and the Digital Personal Data Protection Act 2023. Each field is stored in the tenant's own isolated `store_settings` table — never in the master DB.

---

*Branch: `feature/multi-tenant` · Commit: `fdc5477` · August 2026*
