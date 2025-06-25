import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    port: 8000,
    host: '0.0.0.0',
    open: true,
  },
  build: {
    outDir: 'dist',
  },
});