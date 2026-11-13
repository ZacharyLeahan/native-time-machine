import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { 'nrel-spa-core': fileURLToPath(new URL('./node_modules/nrel-spa/lib/spa.cjs',import.meta.url)) } },
  test: { environment: 'node', globals: true, include: ['src/**/*.test.{ts,tsx}'] },
})
