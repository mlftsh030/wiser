import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // ExcelJS is gone and pdf-lib is dynamically imported, so the initial
    // bundle is small. This keeps the warning meaningful rather than noise.
    chunkSizeWarningLimit: 700,
  },
});
