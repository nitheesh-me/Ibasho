import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type { MemoryEvent } from '../src/ai/memory.ts';
import type { ScenarioOp } from '../src/ai/ops.ts';
import type { Expr, Rule } from '../src/rules.ts';
import {
  ExprSchema,
  HomeTwinSchema,
  MemoryEventSchema,
  NumFieldSchema,
  parseTwin,
  RuleSchema,
  ScenarioOpSchema,
  TwinPatchSchema,
  WireIntSchema,
  WireQSchema,
} from '../src/schemas/index.ts';
import type { HomeTwin } from '../src/twin.ts';

// Reverse direction of the schema annotations: every contract value is a valid schema input.
type Assignable<A, B> = A extends B ? true : false;
const typeChecks: [
  Assignable<HomeTwin, z.input<typeof HomeTwinSchema>>,
  Assignable<Rule, z.input<typeof RuleSchema>>,
  Assignable<Expr, z.input<typeof ExprSchema>>,
  Assignable<ScenarioOp, z.input<typeof ScenarioOpSchema>>,
  Assignable<MemoryEvent, z.input<typeof MemoryEventSchema>>,
] = [true, true, true, true, true];

const k = (value: number) => ({ state: 'known' as const, value, source: { kind: 'stated' as const } });
const c = <E extends string>(value: E) => ({
  state: 'known' as const,
  value,
  source: { kind: 'stated' as const },
});

/** A small but complete GH1-like twin. */
export function minimalTwin(): HomeTwin {
  return {
    schema: 'ibasho.twin/2',
    id: 'gh1',
    version: 1,
    region: 'GB-ENG',
    climatePackId: 'climate-london',
    location: { lat: 51.5, lon: -0.1 },
    archetypeId: 'uk-mid-terrace-1900-1929',
    form: {
      builtForm: 'mid-terrace',
      storeys: k(2),
      storeyHeightM: k(2.7),
      footprintM2: k(42),
      perimeterM: k(26),
      frontAzimuthDeg: k(180),
      roof: c('pitched'),
    },
    zones: { livingAreaFrac: k(0.25) },
    elements: [
      {
        id: 'wall-front',
        kind: 'wall',
        zone: 'both',
        areaM2: k(30),
        constructionId: 'solid-brick-225',
        u: {
          state: 'estimated',
          value: 1.5,
          range: [1.2, 1.9],
          source: { kind: 'default', pluginId: 'home-uk' },
        },
        geometry: {
          polygon: [
            [0, 0, 0],
            [5, 0, 0],
            [5, 6, 0],
          ],
        },
      },
      {
        id: 'window-front',
        kind: 'window',
        zone: 'living',
        areaM2: k(3),
        parentId: 'wall-front',
        constructionId: 'single-glazed-timber',
        u: k(4.8),
        geometry: {
          polygon: [
            [1, 1, 0],
            [2, 1, 0],
            [2, 2, 0],
          ],
        },
      },
    ],
    junctions: [
      {
        id: 'jn-lintel-front',
        kind: 'lintel',
        elementIds: ['wall-front', 'window-front'],
        lengthM: k(1.2),
        psi: k(0.3),
        path: [
          [1, 2, 0],
          [2, 2, 0],
        ],
      },
    ],
    ventilation: {
      chimneysOpen: k(1),
      chimneysBlocked: k(1),
      extractFans: k(1),
      draughtProofedFrac: k(0),
      floorType: c('suspended-unsealed'),
      shelteredSides: k(2),
      system: c('natural'),
    },
    systems: {
      space: { systemId: 'gas-combi-condensing', fuel: 'gas' },
      dhw: { systemId: 'gas-combi-condensing', fuel: 'gas', class: 'combi' },
      hob: c('gas'),
      emitters: { kOversize: k(1) },
      controls: c('programmer-thermostat'),
    },
    occupancy: { people: k(3), setpointC: k(20), heatingHours: k(9) },
    site: { overshading: c('average') },
    legal: {
      tenure: c('owner'),
      designations: {
        conservationArea: true,
        article23Land: true,
        listedGrade: c('none'),
        article4RemovedClasses: [],
      },
      supply: { phases: k(1), looped: 'unknown' },
    },
    checks: [],
    done: [],
  };
}

describe('HomeTwinSchema', () => {
  it('parses a complete twin to an equal value', () => {
    expect(typeChecks.every(Boolean)).toBe(true);
    const t = minimalTwin();
    expect(parseTwin(t)).toEqual(t);
    expect(parseTwin(JSON.parse(JSON.stringify(t)))).toEqual(t);
  });

  it('rejects wrong schema ids, bad dates, NaN and broken references', () => {
    const bad = (mut: (t: HomeTwin) => unknown) => {
      const t = structuredClone(minimalTwin());
      mut(t);
      return HomeTwinSchema.safeParse(t).success;
    };
    expect(bad(() => undefined)).toBe(true);
    expect(bad((t) => Object.assign(t, { schema: 'ibasho.twin/1' }))).toBe(false);
    expect(bad((t) => t.checks.push({ kind: 'structural', at: '2026-02-30' as never, result: 'pass' }))).toBe(
      false,
    );
    expect(bad((t) => Object.assign(t.zones, { livingAreaFrac: k(Number.NaN) }))).toBe(false);
    expect(bad((t) => t.elements.push({ ...t.elements[0]! }))).toBe(false);
    expect(bad((t) => Object.assign(t.elements[1]!, { parentId: 'nope' }))).toBe(false);
    expect(bad((t) => t.junctions[0]!.elementIds.push('ghost'))).toBe(false);
    expect(bad((t) => t.junctions.push({ ...t.junctions[0]! }))).toBe(false);
    expect(bad((t) => Object.assign(t, { region: 'FR' }))).toBe(false);
    expect(
      bad((t) =>
        Object.assign(t.form, { roof: { state: 'known', value: 'dome', source: { kind: 'stated' } } }),
      ),
    ).toBe(false);
  });

  it('NumField ranges must be ordered', () => {
    expect(
      NumFieldSchema.safeParse({
        state: 'unknown',
        range: [2, 1],
        material: true,
        source: { kind: 'stated' },
      }).success,
    ).toBe(false);
    expect(
      NumFieldSchema.safeParse({
        state: 'unknown',
        range: [1, 2],
        material: true,
        source: { kind: 'calibrated', posterior: { lo: 1, hi: 2 } },
      }).success,
    ).toBe(true);
  });

  it('patches use JSON Pointers', () => {
    expect(TwinPatchSchema.safeParse({ set: [{ path: '/elements/0/u', value: k(0.3) }] }).success).toBe(true);
    expect(TwinPatchSchema.safeParse({ set: [{ path: 'elements.0.u', value: 1 }] }).success).toBe(false);
  });
});

