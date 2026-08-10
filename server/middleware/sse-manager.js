/**
 * server/middleware/sse-manager.js
 *
 * In-memory manager for Server-Sent Events (SSE) connections.
 * Keyed by tenant ID to isolate notifications per shop.
 */

class SSEManager {
  constructor() {
    // Map<tenantId, Set<express.Response>>
    this.clients = new Map();
  }

  addClient(tenantId, res) {
    if (!this.clients.has(tenantId)) {
      this.clients.set(tenantId, new Set());
    }
    const tenantClients = this.clients.get(tenantId);
    tenantClients.add(res);

    // Keep connection alive
    res.write(':\n\n'); // Initial heartbeat

    const interval = setInterval(() => {
      res.write(':\n\n'); // Heartbeat every 15s to keep connection open
    }, 15000);

    res.on('close', () => {
      clearInterval(interval);
      tenantClients.delete(res);
      if (tenantClients.size === 0) {
        this.clients.delete(tenantId);
      }
    });
  }

  notifyTenant(tenantId, data) {
    const tenantClients = this.clients.get(tenantId);
    if (!tenantClients) return;

    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of tenantClients) {
      client.write(payload);
    }
  }
}

export const sseManager = new SSEManager();
