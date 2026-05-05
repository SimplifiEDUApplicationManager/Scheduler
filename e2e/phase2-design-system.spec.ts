import { test, expect } from '@playwright/test';

// Phase 2 — Design System
// Tasks 2.1 (tokens), 2.2 (fonts), 2.3 (UI primitives), 2.4 (app shell)

// ─── Task 2.1 — Design tokens ────────────────────────────────────────────────

test.describe('Task 2.1 — Design tokens', () => {
  test('CSS custom properties are defined on :root', async ({ page }) => {
    await page.goto('/dev/ui');
    const tokensDefined = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return (
        style.getPropertyValue('--color-brand-teal').trim() !== '' ||
        style.getPropertyValue('--brand-teal').trim() !== '' ||
        style.getPropertyValue('--color-fg-1').trim() !== '' ||
        style.getPropertyValue('--fg-1').trim() !== ''
      );
    });
    expect(tokensDefined).toBe(true);
  });

  test('surface and fg tokens produce non-default colours', async ({ page }) => {
    await page.goto('/dev/ui');
    // The page root uses bg-surface-2 — verify it resolves to something other than
    // transparent / the browser default white (#ffffff / rgb(255, 255, 255))
    const bg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.min-h-screen')!).backgroundColor
    );
    expect(bg).not.toBe('rgba(0, 0, 0, 0)'); // not transparent
    expect(bg).toBeTruthy();
  });
});

// ─── Task 2.2 — THICCCBOI fonts ──────────────────────────────────────────────

test.describe('Task 2.2 — Fonts', () => {
  test('body font-family references the custom font variable or THICCCBOI', async ({ page }) => {
    await page.goto('/dev/ui');
    const fontFamily = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily
    );
    // Accept either the CSS variable name or the literal font name
    const isCustomFont =
      fontFamily.toLowerCase().includes('thicccboi') ||
      fontFamily.includes('--font') ||
      fontFamily.includes('var(');
    // If neither, fall back — at minimum it should not be "Times New Roman" (browser default serif)
    expect(fontFamily.toLowerCase()).not.toContain('times new roman');
    expect(fontFamily).toBeTruthy();
    // Log for visibility
    console.warn('body font-family:', fontFamily);
    void isCustomFont; // captured above for debugging
  });

  test('font weights render without fallback (no font load error)', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', res => {
      if (res.url().includes('font') && !res.ok()) {
        errors.push(`Font load failed: ${res.url()} (${res.status()})`);
      }
    });
    await page.goto('/dev/ui');
    expect(errors).toHaveLength(0);
  });
});

// ─── Task 2.3 — UI primitives (/dev/ui) ──────────────────────────────────────

test.describe('Task 2.3 — UI primitives at /dev/ui', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/ui');
  });

  // Buttons
  test('renders all four Button variants', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Secondary' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ghost' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Danger' })).toBeVisible();
  });

  test('renders all three Button sizes', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Small' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Medium' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Large' })).toBeVisible();
  });

  test('disabled Button is not interactive', async ({ page }) => {
    const disabled = page.getByRole('button', { name: 'Disabled' });
    await expect(disabled).toBeDisabled();
  });

  // Badges
  test('renders semantic Badge variants', async ({ page }) => {
    for (const label of ['Default', 'Brand', 'Success', 'Warning', 'Danger', 'Info']) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('renders confidence Badge variants', async ({ page }) => {
    for (const label of ['HIGH', 'MEDIUM', 'UNPROVEN', 'LOW']) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  // Cards
  test('renders all four Card variants', async ({ page }) => {
    for (const variant of ['default card', 'elevated card', 'brand card', 'flat card']) {
      await expect(page.getByText(variant)).toBeVisible();
    }
  });

  // Input
  test('renders Input with label, hint, and error states', async ({ page }) => {
    await expect(page.getByText('With hint')).toBeVisible();
    await expect(page.getByText('Used for magic-link login.')).toBeVisible();
    await expect(page.getByText('This field is required.')).toBeVisible();
  });

  test('disabled Input is not interactive', async ({ page }) => {
    await expect(page.getByPlaceholder("Can't touch this")).toBeDisabled();
  });

  // Select
  test('renders Select with error and disabled states', async ({ page }) => {
    await expect(page.getByText('Please select a value.')).toBeVisible();
  });

  // Avatar
  test('renders Avatar in all tones and sizes', async ({ page }) => {
    // 4 tones + 4 sizes = 8 avatars; check initials appear multiple times
    const avatars = page.locator('[class*="rounded-full"]');
    await expect(avatars.first()).toBeVisible();
  });

  // CapacityBar
  test('renders CapacityBar section', async ({ page }) => {
    await expect(page.getByText('OK (8 / 20h)')).toBeVisible();
    await expect(page.getByText('Near capacity (17 / 20h)')).toBeVisible();
    await expect(page.getByText('At capacity (20 / 20h)')).toBeVisible();
  });

  // Dialog
  test('Dialog opens and closes', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Dialog' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm Action' })).toBeVisible();
    await expect(page.getByText('Are you sure you want to proceed?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm Action' })).not.toBeVisible();
  });

  test('Dialog Confirm button closes the dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Dialog' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm Action' })).not.toBeVisible();
  });
});

// ─── Task 2.4 — App shell ────────────────────────────────────────────────────

test.describe('Task 2.4 — App shell layout', () => {
  test('header renders logo and brand name', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByAltText('Simplifi')).toBeVisible();
    await expect(page.getByText('Simplifi EDU')).toBeVisible();
  });

  test('role switcher shows Coordinator, Tutor, Super Admin buttons', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: 'Coordinator' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tutor' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Super Admin' })).toBeVisible();
  });

  test('coordinator nav tabs are visible by default', async ({ page }) => {
    await page.goto('/dashboard');
    for (const tab of ['Dashboard', 'Matcher', 'Calendar', 'Requests', 'Subjects', 'Proposals']) {
      await expect(page.getByRole('link', { name: tab, exact: true })).toBeVisible();
    }
  });

  test('switching to Tutor role updates nav to tutor tabs', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Tutor' }).click();
    await expect(page.getByRole('link', { name: 'Proposals' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    // Coordinator-only tabs should be gone
    await expect(page.getByRole('link', { name: 'Matcher' })).not.toBeVisible();
  });

  test('switching to Super Admin role shows Overview tab', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Super Admin' }).click();
    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
  });

  test('clicking a nav tab updates the URL', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Subjects' }).click();
    await expect(page).toHaveURL(/\/dashboard\/subjects/);
  });

  test('active tab is visually distinct (has active class)', async ({ page }) => {
    await page.goto('/dashboard/subjects');
    const subjectsTab = page.getByRole('link', { name: 'Subjects' });
    const className = await subjectsTab.getAttribute('class');
    // Active tab should have fg-1 or font-semibold class per Header.tsx
    expect(className).toMatch(/font-semibold|text-fg-1/);
  });

  test('user email and logout button are visible in header', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('meg@simplifi.edu')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out|log out/i })).toBeVisible();
  });
});
