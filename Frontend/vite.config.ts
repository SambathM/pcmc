import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': 'http://localhost:5700',
        '/telegram': 'http://localhost:5700',
        '/property': 'http://localhost:5700',
        '/customer': 'http://localhost:5700',
        '/service': 'http://localhost:5700',
        '/bill': 'http://localhost:5700',
        '/upload': 'http://localhost:5700',
        '/messagehub': {
          target: 'http://localhost:5700',
          ws: true,
        },
      },
    },
  };
});
