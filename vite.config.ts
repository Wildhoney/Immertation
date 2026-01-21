import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';
import fs from 'fs';

function serveDocsPlugin() {
  return {
    name: 'serve-docs',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/docs')) {
          const filePath = path.join(__dirname, 'example/public', req.url);
          const indexPath = path.join(filePath, 'index.html');

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return next();
          }
          if (fs.existsSync(indexPath)) {
            req.url = req.url + (req.url.endsWith('/') ? 'index.html' : '/index.html');
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    serveDocsPlugin(),
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
  ],
  publicDir: 'example/public',
  resolve: {
    alias: {
      'immertation': path.resolve(__dirname, './src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/integration/**', '**/node_modules/**', '**/dist/**', '**/example/**'],
  },
  build: {
    emptyOutDir: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      format: {
        comments: false,
      },
      mangle: true,
    },
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Immertation',
      formats: ['es', 'cjs'],
      fileName: (format) => `immertation.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'immer',
        '@mobily/ts-belt',
      ],
      output: {
        globals: {
          immer: 'immer',
          '@mobily/ts-belt': 'TsBelt',
        },
      },
    },
  },
});
