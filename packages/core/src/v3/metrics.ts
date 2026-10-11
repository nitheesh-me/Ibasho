/**
 * Metric registry and building facts for code rules (ARCH 15.4, EC 5 and 7.2, SPEC R34).
 * Owner: WP-00. Leaf module: imports nothing, so rules, plan checks and results can all use it.
 */

/** Metrics a `comply` effect or a plan meter can test. */
export type MetricId =
  | 'u.roof'
  | 'u.wall'
  | 'u.window'
  | 'shgc.eff'
  | 'wwr'
  | 'srr'
  | 'pf'
  | 'lpd'
  | 'retv'
  | 'wfr.op'
  | 'vlt'
  | 'udi.share'
  | 'daylight.extent'
  | 'epi'
  | 'epi.ratio'
  | 'pci'
  | 'eui.site'
  | 'water.in.pct'
  | 'water.out.pct'
  | 're.share.cd'
  | 'sr.roof'
  | 'emit.roof'
  | 'opening.ratio'
  | 'savings.pct';

export interface MetricDef {
  id: MetricId;
  /** Unit string as in `Unit` (kept as a string to stay a leaf module). */
  unit: string;
  /** Which direction is better: lower (`max` limits) or higher (`min` limits). */
  better: 'lower' | 'higher';
  /** Needs a simulation (`energy` or `daylight` stage) or is geometric (meter, live in Make). */
  needs: 'geometry' | 'daylight' | 'energy' | 'inputs';
  label: string;
}

/** The registry. Order is stable (UI lists and certificates use it). */
export const METRICS: readonly MetricDef[] = [
  { id: 'u.roof', unit: 'W/m2K', better: 'lower', needs: 'inputs', label: 'codes.metric.u_roof' },
  { id: 'u.wall', unit: 'W/m2K', better: 'lower', needs: 'inputs', label: 'codes.metric.u_wall' },
  { id: 'u.window', unit: 'W/m2K', better: 'lower', needs: 'inputs', label: 'codes.metric.u_window' },
  { id: 'shgc.eff', unit: '1', better: 'lower', needs: 'geometry', label: 'codes.metric.shgc_eff' },
  { id: 'wwr', unit: '1', better: 'lower', needs: 'geometry', label: 'codes.metric.wwr' },
  { id: 'srr', unit: '1', better: 'lower', needs: 'geometry', label: 'codes.metric.srr' },
  { id: 'pf', unit: '1', better: 'higher', needs: 'geometry', label: 'codes.metric.pf' },
  { id: 'lpd', unit: 'W/m2', better: 'lower', needs: 'inputs', label: 'codes.metric.lpd' },
  { id: 'retv', unit: 'W/m2', better: 'lower', needs: 'geometry', label: 'codes.metric.retv' },
  { id: 'wfr.op', unit: '1', better: 'higher', needs: 'geometry', label: 'codes.metric.wfr_op' },
  { id: 'vlt', unit: '1', better: 'higher', needs: 'inputs', label: 'codes.metric.vlt' },
  { id: 'udi.share', unit: '%', better: 'higher', needs: 'daylight', label: 'codes.metric.udi_share' },
  {
    id: 'daylight.extent',
    unit: '%',
    better: 'higher',
    needs: 'geometry',
    label: 'codes.metric.daylight_extent',
  },
  { id: 'epi', unit: 'kWh/m2.yr', better: 'lower', needs: 'energy', label: 'codes.metric.epi' },
  { id: 'epi.ratio', unit: '1', better: 'lower', needs: 'energy', label: 'codes.metric.epi_ratio' },
  { id: 'pci', unit: '1', better: 'lower', needs: 'energy', label: 'codes.metric.pci' },
  { id: 'eui.site', unit: 'kWh/m2.yr', better: 'lower', needs: 'energy', label: 'codes.metric.eui_site' },
  { id: 'water.in.pct', unit: '%', better: 'higher', needs: 'inputs', label: 'codes.metric.water_in' },
  { id: 'water.out.pct', unit: '%', better: 'higher', needs: 'inputs', label: 'codes.metric.water_out' },
  { id: 're.share.cd', unit: '1', better: 'higher', needs: 'energy', label: 'codes.metric.re_share' },
  { id: 'sr.roof', unit: '1', better: 'higher', needs: 'inputs', label: 'codes.metric.sr_roof' },
  { id: 'emit.roof', unit: '1', better: 'higher', needs: 'inputs', label: 'codes.metric.emit_roof' },
  { id: 'opening.ratio', unit: '1', better: 'higher', needs: 'geometry', label: 'codes.metric.opening' },
  { id: 'savings.pct', unit: '%', better: 'higher', needs: 'energy', label: 'codes.metric.savings' },
];
export const METRIC_IDS: readonly MetricId[] = METRICS.map((m) => m.id);

/**
 * Building facts `b.*` and zone or room facts `z.*` (EC 7.2) that rules read, beside the existing
 * `h.*`, `m.*`, `p.*`, `o.*` and `k.*` families. Values come from the compiled building and the place.
 */
export const BUILDING_FACTS = [
  'b.use',
  'b.typeId',
  'b.buaM2',
  'b.plotM2',
  'b.storeys',
  'b.connectedLoadKw',
  'b.contractDemandKva',
  'b.climateZone',
  'b.ashraeZone',
  'b.latitude',
  'b.region',
  'b.permitYear',
  'b.new',
  'b.public',
  'b.tenure',
  'b.rooftopRights',
] as const;
export const ZONE_FACTS = [
  'z.function',
  'z.habitable',
  'z.conditioned',
  'z.floorM2',
  'z.openingM2',
  'z.openableM2',
  'z.daylit',
] as const;
export type BuildingFactId = (typeof BUILDING_FACTS)[number];
export type ZoneFactId = (typeof ZONE_FACTS)[number];
