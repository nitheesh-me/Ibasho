// PLACEHOLDER: replaced by ibasho-gen.
// Certificate `ibasho.cert/2` (ARCH 8.3). Columnar. Integers travel as decimal strings or
// base64 of little-endian int64/u32/u8 arrays, never as JSON floats. spec-gen imports nothing,
// so the few shared enums are restated here.

export type CertRunMode = 'rating' | 'standard' | 'your-home';
export type CertTri = true | false | 'unknown';
/** Base64 of a little-endian typed array (int64, u32 or u8 as named by the field). */
export type B64 = string;
/** Decimal integer string. */
export type DecInt = string;

export interface CertPackData {
  id: string;
  version: string;
  /** Pack payload; checked by Packs.lean well-formedness predicates, not for equality. */
  data: unknown;
}

export interface CertGroup {
  id: string;
  /** Includes `none` when the group may be left out. */
  options: string[];
  /** Option id to fact table used by the Kleene evaluator. */
  facts: Record<string, Record<string, CertTri | number | string>>;
}

export interface Certificate {
  schema: 'ibasho.cert/2';
  specHash: string;
  engine: { version: string };
  packs: {
    tariffs: CertPackData[];
    carbon: CertPackData;
    trajectory: CertPackData;
    grants: CertPackData[];
    rules: CertPackData[];
    value: CertPackData;
  };
  context: {
    owner: Record<string, unknown>;
    target: Record<string, unknown>;
    memory: { rejected: string[]; completed: string[] };
    asOf: string;
  };
  groups: CertGroup[];
  /** int64 fuel by month per mode (trusted physics). */
  baseline: Record<CertRunMode, B64>;
  /** Heavy keys and their delivered energy per mode (trusted physics). */
  heavy: { keys: string[]; delivered: Partial<Record<CertRunMode, B64>> };
  /** Sparse int64 deltas per light variant (trusted physics). */
  light: { delivered: B64 };
  claimed: {
    status: B64;
    n0: B64;
    npv: B64;
    carbonSaved: B64;
    witness: B64;
    ruleIds: string[][];
  };
  front: B64;
  picks: { leastUpfront?: number; bestReturn?: number; lowestRunningCarbon?: number };
  needsCheck: B64;
}

/** Check ids re-derived by the checker (ARCH 8.3). */
export type CertCheckId =
  | 'spec.known'
  | 'packs.wellformed'
  | 'enum.complete'
  | 'acct.saving'
  | 'acct.carbon'
  | 'money.bills'
  | 'fin.recompute'
  | 'feas.recompute'
  | 'target.recompute'
  | 'pareto.front'
  | 'pareto.witness'
  | 'pareto.picks'
  | 'score.recompute';
export const CERT_CHECK_IDS: readonly CertCheckId[] = [
  'spec.known',
  'packs.wellformed',
  'enum.complete',
  'acct.saving',
  'acct.carbon',
  'money.bills',
  'fin.recompute',
  'feas.recompute',
  'target.recompute',
  'pareto.front',
  'pareto.witness',
  'pareto.picks',
  'score.recompute',
];
