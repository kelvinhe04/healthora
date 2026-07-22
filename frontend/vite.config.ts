import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'

export default defineConfig(({ command }) => ({
  plugins: [
    tanstackStart(),
    // Only wired up for `vite build`: in dev mode the vercel preset's env-runner tries to run
    // `vercel env pull` and hangs without a Vercel CLI session (breaks `bun run dev` and the
    // Playwright webServer in CI, which has no Vercel auth).
    ...(command === 'build' ? [nitro({ config: { preset: 'vercel' } })] : []),
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
}))
