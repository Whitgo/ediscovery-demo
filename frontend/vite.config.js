import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(() => {
  const port = parseInt(process.env.VITE_PORT || '5173', 10);
  const host = process.env.VITE_HOST || '0.0.0.0';
  const apiTarget = process.env.VITE_API_TARGET || 'https://localhost:4443';

  return {
    plugins: [react()],
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },
    server: {
      host,
      port,
      strictPort: true, // Fail fast instead of auto-incrementing
      open: false,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false, // Accept self-signed certificates
        },
      },
    },
    build: {
      outDir: 'build',
      sourcemap: true,
    },
    preview: {
      host,
      port,
      strictPort: true,
    },
  };
});
