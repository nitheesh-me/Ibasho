/**
 * Path to work package map (BUILD_PLAN 2) and its checks. Owner: WP-00 until G0, then WP-10.
 *
 * Agents do not commit, so ownership is enforced as a property of the map over the real file
 * tree: every file has exactly one owner (coverage and disjointness), and a WP's changed paths
 * can be checked against its set (`outsideOwnership`). This is the post-G0 map: G0-only grants to
 * WP-00 (skeletons, spec-gen placeholder, tools/lint, .github, tests/smoke) have transferred.
 *
 * Where BUILD_PLAN 2 is silent the map adds the narrowest sensible owner and says so in `note`.
 */
import { globToRegExp } from './files.ts';

export type Owner =
  | 'WP-00'
  | 'WP-01'
  | 'WP-02'
  | 'WP-03'
  | 'WP-04'
  | 'WP-05'
  | 'WP-06'
  | 'WP-07'
  | 'WP-08'
  | 'WP-09'
  | 'WP-10'
  | 'WP-11'
  | 'WP-12'
  // v3 (BUILD_PLAN 10)
  | 'WP-13'
  | 'WP-14'
  | 'WP-15'
  | 'WP-16'
  | 'WP-17'
  | 'WP-18'
  | 'WP-19'
  | 'WP-20'
  | 'WP-21'
  | 'WP-22'
  | 'WP-23'
  | 'WP-24'
  | 'orchestrator'
  /** Append-only coordination files every agent may add entries to. */
  | 'shared-append';

export interface OwnershipRule {
  owner: Owner;
  include: string[];
  exclude?: string[];
  note?: string;
}

const PACK_HOME_ENGINE = (p: string) => [`packs/${p}/**`];
const PACK_HOME_UI = (p: string) => [`packs/${p}/src/ui/**`, `packs/${p}/test/ui/**`];
const ENGINE_WP01 = ['pipeline', 'physics', 'thermal', 'calibration', 'validation'].map(
  (d) => `packages/engine/src/${d}/**`,
);
const ENGINE_WP03 = ['packages/engine/src/rules/**'];
const FIX = (dirs: string[]) => dirs.map((d) => `packages/fixtures/src/${d}/**`);
const FIX_WP01 = FIX(['homes', 'bills', 'validation']);
const FIX_WP02 = FIX(['results']);
const FIX_WP03 = FIX(['rules']);
const FIX_WP04 = FIX(['certs']);
const FIX_WP05 = FIX(['injection', 'utterances', 'narration']);
const FIX_WP12 = FIX(['agent']);
// v3 (BUILD_PLAN 10)
const FIX_V3 = FIX(['preview', 'buildings', 'site', 'energy', 'codes', 'optimise', 'interop']);
const ENGINE_WP18 = ['zones', 'systems', 'enduse'].map((d) => `packages/engine/src/${d}/**`);
const ENGINE_WP19 = ['packages/engine/src/codes/**'];
const ENGINE_WP20 = ['packages/engine/src/optimise/**'];
const TYPES_UI = ['packs/types-global/src/ui/**', 'packs/types-in/src/ui/**'];

