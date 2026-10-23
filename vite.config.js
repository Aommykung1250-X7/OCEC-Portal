import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: { '/api': `http://127.0.0.1:${process.env.E2E_API_PORT || 3001}` },
  },
});
