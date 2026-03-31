/**
 * Auth setup — logs in and saves storage state for reuse.
 *
 * Set E2E_EMAIL and E2E_PASSWORD env vars, or it will try defaults.
 * For CI: use the credentials created by the setup wizard.
 * For local dev: set your own credentials.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_EMAIL || 'e2e@atlas.local';
  const password = process.env.E2E_PASSWORD || 'E2ePassword123!';

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.getByPlaceholder('you@company.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL('/', { timeout: 10_000 });
  await expect(page).toHaveURL('/');

  await page.context().storageState({ path: AUTH_FILE });
});

export { AUTH_FILE };
