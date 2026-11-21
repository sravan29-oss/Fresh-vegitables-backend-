/**
 * Fresh Vegetables Organic — PWA Service Worker (v2.0.0)
 * 
 * Safety & Privacy Guarantees:
 * 1. Static asset caching for instantaneous PWA loading.
 * 2. Public catalog caching (Network-First) for safe offline produce browsing.
 * 3. STRICT PRIVACY GUARD: Never caches private customer profiles, auth tokens,
 *    admin APIs, payments, or checkout/order placement.
 * 4. Prevents phantom offline orders with authoritative 503 offline response.
 */

const CACHE_NAME = 'fresh-veggies-pwa-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-48x48.png',
  '/favicon-96x96.png',
  '/favicon-144x144.png',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
];

// Sensitive endpoints that MUST NEVER be cached under any circumstances
const SENSITIVE_API_PATTERNS = [
  '/api/orders',
  '/api/admin',
  '/api/auth',
  '/api/payments',
  '/api/delivery',
  '/api/users',
  '/api/profile',
  '/api/wallet',
  '/api/cart',
  '/api/coupons',
  '/api/reviews/manage',
];

// Safe public catalog endpoints eligible for offline reading
const PUBLIC_CATALOG_PATTERNS = [
  '/api/products',
  '/api/categories',
  '/api/cms',
];

// Install: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: Prune legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event listener
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Only process GET requests (mutations: POST, PUT, DELETE, PATCH bypass SW completely)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Sensitive API endpoints: NEVER CACHE. Provide truthful offline JSON if network fails.
  const isSensitive = SENSITIVE_API_PATTERNS.some((pattern) => url.pathname.startsWith(pattern));
  if (isSensitive) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            code: 'NETWORK_OFFLINE',
            message: 'You are currently offline. Placing orders and viewing personal account data requires an active internet connection.',
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      })
    );
    return;
  }

  // 3. Public catalog API endpoints: Network-First with cached fallback
  const isPublicCatalog = PUBLIC_CATALOG_PATTERNS.some((pattern) => url.pathname.startsWith(pattern));
  if (isPublicCatalog) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({
              success: false,
              offline: true,
              data: [],
              message: 'Offline: viewing cached produce catalog is currently unavailable.',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // 4. Static assets & SPA navigation: Cache with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached and optionally revalidate in background
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            // Cache static assets (images, fonts, scripts)
            if (
              url.pathname.startsWith('/assets/') ||
              url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/)
            ) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
          }
          return networkResponse;
        })
        .catch(() => {
          // If HTML navigation failed, fallback to cached index.html
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html') || caches.match('/');
          }
          return new Response('Network offline. Please check your internet connection.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
    })
  );
});
