/**
 * Scale ladder and mode tabs (DESIGN_SYSTEM 13.7, SPEC 17, UV 3.2, 3.3). Owner: WP-06.
 *
 * The ladder is one studio at five zoom levels: City, Site, Building, Floor, Room. Vertical on the
 * left edge on desktop, a breadcrumb chip row on tablet and phone. `[` and `]` step down and up
 * (the app binds the keys; `stepLevel` is the pure step).
 *
 * Modes (Noren tabs): Make, Look, Choose, Prove, Tell, with their single key letters.
 */
import type { KeyboardEvent } from 'react';

export type ScaleLevel = 'city' | 'site' | 'building' | 'floor' | 'room';
export const SCALE_LEVELS: readonly ScaleLevel[] = ['city', 'site', 'building', 'floor', 'room'];
export const SCALE_LABEL: Record<ScaleLevel, string> = {
  city: 'City',
  site: 'Site',
  building: 'Building',
  floor: 'Floor',
  room: 'Room',
};

/** One step down (`-1`, towards City) or up (`+1`, towards Room), clamped. */
export function stepLevel(level: ScaleLevel, dir: -1 | 1): ScaleLevel {
  const i = SCALE_LEVELS.indexOf(level) + dir;
  return SCALE_LEVELS[Math.min(SCALE_LEVELS.length - 1, Math.max(0, i))] as ScaleLevel;
}

export interface ScaleLadderProps {
  level: ScaleLevel;
  onChange: (level: ScaleLevel) => void;
  /** Levels that make sense now (Room needs a selected room). Others are shown but disabled. */
  enabled?: readonly ScaleLevel[];
  layout?: 'vertical' | 'breadcrumb';
  /** Short context per level, e.g. the floor name. */
  detail?: Partial<Record<ScaleLevel, string>>;
}

export function ScaleLadder({
  level,
  onChange,
  enabled = SCALE_LEVELS,
  layout = 'vertical',
  detail,
}: ScaleLadderProps) {
  return (
    <nav className="ib-ladder" data-layout={layout} aria-label="Scale">
      <ol className="ib-ladder__rungs">
        {[...SCALE_LEVELS].reverse().map((l) => {
          const on = enabled.includes(l);
          const here = l === level;
          return (
            <li key={l} className="ib-ladder__rung" data-level={l} data-here={here ? '' : undefined}>
              <button
                type="button"
                className="ib-ladder__btn"
                disabled={!on}
                aria-current={here ? 'location' : undefined}
                onClick={() => onChange(l)}
              >
                <span className="ib-ladder__tick" aria-hidden="true" />
                <span className="ib-ladder__name">{SCALE_LABEL[l]}</span>
                {detail?.[l] ? <span className="ib-ladder__detail">{detail[l]}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="ib-ladder__keys" aria-hidden="true">
        <kbd>[</kbd> <kbd>]</kbd>
      </p>
    </nav>
  );
}

export type StudioMode = 'make' | 'look' | 'choose' | 'prove' | 'tell';
export const STUDIO_MODES: readonly StudioMode[] = ['make', 'look', 'choose', 'prove', 'tell'];
export const MODE_LABEL: Record<StudioMode, string> = {
  make: 'Make',
  look: 'Look',
  choose: 'Choose',
  prove: 'Prove',
  tell: 'Tell',
};
export const MODE_KEY: Record<StudioMode, string> = {
  make: 'M',
  look: 'L',
  choose: 'C',
  prove: 'P',
  tell: 'T',
};
export const MODE_LINE: Record<StudioMode, string> = {
  make: 'Draw and edit the building',
  look: 'See sun, light and heat',
  choose: 'Compare and pick changes',
  prove: 'Codes, ratings and evidence',
  tell: 'The story and what to remember',
};

export interface ModeTabsProps {
  mode: StudioMode;
  onChange: (mode: StudioMode) => void;
  /** Modes hidden on this device (phone hides Make's drawing). */
  hidden?: readonly StudioMode[];
  /** Id of the panel the tabs control. */
  controls?: string;
}

export function ModeTabs({ mode, onChange, hidden = [], controls }: ModeTabsProps) {
  const shown = STUDIO_MODES.filter((m) => !hidden.includes(m));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = shown.indexOf(mode);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = shown[(i + (e.key === 'ArrowRight' ? 1 : shown.length - 1)) % shown.length];
      if (n) onChange(n);
    }
  };
  return (
    <div className="ib-modes" role="tablist" aria-label="Mode" onKeyDown={onKey}>
      {shown.map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          className="ib-modes__tab"
          data-mode={m}
          aria-selected={m === mode}
          aria-controls={controls}
          tabIndex={m === mode ? 0 : -1}
          title={`${MODE_LINE[m]} (${MODE_KEY[m]})`}
          onClick={() => onChange(m)}
        >
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}
