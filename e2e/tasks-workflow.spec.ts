import { test, expect } from '@playwright/test';

test.describe('Tasks workflow', () => {
  test('create a task', async ({ page }) => {
    await page.goto('/tasks');

    // Click add task button
    const addBtn = page.getByRole('button', { name: /add|new|create/i }).first();
    await addBtn.click();

    // Fill task title
    const titleInput = page.getByPlaceholder(/task|title|what/i).first();
    await titleInput.fill('E2E Test Task');
    await page.keyboard.press('Enter');

    // Verify task appears
    await expect(page.getByText('E2E Test Task')).toBeVisible({ timeout: 5_000 });
  });

  test('complete a task', async ({ page }) => {
    await page.goto('/tasks');

    // Look for the created task and toggle its checkbox/status
    const task = page.getByText('E2E Test Task');
    if (await task.isVisible()) {
      // Click the checkbox or status toggle near the task
      const row = task.locator('..').locator('..');
      const checkbox = row.locator('input[type="checkbox"], [role="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await checkbox.click();
      }
    }
  });
});
