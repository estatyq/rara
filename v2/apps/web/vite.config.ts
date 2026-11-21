import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pill.svg'],
      manifest: {
        name: 'DoseMate — Your medication companion',
        short_name: 'DoseMate',
        description: 'Take your medicine. Track your health. Stay supported.',
        theme_color: '#0D9488',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/pill.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5176,
    proxy: {
      '/api': { target: 'http://localhost:4100', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4100', ws: true },
    },
  },
});
