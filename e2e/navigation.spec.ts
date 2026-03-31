import { test, expect } from '@playwright/test';

test.describe('Home dashboard', () => {
  test('shows dock bar with app icons', async ({ page }) => {
    await page.goto('/');
    const dock = page.locator('.atlas-dock');
    await expect(dock).toBeVisible();
    const items = dock.locator('.dock-item');
    expect(await items.count()).toBeGreaterThanOrEqual(5);
  });

  test('clicking dock icon navigates to app', async ({ page }) => {
    await page.goto('/');
    const firstIcon = page.locator('.dock-icon-inner').first();
    await firstIcon.click();
    await page.waitForURL(/\/(crm|hr|sign|drive|tables|tasks|docs|draw|projects)/, { timeout: 5_000 });
  });
});

test.describe('App navigation', () => {
  test('CRM page loads', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/crm/);
  });

  test('HR page loads', async ({ page }) => {
    await page.goto('/hr');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/hr/);
  });

  test('Drive page loads', async ({ page }) => {
    await page.goto('/drive');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/drive/);
  });

  test('Tasks page loads', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/tasks/);
  });

  test('Tables page loads', async ({ page }) => {
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/tables/);
  });

  test('Docs page loads', async ({ page }) => {
    await page.goto('/docs');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/docs/);
  });

  test('Draw page loads', async ({ page }) => {
    await page.goto('/draw');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/draw/);
  });

  test('System page loads', async ({ page }) => {
    await page.goto('/system');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/system/);
  });

  test('Organization page loads', async ({ page }) => {
    await page.goto('/org');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/org/);
  });
});
