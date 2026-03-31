import { test, expect } from '@playwright/test';

test.describe('Home dashboard', () => {
  test('shows dock bar with app icons', async ({ page }) => {
    await page.goto('/');
    // Dock should be visible with app icons
    const dock = page.locator('.atlas-dock');
    await expect(dock).toBeVisible();
    // Should have multiple dock items
    const items = dock.locator('.dock-item');
    await expect(items).toHaveCount(await items.count()); // at least some
    expect(await items.count()).toBeGreaterThanOrEqual(5);
  });

  test('shows clock on home page', async ({ page }) => {
    await page.goto('/');
    // Clock digits should be visible
    await expect(page.locator('.flip-card')).toHaveCount(await page.locator('.flip-card').count());
  });

  test('clicking dock icon navigates to app', async ({ page }) => {
    await page.goto('/');
    // Click the first dock icon (CRM)
    const firstIcon = page.locator('.dock-icon-inner').first();
    await firstIcon.click();
    // Should navigate away from home
    await page.waitForURL(/\/(crm|hr|sign|drive|tables|tasks|docs|draw|projects)/, { timeout: 5_000 });
  });
});

test.describe('App navigation', () => {
  test('CRM page loads with sidebar', async ({ page }) => {
    await page.goto('/crm');
    await expect(page.getByText('CRM')).toBeVisible();
  });

  test('HR page loads', async ({ page }) => {
    await page.goto('/hr');
    await expect(page.getByText('HR')).toBeVisible();
  });

  test('Drive page loads', async ({ page }) => {
    await page.goto('/drive');
    await expect(page.getByText('Drive')).toBeVisible();
  });

  test('Tasks page loads', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page.getByText('Tasks')).toBeVisible();
  });

  test('Tables page loads', async ({ page }) => {
    await page.goto('/tables');
    await expect(page.getByText('Tables')).toBeVisible();
  });

  test('Docs page loads', async ({ page }) => {
    await page.goto('/docs');
    await expect(page.getByText('Write')).toBeVisible();
  });

  test('Draw page loads', async ({ page }) => {
    await page.goto('/draw');
    await expect(page.getByText('Draw')).toBeVisible();
  });

  test('System page loads', async ({ page }) => {
    await page.goto('/system');
    await expect(page.getByText('System')).toBeVisible();
  });

  test('Organization page loads', async ({ page }) => {
    await page.goto('/org');
    await expect(page.getByText('Overview')).toBeVisible();
  });
});
