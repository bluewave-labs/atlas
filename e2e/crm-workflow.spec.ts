import { test, expect } from '@playwright/test';

test.describe('CRM workflow', () => {
  test('create a company', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');

    // Switch to companies view
    await page.locator('button, a', { hasText: /companies/i }).first().click();
    await page.waitForTimeout(500);

    // Click add/new button
    await page.getByRole('button', { name: /add|new|create/i }).first().click();
    await page.waitForTimeout(500);

    // Fill company name — use the first visible text input in the modal
    const nameInput = page.locator('input[type="text"], input:not([type])').first();
    await nameInput.fill('Playwright Corp');

    // Click "Add company" button
    await page.getByRole('button', { name: /add company/i }).click();

    // Verify company appears
    await expect(page.getByText('Playwright Corp').first()).toBeVisible({ timeout: 5_000 });
  });

  test('create a contact', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');

    // Switch to contacts view
    await page.locator('button, a', { hasText: /contacts/i }).first().click();
    await page.waitForTimeout(500);

    // Click add button
    await page.getByRole('button', { name: /add|new|create/i }).first().click();
    await page.waitForTimeout(500);

    // Fill name field — first text input in modal
    const nameInput = page.locator('input[type="text"], input:not([type])').first();
    await nameInput.fill('Jane E2E');

    // Submit
    await page.getByRole('button', { name: /add contact|save|create/i }).click();

    // Verify
    await expect(page.getByText('Jane E2E').first()).toBeVisible({ timeout: 5_000 });
  });
});
