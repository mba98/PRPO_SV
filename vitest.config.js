import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['lib/**/*.js', 'models/**/*.js', 'seed/**/*.js'],
      exclude: [
        'lib/sap/mappers/**',
        'lib/sap/__mocks__/**',
        'seed/index.js',
        'lib/sapServiceLayer.js',
        'lib/sapHana.js',
        'lib/s3.js',
        'lib/email.js',
      ],
      thresholds: {
        lines: 70,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
