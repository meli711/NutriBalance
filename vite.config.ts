import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: ['icons/favicon.png', 'images/header-balanced-meals.jpg'],
      manifest: {
        name: "Meliane's NutriBalance",
        short_name: 'NutriBalance',
        description: 'Nährstoffbedarf vs. Nährstoffaufnahme inkl. Rezept-Feature',
        start_url: '.',
        display: 'standalone',
        background_color: '#f5f7f2',
        theme_color: '#1f5f5b',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Die Nährwert-/Rezeptdaten liegen als JSON in `public/data/` und
        // werden zur Laufzeit per `fetch` geladen. Ohne diesen Eintrag nimmt
        // Workbox JSON NICHT ins Precache-Manifest auf (Default-`globPatterns`
        // kennt nur js/css/html/Bilder). Folge: Nach einem Deployment mit
        // geänderter `food-database.json` bleibt bei bestehenden Clients der
        // alte Datenstand im Cache/Service-Worker, bis der SW zufällig neu
        // gebaut wird. Mit JSON im Manifest bekommt jede Datenänderung einen
        // neuen Revision-Hash → neuer Service Worker → `autoUpdate` zieht die
        // Daten nach und lädt die Seite neu.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,json,woff,woff2}'],
        // Google Fonts auch offline verfügbar machen (Fraunces/Work Sans,
        // siehe DESIGN.md) — Standard-Rezept für vite-plugin-pwa.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})
