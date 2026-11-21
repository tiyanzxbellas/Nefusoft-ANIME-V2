import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: true,
    proxy: {
      // /api/anichin di-handle oleh serverless function api/anichin.js di
      // produksi (Vercel). Di dev (Vite), proxikan ke anichin.moe langsung
      // agar tidak tertangkap oleh proxy '/api' ke apisoft.tiyan.my.id.
      '/api/anichin': {
        target: 'https://anichin.moe',
        changeOrigin: true,
        rewrite: (path) => {
          const m = path.match(/\?path=([^&]*)/);
          return m ? decodeURIComponent(m[1]) : '/';
        },
      },
      '/api': {
        target: 'https://apisoft.tiyan.my.id',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  },
  build: {
    target: 'esnext',
    cssMinify: true,
    minify: 'oxc',
    rolldownOptions: {
      output: {
        minify: {
          compress: {
            dropConsole: true,
          }
        },
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('@supabase') || id.includes('supabase')) {
              return 'vendor-supabase';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})