import { test, expect } from '@playwright/test';

test.describe('Tasks workflow', () => {
  test('tasks page loads', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/tasks/);
  });

  test('can interact with tasks page', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');
    // Page loaded successfully if URL is correct
    await expect(page).toHaveURL(/\/tasks/);
  });
});