export const OWNERSHIP: readonly OwnershipRule[] = [
  {
    owner: 'WP-00',
    include: [
      '{package.json,pnpm-workspace.yaml,pnpm-lock.yaml,turbo.json,tsconfig.base.json,biome.json,knip.json}',
      '{.npmrc,.nvmrc,.gitignore,.dependency-cruiser.cjs,CLAUDE.md}',
      'packages/core/**',
    ],
    note: 'pnpm-lock.yaml, knip.json and CLAUDE.md are root files (BUILD_PLAN 2 "root files stay with WP-00").',
  },
  {
    owner: 'WP-01',
    include: [
      'packages/dmath/**',
      ...ENGINE_WP01,
      'packs/climate/**',
      ...PACK_HOME_ENGINE('home-uk'),
      ...PACK_HOME_ENGINE('home-in'),
      ...FIX_WP01,
    ],
    exclude: [...PACK_HOME_UI('home-uk'), ...PACK_HOME_UI('home-in')],
    note: 'Pack tests outside test/ui/ go with the engine half.',
  },
  {
    owner: 'WP-02',
    include: ['packages/engine/**', 'packs/money-uk/**', 'packs/money-in/**', ...FIX_WP02],
    exclude: [...ENGINE_WP01, ...ENGINE_WP03, ...ENGINE_WP18, ...ENGINE_WP19, ...ENGINE_WP20],
    note: 'WP-02 holds engine package files and any engine path not given to WP-01, WP-03, WP-18, WP-19 or WP-20.',
  },
  { owner: 'WP-03', include: [...ENGINE_WP03, 'packs/rules-uk/**', 'packs/rules-in/**', ...FIX_WP03] },
  {
    owner: 'WP-04',
    include: ['proofs/**', 'packages/spec-gen/**', 'packages/verify/**', 'tools/verify/**', ...FIX_WP04],
  },
  {
    owner: 'WP-05',
    include: ['packages/ai/**', 'apps/companion/**', ...FIX_WP05],
    exclude: ['apps/companion/src/runners/**'],
  },
  { owner: 'WP-06', include: ['packages/ui/**'] },
  {
    owner: 'WP-07',
    include: ['packages/scene/**', ...PACK_HOME_UI('home-uk'), ...PACK_HOME_UI('home-in'), ...TYPES_UI],
  },
  { owner: 'WP-08', include: ['apps/web/**', 'packages/store/**'], exclude: ['apps/web/public/assets/**'] },
  { owner: 'WP-09', include: ['apps/landing/**', 'packages/content/**'] },
  {
    owner: 'WP-10',
    include: ['tests/**', 'tools/lint/**', '.github/**', 'packages/fixtures/**'],
    exclude: [...FIX_WP01, ...FIX_WP02, ...FIX_WP03, ...FIX_WP04, ...FIX_WP05, ...FIX_WP12, ...FIX_V3],
  },
  { owner: 'WP-11', include: ['apps/web/public/assets/**', 'tools/assets/**'] },
  {
    owner: 'WP-12',
    include: [
      'packages/agent-bridge/**',
      'apps/mcp/**',
      'integrations/claude-code/**',
      'tools/agent-install/**',
      ...FIX_WP12,
    ],
  },
  // v3 work packages (BUILD_PLAN 10)
  { owner: 'WP-13', include: ['packages/preview/**', 'packages/fixtures/src/preview/**'] },
  { owner: 'WP-14', include: ['packages/plan/**', 'packages/fixtures/src/buildings/**'] },
  { owner: 'WP-15', include: ['packages/editor/**'] },
  { owner: 'WP-16', include: ['packages/site/**', 'packages/fixtures/src/site/**'] },
  { owner: 'WP-17', include: ['packs/city-hyderabad/**', 'packs/city-london/**', 'tools/city/**'] },
  {
    owner: 'WP-18',
    include: [
      ...ENGINE_WP18,
      'packs/types-global/**',
      'packs/types-in/**',
      'packs/benchmarks/**',
      'packages/fixtures/src/energy/**',
    ],
    exclude: TYPES_UI,
  },
  {
    owner: 'WP-19',
    include: [
      ...ENGINE_WP19,
      'packs/codes-in/**',
      'packs/codes-global/**',
      'packs/ratings/**',
      'packages/fixtures/src/codes/**',
    ],
  },
  { owner: 'WP-20', include: [...ENGINE_WP20, 'packages/fixtures/src/optimise/**'] },
  {
    owner: 'WP-21',
    include: ['packages/interop/**', 'apps/companion/src/runners/**', 'packages/fixtures/src/interop/**'],
  },
  { owner: 'WP-22', include: ['docs/qa/product/**'] },
  { owner: 'WP-23', include: ['docs/qa/ux/**'] },
  { owner: 'WP-24', include: ['docs/qa/content/**'] },
  {
    owner: 'shared-append',
    include: ['docs/BLACKBOARD.typ', 'docs/STATUS.typ', 'docs/refs.yml', 'ACKNOWLEDGEMENTS.md'],
    note: 'ACKNOWLEDGEMENTS.md: every agent appends credits under the right heading (orchestrator decision).',
  },
  {
    owner: 'orchestrator',
    include: ['docs/**', 'report/**', 'deliverables/**', 'README.md'],
    exclude: ['docs/BLACKBOARD.typ', 'docs/STATUS.typ', 'docs/refs.yml', 'docs/qa/{product,ux,content}/**'],
  },
];

interface Compiled {
  owner: Owner;
  include: RegExp[];
  exclude: RegExp[];
}
const compile = (rules: readonly OwnershipRule[]): Compiled[] =>
  rules.map((r) => ({
    owner: r.owner,
    include: r.include.map(globToRegExp),
    exclude: (r.exclude ?? []).map(globToRegExp),
  }));

/** Every owner whose rule matches `path` (more than one means the map overlaps). */
export function ownersOf(path: string, rules: readonly OwnershipRule[] = OWNERSHIP): Owner[] {
  const out = new Set<Owner>();
  for (const r of compile(rules)) {
    if (r.include.some((re) => re.test(path)) && !r.exclude.some((re) => re.test(path))) out.add(r.owner);
  }
  return [...out].sort();
}

export interface OwnershipReport {
  uncovered: string[];
  overlaps: { path: string; owners: Owner[] }[];
}

/** Coverage and disjointness over a file list. */
export function checkOwnership(
  paths: readonly string[],
  rules: readonly OwnershipRule[] = OWNERSHIP,
): OwnershipReport {
  const compiled = compile(rules);
  const report: OwnershipReport = { uncovered: [], overlaps: [] };
  for (const path of paths) {
    const owners = new Set<Owner>();
    for (const r of compiled) {
      if (r.include.some((re) => re.test(path)) && !r.exclude.some((re) => re.test(path)))
        owners.add(r.owner);
    }
    if (owners.size === 0) report.uncovered.push(path);
    else if (owners.size > 1) report.overlaps.push({ path, owners: [...owners].sort() });
  }
  return report;
}

/** Paths in `changed` that `wp` may not edit (shared-append files are allowed for everyone). */
export function outsideOwnership(
  wp: Owner,
  changed: readonly string[],
  rules: readonly OwnershipRule[] = OWNERSHIP,
): string[] {
  return changed.filter((p) => {
    const owners = ownersOf(p, rules);
    return !(owners.includes(wp) || owners.includes('shared-append'));
  });
}
