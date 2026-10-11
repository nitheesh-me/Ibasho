/**
 * The Niwa (stage) for the studio and its time strip (DS 13.1, 13.7, UV 4.1). Owner: WP-08.
 *
 * City, Site, Building, Floor and Room draw agent C's `CityStage` (`@ibasho/scene`): the paper
 * model of the real Hyderabad pack, the hero from the geometry stage's meshes (so lens surface ids
 * match), lenses painted from the site stages, the daylight drawer at Floor level, lanterns at
 * night and find-and-fly focus. The studio drives it with props (`controls={false}`) and keeps its
 * own Andon chrome: ladder, lens chips, the `SunScrubber` time strip and the legend in the panel.
 * No WebGL: `style="svg"`. Make draws the editable plan (`@ibasho/editor`).
 */
import type { BuildingDoc, CityTile, Place, ResultStamp } from '@ibasho/core';
import { PlanEditor, type PlanEditorProps } from '@ibasho/editor';
import {
  type CityFocus,
  type CityLensId,
  type CityTarget,
  dayWindow,
  type Placement,
  type PlacementCheck,
  CityStage as SceneCity,
  sunOf,
  type ZoomLevel,
} from '@ibasho/scene';
import { AnalysisLegend, rampColor, SunScrubber } from '@ibasho/ui';
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { contextIdsFor } from '../data.ts';
import type { LensId } from '../panels/Look.tsx';
import type { Job } from '../state/studio.ts';

export const DATES = [
  { id: 'mar', label: '21 March', iso: '2026-03-21' },
  { id: 'may', label: '21 May', iso: '2026-05-21' },
  { id: 'jun', label: '21 June', iso: '2026-06-21' },
  { id: 'dec', label: '21 December', iso: '2026-12-21' },
] as const;
export type DateId = (typeof DATES)[number]['id'];
export const isoOf = (d: DateId): string => DATES.find((x) => x.id === d)?.iso ?? '2026-03-21';

/** Studio lens to the scene's lens (the scene paints what it can; the rest stay in the panel). */
export function sceneLens(l: LensId): CityLensId {
  switch (l) {
    case 'shadows':
      return 'shadows';
    case 'sun-hours':
    case 'neighbours':
      return 'sun-hours';
    case 'radiation':
      return 'radiation';
    case 'daylight':
    case 'glare':
      return 'daylight';
    default:
      return 'none';
  }
}

/** A search focus id (from the URL) to the scene's focus. */
export function focusFor(
  id: string | undefined,
  doc: BuildingDoc,
  bbox?: CityFocus['bboxMm'],
): CityFocus | null {
  if (!id) return null;
  if (bbox && id !== doc.id && !id.startsWith('osm'))
    return { kind: 'building', buildingId: id, bboxMm: bbox };
  if (id === doc.id) return { kind: 'building', buildingId: doc.id };
  for (const s of doc.storeys) {
    if (s.id === id) return { kind: 'storey', buildingId: doc.id, storeyId: s.id };
    const r = s.rooms.find((x) => x.id === id);
    if (r) return { kind: 'room', buildingId: doc.id, storeyId: s.id, roomId: r.id };
  }
  // A neighbour from the pack: the scene frames that context id (or its box).
  return { kind: 'building', buildingId: id, ...(bbox ? { bboxMm: bbox } : {}) };
}

export interface CityStageProps {
  doc: BuildingDoc;
  place: Place;
  tiles: readonly CityTile[];
  level: ZoomLevel;
  onLevel?: (l: ZoomLevel) => void;
  storeyId?: string;
  roomId?: string;
  onSelect?: (t: CityTarget) => void;
  night: boolean;
  reducedMotion: boolean;
  date: DateId;
  minutes: number;
  onMinutes?: (m: number) => void;
  lens: LensId;
  job: Job | undefined;
  focus?: string | undefined;
  /** Box of the focused hit (pack frame mm), from search. */
  focusBox?: CityFocus['bboxMm'] | undefined;
  /** Placing (SPEC 27): controlled placement, drag and turn handles, and the site check. */
  placement?: Placement;
  onPlacementChange?: (p: Placement) => void;
  placeMode?: boolean;
  onSiteCheck?: (c: PlacementCheck) => void;
  /** 180 shows north up, to sit beside the north up plan in Make. */
  azimuthDeg?: number;
  /** Thumbnails in compare: the SVG plan view, no WebGL context each. */
  compact?: boolean;
  label?: ReactNode;
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Keeps the studio alive if the city view throws: panels and numbers still work (MendedError spirit). */
class SceneGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed)
      return (
        <div className="st-scene__mended ib-plate" role="status">
          The city view stopped drawing. The numbers, panels and plan still work; reload to try the view
          again.
        </div>
      );
    return this.props.children;
  }
}

