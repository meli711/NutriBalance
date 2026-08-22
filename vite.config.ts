import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: ['icons/favicon.png'],
      manifest: {
        name: 'NutriBalance',
        short_name: 'NutriBalance',
        description: 'Nährstoffbedarf vs. Nährstoffaufnahme inkl. Rezept-Feature',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#00796b',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
