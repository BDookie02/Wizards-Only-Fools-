import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('/node_modules/')) return undefined;
            if (id.includes('/react-dom/') || id.includes('/react/')) return 'vendor-react';
            if (id.includes('/three/')) return 'vendor-three';
            if (id.includes('/@react-three/fiber/')) return 'vendor-r3f';
            if (id.includes('/@react-three/rapier/')) return 'vendor-rapier';
            if (
              id.includes('/@react-three/drei/') ||
              id.includes('/@react-three/postprocessing/') ||
              id.includes('/@react-three/csg/') ||
              id.includes('/three-bvh-csg/')
            ) {
              return 'vendor-r3f-extras';
            }
            if (id.includes('/socket.io') || id.includes('/engine.io') || id.includes('/@socket.io/')) {
              return 'vendor-network';
            }
            if (id.includes('/lucide-react/')) return 'vendor-icons';
            if (id.includes('/@google/genai/')) return 'vendor-ai';
            if (id.includes('/zustand/')) return 'vendor-state';
            if (id.includes('/clsx/') || id.includes('/tailwind-merge/')) return 'vendor-ui-utils';
            return undefined;
          },
        },
      },
    },
  };
});
