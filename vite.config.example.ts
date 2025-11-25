import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/Immertation/',
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
  ],
  resolve: {
    alias: {
      immertation: path.resolve(__dirname, './src/index.ts'),
    },
  },
  publicDir: 'example/public',
  build: {
    outDir: 'dist-example',
    emptyOutDir: true,
  },
});
