import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    allowedHosts: ['zekrom.tailf7863.ts.net', 'localhost'],
    proxy: {
      '/api': 'http://localhost:3000',
      '/chat': 'http://localhost:3000',
      '/stream': 'http://localhost:3000',
      '/history': 'http://localhost:3000',
      '/config': 'http://localhost:3000',
      '/agent': 'http://localhost:3000',
      '/session': 'http://localhost:3000',
      '/debug': 'http://localhost:3000',
    }
  }
})