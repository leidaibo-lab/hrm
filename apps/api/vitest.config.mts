import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@cip/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['src/testing/__tests__/env.fixture.ts'],
    include: ['src/**/*.spec.ts'],
  },
});
