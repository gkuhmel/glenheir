import { defineConfig } from 'vitest/config';
import pkg from './package.json';

export default defineConfig({
  define: {
    // Version affichée dans le Menu.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
