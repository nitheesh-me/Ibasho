/**
 * Landing stills (WP-07): renders `dev/posters/*.webp` from the city harness with no interface,
 * then writes the small sizes with ImageMagick. Optional QA shots go to a second directory in the
 * same browser session, so one run is one capture pass.
 * Usage: node packages/scene/dev/posters.mjs [--only id,id] [--qa <dir> name=query ...]
 * Needs the harness running (`pnpm --filter @ibasho/scene dev`). Headless shell, software GL,
 * one browser, closed in finally; pins itself to IBASHO_CAPTURE_CORES at low priority.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { setPriority } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const CORES = process.env.IBASHO_CAPTURE_CORES ?? '0-3';
execFileSync('taskset', ['-a', '-cp', CORES, String(process.pid)], { stdio: 'ignore' });
setPriority(10);
Object.assign(process.env, {
  __EGL_VENDOR_LIBRARY_FILENAMES: '/usr/share/glvnd/egl_vendor.d/50_mesa.json',
  __GLX_VENDOR_LIBRARY_NAME: 'mesa',
  LIBGL_ALWAYS_SOFTWARE: '1',
  DBUS_SESSION_BUS_ADDRESS: 'disabled:',
});

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'posters');
const night = 'min=1230';
/** id, harness query, large file, large size, small file (or null), small size. */
const POSTERS = [
  ['city-day', 'level=site&min=630', 'city-day-1600', [1600, 1000], 'city-day-800', [800, 500]],
  [
    'city-night',
    `level=site&lens=lanterns&${night}`,
    'city-night-1600',
    [1600, 1000],
    'city-night-800',
    [800, 500],
  ],
  [
    'sun-day',
    'level=site&lens=shadows&date=2026-05-21&min=720',
    'sun-day-1600',
    [1600, 1000],
    'sun-day-800',
    [800, 500],
  ],
  [
    'sun-night',
    'level=site&lens=shadows&date=2026-05-21&min=720&style=yoru',
    'sun-night-1600',
    [1600, 1000],
    'sun-night-800',
    [800, 500],
  ],
  [
    'daylight-day',
    'level=floor&lens=daylight&settle=1500',
    'daylight-day-1600',
    [1600, 1000],
    'daylight-day-800',
    [800, 500],
  ],
  [
    'daylight-night',
    'level=floor&lens=daylight&style=yoru&settle=1500',
    'daylight-night-1600',
    [1600, 1000],
    'daylight-night-800',
    [800, 500],
  ],
  ['energy-day', 'level=building&min=630', 'energy-day-1600', [1600, 1000], 'energy-day-800', [800, 500]],
  [
    'energy-night',
    `level=building&lens=lanterns&${night}`,
    'energy-night-1600',
    [1600, 1000],
    'energy-night-800',
    [800, 500],
  ],
  ['codes-day', 'level=building&az=225&min=900', 'codes-day-1600', [1600, 1000], 'codes-day-800', [800, 500]],
  [
    'codes-night',
    `level=building&az=225&style=yoru&${night}`,
    'codes-night-1600',
    [1600, 1000],
    'codes-night-800',
    [800, 500],
  ],
  [
    'compare-day',
    'compare=1&plots=3&wait=20000',
    'compare-day-1600',
    [1600, 1000],
    'compare-day-800',
    [800, 500],
  ],
  [
    'compare-night',
    `compare=1&plots=3&wait=20000&style=yoru&${night}`,
    'compare-night-1600',
    [1600, 1000],
    'compare-night-800',
    [800, 500],
  ],
  [
    'design-day',
    'compare=1&plots=2&level=floor&wait=20000',
    'design-day-1600',
    [1600, 1000],
    'design-day-800',
    [800, 500],
  ],
  [
    'design-night',
    `compare=1&plots=2&wait=20000&level=floor&style=yoru&${night}`,
    'design-night-1600',
    [1600, 1000],
    'design-night-800',
    [800, 500],
  ],
  [
    'trust-day',
    'level=building&lens=radiation&settle=2600',
    'trust-day-1600',
    [1600, 1000],
    'trust-day-800',
    [800, 500],
  ],
  [
    'trust-night',
    `level=floor&style=yoru&${night}`,
    'trust-night-1600',
    [1600, 1000],
    'trust-night-800',
    [800, 500],
  ],
  [
    'hero-wide',
    `level=city&lens=lanterns&${night}`,
    'hero-wide-2400',
    [2400, 1000],
    'hero-wide-1200',
    [1200, 500],
  ],
  ['hero-phone', `level=building&lens=lanterns&${night}`, 'hero-phone-720', [720, 900], null, null],
  ['invitation-dusk', 'level=site&min=1050', 'dusk-wide-2400', [2400, 1000], 'dusk-wide-1200', [1200, 500]],
];

const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const qaAt = args.indexOf('--qa');
const qaDir = qaAt >= 0 ? args[qaAt + 1] : null;
const qaShots =
  qaAt >= 0 ? args.slice(qaAt + 2).map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]) : [];

async function shoot(browser, query, [w, h], path) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') logs.push(`error: ${m.text()}`);
  });
  const params = new URLSearchParams(query);
  await page.goto(`http://127.0.0.1:5177/city.html?capture=1&${query}`);
  await page
    .waitForFunction(
      () => (window.__cityStats?.frames ?? 0) > 0 && window.__cityStats?.phase === 'resting',
      null,
      {
        timeout: Number(params.get('wait') ?? 60000),
        polling: 250,
      },
    )
    .catch(() => logs.push('warning: not resting'));
  await page.waitForTimeout(Number(params.get('settle') ?? 1200));
  await page.screenshot({ path });
  await page.close();
  const size = statSync(path).size;
  console.log(path, size, logs.slice(0, 4).join(' | '));
  if (!size) throw new Error(`empty capture ${path}`);
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-vulkan'],
  env: { ...process.env },
});
try {
  mkdirSync(OUT, { recursive: true });
  for (const [id, query, large, size, small, smallSize] of POSTERS) {
    if (only && !only.has(id)) continue;
    const png = join(OUT, `${large}.png`);
    await shoot(browser, `controls=0&${query}`, size, png);
    execFileSync('magick', [png, '-quality', '86', join(OUT, `${large}.webp`)]);
    if (small)
      execFileSync('magick', [
        png,
        '-resize',
        `${smallSize[0]}x${smallSize[1]}`,
        '-quality',
        '84',
        join(OUT, `${small}.webp`),
      ]);
    rmSync(png);
  }
  if (qaDir) {
    mkdirSync(qaDir, { recursive: true });
    for (const [name, query] of qaShots) {
      const p = new URLSearchParams(query);
      await shoot(
        browser,
        query,
        [Number(p.get('vw') ?? 1280), Number(p.get('vh') ?? 800)],
        join(qaDir, `${name}.png`),
      );
    }
  }
} finally {
  await browser.close();
}
