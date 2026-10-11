/**
 * Real site stages versus the Preview's recorded outputs, with runtimes. Owner: WP-16.
 * Run from the repo root under the CPU cap:
 *   node packages/site/scripts/gen-compare.ts gb1 gh1
 * Writes `packages/fixtures/src/site/compare-<id>.json` and prints a Markdown table for the README.
 */
import { renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SiteResult, Tier } from '@ibasho/core';
import { computeSite } from '../src/index.ts';
import { golden, previewOf, RESOLUTIONS, root } from '../test/inputs.ts';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['gb1'];
const r1 = (x: number) => Math.round(x * 10) / 10;
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : Number.NaN);
const kindOf = (id: string) => (/_win(@\d+)?$/.test(id) ? 'window' : /_roof$/.test(id) ? 'roof' : 'wall');

for (const id of ids) {
  const { compiled, site } = golden(id);
  const resolution = RESOLUTIONS.standard;
  const ms: Record<'sun' | 'radiation' | 'daylight', Record<Tier, number>> = {
    sun: { rough: 0, refined: 0, final: 0 },
    radiation: { rough: 0, refined: 0, final: 0 },
    daylight: { rough: 0, refined: 0, final: 0 },
  };
  let sun: SiteResult | undefined;
  let rad: SiteResult | undefined;
  let day: SiteResult | undefined;
  for (const tier of ['rough', 'refined', 'final'] as Tier[]) {
    let t = performance.now();
    sun = computeSite('sun', { compiled, site, resolution }, tier, '2026-10-11');
    (ms.sun as Record<Tier, number>)[tier] = Math.round(performance.now() - t);
    t = performance.now();
    rad = computeSite('radiation', { compiled, site, resolution, sun }, tier, '2026-10-11');
    (ms.radiation as Record<Tier, number>)[tier] = Math.round(performance.now() - t);
    t = performance.now();
    day = computeSite('daylight', { compiled, site, resolution, sun }, tier, '2026-10-11');
    (ms.daylight as Record<Tier, number>)[tier] = Math.round(performance.now() - t);
  }
  if (!sun || !rad || !day) throw new Error('no result');
  const pSun = previewOf(id, 'sun');
  const pRad = previewOf(id, 'radiation');
  const pDay = previewOf(id, 'daylight');
  const annual = (v: readonly (bigint | string)[] | 'unknown') =>
    v === 'unknown' ? Number.NaN : v.reduce((s: number, x) => s + Number(x), 0) / 1000;
  const rows: Record<string, { real: number; preview: number }> = {};
  for (const k of ['wall', 'window', 'roof']) {
    rows[`irr.${k} kWh/m2.yr`] = {
      real: r1(mean(rad.surfaces.filter((s) => kindOf(s.id) === k).map((s) => annual(s.irrWhm2)))),
      preview: r1(mean(pRad.surfaces.filter((s) => kindOf(s.id) === k).map((s) => annual(s.irrWhm2)))),
    };
  }
  rows['sun hours per year (mean surface)'] = {
    real: Math.round(mean(sun.surfaces.map((s) => s.sunHours?.annual ?? 0))),
    preview: Math.round(mean(pSun.surfaces.map((s) => s.sunHours?.annual ?? 0))),
  };
  rows['sky view factor (mean surface)'] = {
    real:
      Math.round(mean(sun.surfaces.map((s) => (s.svf ? Number(s.svf.n) / Number(s.svf.d) : 0))) * 1000) /
      1000,
    preview:
      Math.round(mean(pSun.surfaces.map((s) => (s.svf ? Number(s.svf.n) / Number(s.svf.d) : 0))) * 1000) /
      1000,
  };
  rows['ledger rows'] = { real: rad.ledger.length, preview: pRad.ledger.length };
  rows['ledger lost MWh.yr'] = {
    real: r1(rad.ledger.reduce((s, l) => s + Number(l.lostWh), 0) / 1e6),
    preview: r1(pRad.ledger.reduce((s, l) => s + Number(l.lostWh), 0) / 1e6),
  };
  const mid = (x?: { lo: number; hi: number }) => (x ? (x.lo + x.hi) / 2 : Number.NaN);
  rows['sDA % (mean room mid)'] = {
    real: r1(mean(day.rooms.map((r) => mid(r.sda)))),
    preview: r1(mean(pDay.rooms.map((r) => mid(r.sda)))),
  };
  rows['ASE % (mean room mid)'] = {
    real: r1(mean(day.rooms.map((r) => mid(r.ase)))),
    preview: r1(mean(pDay.rooms.map((r) => mid(r.ase)))),
  };
  rows['daylight rooms'] = { real: day.rooms.length, preview: pDay.rooms.length };
  const out = {
    building: id,
    resolution: resolution.level,
    surfaces: rad.surfaces.length,
    unknownHeight: sun.unknownHeightIds?.length ?? 0,
    rows,
    runtimeMs: ms,
    note: 'Node 26, one core under the CPU cap (taskset 0-3, nice 10); runtimes are indicative.',
  };
  const file = join(root, `packages/fixtures/src/site/compare-${id}.json`);
  writeFileSync(`${file}.tmp`, `${JSON.stringify(out, null, 2)}\n`);
  renameSync(`${file}.tmp`, file);
  console.log(`\n${id} (${out.surfaces} surfaces, ${out.unknownHeight} neighbours of unknown height)\n`);
  console.log('| Quantity | Real | Preview |\n|---|---|---|');
  for (const [k, v] of Object.entries(rows)) console.log(`| ${k} | ${v.real} | ${v.preview} |`);
  console.log(
    `\nRuntime ms (rough / refined / final): sun ${Object.values(ms.sun).join(' / ')}, radiation ${Object.values(ms.radiation).join(' / ')}, daylight ${Object.values(ms.daylight).join(' / ')}`,
  );
}
