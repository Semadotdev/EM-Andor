import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      // Test-only: lets AdminDashboard.test.jsx mock the admin panels before they exist.
      // Vite's import-analysis resolves the real import before vi.mock can intercept,
      // so the missing ./AdminProperties.jsx and ./AdminInquiries.jsx would error at
      // transform time. Once both files exist, remove this plugin (it no longer matches).
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
