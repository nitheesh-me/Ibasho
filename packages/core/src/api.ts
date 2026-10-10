/**
 * Engine API exposed by the worker through Comlink (ARCH 5.5). Owner: WP-00 (contract);
 * WP-02 implements it in `packages/engine/src/api.ts`.
 */

import type { Certificate } from './certificate.ts';
import type { IsoDate, RunMode } from './common.ts';
import type {
  ActualWeather,
  CalibrationPosterior,
  OwnerCtx,
  PackageSpec,
  SimBundle,
  SimResult,
  Target,
} from './engine.ts';
import type { EvidenceGraph, EvidenceId, EvidenceNode, QuantityId } from './evidence/types.ts';
import type { Tri } from './fields.ts';
import type { Ival } from './ival.ts';
import type { DoNothingRequest, DoNothingResult, NegativesByPackage } from './maintenance.ts';
import type { HomeTwin, MeterData, Vec3 } from './twin.ts';

export interface SearchRequest {
  twin: HomeTwin;
  owner: OwnerCtx;
  target: Target;
  memory: { rejected: string[]; completed: string[] };
  asOf: IsoDate;
}

export interface SearchProgress {
  jobId: string;
  phase: 'plan' | 'heavy' | 'light' | 'rules' | 'bookkeeping' | 'front' | 'evidence';
  done: number;
  total: number;
}

/** Package status codes in `PackageTable.status`. */
export const PACKAGE_STATUS = { feasible: 0, 'needs-check': 1, blocked: 2, 'target-miss': 3 } as const;
export type PackageStatusCode = (typeof PACKAGE_STATUS)[keyof typeof PACKAGE_STATUS];

/**
 * Columnar package table: row i is one package. Typed arrays are structured-cloneable.
 * Money in micro-pence, carbon in gCO2e.
 */
export interface PackageTable {
  ids: string[];
  heavyIdx: Uint32Array;
  /** Light option index per light group, row-major [package][lightGroup]. */
  lightOpts: Uint16Array;
  lightGroups: string[];
  status: Uint8Array;
  n0: BigInt64Array;
  npv: BigInt64Array;
  carbonSaved: BigInt64Array;
  /** Index of the dominating package, or 0xffffffff when none (front member or rule/target miss). */
  witness: Uint32Array;
  /** Rule ids that block or condition each package. */
  ruleIds: string[][];
}

export interface SearchResult {
  hash: string;
  specHash: string;
  baseline: Record<RunMode, SimResult>;
  /** deliveredWh[mode] is [key][fuel][month] flattened, integer Wh. */
  heavy: { keys: string[]; deliveredWh: Record<RunMode, BigInt64Array> };
  packages: PackageTable;
  front: Uint32Array;
  picks: { leastUpfront?: number; bestReturn?: number; lowestRunningCarbon?: number };
  /** R22 lane candidates. */
  needsCheck: Uint32Array;
  /** Baseline, front and picks only; the rest via `evidence()`. */
  graph: EvidenceGraph;
  certificate: Certificate;
  /**
   * What gets worse, per package (SPEC 14, AC-B3). Covers baseline, front and picks, like
   * `graph`; the rest via `EngineApi.negatives`. Optional until WP-02 fills it at M-B.
   */
  negatives?: NegativesByPackage;
}

export interface UncertaintyResult {
  samples: number;
  seed: string;
  byPackage: Record<string, Record<QuantityId, { p10: number; p50: number; p90: number }>>;
}

export interface FlipPoint {
  param: 'price.gas' | 'price.electricity' | 'discount';
  /** Exact decimal string in the param's unit (pence per kWh, or percent). */
  at: string;
  pick: 'leastUpfront' | 'bestReturn' | 'lowestRunningCarbon';
  fromPackageId: string;
  toPackageId: string;
}

export interface AshpUnit {
  id: string;
  /** Sound power level, dB(A). */
  lwa: number;
  position: Vec3;
  mount: 'ground' | 'wall' | 'flat-roof' | 'pitched-roof';
}
export interface NoiseResult {
  positions: { id: string; lp: Ival<number>; pass: Tri }[];
  /** MCS 020 a) threshold 37.0 dB(A) decided only when the enclosure allows. */
  ok: Tri;
}

export interface EngineApi {
  init(manifestIds: string[], sharedFingerprint: string): Promise<void>;
  simulate(req: {
    twin: HomeTwin;
    pkg?: PackageSpec;
    modes: RunMode[];
    asOf: IsoDate;
    thermal?: boolean;
  }): Promise<SimBundle>;
  search(
    req: SearchRequest,
    onProgress?: (p: SearchProgress) => void,
  ): Promise<{ jobId: string; result: Promise<SearchResult> }>;
  /** Honoured between slices (within 50 ms). */
  cancel(jobId: string): void;
  /** Lazy evidence. */
  evidence(
    resultHash: string,
    ids: EvidenceId[] | { quantity: QuantityId; packageId?: string },
  ): Promise<EvidenceNode[]>;
  /** After first paint. */
  uncertainty(resultHash: string, packageIds: string[], samples: number): Promise<UncertaintyResult>;
  calibrate(req: {
    twin: HomeTwin;
    meters: MeterData;
    weather: ActualWeather | null;
  }): Promise<CalibrationPosterior>;
  valueOfInformation(twin: HomeTwin): Promise<{ fieldPath: string; bandReduction: number }[]>;
  flips(resultHash: string, param: FlipPoint['param']): Promise<FlipPoint[]>;
  /** Under 5 ms, enclosure included. */
  noise(req: { twin: HomeTwin; units: AshpUnit[] }): Promise<NoiseResult>;
  /** "If nothing is done" (SPEC 14, AC-B1): ages the twin with the `maintenance` plugins. M-B. */
  doNothing?(req: DoNothingRequest): Promise<DoNothingResult>;
  /** Lazy negatives for packages outside `SearchResult.negatives`. M-B. */
  negatives?(resultHash: string, packageIds: string[]): Promise<NegativesByPackage>;
}
