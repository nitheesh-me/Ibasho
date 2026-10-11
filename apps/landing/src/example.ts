/**
 * The worked example strip, "Vindhya Bhavan, in one page" (landing review M7). Owner: WP-09.
 *
 * Reads the studio's own results for GB1 at build time (the energy, codes and optimise outputs
 * under `packages/fixtures/src/preview/gb1/`) and turns them into a few plain figures. Nothing is
 * hard-coded here: when the studio's results change, the next build shows the new numbers. While
 * those results are Preview the strip says so.
 *
 * Runs in Node only (from `vite.config.ts` and tests). Missing or malformed files give `undefined`,
 * and the page then leaves the strip out.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeOps, END_USE_COPY, FUTURE_ROLE_COPY, LANDING_PLATES, rupees } from '@ibasho/content';
import { END_USES, type EndUse } from '@ibasho/core';

interface Range {
  lo: number;
  hi: number;
}

export interface ExampleFuture {
  role: string;
  name: string;
  changes: string;
  upfront: string;
  bill: string;
  saves: string;
  /** Name of an earlier card when the search picked the same bundle for both. */
  sameAs?: string | undefined;
}

export interface ExampleData {
  preview: boolean;
  lat: number;
  lon: number;
  eui: string;
  euiTarget?: string;
  bill?: string;
  rating?: { level: string; context: string };
  futures: ExampleFuture[];
  /** Shares of the year's energy by end use, largest first, for the end use bar. */
  endUses: { id: EndUse; label: string; share: number }[];
  /** EUI as drawn and the code reference, in kWh/m² a year, for the range plate. */
  euiRange: Range;
  targetRange?: Range;
  /**
   * Rating rows for the codes plate. `none` means the design is short of the first level: the row
   * then says by how much in words, with no status stamp (landing review M9).
   */
  ratings: { scheme: string; level: string; status: 'likely' | 'possible' | 'unknown' | 'none' }[];
  /** How the design compares with the code's reference, in words, for the codes plate. */
  againstReference?: string;
  /** Operational carbon, tonnes CO2e a year, rounded to three figures. */
  carbonTonnes?: number;
  /** Linked values behind the energy result, for the evidence plate. */
  evidenceCount: number;
}

/**
 * Saving on the reference design that each scheme's first level asks for, %. From the rating
 * ladders in `packs/ratings/src/engine/schemes.ts` (GHMC one star, LEED v4.1 first point, IGBC
 * energy credit, EDGE Certified energy part).
 */
const FIRST_LEVEL_PCT: Readonly<Record<string, number>> = {
  'GHMC-stars': 5,
  LEED: 5,
  IGBC: 10,
  EDGE: 20,
};

/** What a scheme's first level is called, for "not yet at one GHMC star". */
const FIRST_LEVEL_NAME: Readonly<Record<string, string>> = {
  'GHMC-stars': 'one GHMC star',
  LEED: 'the first LEED energy point',
  IGBC: 'the first IGBC energy points',
  EDGE: 'EDGE Certified',
};

/** Money in the studio's bills is fixed point: 10^8 units to the rupee. */
const MONEY_SCALE = 1e8;

const kwh = (r: Range) => `${Math.round(r.lo)} to ${Math.round(r.hi)} kWh/m² a year`;

function readJson(file: string): unknown {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
}

/** A savings range against the reference design, in words: "between 3% less and 34% more". */
function savingsWords({ lo, hi }: Range): string {
  const pct = (x: number) => `${Math.abs(Math.round(x))}%`;
  const side = (x: number) => (x < 0 ? `${pct(x)} more` : `${pct(x)} less`);
  // Lead with the better end, so the sentence reads from the hopeful case.
  return `between ${side(Math.max(lo, hi))} and ${side(Math.min(lo, hi))}`;
}

function ratingLine(row: { scheme: string; value: Range | 'unknown'; level: { likely: string } }): {
  level: string;
  context: string;
} {
  const scheme = row.scheme.replace(/-/g, ' ');
  const first = FIRST_LEVEL_PCT[row.scheme];
  const none = row.level.likely === 'none';
  const level = none
    ? `Not yet at ${FIRST_LEVEL_NAME[row.scheme] ?? `the first ${scheme} level`}`
    : row.level.likely === 'unknown'
      ? `${scheme}: not known yet`
      : `${scheme}: ${row.level.likely} likely`;
  if (row.value === 'unknown') return { level, context: 'Needs facts we do not have yet.' };
  const drawn = `As drawn it uses ${savingsWords(row.value)} energy than the code’s reference design.`;
  return {
    level,
    context:
      none && first !== undefined ? `That needs ${first}% less than the reference. ${drawn}` : drawn,
  };
}

