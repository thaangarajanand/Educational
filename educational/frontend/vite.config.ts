import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Keep browser requests on the Vite origin during development while
      // forwarding all API calls to the Express server.
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500, // Set limit to 1500kB to prevent warnings
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
