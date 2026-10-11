/**
 * Dev capture (WP-07): screenshots of the harness for look iteration.
 * Usage: node packages/scene/dev/capture.mjs <outDir> [name=query ...]
 * Needs the harness running (`pnpm --filter @ibasho/scene dev`).
 * Headless shell, software GL, one browser, closed in finally.
 *
 * Load safety: pins itself to a few cores at low priority so software WebGL never saturates the CPU.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setPriority } from 'node:os';
import { chromium } from '@playwright/test';

const CORES = process.env.IBASHO_CAPTURE_CORES ?? '12-15';
try {
  execFileSync('taskset', ['-a', '-cp', CORES, String(process.pid)], { stdio: 'ignore' });
  setPriority(10);
} catch (e) {
  console.error(
    `capture: could not pin to cores ${CORES} (${e.message}); refusing to launch a browser unpinned`,
  );
  process.exit(2);
}

Object.assign(process.env, {
  __EGL_VENDOR_LIBRARY_FILENAMES: '/usr/share/glvnd/egl_vendor.d/50_mesa.json',
  __GLX_VENDOR_LIBRARY_NAME: 'mesa',
  LIBGL_ALWAYS_SOFTWARE: '1',
  DBUS_SESSION_BUS_ADDRESS: 'disabled:',
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
    const vq = new URLSearchParams(query.startsWith('city:') ? query.slice(5) : query);
    const page = await browser.newPage({
      viewport: { width: Number(vq.get('vw') ?? 960), height: Number(vq.get('vh') ?? 600) },
      deviceScaleFactor: 1,
    });
    const logs = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
    // `city:<query>` shoots the city harness (dev/city.html) instead of the house.
    const city = query.startsWith('city:');
    const q = city ? query.slice(5) : query;
    const params = new URLSearchParams(q);
    const svg = params.get('style') === 'svg';
    await page.goto(`http://127.0.0.1:5177/${city ? 'city.html' : ''}?chrome=0&capture=1&${q}`);
    // WebGL: shoot as soon as the still life has baked (bounded). SVG: the DOM is ready at load.
    const limit = Number(params.get('wait') ?? 20000);
    if (svg) await page.waitForTimeout(800);
    else if (city)
      await page
        .waitForFunction(
          () => (window.__cityStats?.frames ?? 0) > 0 && window.__cityStats?.phase === 'resting',
          null,
          {
            timeout: limit,
            polling: 250,
          },
        )
        .then(() => page.waitForTimeout(Number(params.get('settle') ?? 600)))
        .catch(() => logs.push(`warning: city not resting within ${limit} ms`));
    else
      await page
        .waitForFunction(() => window.__sceneStats?.phase === 'baked', null, { timeout: limit, polling: 250 })
        .catch(() => logs.push(`warning: not baked within ${limit} ms`));
    // `probe=<chip label>`: click a lens chip and report the longest main thread task after it.
    const probe = params.get('probe');
    if (probe) {
      await page.evaluate(() => {
        window.__longest = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__longest = Math.max(window.__longest, e.duration);
        }).observe({ type: 'longtask', buffered: false });
      });
      await page.getByRole('radio', { name: probe }).first().click();
      await page.waitForTimeout(3000);
      const longest = await page.evaluate(() => window.__longest);
      console.log(`${name} probe ${probe}: longest task ${Math.round(longest)} ms`);
    }
    await page.screenshot({ path: `${outDir}/${name}.png` });
    const stats = await page.evaluate(() => window.__cityStats ?? window.__sceneStats ?? null);
    console.log(name, JSON.stringify(stats), logs.slice(0, 8).join('\n  '));
    await page.close();
  }
} finally {
  await browser.close();
}
