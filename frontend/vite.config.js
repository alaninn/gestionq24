import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GestionQ24',
        short_name: 'GestionQ24',
        description: 'Punto de venta y gestión — funciona sin internet',
        lang: 'es',
        start_url: '/pos',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#07100c',
        background_color: '#07100c',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // El bundle principal pesa ~2.7 MB (la app no está code-splitteada).
        // Igual conviene precachearlo entero para que abra sin internet.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // El shell de la app (index.html) se sirve para cualquier ruta del
        // sistema, para que una recarga sin internet no dé pantalla en blanco.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
        // Solo las rutas del sistema usan el fallback; la landing y la tienda
        // pública quedan afuera del Service Worker.
        navigateFallbackAllowlist: [/^\/pos/, /^\/admin/, /^\/login/, /^\/superadmin/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // NO se cachean respuestas de /api en el Service Worker: son por-negocio
        // y el SW no distingue el header x-negocio-id (el superadmin cambia de
        // negocio en la misma pestaña → serviría datos cruzados). El caché
        // offline de config/catálogo lo maneja la app en localStorage, que sí se
        // limpia al cerrar sesión o cambiar de negocio.
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: 'all',
    // En desarrollo, las llamadas a /api van al backend local (en producción lo hace nginx)
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  }
})
