/**
 * Static first paint (AC-L1, AC-L2). Owner: WP-09.
 * Renders the landing page to HTML at build time; `vite.config.ts` puts it into `index.html`.
 */
import { LANDING_META, type PluginPresence, visibleChapters } from '@ibasho/content';
import { renderToStaticMarkup } from 'react-dom/server';
import { LandingPage } from './Landing.tsx';

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The page body for the given plugin presence. */
export function renderLanding(presence: PluginPresence): string {
  return renderToStaticMarkup(<LandingPage chapters={visibleChapters(presence)} />);
}

/** Tags for `<head>`: description and social preview text. */
export function renderHead(): string {
  const d = escapeAttr(LANDING_META.description);
  return [
    `<meta name="description" content="${d}" />`,
    `<meta property="og:title" content="${escapeAttr(LANDING_META.title)}" />`,
    `<meta property="og:description" content="${d}" />`,
    '<meta name="color-scheme" content="light dark" />',
  ].join('\n    ');
}

/** Fill the two placeholders in `index.html`. Throws if either is missing, so a broken template fails the build. */
export function fillTemplate(html: string, presence: PluginPresence): string {
  for (const mark of ['<!--landing-head-->', '<!--landing-body-->']) {
    if (!html.includes(mark)) throw new Error(`index.html is missing ${mark}`);
  }
  return html
    .replace('<!--landing-head-->', renderHead())
    .replace('<!--landing-body-->', renderLanding(presence));
}