/** The strip's figures, or undefined when the results are not there. */
export function readExample(repoRoot: string, buildingId = 'gb1'): ExampleData | undefined {
  try {
    const dir = join(repoRoot, 'packages', 'fixtures', 'src', 'preview', buildingId);
    const energy = readJson(join(dir, 'energy.json')) as
      | {
          stamp: { impl: string };
          eui: { site: Range };
          bills?: { currency: string; total: string }[];
          endUses?: Partial<Record<string, string[]>>;
          evidence?: { nodes?: unknown[] };
          carbon?: { op?: string | number };
        }
      | undefined;
    const codes = readJson(join(dir, 'codes.json')) as
      | {
          ratings?: { scheme: string; metric?: string; value: Range | 'unknown'; level: { likely: string } }[];
          baselines?: { code: string; eui: Range }[];
        }
      | undefined;
    const opt = readJson(join(dir, 'optimise.json')) as
      | {
          stamp: { impl: string };
          objectives: { id: string }[];
          candidates: { id: string; ops: { op: string }[]; axes: string[] }[];
          picks: { role: string; id: string }[];
        }
      | undefined;
    if (!energy || !opt) return undefined;
    const places = readJson(join(repoRoot, 'packages', 'fixtures', 'src', 'buildings', 'places.json')) as
      | { buildingIds: string[]; lat: number; lon: number }[]
      | undefined;
    const place = places?.find((p) => p.buildingIds.includes(buildingId));

    const inr = energy.bills?.find((b) => b.currency === 'INR');
    const baseline = codes?.baselines?.find((b) => /ECSBC/.test(b.code));
    const ratingRow = codes?.ratings?.find((r) => r.scheme === 'GHMC-stars') ?? codes?.ratings?.[0];

    const axis = (id: string) => opt.objectives.findIndex((o) => o.id === id);
    const [capexAt, opexAt] = [axis('capex'), axis('opex')];
    const byId = new Map(opt.candidates.map((c) => [c.id, c]));
    const asDrawn = opt.candidates.find((c) => c.ops.length === 0);
    const baseOpex = asDrawn ? Number(asDrawn.axes[opexAt]) : undefined;
    const roles = ['least-upfront', 'best-return', 'lowest-running'];
    const seen = new Map<string, string>();
    const futures: ExampleFuture[] = [];
    for (const role of roles) {
      const pick = opt.picks.find((p) => p.role === role);
      const c = pick && byId.get(pick.id);
      if (!c) continue;
      const name = FUTURE_ROLE_COPY[role] ?? role;
      const opex = Number(c.axes[opexAt]);
      futures.push({
        role,
        name,
        changes: describeOps(c.ops),
        upfront: Number(c.axes[capexAt]) === 0 ? 'No cost' : rupees(Number(c.axes[capexAt])),
        bill: `${rupees(opex)} a year`,
        saves: baseOpex === undefined ? '' : `${rupees(baseOpex - opex)} a year`,
        ...(seen.has(c.id) ? { sameAs: seen.get(c.id) } : {}),
      });
      if (!seen.has(c.id)) seen.set(c.id, name);
    }

    const totals = END_USES.filter((u) => u !== 'pv').map((u) => ({
      id: u,
      total: (energy.endUses?.[u] ?? []).reduce((a, x) => a + Number(x), 0),
    }));
    const sum = totals.reduce((a, t) => a + t.total, 0);
    const endUses =
      sum > 0
        ? totals
            .filter((t) => t.total > 0)
            .map((t) => ({ id: t.id, label: END_USE_COPY[t.id], share: t.total / sum }))
            .sort((a, b) => b.share - a.share)
        : [];
    const ratings = (codes?.ratings ?? []).slice(0, 4).map((r) => {
      const lv = r.level.likely;
      const status = lv === 'unknown' ? 'unknown' : lv === 'none' ? 'none' : 'likely';
      const first = FIRST_LEVEL_PCT[r.scheme];
      const level =
        lv === 'unknown'
          ? 'Not known yet'
          : lv === 'none'
            ? first !== undefined
              ? LANDING_PLATES.codes.notYet.replace('{first}', String(first))
              : 'Not yet at the first level.'
            : `${lv}`;
      return { scheme: r.scheme.replace(/-/g, ' '), level, status } as const;
    });
    const savingsRow = codes?.ratings?.find((r) => r.metric === 'savings.pct' && r.value !== 'unknown');
    const carbonG = Number(energy.carbon?.op ?? Number.NaN);
    const carbonTonnes =
      Number.isFinite(carbonG) && carbonG > 0 ? Number((carbonG / 1e6).toPrecision(3)) : undefined;

    return {
      endUses,
      euiRange: energy.eui.site,
      ...(baseline ? { targetRange: baseline.eui } : {}),
      ratings,
      ...(savingsRow && savingsRow.value !== 'unknown'
        ? { againstReference: `As drawn it uses ${savingsWords(savingsRow.value)} energy than the code’s reference.` }
        : {}),
      ...(carbonTonnes !== undefined ? { carbonTonnes } : {}),
      evidenceCount: energy.evidence?.nodes?.length ?? 0,
      preview: energy.stamp.impl === 'preview' || opt.stamp.impl === 'preview',
      lat: place?.lat ?? 0,
      lon: place?.lon ?? 0,
      eui: kwh(energy.eui.site),
      ...(baseline ? { euiTarget: kwh(baseline.eui) } : {}),
      ...(inr ? { bill: `About ${rupees(Number(BigInt(inr.total) / BigInt(MONEY_SCALE)))} a year` } : {}),
      ...(ratingRow ? { rating: ratingLine(ratingRow) } : {}),
      futures,
    };
  } catch {
    return undefined;
  }
}
