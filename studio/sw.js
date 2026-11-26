/* This cache version is stamped with the Git commit during the PWA build. */
const CACHE = 'mira-studio-__CACHE_VERSION__';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './workbench-fullscreen.js',
  './syntax-highlight.js',
  './reference-ui.js',
  './atlas-ui.js',
  './benchmark-ui.js',
  './benchmark-cases.js',
  './benchmark-worker.js',
  './gui-benchmark.js',
  './gui-specialize.js',
  './gui-benchmark.html',
  './laboratory.html',
  './lab-gui-rendering.json',
  './atlas-program.js',
  './atlas-data.json',
  './ast-inspector.js',
  './inspector-host.js',
  './collection-host.js',
  './inspector-worker.js',
  './inspector.mira',
  './inspector-host.json',
  './host.json',
  './reference.json',
  './examples.js',
  './compiler.js',
  './worker.js',
  './ui-preview.html',
  './ui-host.js',
  './persistent-state.js',
  './persistent-ledger.html',
  './persistent-ledger.css',
  './persistent-ledger.js',
  './persistent-ledger.mira',
  './persistent-ledger-program.js',
  './effects.js',
  './type-lab.html',
  './design-notes.html',
  './type-lab.js',
  './host-module-lab.html',
  './host-module-fixtures.js',
  './host-module-lab.js',
  './host-module-worker.js',
  './text-module-lab.js',
  './text-module-data.js',
  './text-host.js',
  './json-module-data.js',
  './json-host.js',
  './date-host.js',
  './date-module-data.js',
  './module-explorer.html',
  './module-explorer.js',
  './interface-impact.js',
  './module-benchmark.js',
  './effects-demo.mira',
  './effects-demo.js',
  './effects-demo.html',
  './effects-demo-program.js',
  './ui-preview.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('mira-studio-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const scope = new URL('./', self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  if (request.mode === 'navigate') {
    // Cache known standalone pages under their own keys, not index.html.
    if (url.pathname.endsWith('/laboratory.html') || url.pathname.endsWith('/lab-gui-rendering.json')) {
      // The report and its data belong to the same installed build.
      event.respondWith(caches.open(CACHE).then(cache =>
        cache.match(url.pathname.endsWith('/lab-gui-rendering.json') ? './lab-gui-rendering.json' : './laboratory.html')
          .then(hit => hit || fetch(request))));
      return;
    }
    const page = url.pathname.endsWith('/design-notes.html') ? './design-notes.html'
      : url.pathname.endsWith('/host-module-lab.html') ? './host-module-lab.html'
      : url.pathname.endsWith('/module-explorer.html') ? './module-explorer.html'
      : url.pathname.endsWith('/type-lab.html') ? './type-lab.html'
      : url.pathname.endsWith('/effects-demo.html') ? './effects-demo.html'
      : url.pathname.endsWith('/persistent-ledger.html') ? './persistent-ledger.html'
      : url.pathname.endsWith('/gui-benchmark.html') ? './gui-benchmark.html'
      : url.pathname.endsWith('/ui-preview.html') ? './ui-preview.html' : './index.html';
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(page, copy));
        }
        return response;
      }).catch(() => caches.match(page))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
