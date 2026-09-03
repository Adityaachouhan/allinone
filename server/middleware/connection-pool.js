/**
 * server/middleware/connection-pool.js
 *
 * LRU connection pool for per-tenant Sequelize instances.
 *
 * Each tenant domain maps to ONE Sequelize instance. The pool evicts
 * the least-recently-used connection when it exceeds MAX_CONNECTIONS.
 *
 * GUARDRAIL: Pool is keyed ONLY by tenant domain. A connection keyed to
 * domain "bhardwajmart.com" will NEVER be used for "freshmart.in".
 * Eviction calls sequelize.close() to clean up PG connections.
 */

import { Sequelize } from 'sequelize';
import { buildTenantModels } from './tenant-model-factory.js';

const MAX_CONNECTIONS = Number(process.env.TENANT_POOL_MAX) || 100;
const TTL_MS          = Number(process.env.TENANT_POOL_TTL_MS) || 30 * 60 * 1000; // 30 min

// ── LRU Node ─────────────────────────────────────────────────────────────────
class LRUNode {
  constructor(key, value) {
    this.key       = key;
    this.value     = value;
    this.accessedAt = Date.now();
    this.prev      = null;
    this.next      = null;
  }
}

// ── LRU Pool ──────────────────────────────────────────────────────────────────
class TenantConnectionPool {
  constructor() {
    this.map  = new Map();   // domain → LRUNode
    this.head = null;        // most recently used
    this.tail = null;        // least recently used
    this.size = 0;

    // Periodic TTL cleanup every 10 minutes
    setInterval(() => this._evictStale(), 10 * 60 * 1000).unref();
  }

  get(domain) {
    const node = this.map.get(domain);
    if (!node) return null;
    node.accessedAt = Date.now();
    this._moveToHead(node);
    return node.value;
  }

  set(domain, sequelizeInstance, tenantModels) {
    if (this.map.has(domain)) {
      const node = this.map.get(domain);
      node.value = { sequelizeInstance, tenantModels };
      node.accessedAt = Date.now();
      this._moveToHead(node);
      return;
    }

    const node = new LRUNode(domain, { sequelizeInstance, tenantModels });
    this.map.set(domain, node);
    this._addToHead(node);
    this.size++;

    if (this.size > MAX_CONNECTIONS) {
      this._evictTail();
    }
  }

  _addToHead(node) {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  _remove(node) {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  _moveToHead(node) {
    this._remove(node);
    this._addToHead(node);
  }

  _evictTail() {
    if (!this.tail) return;
    const node = this.tail;
    this._remove(node);
    this.map.delete(node.key);
    this.size--;
    node.value.sequelizeInstance.close().catch(() => {});
    console.log(`[Pool] Evicted connection for "${node.key}" (LRU overflow).`);
  }

  _evictStale() {
    const now  = Date.now();
    let   node = this.tail;
    while (node) {
      const prev = node.prev;
      if (now - node.accessedAt > TTL_MS) {
        this._remove(node);
        this.map.delete(node.key);
        this.size--;
        node.value.sequelizeInstance.close().catch(() => {});
        console.log(`[Pool] Evicted stale connection for "${node.key}".`);
      }
      node = prev;
    }
  }
}

export const tenantPool = new TenantConnectionPool();

/**
 * Get or create a Sequelize instance + model set for the given tenant config.
 *
 * @param {string} domain
 * @param {{ db_host, db_port, db_name, db_user, db_password }} tenantConfig
 * @returns {{ sequelizeInstance, tenantModels }}
 */
export async function getOrCreateTenantConnection(domain, { db_host, db_port, db_name, db_user, db_password }) {
  const cached = tenantPool.get(domain);
  if (cached) return cached;

  const seq = new Sequelize(db_name, db_user, db_password, {
    host:    db_host,
    port:    Number(db_port) || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle:    10000,
    },
    define: {
      underscored:     true,
      freezeTableName: true,
      timestamps:      false,
    },
  });

  const tenantModels = buildTenantModels(seq);

  // Auto-ensure database columns on connection initialization.
  // IMPORTANT: Each statement must be run individually — Sequelize's seq.query()
  // only executes the first statement in a multi-statement batch, silently
  // dropping all subsequent ALTER TABLE calls.
  const initStatements = [
    `CREATE TABLE IF NOT EXISTS store_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_name text NOT NULL DEFAULT '',
      tagline text NOT NULL DEFAULT 'Grocery Mart',
      logo_url text NOT NULL DEFAULT '',
      phone text NOT NULL DEFAULT '',
      email text NOT NULL DEFAULT '',
      address text NOT NULL DEFAULT '',
      gstin text NOT NULL DEFAULT '',
      return_policy text,
      grievance_officer text,
      delivery_areas text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_name text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT 'Grocery Mart'`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS gstin text NOT NULL DEFAULT ''`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS return_policy text`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS grievance_officer text`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS delivery_areas text NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text UNIQUE`,
  ];
  for (const stmt of initStatements) {
    try {
      await seq.query(stmt);
    } catch (err) {
      console.warn(`[Pool] Schema auto-migration notice for "${db_name}":`, err.message);
    }
  }

  tenantPool.set(domain, seq, tenantModels);
  console.log(`[Pool] New connection created for "${domain}" → "${db_name}".`);
  return { sequelizeInstance: seq, tenantModels };
}
