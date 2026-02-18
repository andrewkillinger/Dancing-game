import { defineConfig } from 'vite';
import { resolve } from 'path';

// Base path for GitHub Pages deployment
// In dev mode, use '/' - in production use the repo name
const base = process.env.GITHUB_ACTIONS ? '/Dancing-game/' : '/';

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          matter: ['matter-js'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
    sourcemap: false,
    minify: 'esbuild',
  },
  optimizeDeps: {
    include: ['pixi.js', 'matter-js', '@supabase/supabase-js'],
  },
  define: {
    // Ensure process.env is available
    'process.env': {},
  },
});
