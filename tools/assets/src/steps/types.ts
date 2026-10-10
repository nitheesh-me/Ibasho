/** Shared shapes for the processing steps. Owner: WP-11. */

export interface OutFile {
  /** Path under `apps/web/public/assets/`, POSIX. */
  readonly rel: string;
  readonly role: string;
  readonly mime: string;
  readonly data: Uint8Array;
  readonly width?: number;
  readonly height?: number;
}

export interface StepResult {
  readonly files: readonly OutFile[];
  /** Plain sentences describing what was done to the source, copied into the manifest. */
  readonly processing: readonly string[];
  /** Kind-specific facts for the manifest (`hdri`, `texture` or `model` block). */
  readonly details: Readonly<Record<string, unknown>>;
}

/** Rounds for stable JSON. */
export function round(x: number, places = 4): number {
  const f = 10 ** places;
  return Math.round(x * f) / f;
}
