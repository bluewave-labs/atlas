import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./test/integration/global-setup.ts'],
    setupFiles: ['./test/integration/setup.ts'],
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 30_000,
    // Run sequentially — tests share a real database
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
