/**
 * server/middleware/sse-manager.js
 *
 * In-memory manager for Server-Sent Events (SSE) connections.
 * Keyed by tenant ID to isolate notifications per shop.
 *
 * NGINX BUFFERING NOTE:
 *  The SSE route sets "X-Accel-Buffering: no" so nginx passes events
 *  through immediately. This file also calls res.flush() (if available)
 *  after every write as a secondary safeguard.
 */

class SSEManager {
  constructor() {
    // Map<tenantId, Set<express.Response>>
    this.clients = new Map();
  }

  /**
   * Safely write to an SSE response. Handles broken connections gracefully
   * and calls res.flush() to bypass any intermediate buffering.
   */
  _safeWrite(res, data) {
    try {
      res.write(data);
      // flush() is available when Express compression middleware is used.
      // It's a no-op otherwise but calling it is harmless.
      if (typeof res.flush === 'function') res.flush();
      return true;
    } catch (err) {
      // Connection was closed unexpectedly — remove the dead client
      console.warn('[SSE] Write failed (client likely disconnected):', err.message);
      return false;
    }
  }

  addClient(tenantId, res) {
    if (!this.clients.has(tenantId)) {
      this.clients.set(tenantId, new Set());
    }
    const tenantClients = this.clients.get(tenantId);
    tenantClients.add(res);

    // Send initial comment heartbeat so the browser confirms the connection is open
    this._safeWrite(res, ':\n\n');

    // Heartbeat every 25 seconds to prevent proxy/firewall timeouts
    const interval = setInterval(() => {
      const ok = this._safeWrite(res, ':\n\n');
      if (!ok) {
        // Clean up if the write failed (broken connection)
        clearInterval(interval);
        tenantClients.delete(res);
        if (tenantClients.size === 0) this.clients.delete(tenantId);
      }
    }, 25000);

    res.on('close', () => {
      clearInterval(interval);
      tenantClients.delete(res);
      if (tenantClients.size === 0) {
        this.clients.delete(tenantId);
      }
      console.log(`[SSE] Client disconnected from tenant ${tenantId}. Remaining clients: ${tenantClients.size}`);
    });

    console.log(`[SSE] Client registered for tenant ${tenantId}. Total clients: ${tenantClients.size}`);
  }

  notifyTenant(tenantId, data) {
    const tenantClients = this.clients.get(tenantId);
    if (!tenantClients || tenantClients.size === 0) {
      console.log(`[SSE] No admin clients connected for tenant ${tenantId} — notification not delivered.`);
      return;
    }

    const payload = `data: ${JSON.stringify(data)}\n\n`;
    let delivered = 0;
    const dead = [];

    for (const client of tenantClients) {
      const ok = this._safeWrite(client, payload);
      if (ok) {
        delivered++;
      } else {
        dead.push(client);
      }
    }

    // Clean up dead connections
    for (const client of dead) {
      tenantClients.delete(client);
    }
    if (tenantClients.size === 0) {
      this.clients.delete(tenantId);
    }

    console.log(`[SSE] Notification delivered to ${delivered} admin client(s) for tenant ${tenantId}.`);
  }

  /** Returns the number of connected clients across all tenants (for diagnostics) */
  getTotalClientCount() {
    let total = 0;
    for (const set of this.clients.values()) total += set.size;
    return total;
  }
}

export const sseManager = new SSEManager();
