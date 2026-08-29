import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/abon/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        id: '/abon/',
        name: 'Abon — учёт абонементов',
        short_name: 'Abon',
        description: 'Учёт клиентов, абонементов и сроков оплаты в фитнес-зале',
        lang: 'ru',
        start_url: '/abon/',
        scope: '/abon/',
        display: 'standalone',
        background_color: '#f4f6f5',
        theme_color: '#42665c',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  test: {
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwa-register-react.ts', import.meta.url),
      ),
    },
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
