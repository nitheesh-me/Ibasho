/**
 * `pnpm lint:tools`: runs no-dash, no-math, legend and the ownership map check over the repo.
 * Owner: WP-00 until G0, then WP-10. Exit 1 on any finding.
 */
import { formatFinding, listRepoFiles, repoRoot } from './files.ts';
import { legend } from './legend.ts';
import { noDash } from './no-dash.ts';
import { noMath } from './no-math.ts';
import { checkOwnership } from './ownership.ts';

const root = repoRoot();
const files = listRepoFiles(root);
const findings = [...noDash(root, files), ...noMath(root, files), ...legend(root, files)];
for (const f of findings) console.error(formatFinding(f));

const own = checkOwnership(files);
for (const p of own.uncovered)
  console.error(`${p} [ownership] no work package owns this path (BUILD_PLAN 2)`);
for (const o of own.overlaps) console.error(`${o.path} [ownership] owned by ${o.owners.join(', ')}`);

const total = findings.length + own.uncovered.length + own.overlaps.length;
if (total > 0) {
  console.error(`lint:tools: ${total} problem(s) in ${files.length} files`);
  process.exit(1);
}
console.log(`lint:tools: no-dash, no-math, legend and ownership clean over ${files.length} files`);
