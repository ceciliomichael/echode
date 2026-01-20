import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? './' : '/',
  build: {
    // Ensure all assets use relative paths for VS Code webview compatibility
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Inline all dynamic imports to avoid chunk loading issues in VS Code webview
        // Mermaid uses dynamic imports for diagram types which fail in webview context
        manualChunks: undefined,
        inlineDynamicImports: true,
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
