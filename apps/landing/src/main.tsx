/**
 * Entry. Owner: WP-09 (Content and landing).
 * The HTML is prerendered at build time (`prerender.tsx`); this script only enhances it.
 *
 * First paint needs only tokens and the landing styles (AC-L1). The three webfonts load after,
 * as a separate stylesheet, because their unicode-range table is large; until then, and with
 * JavaScript off, the token font stacks fall back to system serif and sans.
 */
import '@ibasho/ui/tokens.css';
import './landing.css';
import { setupLantern, setupReveal, setupWords } from './enhance.ts';

setupLantern(document, window);
setupReveal(document, window);
setupWords(document, window);
void import('./fonts.ts');
