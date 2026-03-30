import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          // Apenas React core — seguro e sem conflito
          'vendor-react': ['react', 'react-dom'],
          // Supabase SDK separado — sem dependência circular
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
})
