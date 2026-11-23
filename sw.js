// Offline support: serve the app from a local copy instantly, and refresh that copy from the server
// in the background. Every download asks the server for the newest file ("no-cache" / "reload"),
// so a fresh publish is never hidden behind the browser's own short-term cache.
// Bump CACHE whenever you publish (and bump version.json + VERSION in js/app.js).
const CACHE = 'gym-log-v18';
const ASSETS = [
  './', 'index.html', 'css/styles.css',
  'js/app.js', 'js/store.js', 'js/seed.js', 'js/charts.js', 'js/sync.js', 'js/push.js', 'js/demo.js', 'js/tour.js', 'js/config.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

// Lock-screen rest alerts. iPhone requires every push to show a notification, so always show one.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Rest over', {
    body: d.body || 'Time for your next set',
    tag: 'rest',
    renotify: true,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => 'focus' in c);
    return open ? open.focus() : self.clients.openWindow('./');
  }));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // never touch cloud sync requests
  if (url.pathname.endsWith('/version.json')) return;                  // update checks always go to the network

  const forceFresh = req.cache === 'reload' || req.cache === 'no-store';
  const fetchFresh = () => fetch(url.href, { cache: forceFresh ? 'reload' : 'no-cache', credentials: 'same-origin' });

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === 'navigate' ? 'index.html' : req;
    const fresh = fetchFresh().then(res => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    }).catch(() => null);

    if (forceFresh) return (await fresh) || (await cache.match(key, { ignoreSearch: true })) || new Response('Offline', { status: 503 });

    const cached = await cache.match(key, { ignoreSearch: true });
    if (cached) { e.waitUntil(fresh); return cached; }
    return (await fresh) || new Response('Offline', { status: 503 });
  })());
});
