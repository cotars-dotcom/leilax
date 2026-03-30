import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }
          // Supabase SDK
          if (id.includes('@supabase')) {
            return 'vendor-supabase'
          }
          // Motor IA pesado
          if (id.includes('/lib/motorIA') || id.includes('/lib/motorAnaliseGemini') || id.includes('/lib/agenteReanalise')) {
            return 'motor-ia'
          }
          // Supabase client customizado
          if (id.includes('/lib/supabase.js')) {
            return 'supabase-client'
          }
          // Documentos e agentes jurídicos
          if (id.includes('/lib/documentosPDF') || id.includes('/lib/agenteJuridico') || id.includes('/lib/analisador')) {
            return 'agentes-docs'
          }
          // Componentes pesados da tela de detalhe
          if (id.includes('/components/Detail') || id.includes('/components/Painel') || id.includes('/components/AbaJuridica') || id.includes('/components/AbaDiag')) {
            return 'detail-chunks'
          }
          // Dados estáticos
          if (id.includes('/data/')) {
            return 'static-data'
          }
        },
      },
    },
  },
})
