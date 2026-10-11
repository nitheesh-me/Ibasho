import { expect, test } from '@playwright/test';

// Smoke: the studio and the landing page boot on Andon paper with no errors.

/** Collect page errors and console errors for one page. */
function watch(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

// Hiru paper ground (DESIGN_SYSTEM 2.1 --paper #F4EEE3), as sRGB bytes.
const PAPER = [244, 238, 227];

/** The body background as sRGB bytes. Browsers report tokens as oklch, so paint one pixel to read it. */
function bodyRgb(): number[] {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  const g = c.getContext('2d')!;
  g.fillStyle = getComputedStyle(document.body).backgroundColor;
  g.fillRect(0, 0, 1, 1);
  return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

/** Within one step per channel, for rounding in the colour conversion. */
function expectPaper(rgb: number[]): void {
  for (const [i, v] of rgb.entries()) expect(Math.abs(v - PAPER[i]!), `channel ${i}`).toBeLessThanOrEqual(1);
}

test('landing boots to the prerendered page', async ({ page }) => {
  const errors = watch(page);
  await page.goto('http://localhost:4174/');
  await expect(page).toHaveTitle('Ibasho: see how a building will live in its city');
  await expect(page.locator('main[data-andon="landing"]')).toBeVisible();
  await expect(page.locator('section[data-chapter="hero"] h1')).toBeVisible();
  await expect(page.locator('section[data-chapter="trust"]')).toHaveCount(1);
  // The one gold action leads into the studio.
  await expect(page.locator('.lp-cta')).toHaveAttribute('href', '/app/');
  expectPaper(await page.evaluate(bodyRgb));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('studio boots to your places', async ({ page }) => {
  const errors = watch(page);
  await page.goto('http://localhost:4173/app/');
  await expect(page).toHaveTitle('Ibasho');
  await expect(page.locator('[data-andon="app"]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Your places' })).toBeVisible();
  expectPaper(await page.evaluate(bodyRgb));
  expect(errors).toEqual([]);
});
