import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // In production, Vite builds into ../../static (repo root /static)
  // so FastAPI can serve it at /
  build: {
    outDir: path.resolve(__dirname, '../static'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI backend during local dev
    proxy: {
      '/analyze': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/compare': 'http://localhost:8000',
    },
  },
})
