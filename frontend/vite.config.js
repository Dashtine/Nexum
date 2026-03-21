import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['nexum7.app', 'www.nexum7.app'],
    proxy: {
      '/api': 'http://localhost:3001',
      '/webhook': 'http://localhost:3001',
    },
  },
})
