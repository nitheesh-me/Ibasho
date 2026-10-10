/**
 * OpValidator (AM 6.1 and 6.2 step 3, SPEC 5.6). The LLM or the intent parser proposes
 * `ScenarioOp`s; this decides which may run. Shape comes from `ScenarioOpSchema` (core); ranges come
 * from the measure models' option params (ARCH 5.6), never from a JSON schema sent to a model.
 * Memory constraints are enforced here: a ruled-out measure is a `memory-conflict`, and the
 * narrator acknowledges it instead of applying it.
 */
import {
  type Fuel,
  isMutatingOp,
  type MeasureOptionParam,
  type OpValidation,
  type Preferences,
  type Right,
  type ScenarioOp,
} from '@ibasho/core';
import { ScenarioOpSchema } from '@ibasho/core/schemas';
import { MEASURE_CATALOGUE } from '../measures.ts';

export type RightKey = keyof Preferences['rights'];

export interface CatalogueMeasure {
  id: string;
  options: { id: string; params: Record<string, MeasureOptionParam> }[];
  /** The right a tenant or leaseholder needs for it. */
  needsRight?: RightKey;
}

export interface OpCatalogue {
  measures: CatalogueMeasure[];
  /** Owner-editable parameters and their ranges. */
  params: Record<string, { min?: number; max?: number; enum?: string[] }>;
  tariffs: Partial<Record<Fuel, string[]>>;
  /** Central capital cost per option, GBP, for the budget check (optional). */
  costMidGBP?: Record<string, number>;
  /** Known evidence ids (`explain`) and scenario ids (`compare`); unchecked when absent. */
  evidenceIds?: ReadonlySet<string>;
  scenarioIds?: ReadonlySet<string>;
}

export interface OpContext {
  catalogue: OpCatalogue;
  preferences: Preferences;
  /** ISO instant for snooze expiry. */
  now: string;
}

/** Rights per measure (SPEC 5.12 rights; RP tenure rules). */
const NEEDS_RIGHT: Record<string, RightKey> = {
  'wall-ewi': 'externalWalls',
  ashp: 'externalWalls',
  pv: 'roof',
  'solar-thermal': 'roof',
  loft: 'roof',
  'glazing-double': 'windows',
  'glazing-secondary': 'windows',
};

/** Owner levers (SPEC 5.6). Ranges are physical or policy limits; the engine re-checks. */
export const DEFAULT_PARAMS: OpCatalogue['params'] = {
  'occupancy.setpointC': { min: 14, max: 25 },
  'heating.flowTempC': { min: 35, max: 75 },
  'heating.radiatorOversize': { min: 1, max: 3 },
  'finance.discountRatePct': { min: 0, max: 15 },
  'price.gasPence': { min: 1, max: 50 },
  'price.electricityPence': { min: 1, max: 100 },
};

export const DEFAULT_TARIFFS: OpCatalogue['tariffs'] = {
  electricity: ['price-cap', 'economy-7', 'octopus-agile', 'octopus-cosy', 'octopus-go'],
  gas: ['price-cap', 'fixed-12m'],
};

/**
 * Catalogue from the local measure table (LOCAL ADAPTER until the app passes the registry's
 * `MeasureModel`s through `catalogueFromModels`). Options carry no params here.
 */
export function defaultCatalogue(): OpCatalogue {
  return {
    measures: MEASURE_CATALOGUE.map((m) => {
      const right = NEEDS_RIGHT[m.id];
      const c: CatalogueMeasure = { id: m.id, options: Object.keys(m.options).map((id) => ({ id, params: {} })) };
      if (right) c.needsRight = right;
      return c;
    }),
    params: DEFAULT_PARAMS,
    tariffs: DEFAULT_TARIFFS,
  };
}

