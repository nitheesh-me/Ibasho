/**
 * Zod schema for `HomeTwin` (`ibasho.twin/2`, ARCH 5.2). Owner: WP-00.
 * Used at every boundary where a twin enters from outside: `.ibasho` import, onboarding,
 * fixtures and the agent link. The output type is exactly `HomeTwin`.
 */
import { z } from 'zod';
import {
  BANDS,
  type Band,
  CHECK_KINDS,
  type CheckKind,
  type Element,
  type HomeTwin,
  type Junction,
  type MeterData,
  type TwinPatch,
} from '../twin.ts';
import { FUELS, type Fuel } from '../units.ts';
import {
  choiceSchema,
  Finite,
  InputSourceSchema,
  IsoDateSchema,
  NumFieldSchema,
  RegionCodeSchema,
  TriSchema,
} from './common.ts';

const opt = <T extends z.ZodType>(s: T) => s.exactOptional();
const FuelSchema = z.enum(FUELS as [Fuel, ...Fuel[]]);
const BandSchema = z.enum(BANDS as [Band, ...Band[]]);
const CheckKindSchema = z.enum(CHECK_KINDS as unknown as [CheckKind, ...CheckKind[]]);
const Vec3 = z.tuple([Finite, Finite, Finite]);
const Vec2 = z.tuple([Finite, Finite]);
const Overshading = choiceSchema(['heavy', 'more-than-average', 'average', 'very-little']);
const OvershadingClass = z.enum(['heavy', 'more-than-average', 'average', 'very-little']);

export const ElementSchema: z.ZodType<Element> = z.object({
  id: z.string().min(1),
  kind: z.enum(['wall', 'party-wall', 'roof', 'floor', 'window', 'door', 'rooflight']),
  zone: z.enum(['living', 'rest', 'both']),
  orientationDeg: opt(Finite),
  tiltDeg: opt(Finite),
  areaM2: NumFieldSchema,
  parentId: opt(z.string()),
  constructionId: z.string(),
  u: NumFieldSchema,
  g: opt(NumFieldSchema),
  frameFactor: opt(NumFieldSchema),
  absorptance: opt(NumFieldSchema),
  geometry: z.object({ polygon: z.array(Vec3), holes: opt(z.array(z.array(Vec3))) }),
  finish: opt(z.string()),
  frontsHighway: opt(TriSchema),
  onBoundary: opt(TriSchema),
});

export const JunctionSchema: z.ZodType<Junction> = z.object({
  id: z.string().min(1),
  kind: z.enum([
    'lintel',
    'sill',
    'jamb',
    'eaves',
    'ground-floor',
    'party-wall',
    'intermediate-floor',
    'corner',
    'joist-end',
  ]),
  elementIds: z.array(z.string()),
  lengthM: NumFieldSchema,
  psi: NumFieldSchema,
  path: z.array(Vec3),
});

const SystemRefShape = {
  systemId: z.string(),
  fuel: FuelSchema,
  efficiency: opt(NumFieldSchema),
  sizeKW: opt(NumFieldSchema),
  installedYear: opt(z.number().int()),
};

export const MeterDataSchema: z.ZodType<MeterData> = z.object({
  series: z.array(
    z.object({
      fuel: FuelSchema,
      quality: z.enum(['meter', 'kwh', 'money', 'direct-debit']),
      periods: z.array(
        z.object({
          from: IsoDateSchema,
          to: IsoDateSchema,
          value: Finite,
          unit: z.enum(['kWh', 'GBP', 'INR', 'm3']),
        }),
      ),
      source: InputSourceSchema,
    }),
  ),
});

