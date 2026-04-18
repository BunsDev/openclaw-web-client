import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port =
    Number(process.env.CLIENT_PORT) ||
    Number(env.CLIENT_PORT) ||
    Number(env.VITE_CLIENT_PORT) ||
    18800

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'logo_128.png',
          'icons/apple-touch-icon.png',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-512-maskable.png',
        ],
        manifest: {
          name: 'OpenClaw Client',
          short_name: 'OpenClaw',
          description: 'Chat interface for OpenClaw AI agents',
          theme_color: '#0b0b0b',
          background_color: '#0b0b0b',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // workbox-build 7.x + terser has a known hang during SW minification
          // (https://github.com/GoogleChrome/workbox/issues/3245). The SW is
          // already small (<20KB), so skipping minification is a safe tradeoff.
          mode: 'development',
          // Precache static build output (JS, CSS, HTML, fonts).
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // The main app bundle currently weighs ~3.4MB unminified due to MUI + markdown.
          // 6MB headroom avoids nuisance build failures when it grows slightly.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          // Allow the SPA shell to serve any client-side route offline…
          navigateFallback: '/index.html',
          // …but never intercept API or WebSocket requests.
          navigateFallbackDenylist: [/^\/api/, /^\/ws/],
          runtimeCaching: [
            {
              // API is on a different origin (port 18802) but be explicit
              // in case anyone proxies everything through one host.
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/ws'),
              handler: 'NetworkOnly',
            },
          ],
          // index.html is served with no-store anyway; prevent Workbox from
          // caching it separately so runtime config (window.__OPENCLAW_CONFIG__)
          // is always fresh after a port change.
          cleanupOutdatedCaches: true,
        },
        devOptions: {
          // Keep the SW off during `npm run dev` — otherwise its
          // navigateFallback intercepts Vite's ESM requests (/main.tsx,
          // /@react-refresh, /@vite/client, /manifest.webmanifest) and
          // returns index.html, breaking HMR with MIME-type errors.
          // Test install/offline via `npm run build && npm run preview`.
          enabled: false,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],
    server: {
      port,
      host: '0.0.0.0',
    },
    preview: {
      port,
      host: '0.0.0.0',
    },
  }
})
