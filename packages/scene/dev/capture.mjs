/**
 * Dev capture (WP-07): screenshots of the harness for look iteration.
 * Usage: node packages/scene/dev/capture.mjs <outDir> [name=query ...]
 * Needs the harness running (`pnpm --filter @ibasho/scene dev`).
 * Headless shell, software GL, one browser, closed in finally.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

Object.assign(process.env, {
  __EGL_VENDOR_LIBRARY_FILENAMES: '/usr/share/glvnd/egl_vendor.d/50_mesa.json',
  __GLX_VENDOR_LIBRARY_NAME: 'mesa',
  LIBGL_ALWAYS_SOFTWARE: '1',
});

const [outDir = 'scene-shots', ...pairs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const shots = pairs.length
  ? pairs.map((p) => (p.includes('=') ? [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)] : [p, '']))
  : [
      ['washi', 'style=washi'],
      ['yoru', 'style=yoru'],
      ['svg', 'style=svg'],
    ];
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-vulkan'],
  env: { ...process.env },
});
try {
  for (const [name, query] of shots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    const logs = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
    await page.goto(`http://127.0.0.1:5177/?chrome=0&${query}`);
    const wait = Number(new URLSearchParams(query).get('wait') ?? 6000);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${outDir}/${name}.png` });
    const stats = await page.evaluate(() => window.__sceneStats ?? null);
    console.log(name, JSON.stringify(stats), logs.slice(0, 8).join('\n  '));
    await page.close();
  }
} finally {
  await browser.close();
}
