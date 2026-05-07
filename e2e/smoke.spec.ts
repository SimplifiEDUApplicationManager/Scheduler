import { test, expect } from '@playwright/test';

// All tests run against the dev server with NEXT_PUBLIC_DEV_BYPASS=true,
// so auth is skipped and every route is accessible directly.

test.describe('Dashboard', () => {
  test('loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/login/);
    expect(errors).toHaveLength(0);
  });

  test('shows stats cards and nav links', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Open requests').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Subjects' })).toBeVisible();
  });
});

test.describe('Subjects page', () => {
  test('loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/dashboard/subjects');
    await expect(page).not.toHaveURL(/login/);
    expect(errors).toHaveLength(0);
  });

  test('shows Subjects heading and search input', async ({ page }) => {
    await page.goto('/dashboard/subjects');
    await expect(page.getByRole('heading', { name: 'Subjects' })).toBeVisible();
    await expect(page.getByPlaceholder('Search subjects…')).toBeVisible();
  });

  test('Add button opens inline subject form', async ({ page }) => {
    await page.goto('/dashboard/subjects');
    await page.getByRole('button', { name: 'Add' }).first().click();
    await expect(page.getByPlaceholder('Subject name')).toBeVisible();
  });
});

test.describe('Dashboard - Calendar', () => {
  test('loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/dashboard/calendar');
    await expect(page).not.toHaveURL(/login/);
    expect(errors).toHaveLength(0);
  });
});

test.describe('Dashboard - Requests', () => {
  test('loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/dashboard/requests');
    await expect(page).not.toHaveURL(/login/);
    expect(errors).toHaveLength(0);
  });
});

test.describe('Dashboard - Proposals', () => {
  test('loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/dashboard/proposals');
    await expect(page).not.toHaveURL(/login/);
    expect(errors).toHaveLength(0);
  });
});

test.describe('Tutor views', () => {
  test('tutor calendar loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/tutor/calendar');
    await expect(page).not.toHaveURL(/login/);
    expect(errors).toHaveLength(0);
  });

  test('tutor subjects loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/tutor/subjects');
    await expect(page).not.toHaveURL(/login/);
    expect(errors).toHaveLength(0);
  });

  test('tutor proposals loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/tutor/proposals');
    await expect(page).not.toHaveURL(/login/);
    expect(errors).toHaveLength(0);
  });

  test('tutor settings loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/tutor/settings');
    await expect(page).not.toHaveURL(/login/);
    expect(errors).toHaveLength(0);
  });
});

test.describe('Admin', () => {
  test('loads without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/login/);
    expect(errors).toHaveLength(0);
  });
});