/** The one place the scene component is mounted. */
export function CityStage(p: CityStageProps) {
  const gl = useMemo(hasWebGL, []);
  const out = p.job ? { ...p.job.outputs, ...p.job.latest } : undefined;
  const lens = sceneLens(p.lens);
  const site = lens === 'radiation' ? out?.radiation : lens === 'sun-hours' ? out?.sun : undefined;
  const stamp: ResultStamp | null =
    (lens === 'radiation'
      ? out?.radiation?.stamp
      : lens === 'sun-hours'
        ? out?.sun?.stamp
        : out?.energy?.stamp) ?? null;
  const focus = useMemo(() => focusFor(p.focus, p.doc, p.focusBox), [p.focus, p.doc, p.focusBox]);
  const hide = contextIdsFor(p.doc.id);
  return (
    <div className="st-scene" data-compact={p.compact ? '' : undefined}>
      <SceneGuard>
        <SceneCity
          place={{ lat: p.place.lat, lon: p.place.lon, name: p.place.name }}
          tiles={
            hide.length
              ? p.tiles.map((t) => ({ ...t, buildings: t.buildings.filter((b) => !hide.includes(b.id)) }))
              : p.tiles
          }
          hero={p.doc}
          compiled={out?.geometry ?? null}
          level={p.level}
          {...(p.onLevel ? { onLevelChange: p.onLevel } : {})}
          {...(p.storeyId ? { storeyId: p.storeyId } : {})}
          {...(p.roomId ? { roomId: p.roomId } : {})}
          {...(p.onSelect ? { onSelect: p.onSelect } : {})}
          time={{ date: isoOf(p.date), minutes: p.minutes }}
          {...(p.onMinutes ? { onTimeChange: (t: { minutes: number }) => p.onMinutes?.(t.minutes) } : {})}
          lens={p.night && lens === 'none' ? 'lanterns' : lens}
          site={site ?? null}
          stamp={stamp}
          style={p.compact || !gl ? 'svg' : p.night ? 'yoru' : 'washi'}
          reducedMotion={p.reducedMotion}
          controls={false}
          legend={false}
          focus={focus}
        />
      </SceneGuard>
      {p.label ? <div className="st-scene__label ib-plate">{p.label}</div> : null}
    </div>
  );
}

/** Plan painted by the daylight lens (floor level outside Make). */
export function PlanStage(props: Omit<PlanEditorProps, 'paint'> & { lens: LensId; job: Job | undefined }) {
  const { lens, job, ...rest } = props;
  const day = job?.views.daylight;
  const paint =
    (lens === 'daylight' || lens === 'glare') && day
      ? (r: { id: string }) =>
          day.rooms[r.id] !== undefined
            ? rampColor('akari', lens === 'glare' ? 1 - (day.rooms[r.id] ?? 0) : (day.rooms[r.id] ?? 0))
            : undefined
      : undefined;
  return (
    <PlanEditor
      {...rest}
      {...(paint ? { paint } : {})}
      {...(paint
        ? {
            overlay: (
              <div className="ib-plate">
                <AnalysisLegend
                  ramp="akari"
                  unit="daylit share of each room"
                  resolution="standard"
                  period="Occupied hours, typical year"
                  method="Simplified daylight model"
                  preview
                  {...(job?.tiers.daylight ? { tier: job.tiers.daylight } : {})}
                />
              </div>
            ),
          }
        : {})}
    />
  );
}

export interface TimeStripProps {
  date: DateId;
  onDate: (d: DateId) => void;
  minutes: number;
  onMinutes: (m: number) => void;
  reducedMotion: boolean;
  lat: number;
  lon: number;
}

/** Date chips and the 24 hour sun scrubber with play (moment 1: the day in 12 s, pausable). */
export function TimeStrip({ date, onDate, minutes, onMinutes, reducedMotion, lat, lon }: TimeStripProps) {
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const at = useRef(minutes);
  at.current = minutes;
  const win = useMemo(() => dayWindow(isoOf(date), lat, lon), [date, lat, lon]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const span = win.set - win.rise;
    const step = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      let m = at.current + (dt * span) / 12; // one day of sun in 12 s
      if (m > win.set) m = win.rise;
      onMinutes(Math.round(m));
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, onMinutes, win]);
  const iso = isoOf(date);
  return (
    <div className="st-time">
      <fieldset className="ib-chips" aria-label="Date">
        {DATES.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={date === d.id}
            className="ib-chip"
            onClick={() => onDate(d.id)}
          >
            {d.label}
          </button>
        ))}
      </fieldset>
      <SunScrubber
        minutes={minutes}
        onChange={onMinutes}
        sunriseMin={win.rise}
        sunsetMin={win.set}
        altitude={(m) => sunOf({ date: iso, minutes: m }, lat, lon).altitudeDeg}
      >
        <button
          type="button"
          className="st-time__play"
          onClick={() => setPlaying((v) => !v)}
          aria-pressed={playing}
          disabled={reducedMotion}
          title={
            reducedMotion
              ? 'Motion is reduced: use the scrubber'
              : playing
                ? 'Pause the sun'
                : 'Sweep the sun across the day'
          }
        >
          {playing ? 'Pause' : 'Play the day'}
        </button>
      </SunScrubber>
    </div>
  );
}
