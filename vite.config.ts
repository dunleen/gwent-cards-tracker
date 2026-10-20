import { defineConfig } from 'vite';

// Tauri ждёт статику в dist/ и дев-сервер на 1420
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: 'chrome105',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
