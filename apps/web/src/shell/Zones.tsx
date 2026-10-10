/**
 * Layout zones (DS 4.3, SPEC 4 layout). Owner: WP-08.
 *
 * Niwa (the house), Engawa (the narrator strip), Zashiki (data, evidence and controls) with the
 * Tokonoma card at its top. Desktop: Niwa about 62% of the width at full height, Engawa and
 * Zashiki share the rest. Tablet and phone: Niwa on top (about 45% of the height), then Engawa
 * and Zashiki stacked below. Every page that shows a home uses this one frame, so the zones stay
 * where people expect them.
 */
import type { ReactNode } from 'react';

export interface ZonesProps {
  /** The house. */
  niwa: ReactNode;
  /** Accessible name for the house zone. */
  niwaLabel: string;
  /** One line under the house. */
  caption?: ReactNode;
  /** The narrator strip; announced politely when it changes. */
  engawa: ReactNode;
  /** The one insight card, at the top of Zashiki. */
  tokonoma?: ReactNode;
  /** The room: data, evidence and controls. */
  zashiki: ReactNode;
  /** `data-state` on the frame, for styling and tests. */
  state?: string;
}

export function Zones({ niwa, niwaLabel, caption, engawa, tokonoma, zashiki, state }: ZonesProps) {
  return (
    <div className="ib-home" data-zones="" data-state={state}>
      <section className="ib-niwa ib-washi" aria-label={niwaLabel}>
        <div className="ib-niwa__drawing">{niwa}</div>
        {caption ? <p className="ib-niwa__caption">{caption}</p> : null}
      </section>
      <aside className="ib-engawa" aria-live="polite" aria-label="What is happening">
        {engawa}
      </aside>
      <div className="ib-zashiki">
        {tokonoma}
        {zashiki}
      </div>
    </div>
  );
}