export const HomeTwinSchema: z.ZodType<HomeTwin> = z
  .object({
    schema: z.literal('ibasho.twin/2'),
    id: z.string().min(1),
    version: z.number().int().nonnegative(),
    region: RegionCodeSchema,
    climatePackId: z.string(),
    location: z.object({ lat: Finite, lon: Finite, district: opt(z.string()) }),
    archetypeId: z.string(),
    form: z.object({
      builtForm: z.enum([
        'detached',
        'semi-detached',
        'end-terrace',
        'mid-terrace',
        'enclosed-end-terrace',
        'enclosed-mid-terrace',
        'flat',
        'maisonette',
        'independent-house',
      ]),
      storeys: NumFieldSchema,
      storeyHeightM: NumFieldSchema,
      footprintM2: NumFieldSchema,
      perimeterM: NumFieldSchema,
      frontAzimuthDeg: NumFieldSchema,
      roof: choiceSchema(['pitched', 'flat', 'rafters']),
      pitchDeg: opt(NumFieldSchema),
      floorLevel: opt(z.number().int()),
    }),
    zones: z.object({ livingAreaFrac: NumFieldSchema }),
    elements: z.array(ElementSchema),
    junctions: z.array(JunctionSchema),
    ventilation: z.object({
      chimneysOpen: NumFieldSchema,
      chimneysBlocked: NumFieldSchema,
      extractFans: NumFieldSchema,
      ap50: opt(NumFieldSchema),
      draughtProofedFrac: NumFieldSchema,
      floorType: choiceSchema(['suspended-unsealed', 'suspended-sealed', 'solid']),
      shelteredSides: NumFieldSchema,
      system: choiceSchema(['natural', 'intermittent-extract', 'mev', 'piv', 'mvhr']),
    }),
    systems: z.object({
      space: z.object(SystemRefShape),
      dhw: z.object({ ...SystemRefShape, class: z.enum(['combi', 'cylinder', 'instant', 'geyser']) }),
      boilerAgeYears: opt(NumFieldSchema),
      cooling: opt(z.array(z.object(SystemRefShape))),
      pv: opt(
        z.array(
          z.object({
            id: z.string(),
            kWp: NumFieldSchema,
            azimuthDeg: Finite,
            tiltDeg: Finite,
            overshading: OvershadingClass,
            elementId: opt(z.string()),
          }),
        ),
      ),
      battery: opt(NumFieldSchema),
      hob: choiceSchema(['gas', 'electric', 'induction']),
      emitters: z.object({
        kOversize: NumFieldSchema,
        radiators: opt(
          z.array(
            z.object({
              id: z.string(),
              zone: z.enum(['living', 'rest']),
              room: opt(z.string()),
              outputW50: NumFieldSchema,
              elementId: opt(z.string()),
            }),
          ),
        ),
      }),
      controls: choiceSchema([
        'none',
        'programmer-only',
        'room-thermostat',
        'programmer-thermostat',
        'programmer-thermostat-trvs',
        'zone-control',
        'trvs-weather-compensation',
      ]),
    }),
    occupancy: z.object({
      people: NumFieldSchema,
      setpointC: NumFieldSchema,
      heatingHours: NumFieldSchema,
      acHoursPerNight: opt(NumFieldSchema),
      fans: opt(NumFieldSchema),
    }),
    site: z.object({
      overshading: Overshading,
      garden: opt(z.object({ polygon: z.array(Vec2), areaM2: Finite })),
      neighbours: opt(
        z.array(
          z.object({
            id: z.string(),
            position: Vec3,
            kind: z.enum(['window', 'door']),
            habitable: TriSchema,
          }),
        ),
      ),
      boundaries: opt(
        z.array(
          z.object({
            id: z.string(),
            path: z.array(Vec2),
            kind: z.enum(['wall', 'fence', 'hedge', 'open']),
            heightM: opt(Finite),
          }),
        ),
      ),
    }),
    legal: z.object({
      tenure: choiceSchema(['owner', 'tenant', 'landlord', 'leaseholder']),
      designations: z.object({
        conservationArea: TriSchema,
        article23Land: TriSchema,
        listedGrade: choiceSchema(['I', 'II*', 'II', 'none']),
        inCurtilageOfListed: opt(TriSchema),
        article4RemovedClasses: z.array(z.string()),
        scheduledMonument: opt(TriSchema),
      }),
      roofIsCommonArea: opt(TriSchema),
      leaseCovenant: opt(choiceSchema(['absolute', 'qualified', 'silent', 'unknown'])),
      epc: opt(z.object({ band: BandSchema, sap: opt(Finite), issued: IsoDateSchema })),
      sanctionedLoadKW: opt(NumFieldSchema),
      valueGBP: opt(NumFieldSchema),
      supply: z.object({ phases: NumFieldSchema, looped: TriSchema, fuseA: opt(NumFieldSchema) }),
    }),
    checks: z.array(
      z.object({
        kind: CheckKindSchema,
        at: IsoDateSchema,
        result: z.enum(['pass', 'fail', 'conditional']),
        ref: opt(z.string()),
      }),
    ),
    meters: opt(MeterDataSchema),
    done: z.array(
      z.object({ measureId: z.string(), optionId: z.string(), at: IsoDateSchema, costGBP: opt(Finite) }),
    ),
  })
  .superRefine((t, ctx) => {
    const ids = new Set<string>();
    for (const e of t.elements) {
      if (ids.has(e.id))
        ctx.addIssue({ code: 'custom', message: `duplicate element id ${e.id}`, path: ['elements'] });
      ids.add(e.id);
    }
    for (const e of t.elements) {
      if (e.parentId !== undefined && !ids.has(e.parentId)) {
        ctx.addIssue({
          code: 'custom',
          message: `element ${e.id} has unknown parent ${e.parentId}`,
          path: ['elements'],
        });
      }
    }
    const jids = new Set<string>();
    for (const j of t.junctions) {
      if (jids.has(j.id))
        ctx.addIssue({ code: 'custom', message: `duplicate junction id ${j.id}`, path: ['junctions'] });
      jids.add(j.id);
      for (const el of j.elementIds) {
        if (!ids.has(el)) {
          ctx.addIssue({
            code: 'custom',
            message: `junction ${j.id} names unknown element ${el}`,
            path: ['junctions'],
          });
        }
      }
    }
  });

export const TwinPatchSchema: z.ZodType<TwinPatch> = z.object({
  set: z.array(z.object({ path: z.string().startsWith('/'), value: z.unknown() })),
  addElements: opt(z.array(ElementSchema)),
  addJunctions: opt(z.array(JunctionSchema)),
  removeElementIds: opt(z.array(z.string())),
});

/** Parse an untrusted twin; throws a `ZodError` listing every issue. */
export function parseTwin(input: unknown): HomeTwin {
  return HomeTwinSchema.parse(input);
}
