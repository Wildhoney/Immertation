import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'immeration': path.resolve(__dirname, './src/index.ts'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Immeration',
      formats: ['es', 'cjs'],
      fileName: (format) => `immeration.${format === 'es' ? 'mjs' : 'cjs'}`,
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
