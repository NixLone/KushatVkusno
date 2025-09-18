import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use relative base for GitHub Pages project sites
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' }
})
