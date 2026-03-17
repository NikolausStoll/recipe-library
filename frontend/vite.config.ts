import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: "./",
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8097',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:8097',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
