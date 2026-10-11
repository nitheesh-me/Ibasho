/**
 * Layering rules from docs/ARCHITECTURE.md section 3. Owner: WP-00.
 *
 * L0  core, dmath, spec-gen          spec-gen and dmath import nothing in the repo; core imports spec-gen.
 * L1  engine, verify, store, packs engine halves   import L0 only.
 * L2  ai (L0, L1 types only), ui (L0 only).
 * L3  scene, packs ui halves         L0, ui, engine result types (type only).
 * L4  apps                           anything.
 *
 * v3 (ARCH 15.2): plan, site and preview are L1 (L0 only; preview may also import plan and read its
 * replay data in packages/fixtures/src/{preview,buildings}; site alone may import three maths and three-mesh-bvh);
 * interop is L2 (L0 and plan); editor is L3 (L0, ui, plan). Every L3 may use plan's pure functions.
 *
 * Test files (`*.test.ts`, `test/`) are exempt from the layer rules (not from the react/three ban),
 * because tests legitimately wire fixtures and packs together.
 *
 * Paths under `tools/lint/__fixtures__/` named `<layer>-imports-<x>.ts` stand in for files of that
 * layer so the rules can be tested (G0-2) without placing a violating file inside a package.
 */
const TEST = '(\\.test\\.tsx?$|/test/|/__tests__/)';
const FX = '^tools/lint/__fixtures__/';
// Plain prefix (no nested optional groups): dependency-cruiser rejects regexes safe-regex flags.
const NM = 'node_modules/';

const L0 = '^packages/(core|dmath|spec-gen)/';
const L1_ENGINE_HALVES = '^packs/[^/]+/src/engine/';
const PACK_UI = '^packs/[^/]+/src/ui/';
const L1_V3 = 'plan|site';
const L3 = `(^packages/(scene|editor)/src/|${PACK_UI})`;