/** Catalogue from registry measure models (`kind: 'measure'`). */
export function catalogueFromModels(
  models: readonly { id: string; options: { id: string; params: Record<string, MeasureOptionParam> }[] }[],
  extra: Partial<OpCatalogue> = {},
): OpCatalogue {
  return {
    measures: models.map((m) => {
      const right = NEEDS_RIGHT[m.id];
      const c: CatalogueMeasure = { id: m.id, options: m.options.map((o) => ({ id: o.id, params: o.params })) };
      if (right) c.needsRight = right;
      return c;
    }),
    params: extra.params ?? DEFAULT_PARAMS,
    tariffs: extra.tariffs ?? DEFAULT_TARIFFS,
    ...(extra.costMidGBP ? { costMidGBP: extra.costMidGBP } : {}),
    ...(extra.evidenceIds ? { evidenceIds: extra.evidenceIds } : {}),
    ...(extra.scenarioIds ? { scenarioIds: extra.scenarioIds } : {}),
  };
}

type Rejection = OpValidation['rejected'][number];

function findMeasure(cat: OpCatalogue, id: string): { measure: CatalogueMeasure; option?: string } | undefined {
  for (const m of cat.measures) {
    if (m.id === id) return { measure: m };
    if (m.options.some((o) => o.id === id)) return { measure: m, option: id };
  }
  return undefined;
}

export function isRejectionActive(r: Preferences['rejected'][string], now: string): boolean {
  return r.scope === 'never' || (r.until !== undefined && now < r.until);
}

function inRange(v: number, r: { min?: number; max?: number }): boolean {
  return (r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max);
}

function checkAdd(op: Extract<ScenarioOp, { op: 'addMeasure' }>, ctx: OpContext): Rejection | null {
  const found = findMeasure(ctx.catalogue, op.measureId);
  if (!found) return { op, code: 'unknown-measure', detail: `no measure ${op.measureId}` };
  const { measure } = found;
  const rej = ctx.preferences.rejected[measure.id];
  if (rej && isRejectionActive(rej, ctx.now)) {
    return { op, code: 'memory-conflict', detail: `you ruled out ${measure.id} (${rej.scope})` };
  }
  if (ctx.preferences.completed[measure.id]) {
    return { op, code: 'memory-conflict', detail: `${measure.id} is already done` };
  }
  const right: Right | undefined = measure.needsRight ? ctx.preferences.rights[measure.needsRight] : undefined;
  if (right === 'no') return { op, code: 'tenure', detail: `needs the right to change the ${measure.needsRight}` };

  const optionId = found.option ?? (typeof op.params?.['option'] === 'string' ? op.params['option'] : undefined);
  const options = optionId ? measure.options.filter((o) => o.id === optionId) : measure.options;
  if (optionId && options.length === 0) return { op, code: 'unknown-measure', detail: `${measure.id} has no option ${optionId}` };
  for (const [k, v] of Object.entries(op.params ?? {})) {
    if (k === 'option') continue;
    const defs = options.map((o) => o.params[k]).filter((d): d is MeasureOptionParam => d !== undefined);
    if (defs.length === 0) return { op, code: 'range', detail: `${measure.id} has no parameter ${k}` };
    if (typeof v === 'number' && !defs.some((d) => inRange(v, d))) {
      return { op, code: 'range', detail: `${k} = ${v} is outside the allowed range` };
    }
    if (typeof v === 'string' && !defs.some((d) => d.value === v)) {
      return { op, code: 'range', detail: `${k} = ${v} is not an allowed value` };
    }
  }
  const cap = ctx.preferences.budgetCapGBP;
  const cost = optionId ? ctx.catalogue.costMidGBP?.[optionId] : undefined;
  if (cap !== undefined && cost !== undefined && cost > cap) {
    return { op, code: 'budget', detail: `${optionId} costs more than your budget on its own` };
  }
  return null;
}

