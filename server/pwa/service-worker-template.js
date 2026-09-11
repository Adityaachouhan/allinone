/**
 * server/pwa/service-worker-template.js
 *
 * Returns a Service Worker JS string with tenant-specific constants injected.
 * This is served from GET /sw.js, dynamically generated per-tenant.
 *
 * Strategy:
 *  - Static assets (JS, CSS, fonts, images): Cache-First (fast loads)
 *  - API calls (/api/*): Network-First, never cached (always fresh data)
 *  - Navigation requests (HTML pages): Network-First, fallback to cached shell,
 *    fallback to /offline.html if both fail.
 */

/**
 * Generate the Service Worker JavaScript string for a specific tenant.
 *
 * @param {object} opts
 * @param {string} opts.slug       - Tenant slug e.g. "bhardwajmart"
 * @param {string} opts.storeName  - Display store name e.g. "Bhardwaj Mart"
 * @returns {string}               - JavaScript source code for the SW
 */
export function generateServiceWorker({ slug, storeName }) {
  const cacheName = `grocery-pwa-${slug}-v1`;

  return `
// ============================================================
// Service Worker for ${storeName}
// Auto-generated — do not edit. Cache: ${cacheName}
// ============================================================

const CACHE_NAME = '${cacheName}';

// Core shell files to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/offline.html',
];

// ── Install: pre-cache shell ──────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((e) => {
        console.warn('[SW] Pre-cache failed (some URLs may not exist yet):', e.message);
      })
    )
  );
});

// ── Activate: clean up old caches ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ───────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache API calls — always network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Never cache superadmin routes
  if (url.pathname.startsWith('/superadmin/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets — Cache-First (JS, CSS, fonts, images, uploads)
  const isStatic =
    url.pathname.startsWith('/uploads/') ||
    /\\.(js|css|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|ico|webp)$/i.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
          return response;
        });
      })
    );
    return;
  }

  // HTML navigation — Network-First, fallback to offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }
});
`.trim();
}
