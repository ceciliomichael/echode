import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? './' : '/',
  build: {
    chunkSizeWarningLimit: 1500,
    // Ensure all assets use relative paths for VS Code webview compatibility
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Use manualChunks to split vendor code and improve loading performance
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('lucide')) {
              return 'icons';
            }
            return 'vendor';
          }
        },
        // Disable inlineDynamicImports to allow chunk splitting
        inlineDynamicImports: false,
        // Ensure entry chunk is named consistently
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: true,
      },
    },
  },
}));
