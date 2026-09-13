import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const siteRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { port: 5340, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(siteRoot, 'index.html'),
        stores: resolve(siteRoot, 'stores/index.html'),
      },
    },
  },
});