describe('rule schemas', () => {
  const rule: Rule = {
    id: 'ENG.PD.ASHP.NOISE',
    jurisdiction: 'GB-ENG',
    measures: ['ashp'],
    scope: 'package',
    when: { not: { fn: 'mcs020a_Lp_le', args: [{ fact: 'p.noise.lp' }] } },
    effect: { kind: 'block', reason: 'rules.noise' },
    effectiveFrom: '2025-05-29',
    source: {
      url: 'https://www.legislation.gov.uk/uksi/2015/596',
      clause: 'Sch 2 Pt 14 Class G',
      grade: 'primary',
    },
    explain: 'rules.noise.explain',
  };

  it('accepts a valid rule and rejects unknown functions and stray keys', () => {
    expect(RuleSchema.parse(rule)).toEqual(rule);
    expect(RuleSchema.safeParse({ ...rule, when: { fn: 'eval', args: [] } }).success).toBe(false);
    expect(ExprSchema.safeParse({ and: [{ const: true }], extra: 1 }).success).toBe(false);
    expect(RuleSchema.safeParse({ ...rule, effectiveTo: '2025-01-01' }).success).toBe(false);
    expect(RuleSchema.safeParse({ ...rule, id: 'lower.case' }).success).toBe(false);
    expect(
      RuleSchema.safeParse({
        ...rule,
        effect: { kind: 'oblige', spec: { kind: 'max-u', element: 'wall', maxU: 0.3 } },
      }).success,
    ).toBe(true);
  });

  it('parses nested Kleene expressions', () => {
    const e: Expr = {
      or: [
        { in: { fact: 'h.tenure' }, set: ['owner', 'landlord'] },
        { and: [{ cmp: '>', left: { fact: 'p.kw' }, right: 3.68 }, { const: 'unknown' }] },
      ],
    };
    expect(ExprSchema.parse(e)).toEqual(e);
  });
});

describe('op and memory schemas', () => {
  it('accepts typed ops and rejects anything else', () => {
    const ok: ScenarioOp[] = [
      { op: 'addMeasure', measureId: 'loft', params: { depthMm: 300 } },
      { op: 'setParam', path: 'occupancy.setpointC', value: 19 },
      { op: 'explain', evidenceId: 'ev_0123abcd' },
      { op: 'rejectMeasure', measureId: 'wall-ewi', scope: 'snooze', until: '2027-01-01' },
      { op: 'compare', scenarioIds: ['a', 'b'] },
    ];
    for (const o of ok) expect(ScenarioOpSchema.parse(o)).toEqual(o);
    expect(ScenarioOpSchema.safeParse({ op: 'runCode', code: 'x' }).success).toBe(false);
    expect(ScenarioOpSchema.safeParse({ op: 'removeMeasure', measureId: 'loft', extra: true }).success).toBe(
      false,
    );
    expect(ScenarioOpSchema.safeParse({ op: 'setParam', path: 'a..b', value: 1 }).success).toBe(false);
    expect(ScenarioOpSchema.safeParse({ op: 'setHorizon', years: 0 }).success).toBe(false);
  });

  it('accepts memory events by type and checks payloads', () => {
    const e: MemoryEvent = {
      id: 'm1',
      homeId: 'gh1',
      at: '2026-10-11T09:00:00Z',
      actor: 'owner',
      type: 'measureRejected',
      payload: { measureId: 'wall-ewi', scope: 'never', reason: 'front elevation' },
      source: { kind: 'ui' },
    };
    expect(MemoryEventSchema.parse(e)).toEqual(e);
    expect(MemoryEventSchema.safeParse({ ...e, payload: { measureId: 'x' } }).success).toBe(false);
    expect(MemoryEventSchema.safeParse({ ...e, type: 'budgetSet' }).success).toBe(false);
    expect(
      MemoryEventSchema.safeParse({
        ...e,
        type: 'memoryForgotten',
        payload: { selector: { kind: 'type', type: 'budgetSet' } },
      }).success,
    ).toBe(true);
    expect(
      MemoryEventSchema.safeParse({
        ...e,
        type: 'opApplied',
        payload: { op: { op: 'setBudget', capGBP: 15000 } },
      }).success,
    ).toBe(true);
  });
});

describe('wire strings', () => {
  it('integers and rationals', () => {
    expect(WireIntSchema.safeParse('-120').success).toBe(true);
    expect(WireIntSchema.safeParse('-0').success).toBe(false);
    expect(WireIntSchema.safeParse('1.5').success).toBe(false);
    expect(WireQSchema.safeParse('3/20').success).toBe(true);
    expect(WireQSchema.safeParse('3/0').success).toBe(false);
  });
});
