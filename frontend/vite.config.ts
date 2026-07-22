import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro({ config: { preset: 'vercel' } }),
    viteReact(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        // ws:true lets the notification WebSocket (/api/notifications/ws) tunnel through the same
        // dev proxy the REST API uses, so the browser talks to a single origin (HU-061).
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
