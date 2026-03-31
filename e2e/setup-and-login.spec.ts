import { test, expect } from '@playwright/test';

/**
 * E2E credentials — on CI with fresh DB, these are created by setup.
 * On local dev, the auth.setup.ts tries multiple credential sets.
 */

test.describe.serial('Setup wizard', () => {
  test('fresh DB shows setup, existing DB shows login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(setup|login)/);
  });

  test('complete setup if fresh, or skip if already done', async ({ page }) => {
    // Check if setup is needed via API
    const res = await page.request.get('/api/v1/auth/setup-status');
    const body = await res.json();
    if (!body.data?.needsSetup) {
      test.skip();
      return;
    }

    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    // Step 0: Language
    await page.getByText('English').click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(500);

    // Step 1: Organization
    await page.getByPlaceholder(/acme/i).fill('E2E Test Corp');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(500);

    // Step 2: Admin
    await page.getByPlaceholder(/john doe/i).fill('E2E Admin');
    await page.getByPlaceholder(/admin@company/i).fill('e2e@atlas.local');
    await page.getByPlaceholder(/minimum 8/i).fill('E2ePassword123!');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(500);

    // Step 3: Complete
    await page.getByRole('button', { name: /complete/i }).click();
    await page.waitForURL('/', { timeout: 30_000 });
    await expect(page).toHaveURL('/');
  });
});

test.describe.serial('Login', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to Atlas')).toBeVisible();
  });

  test('rejects wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@company.com').fill('nobody@nowhere.com');
    await page.getByPlaceholder('Enter your password').fill('WrongPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 5_000 });
  });
});
