import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

function computeFnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = ((hash * 0x0103) ^ (hash >>> 11)) >>> 0;
  }
  const rawHex = (hash >>> 0).toString(16);
  return ('00000000' + rawHex).slice(-8);
}

function calciosOfflineSwPlugin(): Plugin {
  return {
    name: 'calcios-offline-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const emittedFiles = Object.keys(bundle)
        .filter((fileName) => fileName.slice(-4) !== '.map' && fileName !== 'sw.js')
        .sort();
      const precacheList = [
        './',
        './index.html',
        './manifest.webmanifest',
        './icon.svg',
        ...emittedFiles.map((f) => `./${f}`),
      ];
      const versionHash = computeFnv1aHex(emittedFiles.join('|'));
      const cacheName = `calcios-shell-${versionHash}`;

      const swSource = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_PATHS = ${JSON.stringify(precacheList)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const scope = self.registration.scope;
      await Promise.all(
        PRECACHE_PATHS.map(async (relPath) => {
          try {
            const url = new URL(relPath, scope).toString();
            const res = await fetch(url, { cache: 'reload' });
            if (res && res.ok) {
              await cache.put(url, res);
            }
          } catch {
            // Ignore transient precache miss for individual asset
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('calcios-shell-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const scope = self.registration.scope;
  if (!url.href.startsWith(scope)) return;

  const accept = req.headers.get('accept') || '';
  const isNavigation = req.mode === 'navigate' || accept.includes('text/html');

  if (isNavigation) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const indexUrl = new URL('./index.html', scope).toString();
        const rootUrl = new URL('./', scope).toString();

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          const netRes = await fetch(req, { signal: controller.signal });
          clearTimeout(timer);

          if (netRes && netRes.ok) {
            const text = await netRes.clone().text();
            if (text.includes('id="root"')) {
              await cache.put(indexUrl, netRes.clone());
              return netRes;
            }
          }
        } catch {
          // Network offline, tab woke up without radio, or preview host asleep
        }

        const cached =
          (await cache.match(req, { ignoreSearch: true })) ||
          (await cache.match(indexUrl)) ||
          (await cache.match(rootUrl));
        if (cached) return cached;

        return fetch(req);
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const netRes = await fetch(req);
        if (netRes && netRes.ok) {
          await cache.put(req, netRes.clone());
        }
        return netRes;
      } catch {
        const fallback = await caches.match(req, { ignoreSearch: true });
        if (fallback) return fallback;
        throw new Error('Offline asset unavailable');
      }
    })()
  );
});
`;

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: swSource,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiUrl = (env.VITE_GROQ_API_URL ?? env.GROQ_API_URL ?? '').trim();
  const modelName = (env.VITE_GROQ_MODEL ?? env.GROQ_MODEL ?? '').trim();

  return {
    base: './',
    plugins: [react(), calciosOfflineSwPlugin()],
    define: {
      __CALCIOS_GROQ_URL__: JSON.stringify(apiUrl),
      __CALCIOS_GROQ_MODEL__: JSON.stringify(modelName),
    },
    server: { host: '0.0.0.0', allowedHosts: true },
    preview: { host: '0.0.0.0', allowedHosts: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
    },
  };
});
