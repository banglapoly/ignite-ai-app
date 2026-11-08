import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IGNITE_API_URL (netlify.toml) names a hosted backend; empty/unset = static-only build, in which the
// app never calls /api unless the page it is served in says <meta name="ignite-api" content="on">
// (the FastAPI server adds that to the pages it renders).
const hasApi = !!(process.env.IGNITE_API_URL || '').trim()

export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: { __IGNITE_API_BUILD__: JSON.stringify(hasApi || command === 'serve') },   // `vite dev` proxies /api
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8000' },
  },
  build: { chunkSizeWarningLimit: 1600 },
  // Local preview only. A quick tunnel's hostname changes, and Vite otherwise rejects it.
  // The server still binds to 127.0.0.1; this does not publish the machine.
  preview: { allowedHosts: true },
}))
