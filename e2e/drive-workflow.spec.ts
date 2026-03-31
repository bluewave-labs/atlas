import { test, expect } from '@playwright/test';

test.describe('Drive workflow', () => {
  test('create a folder', async ({ page }) => {
    await page.goto('/drive');

    // Click new/add button
    const newBtn = page.getByRole('button', { name: /new|add|create/i }).first();
    await newBtn.click();

    // Look for "New folder" option in dropdown
    const folderOption = page.getByText(/new folder/i);
    if (await folderOption.isVisible()) {
      await folderOption.click();

      // Type folder name
      const nameInput = page.getByRole('textbox').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('E2E Folder');
        await page.keyboard.press('Enter');
      }

      // Verify folder appears
      await expect(page.getByText('E2E Folder')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('shows empty state or file list', async ({ page }) => {
    await page.goto('/drive');

    // Should show either files/folders or an empty state
    const content = page.locator('main, [class*="drive"], [class*="content"]');
    await expect(content.first()).toBeVisible();
  });
});
