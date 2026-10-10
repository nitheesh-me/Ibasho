/**
 * Typed ops to an engine request, for `ibasho_what_if` and `ibasho_compare`. Owner: WP-12.
 *
 * The only way an agent changes a home is a list of `ScenarioOp`s (AM 6.1), each parsed with
 * `ScenarioOpSchema` from `@ibasho/core/schemas`. There is no op that carries code, and nothing
 * here evaluates strings. Edits go to a copy of the twin, which is re-validated with `parseTwin`.
 */
import type { HomeTwin, OwnerCtx, PackageSpec, ScenarioOp } from '@ibasho/core';
import { parseTwin, ScenarioOpSchema } from '@ibasho/core/schemas';
import type { MeasureCatalogue } from './catalogue.ts';

export interface RejectedOp {
  op: unknown;
  code: 'schema' | 'range' | 'unknown-measure' | 'read-only' | 'use-memory' | 'unsupported';
  detail: string;
}

export interface OpsApplied {
  accepted: ScenarioOp[];
  rejected: RejectedOp[];
  twin: HomeTwin;
  pkg: PackageSpec;
  owner: { budgetGBP?: number; horizonYears?: number };
}

/**
 * Owner-editable numeric parameters (`setParam`). Each is a `NumField` in the twin; the op sets
 * it to a stated known value. Ranges guard against nonsense; the engine applies its own.
 */
export const OWNER_PARAMS: Record<string, { min: number; max: number }> = {
  'occupancy.setpointC': { min: 14, max: 26 },
  'occupancy.heatingHours': { min: 0, max: 24 },
  'occupancy.people': { min: 1, max: 12 },
  'ventilation.draughtProofedFrac': { min: 0, max: 1 },
  'ventilation.chimneysOpen': { min: 0, max: 6 },
  'ventilation.chimneysBlocked': { min: 0, max: 6 },
  'ventilation.extractFans': { min: 0, max: 8 },
};

/** Canonical package id (ARCH 5.3): sorted option ids joined by `+`, or `baseline`. */
export function packageIdOf(
  options: Record<string, string>,
  subOptions: Record<string, string> = {},
): string {
  const ids = [...Object.values(options), ...Object.values(subOptions)].sort();
  return ids.length === 0 ? 'baseline' : ids.join('+');
}

function setField(twin: HomeTwin, path: string, value: number): HomeTwin {
  const copy = structuredClone(twin) as unknown as Record<string, unknown>;
  const keys = path.split('.');
  let cur: Record<string, unknown> = copy;
  for (const k of keys.slice(0, -1)) {
    const next = cur[k];
    if (!next || typeof next !== 'object') throw new Error(`no field ${path}`);
    cur = next as Record<string, unknown>;
  }
  const last = keys.at(-1) as string;
  if (!Object.hasOwn(cur, last)) throw new Error(`no field ${path}`);
  cur[last] = { state: 'known', value, source: { kind: 'stated' } };
  return parseTwin(copy);
}

