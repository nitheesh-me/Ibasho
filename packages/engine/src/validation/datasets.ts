/**
 * Validation datasets (WP-01 first deliverable, A1). Owner: WP-01.
 *
 * Each file in `packages/fixtures/src/validation/` is one dataset with this envelope. `status`
 * `pending` marks a dataset whose download is blocked (PLACEHOLDER, named in the file's notes and
 * on the blackboard); tests that need its records skip with that reason.
 */
export interface DatasetSource {
  title: string;
  url: string;
  clause?: string;
}

export interface ValidationDataset<D = Record<string, unknown>> {
  schema: 'ibasho.validation/1';
  id: string;
  title: string;
  grade: 'primary' | 'secondary' | 'announced' | 'estimate';
  /** Period the data describe (free text, e.g. `2023`, `2005-2020`), when known. */
  dataDate?: string;
  /** ISO date the data were retrieved, or `pending`. */
  retrieved: string;
  status: 'ready' | 'pending';
  sources: DatasetSource[];
  data: D;
  notes?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GRADES = new Set(['primary', 'secondary', 'announced', 'estimate']);

/** Schema check for one dataset; returns the problems found (empty when valid). */
export function datasetProblems(x: unknown, fileId?: string): string[] {
  const p: string[] = [];
  if (x === null || typeof x !== 'object') return ['not an object'];
  const d = x as Partial<ValidationDataset>;
  if (d.schema !== 'ibasho.validation/1') p.push('schema must be ibasho.validation/1');
  if (typeof d.id !== 'string' || !/^[a-z0-9-]+$/.test(d.id)) p.push('id must be kebab-case');
  if (fileId !== undefined && d.id !== fileId) p.push(`id ${d.id} does not match file ${fileId}`);
  if (typeof d.title !== 'string' || d.title.length < 5) p.push('title missing');
  if (!GRADES.has(d.grade as string)) p.push('grade invalid');
  if (d.status !== 'ready' && d.status !== 'pending') p.push('status must be ready or pending');
  if (d.status === 'ready' && !(typeof d.retrieved === 'string' && ISO_DATE.test(d.retrieved)))
    p.push('a ready dataset needs an ISO retrieved date');
  if (d.status === 'pending' && d.retrieved !== 'pending' && !ISO_DATE.test(String(d.retrieved)))
    p.push('retrieved must be an ISO date or pending');
  if (!Array.isArray(d.sources) || d.sources.length === 0) p.push('at least one source');
  else
    for (const s of d.sources) {
      if (!s || typeof s.title !== 'string' || typeof s.url !== 'string' || !/^https:\/\//.test(s.url))
        p.push('every source needs a title and an https url');
    }
  if (d.data === null || typeof d.data !== 'object') p.push('data must be an object');
  if (d.status === 'pending' && !(typeof d.notes === 'string' && /PLACEHOLDER/.test(d.notes)))
    p.push('a pending dataset must say PLACEHOLDER in its notes');
  return p;
}

/** The datasets WP-01 must ship (BUILD_PLAN WP-01 first deliverable). */
export const REQUIRED_DATASETS = [
  'need-2025',
  'epc-open-data-sample',
  'pvgis-pvcalc-6-cities',
  'hp-field-spf',
  'india-ac-homes',
  'lbnl-cool-roof',
] as const;
