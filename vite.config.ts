import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: '/dashboard-gitlab/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vuetify')) return 'vendor-vuetify'
          if (
            id.includes('node_modules/vue/') ||
            id.includes('node_modules/@vue/') ||
            id.includes('node_modules/vue-router') ||
            id.includes('node_modules/pinia') ||
            id.includes('node_modules/vue-demi')
          ) return 'vendor-vue'
          if (
            id.includes('node_modules/apexcharts') ||
            id.includes('node_modules/vue3-apexcharts')
          ) return 'vendor-apexcharts'
          if (id.includes('node_modules/axios')) return 'vendor-axios'
        }
      }
    }
  }
})
