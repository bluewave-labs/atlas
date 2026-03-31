import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:5180',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // 1. Setup: run setup wizard + login, save auth state
    {
      name: 'setup',
      testMatch: /setup-and-login\.spec\.ts/,
    },
    // 2. Auth: log in and save storage state for other tests
    {
      name: 'auth',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['setup'],
    },
    // 3. All other tests use saved auth state
    {
      name: 'tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      testIgnore: [/setup-and-login\.spec\.ts/, /auth\.setup\.ts/],
      dependencies: ['auth'],
    },
  ],

  webServer: [
    {
      command: 'npm run dev --workspace=packages/server',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev --workspace=packages/client',
      port: 5180,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
