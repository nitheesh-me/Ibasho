import { expect, test } from '@playwright/test';

// G0-6: apps/web and apps/landing boot to a blank Andon page.
const APPS = [
  { name: 'web', url: 'http://localhost:4173/app/' },
  { name: 'landing', url: 'http://localhost:4174/' },
];

for (const app of APPS) {
  test(`${app.name} boots to a blank Andon page`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(app.url);
    await expect(page).toHaveTitle('Ibasho');
    const main = page.locator('main[data-andon="blank"]');
    await expect(main).toBeVisible();
    await expect(main).toBeEmpty();
    // Hiru paper ground (DESIGN_SYSTEM 2.1 --paper #F4EEE3).
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(244, 238, 227)');
    expect(errors).toEqual([]);
  });
}
