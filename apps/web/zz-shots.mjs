import { chromium } from '@playwright/test';
const base = 'http://127.0.0.1:5191/app';
const out = process.argv[2];
const shots = [
  ['home-1280', '/', 1280, 860],
  ['new-type-1280', '/new', 1280, 860, async (p) => { await p.getByRole('button', { name: 'Next: building type' }).click(); }],
  ['studio-look-1280', '/p/pl_iiit/b/gb1?level=building&mode=look&lens=radiation', 1280, 820],
  ['studio-choose-1600', '/p/pl_iiit/b/gb1?level=building&mode=choose', 1600, 900],
  ['studio-make-1600', '/p/pl_iiit/b/gb1?level=floor&mode=make', 1600, 900],
  ['studio-prove-1280', '/p/pl_iiit/b/gb1?level=building&mode=prove', 1280, 820],
  ['settings-768', '/settings', 768, 1024],
  ['studio-phone-360', '/p/pl_iiit/b/gb1?level=building&mode=look', 360, 780],
  ['search-1280', '/p/pl_iiit/b/gb1?level=building&mode=look', 1280, 820, async (p) => { await p.keyboard.press('Control+k'); await p.keyboard.type('vindhya floor 2'); }],
];
async function ready() {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(`${base}/`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server not up');
}
await ready();
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-vulkan'] });
const errors = [];
try {
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  for (const [name, path, w, h, act] of shots) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text().slice(0, 200)}`));
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(name.startsWith('studio') || name.startsWith('search') ? 9000 : 2000);
    if (act) { await act(page); await page.waitForTimeout(800); }
    await page.screenshot({ path: `${out}/${name}.png` });
    const hs = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (hs) errors.push(`${name}: horizontal scroll`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(errors.join('\n') || 'no errors');
