import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => ({
  base: '/PantryPal/', // ✅ HARDCODED — NO DEBATE
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        id: '/PantryPal/',
        name: 'PantryPal',
        short_name: 'PantryPal',
        description: 'Fully offline mobile and tablet inventory management with barcode scanning and best-by dates.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/PantryPal/',
        scope: '/PantryPal/',
        icons: [
          { src: '/PantryPal/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/PantryPal/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/PantryPal/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  preview: { port: 4173 },
}));