export function applyOps(
  twin: HomeTwin,
  rawOps: readonly unknown[],
  catalogue: MeasureCatalogue | null,
  base?: PackageSpec,
): OpsApplied {
  const options: Record<string, string> = { ...(base?.options ?? {}) };
  const subOptions: Record<string, string> = { ...(base?.subOptions ?? {}) };
  const accepted: ScenarioOp[] = [];
  const rejected: RejectedOp[] = [];
  const owner: OpsApplied['owner'] = {};
  let cur = twin;

  for (const raw of rawOps) {
    const r = ScenarioOpSchema.safeParse(raw);
    if (!r.success) {
      rejected.push({
        op: raw,
        code: 'schema',
        detail: r.error.issues.map((i) => `${i.path.join('.') || 'op'}: ${i.message}`).join('; '),
      });
      continue;
    }
    const op = r.data;
    switch (op.op) {
      case 'addMeasure': {
        const def = catalogue?.measures[op.measureId];
        if (!def) {
          rejected.push({
            op,
            code: 'unknown-measure',
            detail: catalogue
              ? `unknown measure; known: ${Object.keys(catalogue.measures).join(', ')}`
              : 'the measure catalogue for this region is not available yet',
          });
          continue;
        }
        const given = op.params?.option ?? op.params?.optionId;
        const option = given ?? (def.options.length === 1 ? def.options[0] : undefined);
        if (typeof option !== 'string' || !def.options.includes(option)) {
          rejected.push({
            op,
            code: 'range',
            detail: `params.option must be one of ${def.options.join(', ')}`,
          });
          continue;
        }
        if (catalogue?.subGroups.has(def.group)) subOptions[def.group] = option;
        else options[def.group] = option;
        accepted.push(op);
        break;
      }
      case 'removeMeasure': {
        const def = catalogue?.measures[op.measureId];
        if (!def) {
          rejected.push({ op, code: 'unknown-measure', detail: 'unknown measure' });
          continue;
        }
        const slot = catalogue?.subGroups.has(def.group) ? subOptions : options;
        const current = slot[def.group];
        if (current && def.options.includes(current)) delete slot[def.group];
        accepted.push(op);
        break;
      }
      case 'setParam': {
        const range = OWNER_PARAMS[op.path];
        if (!range) {
          rejected.push({
            op,
            code: 'range',
            detail: `setParam path must be one of ${Object.keys(OWNER_PARAMS).join(', ')}`,
          });
          continue;
        }
        if (typeof op.value !== 'number' || op.value < range.min || op.value > range.max) {
          rejected.push({ op, code: 'range', detail: `${op.path} must be a number in its allowed range` });
          continue;
        }
        try {
          cur = setField(cur, op.path, op.value);
          accepted.push(op);
        } catch (e) {
          rejected.push({ op, code: 'range', detail: e instanceof Error ? e.message : String(e) });
        }
        break;
      }
      case 'setBudget':
        owner.budgetGBP = op.capGBP;
        accepted.push(op);
        break;
      case 'setHorizon':
        owner.horizonYears = op.years;
        accepted.push(op);
        break;
      case 'setTariff':
        rejected.push({ op, code: 'unsupported', detail: 'tariff switching is not available headless yet' });
        break;
      case 'compare':
      case 'explain':
        rejected.push({
          op,
          code: 'read-only',
          detail: 'read-only op: use ibasho_compare or ibasho_evidence',
        });
        break;
      case 'rejectMeasure':
        rejected.push({ op, code: 'use-memory', detail: 'record this with ibasho_memory_remember' });
        break;
    }
  }
  const pkg: PackageSpec = { id: packageIdOf(options, subOptions), options };
  if (Object.keys(subOptions).length > 0) pkg.subOptions = subOptions;
  return { accepted, rejected, twin: cur, pkg, owner };
}

export const DEFAULT_DISCOUNT_PPB = 35_000_000n;
export const DEFAULT_HORIZON_YEARS = 25;

export function ownerCtx(
  tenure: OwnerCtx['tenure'],
  opts: { budgetGBP?: number | undefined; horizonYears?: number | undefined },
): OwnerCtx {
  const o: OwnerCtx = {
    tenure,
    discountRatePpb: DEFAULT_DISCOUNT_PPB,
    horizonYears: opts.horizonYears ?? DEFAULT_HORIZON_YEARS,
  };
  // 1 GBP = 100 pence = 100,000,000 micro-pence.
  if (opts.budgetGBP !== undefined) o.budget = BigInt(Math.round(opts.budgetGBP * 100)) * 1_000_000n;
  return o;
}

/** Value-free label for an op, for echoes and ledgers (`addMeasure loft`, `setParam occupancy.people`). */
export function opLabel(raw: unknown): string {
  const o = raw as { op?: unknown; measureId?: unknown; path?: unknown; fuel?: unknown } | null;
  const op = typeof o?.op === 'string' ? o.op.slice(0, 40) : 'unknown';
  if (typeof o?.measureId === 'string') return `${op} ${o.measureId.slice(0, 80)}`;
  if (typeof o?.path === 'string') return `${op} ${o.path.slice(0, 80)}`;
  if (typeof o?.fuel === 'string') return `${op} ${o.fuel.slice(0, 20)}`;
  return op;
}
