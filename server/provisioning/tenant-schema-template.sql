-- ============================================================
-- Per-Tenant Database Schema Template
-- Applied to every new tenant DB during provisioning.
-- This is server/schema.sql PLUS store_settings table.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------
-- Admin Users (tenant's own admins — NOT super admins)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  email         text        NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  role          text        NOT NULL DEFAULT 'owner',   -- 'owner' | 'staff'
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Customer Users (shop's own customers)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         text        NOT NULL UNIQUE,
  email         text,
  password_hash text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id         uuid        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name  text        NOT NULL DEFAULT '',
  phone      text        NOT NULL DEFAULT '',
  email      text        NOT NULL DEFAULT '',
  app_role   text        NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(app_role);

-- -------------------------------------------------------
-- Categories
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        NOT NULL UNIQUE,
  icon_name  text        NOT NULL DEFAULT 'ShoppingBag',
  sort_order int         NOT NULL DEFAULT 0,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Products
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      uuid           REFERENCES categories(id) ON DELETE SET NULL,
  name             text           NOT NULL,
  slug             text           NOT NULL,
  description      text,
  price            numeric(10,2)  NOT NULL DEFAULT 0,
  mrp              numeric(10,2)  NOT NULL DEFAULT 0,
  unit             text           NOT NULL DEFAULT 'piece',
  stock_quantity   int            NOT NULL DEFAULT 0,
  brand            text           NOT NULL DEFAULT '',
  image_url        text           NOT NULL DEFAULT '',
  is_featured      boolean        NOT NULL DEFAULT false,
  is_out_of_stock  boolean        NOT NULL DEFAULT false,
  rating           numeric(2,1)   NOT NULL DEFAULT 4.0,
  created_at       timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug     ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_created  ON products(created_at DESC);

-- -------------------------------------------------------
-- Addresses
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      text        NOT NULL DEFAULT 'Home',
  full_name  text        NOT NULL,
  phone      text        NOT NULL,
  line1      text        NOT NULL,
  line2      text,
  city       text        NOT NULL,
  pincode    text        NOT NULL,
  is_default boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- -------------------------------------------------------
-- Orders
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_number     text           NOT NULL UNIQUE,
  status           text           NOT NULL DEFAULT 'placed',
  subtotal         numeric(10,2)  NOT NULL DEFAULT 0,
  delivery_charge  numeric(10,2)  NOT NULL DEFAULT 0,
  discount         numeric(10,2)  NOT NULL DEFAULT 0,
  total            numeric(10,2)  NOT NULL DEFAULT 0,
  payment_mode     text           NOT NULL DEFAULT 'cod',
  payment_status   text           NOT NULL DEFAULT 'unpaid',
  address_snapshot jsonb          NOT NULL DEFAULT '{}'::jsonb,
  delivery_slot    text,
  notes            text,
  created_at       timestamptz    NOT NULL DEFAULT now(),
  updated_at       timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- -------------------------------------------------------
-- Order Items
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    uuid           REFERENCES products(id) ON DELETE SET NULL,
  product_name  text           NOT NULL,
  product_image text           NOT NULL DEFAULT '',
  unit          text           NOT NULL DEFAULT '',
  price         numeric(10,2)  NOT NULL DEFAULT 0,
  quantity      int            NOT NULL DEFAULT 1,
  subtotal      numeric(10,2)  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- -------------------------------------------------------
-- Banners
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS banners (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  subtitle   text,
  image_url  text        NOT NULL DEFAULT '',
  cta_label  text        NOT NULL DEFAULT 'Shop Now',
  cta_link   text        NOT NULL DEFAULT '/',
  sort_order int         NOT NULL DEFAULT 0,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Delivery Settings
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_settings (
  id                           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  pincode                      text           NOT NULL,
  area_name                    text           NOT NULL DEFAULT '',
  delivery_charge              numeric(10,2)  NOT NULL DEFAULT 0,
  min_order_for_free_delivery  numeric(10,2)  NOT NULL DEFAULT 0,
  is_active                    boolean        NOT NULL DEFAULT true,
  created_at                   timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_pincode ON delivery_settings(pincode);

-- -------------------------------------------------------
-- Store Settings (SAAS ADDITION — one row per tenant DB)
-- Consumer Protection (E-Commerce) Rules 2020 + DPDP Act fields
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_settings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name        text        NOT NULL DEFAULT '',
  logo_url          text        NOT NULL DEFAULT '',
  phone             text        NOT NULL DEFAULT '',
  email             text        NOT NULL DEFAULT '',
  address           text        NOT NULL DEFAULT '',
  gstin             text        NOT NULL DEFAULT '',
  return_policy     text,
  grievance_officer text,       -- name + email of grievance officer (DPDP/Consumer Protection)
  delivery_areas    text        NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- Triggers
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION bump_tenant_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS orders_bump_updated_at ON orders;
CREATE TRIGGER orders_bump_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION bump_tenant_updated_at();

DROP TRIGGER IF EXISTS store_settings_bump_updated_at ON store_settings;
CREATE TRIGGER store_settings_bump_updated_at
  BEFORE UPDATE ON store_settings
  FOR EACH ROW EXECUTE FUNCTION bump_tenant_updated_at();

-- -------------------------------------------------------
-- Seed: default store_settings row (one per tenant DB)
-- -------------------------------------------------------
INSERT INTO store_settings (store_name) VALUES ('') ON CONFLICT DO NOTHING;
