/**
 * Attribution page source, generated from the manifest (K4). Owner: WP-11.
 *
 * `renderAttribution(manifest)` is pure and deterministic. `process.ts` writes its output to
 * `apps/web/public/assets/attribution.html`, a static page served at `/app/assets/attribution.html`
 * that works offline. WP-08 can link it from the shell or render the same data from
 * `manifest.json` in its own Credits view.
 */
import { PROVIDERS, type ProviderId } from './config.ts';
import type { Manifest, ManifestAsset } from './manifest.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const KIND_LABEL: Record<string, string> = { hdri: 'Sky (HDRI)', texture: 'Material', model: 'Model' };

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function row(a: ManifestAsset): string {
  const bytes = a.files.reduce((s, f) => s + f.bytes, 0);
  return [
    '<tr>',
    `<td><a href="${esc(a.source.page)}">${esc(a.title)}</a><br><code>${esc(a.id)}</code></td>`,
    `<td>${esc(KIND_LABEL[a.kind] ?? a.kind)}</td>`,
    `<td>${esc(a.source.authors.join(', '))}</td>`,
    `<td><a href="${esc(a.licenceUrl)}">${esc(a.licence)}</a></td>`,
    `<td class="num">${kb(bytes)}</td>`,
    '</tr>',
  ].join('');
}

export function renderAttribution(m: Manifest): string {
  const credited = m.assets.filter((a) => a.source.provider !== 'ibasho');
  const order = Object.keys(PROVIDERS) as ProviderId[];
  const sections = order
    .map((p) => {
      const list = credited.filter((a) => a.source.provider === p);
      if (list.length === 0) return '';
      const info = PROVIDERS[p];
      return [
        `<section id="${p}">`,
        `<h2><a href="${esc(info.url)}">${esc(info.name)}</a></h2>`,
        `<p>${list.length} asset${list.length === 1 ? '' : 's'}, licensed <a href="${esc(info.licenceUrl)}">${esc(info.licence)}</a>. Thank you.</p>`,
        '<table>',
        '<thead><tr><th>Asset</th><th>Kind</th><th>Authors</th><th>Licence</th><th class="num">Size</th></tr></thead>',
        `<tbody>${list.map(row).join('\n')}</tbody>`,
        '</table>',
        '</section>',
      ].join('\n');
    })
    .filter((s) => s !== '');

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ibasho credits</title>
<meta name="description" content="Skies, materials and furniture used in Ibasho, with authors and licences.">
<style>
:root { --paper: #f4eee3; --paper-raised: #faf6ef; --ink: #26221f; --ink-2: #4f4944; --line: #c6c2b6; --deep: #034f67; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --paper: #15120f; --paper-raised: #1e1a16; --ink: #f2e7d0; --ink-2: #b9ae9c; --line: #39332d; --deep: #519eb9; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.55 "Zen Kaku Gothic New", system-ui, sans-serif; }
main { max-width: 60rem; margin: 0 auto; padding: 2rem 16px 4rem; }
h1, h2 { font-family: "Shippori Mincho B1", Georgia, serif; font-weight: 600; }
h1 { font-size: 2rem; margin: 0 0 0.5rem; }
h2 { font-size: 1.35rem; margin: 2.5rem 0 0.25rem; }
p { color: var(--ink-2); margin: 0.25rem 0 1rem; }
a { color: var(--deep); }
a:focus-visible { outline: 2px solid var(--deep); outline-offset: 2px; }
.wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; background: var(--paper-raised); font-size: 0.92rem; }
th, td { text-align: left; vertical-align: top; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--line); }
th { color: var(--ink-2); font-weight: 600; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
code { font: 0.8rem "M PLUS 1 Code", ui-monospace, monospace; color: var(--ink-2); }
@media (max-width: 40rem) { th:nth-child(2), td:nth-child(2), th:nth-child(5), td:nth-child(5) { display: none; } }
</style>
</head>
<body>
<main>
<h1>Credits</h1>
<p>Ibasho draws its skies, materials and furniture from artists who give their work away. Every file the app loads is listed in <a href="manifest.json">manifest.json</a> with its licence and sha256. This page is generated from that manifest.</p>
<div class="wrap">
${sections.join('\n')}
</div>
</main>
</body>
</html>
`;
}
