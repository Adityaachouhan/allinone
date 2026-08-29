/**
 * server/master-db/models.js
 *
 * Sequelize models for the MASTER (control plane) database.
 * This is a COMPLETELY SEPARATE Sequelize instance from any tenant DB.
 * It connects to saas_master using MASTER_DB_* env vars.
 *
 * GUARDRAIL: Never import tenant models from this file, and never import
 * this file's models in tenant-facing request handlers.
 */
import 'dotenv/config';
import { Sequelize, DataTypes } from 'sequelize';

// ── Master DB connection (saas_master) ─────────────────────────────────────
export const masterSequelize = new Sequelize(
  process.env.MASTER_DB_NAME || 'saas_master',
  process.env.MASTER_DB_USER || process.env.DB_USER || 'postgres',
  process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD,
  {
    host: process.env.MASTER_DB_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MASTER_DB_PORT || process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
    define: {
      underscored: true,
      freezeTableName: true,
      timestamps: false,
    },
  },
);

// ── Super Admins ────────────────────────────────────────────────────────────
export const SuperAdmin = masterSequelize.define(
  'SuperAdmin',
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name:          { type: DataTypes.TEXT, allowNull: false },
    email:         { type: DataTypes.TEXT, allowNull: false, unique: true },
    password_hash: { type: DataTypes.TEXT, allowNull: false },
    role:          { type: DataTypes.TEXT, allowNull: false, defaultValue: 'staff' },
    created_at:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'super_admins' },
);

// ── Subscription Plans ──────────────────────────────────────────────────────
export const SubscriptionPlan = masterSequelize.define(
  'SubscriptionPlan',
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name:          { type: DataTypes.TEXT, allowNull: false },
    price_monthly: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    price_yearly:  { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    features:      { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    is_active:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'subscription_plans' },
);

// ── Tenants ─────────────────────────────────────────────────────────────────
export const Tenant = masterSequelize.define(
  'Tenant',
  {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    business_name:         { type: DataTypes.TEXT, allowNull: false },
    slug:                  { type: DataTypes.TEXT, allowNull: false, unique: true },
    owner_name:            { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    owner_phone:           { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    owner_email:           { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    domain:                { type: DataTypes.TEXT, allowNull: false, unique: true },
    db_host:               { type: DataTypes.TEXT, allowNull: false, defaultValue: 'localhost' },
    db_port:               { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5432 },
    db_name:               { type: DataTypes.TEXT, allowNull: false },
    db_user:               { type: DataTypes.TEXT, allowNull: false },
    db_password_encrypted: { type: DataTypes.TEXT, allowNull: false },
    jwt_secret_encrypted:  { type: DataTypes.TEXT, allowNull: false },
    admin_password_encrypted: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    status:                { type: DataTypes.TEXT, allowNull: false, defaultValue: 'provisioning' },
    created_at:            { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at:            { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'tenants' },
);

// ── Tenant Subscriptions ────────────────────────────────────────────────────
export const TenantSubscription = masterSequelize.define(
  'TenantSubscription',
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id:         { type: DataTypes.UUID, allowNull: false },
    plan_id:           { type: DataTypes.UUID, allowNull: true },
    start_date:        { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
    next_billing_date: { type: DataTypes.DATEONLY, allowNull: true },
    status:            { type: DataTypes.TEXT, allowNull: false, defaultValue: 'active' },
    payment_method:    { type: DataTypes.TEXT, allowNull: false, defaultValue: 'manual' },
    notes:             { type: DataTypes.TEXT, allowNull: true },
    created_at:        { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at:        { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'tenant_subscriptions' },
);

// ── Domain Provisioning ─────────────────────────────────────────────────────
export const DomainProvisioning = masterSequelize.define(
  'DomainProvisioning',
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id:      { type: DataTypes.UUID, allowNull: false },
    domain:         { type: DataTypes.TEXT, allowNull: false },
    purchased_at:   { type: DataTypes.DATE, allowNull: true },
    dns_configured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ssl_issued:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ssl_expires_at: { type: DataTypes.DATE, allowNull: true },
    registrar:      { type: DataTypes.TEXT, allowNull: true },
    notes:          { type: DataTypes.TEXT, allowNull: true },
    created_at:     { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at:     { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'domain_provisioning' },
);

// ── Audit Logs ──────────────────────────────────────────────────────────────
export const AuditLog = masterSequelize.define(
  'AuditLog',
  {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    actor_id:         { type: DataTypes.UUID, allowNull: true },
    actor_email:      { type: DataTypes.TEXT, allowNull: true },
    action:           { type: DataTypes.TEXT, allowNull: false },
    target_tenant_id: { type: DataTypes.UUID, allowNull: true },
    details:          { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at:       { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { tableName: 'audit_logs' },
);

// ── Associations ────────────────────────────────────────────────────────────
Tenant.hasMany(TenantSubscription, { foreignKey: 'tenant_id', as: 'subscriptions' });
TenantSubscription.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(DomainProvisioning, { foreignKey: 'tenant_id', as: 'domainProvisionings' });
DomainProvisioning.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

TenantSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'plan_id', as: 'plan' });
SubscriptionPlan.hasMany(TenantSubscription, { foreignKey: 'plan_id', as: 'subscriptions' });

export async function connectMasterDb() {
  await masterSequelize.authenticate();
}

export default {
  masterSequelize,
  SuperAdmin,
  SubscriptionPlan,
  Tenant,
  TenantSubscription,
  DomainProvisioning,
  AuditLog,
  connectMasterDb,
};
