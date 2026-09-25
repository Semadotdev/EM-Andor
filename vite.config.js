import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'auto',
      injectRegister: false,
      manifest: {
        name: 'EM Andor Admin',
        short_name: 'EM Admin',
        description: 'Admin dashboard for E.M. Andor Realty and Development',
        start_url: '/admin',
        scope: '/',
        id: '/admin',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#006B3C',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/pwa-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,woff2}', 'icons/*.png', 'favicon.svg'],
      },
    }),
  ],
})
