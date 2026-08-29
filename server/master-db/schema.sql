-- ============================================================
-- saas_master — Control Plane Schema
-- Run: node server/master-db/migrate.js
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------
-- Super Admins (platform owner + staff)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS super_admins (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  email       text        NOT NULL UNIQUE,
  password_hash text      NOT NULL,
  role        text        NOT NULL DEFAULT 'staff',   -- 'owner' | 'staff'
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Subscription Plans
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text          NOT NULL,              -- Basic, Pro, Enterprise
  price_monthly   numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly    numeric(10,2) NOT NULL DEFAULT 0,
  features        jsonb         NOT NULL DEFAULT '[]',
  is_active       boolean       NOT NULL DEFAULT true,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Tenants Registry
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name        text        NOT NULL,
  slug                 text        NOT NULL UNIQUE,    -- used as DB name suffix
  owner_name           text        NOT NULL DEFAULT '',
  owner_phone          text        NOT NULL DEFAULT '',
  owner_email          text        NOT NULL DEFAULT '',
  domain               text        NOT NULL UNIQUE,    -- e.g. bhardwajmart.com
  db_host              text        NOT NULL DEFAULT 'localhost',
  db_port              int         NOT NULL DEFAULT 5432,
  db_name              text        NOT NULL,           -- tenant_<slug>
  db_user              text        NOT NULL,           -- per-tenant PG role
  db_password_encrypted text       NOT NULL,           -- AES-256-GCM, MASTER_ENCRYPTION_KEY
  jwt_secret_encrypted  text       NOT NULL,           -- per-tenant JWT secret (encrypted)
  admin_password_encrypted text    NOT NULL DEFAULT '', -- AES-256-GCM for viewing in super admin UI
  status               text        NOT NULL DEFAULT 'provisioning',
    -- 'provisioning' | 'active' | 'trial' | 'suspended' | 'cancelled' | 'provisioning_failed'
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON tenants(slug);

-- Auto-migrate existing saas_master database tables if they are missing the new columns
DO $$
BEGIN
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_password_encrypted text NOT NULL DEFAULT '';
END $$;

-- -------------------------------------------------------
-- Tenant Subscriptions
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id           uuid        REFERENCES subscription_plans(id) ON DELETE SET NULL,
  start_date        date        NOT NULL DEFAULT CURRENT_DATE,
  next_billing_date date,
  status            text        NOT NULL DEFAULT 'active',  -- 'active' | 'past_due' | 'cancelled'
  payment_method    text        NOT NULL DEFAULT 'manual',
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subs_tenant ON tenant_subscriptions(tenant_id);

-- -------------------------------------------------------
-- Domain Provisioning Log
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS domain_provisioning (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain         text        NOT NULL,
  purchased_at   timestamptz,
  dns_configured boolean     NOT NULL DEFAULT false,
  ssl_issued     boolean     NOT NULL DEFAULT false,
  ssl_expires_at timestamptz,
  registrar      text,                  -- 'godaddy' | 'namecheap' | 'manual'
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_domain_prov_tenant ON domain_provisioning(tenant_id);

-- -------------------------------------------------------
-- Audit Log
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id         uuid,                        -- super_admins.id
  actor_email      text,
  action           text        NOT NULL,        -- 'tenant.created' | 'tenant.suspended' etc.
  target_tenant_id uuid        REFERENCES tenants(id) ON DELETE SET NULL,
  details          jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant   ON audit_logs(target_tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_logs(created_at DESC);

-- -------------------------------------------------------
-- Trigger: bump updated_at on tenants + subscriptions
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION bump_master_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS tenants_bump_updated_at ON tenants;
CREATE TRIGGER tenants_bump_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION bump_master_updated_at();

DROP TRIGGER IF EXISTS subs_bump_updated_at ON tenant_subscriptions;
CREATE TRIGGER subs_bump_updated_at
  BEFORE UPDATE ON tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION bump_master_updated_at();

DROP TRIGGER IF EXISTS domain_prov_bump_updated_at ON domain_provisioning;
CREATE TRIGGER domain_prov_bump_updated_at
  BEFORE UPDATE ON domain_provisioning
  FOR EACH ROW EXECUTE FUNCTION bump_master_updated_at();

-- -------------------------------------------------------
-- Seed: default subscription plans
-- -------------------------------------------------------
INSERT INTO subscription_plans (name, price_monthly, price_yearly, features)
  VALUES
    ('Trial',      0,     0,     '["Up to 50 products","1 admin user","Email support"]'),
    ('Basic',    999,  9990,   '["Up to 500 products","2 admin users","Email support"]'),
    ('Pro',     2499, 24990,  '["Unlimited products","5 admin users","Priority support","Analytics"]')
  ON CONFLICT DO NOTHING;
