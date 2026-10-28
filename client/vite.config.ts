import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { readFileSync } from 'fs';

// The version shown in the app comes from client/package.json.
const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    VitePWA({
      // Updates wait for the user to tap Update instead of applying on their own.
      registerType: 'prompt',
      // The app registers its service worker itself (see UpdatePrompt), so the
      // plugin must not inject a second registration.
      injectRegister: null,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'The Hifz App',
        short_name: 'Hifz',
        description: 'Track your daily Sabaq, Sabaq Para & Dawr',
        theme_color: '#0F4C3A',
        background_color: '#FAF7F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // skipWaiting is on for this release only. Installs on code that predates
        // the update prompt cannot show it, so they take this build on their own.
        // Remove the next line in the next release, so later updates wait for the
        // user to tap Update (see UpdatePrompt).
        skipWaiting: true,
        // clientsClaim hands the open page to a new build as soon as it takes over.
        clientsClaim: true,
        // Drop caches from previous builds instead of leaving them to
        // accumulate and potentially be served.
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, '../shared') },
  },
  server: {
    // Listen on all interfaces (0.0.0.0) so phones/tablets on the same
    // Wi-Fi network can reach the dev server via the host machine's LAN IP.
    host: true,
    port: 5173,
    // Proxy /api → the API server. We use 127.0.0.1 (not localhost) because
    // when the dev server is opened from a LAN device, `localhost` would
    // resolve to the *visiting device* — never to the API host. 127.0.0.1
    // here is evaluated by the Vite process itself, which IS the API host.
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      // The recitations live under server/public, not client/public, so in dev
      // they must be proxied too — otherwise Vite answers with the SPA shell.
      '/audio': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
});