module.exports = {
  forbidden: [
    {
      name: 'ui-not-engine',
      comment: 'ARCH 3: ui must not import engine (ui is L2, L0 only).',
      severity: 'error',
      from: { path: `(^packages/ui/|${FX}ui-)` },
      to: { path: '^packages/engine/' },
    },
    {
      name: 'engine-no-react-three-dom',
      comment: 'ARCH 3: engine and pack engine halves must not import react, three or DOM libraries.',
      severity: 'error',
      from: { path: `(^packages/(engine|plan|preview)/|${L1_ENGINE_HALVES}|${FX}(engine|plan)-)` },
      to: { path: `${NM}(react|react-dom|three|@react-three|motion|@use-gesture)/` },
    },
    {
      name: 'site-no-react-dom',
      comment: 'ARCH 15.2: site may import three maths and three-mesh-bvh, never react or DOM libraries.',
      severity: 'error',
      from: { path: `(^packages/site/|${FX}site-)` },
      to: { path: `${NM}(react|react-dom|@react-three|motion|@use-gesture)/` },
    },
    {
      name: 'packages-not-apps',
      comment: 'ARCH 3: packages never import apps.',
      severity: 'error',
      from: { path: `(^packages/|${FX}packages-)` },
      to: { path: '^apps/' },
    },
    {
      name: 'packs-not-engine-internals',
      comment: 'ARCH 3: packs implement core interfaces and never import engine internals.',
      severity: 'error',
      from: { path: `(^packs/|${FX}packs-)`, pathNot: TEST },
      to: { path: '^packages/engine/src/(?!(index|api)\\.ts$)' },
    },
    {
      name: 'pack-engine-not-pack-ui',
      comment: 'ARCH 3: a pack engine half never imports a pack ui half.',
      severity: 'error',
      from: { path: L1_ENGINE_HALVES },
      to: { path: PACK_UI },
    },
    {
      name: 'spec-gen-and-dmath-import-nothing',
      comment: 'ARCH 3: spec-gen and dmath import nothing else in the repo.',
      severity: 'error',
      from: { path: '^packages/(spec-gen|dmath)/src/', pathNot: TEST },
      to: { path: '^(packages|packs|apps)/', pathNot: '^packages/(spec-gen|dmath)/' },
    },
    {
      name: 'core-imports-spec-gen-only',
      comment: 'ARCH 3: core imports spec-gen types only.',
      severity: 'error',
      from: { path: '^packages/core/src/', pathNot: TEST },
      to: { path: '^(packages|packs|apps)/', pathNot: '^packages/(core|spec-gen)/' },
    },
    {
      name: 'l1-imports-l0-only',
      comment: 'ARCH 3: engine, verify, store and pack engine halves import L0 only.',
      severity: 'error',
      from: { path: `(^packages/(engine|verify|store|${L1_V3})/src/|${L1_ENGINE_HALVES})`, pathNot: TEST },
      to: {
        path: '^(packages|packs|apps)/',
        pathNot: [
          L0,
          `^packages/(engine|verify|store|${L1_V3})/src/`,
          L1_ENGINE_HALVES,
          // BUILD_PLAN 2: a pack's ids.ts is shared by its engine and UI halves.
          '^packs/[^/]+/src/ids\\.ts$',
        ],
      },
    },
    {
      name: 'l1-siblings-separate',
      comment: 'ARCH 3: L1 packages do not import each other (engine result types live in core).',
      severity: 'error',
      from: { path: `^packages/(engine|verify|store|${L1_V3})/src/`, pathNot: TEST },
      to: { path: `^packages/(engine|verify|store|${L1_V3})/src/`, pathNot: '^packages/$1/' },
    },
    {
      name: 'ai-l0-and-l1-types-only',
      comment: 'ARCH 3: ai imports L0, and L1 only as types.',
      severity: 'error',
      from: { path: '^packages/ai/src/', pathNot: TEST },
      to: {
        path: '^(packages/(ui|scene|content)|packs/[^/]+/src/ui|apps)/',
      },
    },
    {
      name: 'ai-l1-type-only',
      severity: 'error',
      from: { path: '^packages/ai/src/', pathNot: TEST },
      to: {
        path: `^(packages/(engine|verify|store)/|${L1_ENGINE_HALVES})`,
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'preview-l0-plan-and-fixtures',
      comment:
        'ARCH 15.5: preview (L1) imports L0, the plan kernel (its geometry provider compiles documents) and its replay data.',
      severity: 'error',
      from: { path: '^packages/preview/src/', pathNot: TEST },
      to: {
        path: '^(packages|packs|apps)/',
        pathNot: [L0, '^packages/(preview|plan)/src/', '^packages/fixtures/src/(preview|buildings)/'],
      },
    },
    {
      name: 'fixtures-only-for-preview',
      comment: 'ARCH 15.5: of the L1 packages only preview reads fixture data at run time.',
      severity: 'error',
      from: { path: '^packages/(engine|verify|store|plan|site)/src/', pathNot: TEST },
      to: { path: '^packages/fixtures/' },
    },
    {
      name: 'interop-l0-and-plan',
      comment: 'ARCH 15.2: interop (L2) imports L0 and plan only.',
      severity: 'error',
      from: { path: '^packages/interop/src/', pathNot: TEST },
      to: { path: '^(packages|packs|apps)/', pathNot: [L0, '^packages/(interop|plan)/'] },
    },
    {
      name: 'ui-l0-only',
      comment: 'ARCH 3: ui imports L0 only.',
      severity: 'error',
      from: { path: '^packages/ui/src/', pathNot: TEST },
      to: { path: '^(packages|packs|apps)/', pathNot: [L0, '^packages/ui/'] },
    },
    {
      name: 'l3-allowed',
      comment:
        'ARCH 3 and 15.2: scene, editor and pack ui halves import L0, ui, plan and engine result types (type only).',
      severity: 'error',
      from: { path: L3, pathNot: TEST },
      to: {
        path: '^(packages|packs|apps)/',
        pathNot: [
          L0,
          '^packages/(ui|scene|editor|plan)/',
          PACK_UI,
          '^packs/[^/]+/src/ids\\.ts$',
          '^packages/engine/',
        ],
      },
    },
    {
      name: 'l3-engine-type-only',
      severity: 'error',
      from: { path: L3, pathNot: TEST },
      to: { path: '^packages/engine/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'not-to-unresolvable',
      comment:
        'An import that does not resolve is usually an undeclared workspace dependency; layer rules cannot see it.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: '^virtual:' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|coverage|node_modules/\\.vite)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
      mainFields: ['module', 'main', 'types'],
    },
    skipAnalysisNotInRules: true,
  },
};
