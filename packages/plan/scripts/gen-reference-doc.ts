/**
 * Writes docs/sources/REFERENCE-BUILDINGS.md from the building notes
 * (`packages/fixtures/src/buildings/<id>.notes.json`), so the public sources page always matches
 * the fixtures. Run after `gen:buildings`: `pnpm --filter @ibasho/plan gen:reference-doc`.
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Notes {
  id: string;
  title: string;
  tenant?: { name: string; occupies: string };
  sources: { id: string; title: string; url?: string }[];
  status: Record<string, string>;
  unknowns: string[];
}

const root = join(import.meta.dirname, '..', '..', '..');
const dir = join(root, 'packages/fixtures/src/buildings');
/** Buildings of interest first, then the campus, the samples and the London home. */
const ORDER = ['gb7', 'gb5', 'gb6', 'gb1', 'gb2', 'gb3', 'gb4', 'gh1'];

const head = `# Reference buildings: sources

Where the information for each sample building comes from. Every fact is from a public source or marked estimated or assumed in the building's notes (\`packages/fixtures/src/buildings/<id>.notes.json\`). No private documents are shipped; downloaded source files stay local.

Buildings of interest (Lloyds Technology Centre, Qualcomm, Vanguard) are leased offices in towers owned by others. No public floor plans were found for any of them, so their floors are estimated from the OpenStreetMap outline and the developers' stated areas.
`;

const section = (n: Notes): string => {
  const out = [`## ${n.title} (\`${n.id}\`)`, ''];
  if (n.tenant) out.push(`**Occupier:** ${n.tenant.name}. ${n.tenant.occupies}`, '');
  out.push('**What is measured, estimated or assumed:**', '');
  for (const [k, v] of Object.entries(n.status)) out.push(`- ${k}: ${v}`);
  out.push('', '**Sources:**', '');
  for (const s of n.sources) out.push(`- ${s.title}.${s.url ? ` <${s.url}>` : ''}`);
  out.push('', '**Unknowns:**', '');
  for (const u of n.unknowns) out.push(`- ${u}`);
  return out.join('\n');
};

const notes = ORDER.map((id) => JSON.parse(readFileSync(join(dir, `${id}.notes.json`), 'utf8')) as Notes);
const text = `${head}\n${notes.map(section).join('\n\n')}\n`;
const out = join(root, 'docs/sources/REFERENCE-BUILDINGS.md');
writeFileSync(`${out}.tmp`, text);
renameSync(`${out}.tmp`, out);
console.log(`wrote ${notes.length} buildings to docs/sources/REFERENCE-BUILDINGS.md`);
