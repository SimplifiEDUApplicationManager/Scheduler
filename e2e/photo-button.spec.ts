import { test, expect } from '@playwright/test';

test('Change photo label triggers file chooser', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/tutor/settings');
  await expect(page).not.toHaveURL(/login/);

  // Confirm page loaded
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  // Verify there are no JS errors (hydration mismatch would show here)
  expect(errors, `Console errors: ${errors.join(', ')}`).toHaveLength(0);

  // Verify the label is visible
  const label = page.locator('label', { hasText: 'Change photo' });
  await expect(label).toBeVisible();

  // Clicking the label should open a file chooser
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 3000 }),
    label.click(),
  ]);

  expect(fileChooser).toBeTruthy();
  expect(fileChooser.isMultiple()).toBe(false);
});
