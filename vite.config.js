import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base:process.env.PAGES_BASE_PATH||'/',
  // Keep a play session intact while source files are edited. Reload manually.
  server: {hmr: false},
  build: {
    rollupOptions: {
      input: Object.fromEntries(['index', 'game', 'workshop', 'body', 'avatar', 'validation', 'compare', 'gear', 'crowd', 'creatures', 'battle'].map(name => [name, resolve(import.meta.dirname, `${name}.html`)])),
    },
  },
});
