import { test, expect } from '@playwright/test';

test.describe('CRM workflow', () => {
  test('create a company', async ({ page }) => {
    await page.goto('/crm');

    // Switch to companies view
    await page.getByText(/companies/i).first().click();

    // Click add/new button
    const addBtn = page.getByRole('button', { name: /add|new|create/i }).first();
    await addBtn.click();

    // Fill company form
    await page.getByPlaceholder(/company name/i).fill('Playwright Corp');
    await page.getByRole('button', { name: /save|create|add/i }).last().click();

    // Verify company appears in list
    await expect(page.getByText('Playwright Corp')).toBeVisible({ timeout: 5_000 });
  });

  test('create a contact', async ({ page }) => {
    await page.goto('/crm');

    // Switch to contacts view
    await page.getByText(/contacts/i).first().click();

    // Click add button
    const addBtn = page.getByRole('button', { name: /add|new|create/i }).first();
    await addBtn.click();

    // Fill contact form
    await page.getByPlaceholder(/name/i).first().fill('Jane E2E');
    await page.getByPlaceholder(/email/i).first().fill('jane@e2e.com');
    await page.getByRole('button', { name: /save|create|add/i }).last().click();

    // Verify contact appears
    await expect(page.getByText('Jane E2E')).toBeVisible({ timeout: 5_000 });
  });
});
