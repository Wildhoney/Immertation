import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react({
    jsxImportSource: '@emotion/react',
    babel: {
      plugins: ['@emotion/babel-plugin'],
    },
  })],
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
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Immertation',
      formats: ['es', 'cjs'],
      fileName: (format) => `immertation.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'immer',
        'lodash/cloneDeep',
        'lodash/get',
        '@mobily/ts-belt',
      ],
      output: {
        globals: {
          immer: 'immer',
          'lodash/cloneDeep': '_.cloneDeep',
          'lodash/get': '_.get',
          '@mobily/ts-belt': 'TsBelt',
        },
      },
    },
  },
});
