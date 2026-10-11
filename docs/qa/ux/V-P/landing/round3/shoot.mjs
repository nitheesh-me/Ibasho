import { chromium } from '@playwright/test';

const out = '/home/nitheesh/AI_things/HACKTHONS/Ibasho/docs/qa/ux/V-P/landing/round3';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-vulkan'],
});
try {
  const runs = [
    [360, 'day', 740],
    [768, 'day', 1024],
    [1280, 'day', 800],
    [1600, 'day', 900],
    [1280, 'night', 800],
    [360, 'night', 740],
  ];
  for (const [w, theme, h] of runs) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      colorScheme: theme === 'night' ? 'dark' : 'light',
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    await page.goto('http://127.0.0.1:4174/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: out + '/fold-' + w + '-' + theme + '.png' });
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += h) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(150);
    }
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      h: document.documentElement.scrollHeight,
      imgs: [...document.images]
        .filter((i) => i.complete && i.naturalWidth > 0 && i.offsetParent)
        .map((i) => i.currentSrc.split('/').pop()),
      cta: Math.round(document.querySelector('.lp-cta')?.getBoundingClientRect().bottom ?? -1),
    }));
    await page.screenshot({ path: out + '/full-' + w + '-' + theme + '.png', fullPage: true });
    for (const id of ['energy', 'codes', 'compare', 'trust']) {
      if (w === 1280) {
        const el = page.locator('#' + id);
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await el.screenshot({ path: out + '/' + id + '-' + w + '-' + theme + '.png' });
      }
    }
    console.log(w, theme, JSON.stringify(info), 'errors', errs.length, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
