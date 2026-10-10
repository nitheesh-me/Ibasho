/**
 * Package facts derived from the option set (ARCH 5.4 step 3: "facts derived from the option set
 * (counts, totals, noise inputs)"). Owner: WP-03.
 *
 * `derivePackageFacts(options, home)` gives:
 * - `p.kind.<kind>`: how many chosen options have that `MeasureKind` (0 when none; always known).
 * - `p.adf.major`, `p.adf.minor`: AD F Diagram 3.1 counts (RP 6.2), past measures included
 *   (`h.past.adf.*`). Major: EWI or IWI on more than half the external wall, replacing more than
 *   30% of windows, sealing a suspended floor, sealing a chimney. Minor: loft, roof or cavity
 *   insulation, EWI or IWI on half the wall or less, secondary glazing, draught-proofing. An option
 *   that does not state its share (`m.wall.share`, `m.glazing.share`) is a whole-element measure.
 *   `p.adf.now` counts the package's own AD F measures (AD F applies only when work is done now).
 * - `p.vent.provided`: the package adds MVHR, or the home already has continuous extract or MVHR.
 * - `p.airtighter`: the package makes the home more airtight (draught, glazing, wall, floor, MVHR).
 * - `p.export.W`: total export capacity of PV and battery inverters (`m.pv.exportW`,
 *   `m.battery.exportW`), unknown if any is unknown; 0 with neither.
 * - `p.export.limitW`: the G98 limit, 3,680 W (16 A at 230 V) per phase; unknown if phases unknown.
 * - `p.envelope.share`: renovated envelope fraction from `m.*.renovatedM2` over `h.envelope.areaM2`.
 * - `p.funded.pas2035`: 0 unless the caller says a funded scheme needing PAS 2035 applies.
 *
 * `evaluateRules` merges these under `ctx.pkg` (the caller's facts win), so WP-02 need not call
 * this, but the certificate must carry the merged package facts for the checker (INTERFACES).
 */
import type { MeasureKind } from '@ibasho/core';
import { MEASURE_KINDS } from '@ibasho/core';
import type { FactEnv, FactValue } from './expr.ts';

export interface DerivableOption {
  kind: MeasureKind;
  facts: FactEnv;
}

/** G98 limit per phase in watts (ENA EREC G98: 16 A per phase at 230 V). */
export const G98_W_PER_PHASE = 3680;

export type AdfClass = 'major' | 'minor' | 'none';

const KIND_SET: ReadonlySet<string> = new Set(MEASURE_KINDS);
const BY_LENGTH = [...MEASURE_KINDS].sort((a, b) => b.length - a.length);

/**
 * Measure kind of a measure id by name (`wall-ewi` is `ewi`, `loft` is `loft`): an exact kind,
 * else the longest kind that is a dash-separated part of the id. For past measures in `twin.done`.
 */
export function kindOfMeasureId(measureId: string): MeasureKind | undefined {
  if (KIND_SET.has(measureId)) return measureId as MeasureKind;
  for (const k of BY_LENGTH)
    if (measureId.startsWith(`${k}-`) || measureId.endsWith(`-${k}`) || measureId.includes(`-${k}-`))
      return k;
  return undefined;
}

function known(v: FactValue | undefined): number | undefined {
  if (v === undefined || v === 'unknown') return undefined;
  if (v === true) return 1;
  if (v === false) return 0;
  return typeof v === 'number' ? v : undefined;
}

/** AD F class of one option (unknown share counts as whole element, see the module note). */
export function adfClassOf(kind: MeasureKind, facts: FactEnv = {}): AdfClass {
  switch (kind) {
    case 'ewi':
    case 'iwi': {
      const share = known(facts['m.wall.share']);
      return share === undefined || share > 0.5 ? 'major' : 'minor';
    }
    case 'glazing-double': {
      const share = known(facts['m.glazing.share']);
      return share === undefined || share > 0.3 ? 'major' : 'minor';
    }
    case 'floor':
      return 'major';
    case 'draught': {
      const chimneys = known(facts['m.draught.openChimneys']);
      return chimneys !== undefined && chimneys > 0 ? 'major' : 'minor';
    }
    case 'loft':
    case 'roof-insulation':
    case 'cavity':
    case 'glazing-secondary':
      return 'minor';
    default:
      return 'none';
  }
}

/** AD F class of a past measure by its id. */
export function adfClassOfMeasureId(measureId: string): AdfClass {
  const k = kindOfMeasureId(measureId);
  return k === undefined ? 'none' : adfClassOf(k);
}

const AIRTIGHT: ReadonlySet<MeasureKind> = new Set<MeasureKind>([
  'draught',
  'glazing-double',
  'glazing-secondary',
  'ewi',
  'iwi',
  'floor',
  'mvhr',
]);

function sumKnown(values: (FactValue | undefined)[]): FactValue {
  let s = 0;
  for (const v of values) {
    const n = known(v);
    if (n === undefined) return 'unknown';
    s += n;
  }
  return s;
}

export function derivePackageFacts(options: readonly DerivableOption[], home: FactEnv = {}): FactEnv {
  const out: Record<string, FactValue> = {};
  for (const k of MEASURE_KINDS) out[`p.kind.${k}`] = 0;
  let major = known(home['h.past.adf.major']) ?? 0;
  let minor = known(home['h.past.adf.minor']) ?? 0;
  let now = 0;
  let airtighter = false;
  const exports: (FactValue | undefined)[] = [];
  const renovated: (FactValue | undefined)[] = [];
  for (const o of options) {
    out[`p.kind.${o.kind}`] = (out[`p.kind.${o.kind}`] as number) + 1;
    const c = adfClassOf(o.kind, o.facts);
    if (c === 'major') major++;
    else if (c === 'minor') minor++;
    if (c !== 'none') now++;
    if (AIRTIGHT.has(o.kind)) airtighter = true;
    if (o.kind === 'pv') exports.push(o.facts['m.pv.exportW']);
    if (o.kind === 'battery') exports.push(o.facts['m.battery.exportW']);
    if (o.kind === 'ewi' || o.kind === 'iwi' || o.kind === 'cavity' || o.kind === 'roof-insulation')
      renovated.push(o.facts[`m.${o.kind}.renovatedM2`]);
  }
  out['p.adf.major'] = major;
  out['p.adf.minor'] = minor;
  out['p.adf.now'] = now;
  const vs = home['h.vent.system'];
  out['p.vent.provided'] =
    (out['p.kind.mvhr'] as number) > 0 || vs === 'mev' || vs === 'mvhr'
      ? true
      : vs === undefined || vs === 'unknown'
        ? 'unknown'
        : false;
  out['p.airtighter'] = airtighter;
  out['p.export.W'] = sumKnown(exports);
  const phases = known(home['h.supply.phases']);
  out['p.export.limitW'] = phases === undefined ? 'unknown' : G98_W_PER_PHASE * phases;
  const env = known(home['h.envelope.areaM2']);
  const ren = sumKnown(renovated);
  out['p.envelope.share'] =
    renovated.length === 0
      ? 0
      : env === undefined || env <= 0 || ren === 'unknown'
        ? 'unknown'
        : (ren as number) / env;
  out['p.funded.pas2035'] = false;
  return out;
}
