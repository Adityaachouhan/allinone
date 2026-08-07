# Multi-Tenant Grocery SaaS — Guardrails

> Paste this into any AI tool alongside `PROJECT_BRIEF.md`. Tell it: "Follow these constraints strictly — flag anything that would violate one of these rules instead of writing it."

---

## 1. Data Isolation — Non-Negotiable

- **NEVER** use a shared database with a `tenant_id` column as the isolation mechanism. One fully separate database per tenant.
- **NEVER** write any query that uses a default/global/hardcoded database connection for tenant data. Every tenant query goes through `req.tenantModels`, resolved per-request from the domain-lookup middleware.
- **NEVER** cache a tenant's DB connection globally across requests from different tenants. Pooling is fine, but keyed strictly to one tenant.
- **NEVER** create a shared table storing data from multiple tenants together.
- **NEVER** let the Super Admin session double as a tenant admin session. Separate JWT secrets, separate login routes, separate middleware.
- **NEVER** skip the isolation test. It must pass (exit 0) before UI work begins.

---

## 2. Credentials & Secrets

- **NEVER** store DB passwords or API keys in plain text. Encrypt at rest with `MASTER_ENCRYPTION_KEY`.
- **NEVER** commit `.env`, credential files, or secrets to git.
- **NEVER** expose registrar API keys, DB credentials, or SSL commands in client-side code.
- **NEVER** log full DB passwords or API keys — mask them.
- **NEVER** reuse the same DB user/password across multiple tenant databases.

---

## 3. Provisioning

- **NEVER** leave a tenant in a half-provisioned state without marking `status = 'provisioning_failed'`.
- **NEVER** provision without a rollback/cleanup path.
- **NEVER** auto-purchase a domain without explicit Super Admin trigger.
- **NEVER** launch a tenant without HTTPS (once in production).

---

## 4. Routing & Middleware

- **NEVER** resolve tenant identity from anything other than the verified `Host` header looked up against the master DB.
- **NEVER** allow a request to proceed if domain lookup fails or tenant is `suspended`/`cancelled`.
- **NEVER** hardcode any tenant's domain, DB name, or credentials in application code.

---

## 5. Development Process

- **NEVER** build the entire system in one pass — one module at a time, in build order.
- **NEVER** test provisioning logic against a live tenant — use disposable dummy tenants.
- **NEVER** introduce a new ORM or auth framework without checking it fits the existing stack.
- **NEVER** write speculative future-proofing code for features not yet requested.

---

## 6. Business & Legal

- **NEVER** default a tenant's business info, GST details, or legal disclaimers to platform owner info.
- **NEVER** auto-delete a tenant's database on cancellation — grace period + export window first.
- **NEVER** build a payment gateway integration unless explicitly asked.
