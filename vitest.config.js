import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'virtual-admin-panels',
      resolveId(id) {
        if (id === './AdminProperties.jsx' || id === './AdminInquiries.jsx') return id
      },
    },
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
