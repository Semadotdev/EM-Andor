import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      // Test-only: lets AdminDashboard.test.jsx mock the AdminInquiries panel before it exists.
      // Vite's import-analysis resolves the real import before vi.mock can intercept,
      // so the missing ./AdminInquiries.jsx would error at transform time.
      // Once AdminInquiries.jsx exists (Task 12), remove this plugin entirely.
      name: 'virtual-admin-panels',
      resolveId(id) {
        if (id === './AdminInquiries.jsx') return id
      },
    },
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
