/**
 * Load the above-the-fold Andon faces before first paint (design review B-m12). Owner: WP-06.
 *
 * Fontsource `@font-face` rules use `font-display: swap`, so a screen could paint in system faces
 * and then shift. Asking `document.fonts` for the faces the first screen uses starts those
 * downloads at once (the Latin slices only, by unicode-range), and the app renders when they are
 * ready or after a short cap, whichever comes first. Slow networks still get text at the cap.
 */
import { FAMILIES } from '../tokens/scale.ts';

/** Faces the first screen uses: UI regular and medium, heading bold, numbers. */
export const ABOVE_THE_FOLD: readonly string[] = [
  `400 16px "${FAMILIES.gothic.family}"`,
  `500 16px "${FAMILIES.gothic.family}"`,
  `700 16px "${FAMILIES.mincho.family}"`,
  `800 16px "${FAMILIES.mincho.family}"`,
  `400 16px "${FAMILIES.code.family}"`,
];

interface FontSetLike {
  load(font: string, text?: string): Promise<unknown>;
}

/** Resolve when the faces are loaded or after `capMs`, never rejecting. */
export function loadAndonFonts(
  capMs = 450,
  fonts: FontSetLike | undefined = globalThis.document?.fonts,
): Promise<void> {
  if (!fonts) return Promise.resolve();
  const all = Promise.all(ABOVE_THE_FOLD.map((f) => fonts.load(f, 'Aa1').catch(() => undefined))).then(
    () => undefined,
  );
  const cap = new Promise<void>((r) => setTimeout(r, capMs));
  return Promise.race([all, cap]);
}
