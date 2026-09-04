import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // O frontend fala com a API do TicSol através do mesmo host, evitando CORS.
      '/auth': 'http://localhost:3000',
      '/rest': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
