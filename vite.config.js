import { readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import market from './api/market.js'
import workspace from './api/workspace.js'
import research from './api/research.js'
import audit from './api/audit.js'

function localApi() {
  const routes = { '/api/market': market, '/api/workspace': workspace, '/api/research': research, '/api/audit': audit }
  const attach = (server) => { server.middlewares.use((req, res, next) => {
    const route = routes[req.url?.split('?')[0]]
    if (route) return void route(req, res)
    next()
  }) }
  return { name: 'aura-api-local', configureServer: attach, configurePreviewServer: attach }
}
function offlineShell() {
  return {
    name: 'aura-shell-cache',
    apply: 'build',
    async closeBundle() {
      const assets = (await readdir('dist/assets')).filter((file) => !file.endsWith('.map')).sort().map((file) => `/assets/${file}`)
      const precache = ['/index.html', '/aura.svg', '/art/nairobi-mesh.webp', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', ...assets]
      const version = createHash('sha256').update(JSON.stringify(precache)).digest('hex').slice(0, 16)
      await writeFile('dist/sw.js', `const CACHE = 'aura-shell-${version}';
const FILES = ${JSON.stringify(precache)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter(key => key.startsWith('aura-shell-') && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/app/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('/index.html')).then(response => response || fetch(event.request)));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(response => response || fetch(event.request)));
  }
});\n`)
    },
  }
}
export default defineConfig(({ mode }) => {
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) if (process.env[key] === undefined) process.env[key] = value
  return {
    plugins: [react(), tailwindcss(), localApi(), offlineShell()],
    server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
    preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
    build: { target: ['chrome109','safari16','firefox115'], rollupOptions: { output: { manualChunks(id) { if (id.includes('/@supabase/')) return 'supabase'; if (/\/node_modules\/(dexie|dexie-react-hooks)\//.test(id)) return 'storage'; if (/\/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return 'motion' } } } },
  }
})