function checkOne(op: ScenarioOp, ctx: OpContext): Rejection | null {
  const cat = ctx.catalogue;
  switch (op.op) {
    case 'addMeasure':
      return checkAdd(op, ctx);
    case 'removeMeasure':
    case 'rejectMeasure':
      return findMeasure(cat, op.measureId) ? null : { op, code: 'unknown-measure', detail: `no measure ${op.measureId}` };
    case 'setParam': {
      const def = cat.params[op.path];
      if (!def) return { op, code: 'schema', detail: `${op.path} is not an owner lever` };
      if (typeof op.value === 'number' && !inRange(op.value, def)) {
        return { op, code: 'range', detail: `${op.path} = ${op.value} is outside ${def.min} to ${def.max}` };
      }
      if (typeof op.value === 'string' && !(def.enum ?? []).includes(op.value)) {
        return { op, code: 'range', detail: `${op.path} does not take ${op.value}` };
      }
      return null;
    }
    case 'setTariff':
      return (cat.tariffs[op.fuel] ?? []).includes(op.tariffId)
        ? null
        : { op, code: 'schema', detail: `no ${op.fuel} tariff ${op.tariffId}` };
    case 'setBudget':
    case 'setHorizon':
      return null;
    case 'compare':
      return cat.scenarioIds && op.scenarioIds.some((s) => !cat.scenarioIds?.has(s))
        ? { op, code: 'schema', detail: 'unknown scenario' }
        : null;
    case 'explain':
      return cat.evidenceIds && !cat.evidenceIds.has(op.evidenceId)
        ? { op, code: 'schema', detail: `unknown evidence ${op.evidenceId}` }
        : null;
  }
}

/** Validate proposed ops. Unknown input is parsed with the core schema first. */
export function validateOps(ops: readonly unknown[], ctx: OpContext): OpValidation {
  const accepted: ScenarioOp[] = [];
  const rejected: Rejection[] = [];
  for (const raw of ops) {
    const parsed = ScenarioOpSchema.safeParse(raw);
    if (!parsed.success) {
      rejected.push({
        op: raw as ScenarioOp,
        code: 'schema',
        detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
      continue;
    }
    const bad = checkOne(parsed.data, ctx);
    if (bad) rejected.push(bad);
    else accepted.push(parsed.data);
  }
  return { accepted, rejected, needsConfirmation: accepted.some(isMutatingOp) };
}

/**
 * JSON Schema of the op union for model backends (AM 6.1): measure ids as enums, and no
 * `minimum`/`maximum` (Claude's strict subset; Ollama ignores descriptions). Ranges stay in zod.
 */
export function opPlanJsonSchema(cat: OpCatalogue): Record<string, unknown> {
  const measureIds = [...new Set(cat.measures.flatMap((m) => [m.id, ...m.options.map((o) => o.id)]))].sort();
  const str = { type: 'string' };
  const obj = (op: string, props: Record<string, unknown>, required: string[]) => ({
    type: 'object',
    additionalProperties: false,
    required: ['op', ...required],
    properties: { op: { type: 'string', enum: [op] }, ...props },
  });
  const measure = { type: 'string', enum: measureIds };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['ops', 'rationale'],
    properties: {
      rationale: str,
      ops: {
        type: 'array',
        items: {
          anyOf: [
            obj('addMeasure', { measureId: measure, params: { type: 'object', additionalProperties: { type: ['number', 'string'] } } }, ['measureId']),
            obj('removeMeasure', { measureId: measure }, ['measureId']),
            obj('setParam', { path: { type: 'string', enum: Object.keys(cat.params).sort() }, value: { type: ['number', 'string'] } }, ['path', 'value']),
            obj('setTariff', { fuel: { type: 'string', enum: Object.keys(cat.tariffs).sort() }, tariffId: str }, ['fuel', 'tariffId']),
            obj('setBudget', { capGBP: { type: 'number' } }, ['capGBP']),
            obj('setHorizon', { years: { type: 'integer' } }, ['years']),
            obj('compare', { scenarioIds: { type: 'array', items: str } }, ['scenarioIds']),
            obj('explain', { evidenceId: str }, ['evidenceId']),
            obj('rejectMeasure', { measureId: measure, scope: { type: 'string', enum: ['never', 'snooze'] }, reason: str }, ['measureId', 'scope']),
          ],
        },
      },
    },
  };
}
