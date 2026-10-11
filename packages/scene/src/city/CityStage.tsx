/**
 * `<CityStage>`: the building in its city (PLAN-V3 5, 6, 8; DESIGN_SYSTEM 13). One orthographic
 * `<Canvas frameloop="demand">` over washi, the scale ladder with camera moves, the real sun with
 * a 24 hour scrubber and a month strip, lenses painted from stage data, the signature moments, a
 * quality ladder, reduced motion and an SVG plan when WebGL is unavailable. The chrome follows the
 * DS 13.7 breakpoints (phone, tablet, desktop) and the camera frames inside the area it leaves
 * free, so no panel covers the building. Owner: WP-07.
 *
 * Data in, pictures out: every prop is shaped like a v3 contract (`CityTile`, `BuildingDoc`,
 * `CompiledBuilding`, `SiteResult`) or a scene type in `./types.ts`. An `undefined` prop falls back
 * to a labelled stand in; `null` means "not computed yet" and paints nothing.
 */
import type {
  BuildingDoc,
  CityTile,
  CompiledBuilding,
  Mm,
  QualityTier,
  ResultStamp,
  SiteResult,
} from '@ibasho/core';
import { PreviewStamp, SunScrubber } from '@ibasho/ui';
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  type CSSProperties,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
  type WheelEvent,
} from 'react';
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace } from 'three';
import type { Theme } from '../colour/palette.ts';
import { effectiveTier, initialLadder, type LadderEvent, stepLadder, TIERS } from '../quality/ladder.ts';
import {
  CITY_CSS,
  CityLegend,
  Compass,
  Ladder,
  LanternKey,
  type LegendSpec,
  LensChips,
  MonthStrip,
  PinnedChip,
  ScaleBar,
  ShareBar,
  StoreyStack,
} from './CityChrome.tsx';
import { CityScene, type CityStats, HOURS_DOMAIN, USE_LABEL } from './CityScene.tsx';
import { CitySvg } from './CitySvg.tsx';
import { type EN, ringArea } from './frame.ts';
import { runKernel } from './kernels.ts';
import { type CityModel, type CityPlace, cityModel, defaultLanterns, LANTERN_SCALE_KWH } from './model.ts';
import { annualKwh, previewDaylight, sdaShare } from './preview.ts';
import type { SafeArea } from './sceneParts.ts';
import type { SunHoursGrid } from './shadow.ts';
import { type CityTime, clockLabel, dateLabel, dayWindow, SWEEP_MS, sunOf, sweepMinutes } from './sun.ts';
import type {
  CityFocus,
  CityLensId,
  CityTarget,
  DaylightGrid,
  LanternDatum,
  PhototropicSpec,
  ZoomLevel,
} from './types.ts';
import { levelView, resolveFocus } from './view.ts';

export type CityStyle = 'washi' | 'yoru' | 'svg';

export interface CityStageProps {
  /** Default: IIIT Hyderabad campus (17.4453 N, 78.3490 E, IST). */
  place?: CityPlace;
  /** City pack tiles (`ibasho.city/1`, e.g. `loadCityTiles()` of `@ibasho/pack-city-hyderabad`). Default: a stand in. */
  tiles?: readonly CityTile[];
  /** Context ids the hero stands in for (pack `HERO_CONTEXT_IDS`); not drawn. */
  hideContextIds?: readonly string[];
  /** Road centrelines (m, pack frame). Default: the stand in roads when `tiles` is default. */
  roads?: readonly { points: EN[]; width: number }[];
  /** The hero document (e.g. GB1 Vindhya). Default: a stand in. `null`: no hero. */
  hero?: BuildingDoc | null;
  /** Geometry stage output (`@ibasho/plan` `compile`); the hero is drawn from `meshes`. */
  compiled?: CompiledBuilding | null;

  /** Scale ladder. Controlled when given. */
  level?: ZoomLevel;
  onLevelChange?: (level: ZoomLevel) => void;
  /** Floor and room levels focus this storey and room. */
  storeyId?: string;
  roomId?: string;
  onSelect?: (target: CityTarget) => void;

  /** Local date and minutes. Controlled when given. Default: 21 March, 10:30. */
  time?: CityTime;
  onTimeChange?: (time: CityTime) => void;
  /** Moment 1: sweep dawn to dusk on each date in turn, 12 s per day. Replays when `key` changes. */
  sweep?: { dates: readonly string[]; key: number } | null;
  onSweepEnd?: () => void;

  /** Lens. Controlled when given. Default `none` (paper model, live shadows, penumbra). */
  lens?: CityLensId;
  onLensChange?: (lens: CityLensId) => void;
  /** Radiation and sun hours per surface. `undefined`: scene estimate (labelled); `null`: not yet. */
  site?: SiteResult | null;
  /** Daylight point grids per storey. `undefined`: scene estimate (labelled); `null`: not yet. */
  daylight?: readonly DaylightGrid[] | null;
  /** Night lanterns: only these buildings glow. Default: the hero and named neighbours, Preview. */
  lanterns?: readonly LanternDatum[];
  /** Stamp of the painted result; a `preview` stamp shows the Preview mark in the legend. */
  stamp?: ResultStamp | null;

  /** Heights the person entered for neighbours (mm). Each closes that neighbour's band. */
  heightOverrides?: Readonly<Record<string, Mm>>;
  /** A height entered in the pinned chip (the studio stores it and passes it back). */
  onHeightEnter?: (contextId: string, mm: Mm) => void;
  /** Moment 2. Default true. */
  penumbra?: boolean;
  /** Moment 6. */
  phototropic?: PhototropicSpec | null;

  style?: CityStyle;
  /** Plan azimuth of the camera (degrees, snapped to 45 on release). */
  azimuthDeg?: number;
  onAzimuthChange?: (deg: number) => void;
  reducedMotion?: boolean;
  /** Highest tier (the ladder starts here). Default 2: software GL friendly. */
  tierCap?: QualityTier;
  llmGenerating?: boolean;
  /** Built in ladder, lens chips, time strip, compass and legend. Default true. */
  controls?: boolean;
  /** The legend alone, when `controls` is false. Default follows `controls`. */
  legend?: boolean;
  /** Extra insets (CSS px) the studio's own chrome covers, added to the stage's. */
  insets?: Partial<SafeArea>;
  stats?: MutableRefObject<CityStats | null>;
  /**
   * Find: ease to a building, storey or room, outline it (focus colour by day, lantern by night),
   * dim the rest and, for a storey or room, lift the floors above. Controlled when given.
   * `focusFromHit(placeHit)` turns a search hit into one.
   */
  focus?: CityFocus | null;
  onFocusChange?: (focus: CityFocus | null) => void;
  /** `ref.current.flyTo(focus)` for programmatic moves (calls `onFocusChange` when controlled). */
  ref?: Ref<CityStageHandle>;
  className?: string;
  style_?: CSSProperties;
}

export interface CityStageHandle {
  flyTo: (focus: CityFocus | null) => void;
}

export const DEFAULT_TIME: CityTime = { date: '2026-03-21', minutes: 630 };
/** Moment 1 sequence (PLAN-V3 6): the equinox, then a day when the noon sun stands in the north. */
export const SWEEP_DATES = ['2026-03-21', '2026-05-21'] as const;
const NIGHT_MINUTES = 1230;
const LEVELS: readonly ZoomLevel[] = ['city', 'site', 'building', 'floor', 'room'];

export type CityLayout = 'phone' | 'tablet' | 'desktop';
/** DS 13.7 breakpoints. */
export function layoutOf(width: number): CityLayout {
  return width < 768 ? 'phone' : width < 1280 ? 'tablet' : 'desktop';
}

/** Insets the stage's own chrome covers at each layout (the camera frames inside the rest). */
export function chromeInsets(layout: CityLayout, height: number, legend: boolean): SafeArea {
  switch (layout) {
    case 'phone':
      return { left: 8, top: 8, right: 8, bottom: Math.round(height * 0.55) + 8 };
    case 'tablet':
      return { left: 16, top: 72, right: legend ? 300 : 16, bottom: 132 };
    case 'desktop':
      return { left: 132, top: 72, right: legend ? 312 : 72, bottom: 132 };
  }
}

function useReducedMotion(explicit?: boolean): boolean {
  const [pref, setPref] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPref(mq.matches);
    const on = (): void => setPref(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return explicit ?? pref;
}

function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function useControlled<T>(value: T | undefined, initial: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [own, setOwn] = useState(initial);
  const set = useCallback(
    (v: T) => {
      setOwn(v);
      onChange?.(v);
    },
    [onChange],
  );
  return [value ?? own, set];
}

const COMPASS_WORDS = [
  'north',
  'north east',
  'east',
  'south east',
  'south',
  'south west',
  'west',
  'north west',
];
const compass = (deg: number): string => COMPASS_WORDS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;

/** 2nd and 98th percentile of annual radiation over the painted surfaces, rounded to 50 (QA M7). */
export function radiationDomain(site: SiteResult | null): [number, number] {
  const v = (site?.surfaces ?? [])
    .map((s) => annualKwh(s))
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);
  if (v.length < 4) return [200, 2000];
  const q = (f: number): number => v[Math.min(v.length - 1, Math.max(0, Math.round(f * (v.length - 1))))]!;
  const lo = Math.floor(q(0.02) / 50) * 50;
  const hi = Math.ceil(q(0.98) / 50) * 50;
  return hi - lo < 100 ? [lo, lo + 100] : [lo, hi];
}

/** The legend for a lens (pure, so the app can show it outside the stage). */
export function legendFor(opts: {
  lens: CityLensId;
  date: string;
  estimated: boolean;
  stamp: ResultStamp | null | undefined;
  daylightShare?: number | null;
  sweeping?: boolean;
  radiationDomain?: [number, number];
}): LegendSpec | null {
  const preview = opts.estimated || opts.stamp?.impl === 'preview';
  const est = opts.estimated ? 'Scene estimate' : 'Site stage';
  switch (opts.lens) {
    case 'none':
      return null;
    case 'shadows':
      return {
        title: 'Shadow hours',
        unit: 'h a day',
        ramp: 'kage',
        domain: HOURS_DOMAIN,
        reversed: true,
        resolution: 'Sketch, 3 m',
        period: dateLabel(opts.date),
        method: 'Likely heights, 10 min steps; hatch reaches plausible heights',
        preview: true,
      };
    case 'sun-hours':
      return {
        title: opts.sweeping ? 'Sun hours so far' : 'Sun hours',
        unit: 'h a day',
        ramp: opts.sweeping ? 'hinode' : 'hidamari',
        domain: HOURS_DOMAIN,
        reversed: !!opts.sweeping,
        resolution: 'Sketch, 3 m',
        period: dateLabel(opts.date),
        method: `${est}, 10 min steps`,
        preview: true,
      };
    case 'radiation':
      return {
        title: 'Radiation',
        unit: 'kWh/m²·yr',
        ramp: 'hinata',
        domain: opts.radiationDomain ?? [200, 2000],
        resolution: 'Sketch, per wall and roof',
        period: 'A typical year, range of this view',
        method: `${est}, clear sky and monsoon prior`,
        preview,
      };
    case 'daylight':
      return {
        title: 'Daylight, sDA 300/50',
        unit: '% of hours',
        ramp: 'akari',
        domain: [0, 100],
        resolution: 'Sketch, 1 m',
        period: 'Occupied hours, a year',
        method: `${opts.estimated ? 'Scene estimate from distance to glass' : 'Daylight stage'}; dots fail, hatch is glare`,
        preview,
        ...(opts.daylightShare != null ? { extra: <ShareBar share={opts.daylightShare} target={40} /> } : {}),
      };
    case 'lanterns':
      return {
        title: 'Lanterns',
        unit: 'EUI',
        ramp: null,
        resolution: 'Per building',
        period: 'Glow follows the hourly load',
        method: 'Only modelled buildings glow',
        preview: true,
        extra: <LanternKey scale={LANTERN_SCALE_KWH} />,
      };
  }
}

export function CityStage(props: CityStageProps) {
  const style = props.style ?? 'washi';
  const reducedMotion = useReducedMotion(props.reducedMotion);
  const controls = props.controls ?? true;
  const showLegend = props.legend ?? controls;
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 960, height: 600 });
  const [glOk] = useState(webglAvailable);
  const [lost, setLost] = useState(false);
  const [ladder, dispatch] = useReducer(
    (s: ReturnType<typeof initialLadder>, e: LadderEvent) => stepLadder(s, e),
    props.tierCap ?? 2,
    (cap: QualityTier) => initialLadder(cap),
  );
  useEffect(() => {
    dispatch(props.llmGenerating ? 'llm-start' : 'llm-end');
  }, [props.llmGenerating]);
  const settings = TIERS[effectiveTier(ladder)];

  const [ladderLevel, setLadderLevel] = useControlled<ZoomLevel>(props.level, 'site', props.onLevelChange);
  const [lens, setLensRaw] = useControlled<CityLensId>(props.lens, 'none', props.onLensChange);
  const [time, setTimeRaw] = useState<CityTime>(props.time ?? DEFAULT_TIME);
  const timeNow = props.time ?? time;
  const setTime = useCallback(
    (t: CityTime) => {
      setTimeRaw(t);
      props.onTimeChange?.(t);
    },
    [props.onTimeChange],
  );
  const [azOwn, setAzOwn] = useState(props.azimuthDeg ?? 135);
  const azimuth = props.azimuthDeg ?? azOwn;
  const [zoom, setZoom] = useState(1);
  const [storeyOwn, setStoreyOwn] = useState<string | undefined>(undefined);
  const [roomOwn, setRoomOwn] = useState<string | undefined>(undefined);
  const [hover, setHover] = useState<{ t: CityTarget; at: { x: number; y: number } } | null>(null);
  const [pinned, setPinned] = useState<{ id: string; floors: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [closing, setClosing] = useState<ReadonlySet<string>>(new Set());
  const [ownOverrides, setOwnOverrides] = useState<Record<string, Mm>>({});
  const overrides = useMemo(
    () => ({ ...ownOverrides, ...(props.heightOverrides ?? {}) }),
    [ownOverrides, props.heightOverrides],
  );

  useEffect(() => {
    const el = container.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      const w = Math.max(1, Math.round(e.contentRect.width));
      const h = Math.max(1, Math.round(e.contentRect.height));
      setSize((s) => (s.width === w && s.height === h ? s : { width: w, height: h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A newly entered height closes its band with a crease; remember which ones are closing.
  const prevOverrides = useRef<Record<string, Mm>>(overrides);
  useEffect(() => {
    const fresh = Object.keys(overrides).filter((k) => prevOverrides.current[k] !== overrides[k]);
    prevOverrides.current = overrides;
    if (!fresh.length) return;
    setClosing(new Set(fresh));
    const id = setTimeout(() => setClosing(new Set()), 1000);
    return () => clearTimeout(id);
  }, [overrides]);

  const model: CityModel = useMemo(
    () =>
      cityModel({
        ...(props.place ? { place: props.place } : {}),
        ...(props.tiles !== undefined ? { tiles: props.tiles } : {}),
        ...(props.roads ? { roads: props.roads } : {}),
        ...(props.hero !== undefined ? { hero: props.hero } : {}),
        ...(props.compiled !== undefined ? { compiled: props.compiled } : {}),
        heightOverrides: overrides,
        ...(props.hideContextIds ? { hideContextIds: props.hideContextIds } : {}),
      }),
    [props.place, props.tiles, props.roads, props.hero, props.compiled, overrides, props.hideContextIds],
  );

  // Choosing Lanterns eases the clock to 20:30 unless the person already chose a night hour (QA B1).
  const setLens = useCallback(
    (l: CityLensId) => {
      setLensRaw(l);
      const day = timeNow.minutes > 330 && timeNow.minutes < 1110;
      if (l === 'lanterns' && day && !props.time) {
        if (reducedMotion) setTime({ ...timeNow, minutes: NIGHT_MINUTES });
        else {
          const from = timeNow.minutes;
          const t0 = performance.now();
          const step = (now: number): void => {
            const k = Math.min(1, (now - t0) / 1200);
            setTime({ ...timeNow, minutes: from + (NIGHT_MINUTES - from) * (1 - (1 - k) ** 3) });
            if (k < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      }
    },
    [setLensRaw, timeNow, props.time, reducedMotion, setTime],
  );

  const sun = useMemo(
    () => sunOf(timeNow, model.place.lat, model.place.lon, model.place.tzHours),
    [timeNow, model.place],
  );
  // Night look: the Yoru style, the Lanterns lens, or the sun well below the horizon.
  const theme: Theme = style === 'yoru' || lens === 'lanterns' || sun.altitudeDeg < -4 ? 'yoru' : 'hiru';

  // Analysis: given data, else the scene estimate, computed only when a lens needs it.
  const needSite = lens === 'radiation' || lens === 'sun-hours';
  // Scene estimates run in a worker (kernels.ts); the stage stays responsive while they compute.
  const [siteEst, setSiteEst] = useState<{ model: CityModel; site: SiteResult } | null>(null);
  useEffect(() => {
    if (props.site !== undefined || !needSite || !model.hero) return;
    if (siteEst?.model === model) return;
    let live = true;
    runKernel({ kind: 'site', hero: model.hero, casters: model.casters, place: model.place }).then((r) => {
      if (live && r.kind === 'site') setSiteEst({ model, site: r.site });
    });
    return () => {
      live = false;
    };
  }, [props.site, needSite, model, siteEst]);
  const site = props.site !== undefined ? props.site : siteEst?.model === model ? siteEst.site : null;
  const needGrid = lens === 'sun-hours' || lens === 'shadows';
  const [gridEst, setGridEst] = useState<{ model: CityModel; date: string; grid: SunHoursGrid } | null>(null);
  useEffect(() => {
    if (!needGrid || !model.hero) return;
    if (gridEst?.model === model && gridEst.date === timeNow.date) return;
    let live = true;
    const date = timeNow.date;
    runKernel({ kind: 'sun-hours', hero: model.hero, casters: model.casters, place: model.place, date }).then(
      (r) => {
        if (live && r.kind === 'sun-hours') setGridEst({ model, date, grid: r.grid });
      },
    );
    return () => {
      live = false;
    };
  }, [needGrid, model, timeNow.date, gridEst]);
  const sunGrid = gridEst?.model === model ? gridEst.grid : null;
  const computing =
    (needSite && props.site === undefined && !site) ||
    (needGrid && (!sunGrid || gridEst?.date !== timeNow.date));
  const daylight = useMemo(() => {
    if (props.daylight !== undefined) return props.daylight;
    return lens === 'daylight' && model.heroDoc ? previewDaylight(model.heroDoc) : null;
  }, [props.daylight, lens, model.heroDoc]);
  const lanterns = useMemo(() => props.lanterns ?? defaultLanterns(model), [props.lanterns, model]);
  const radDomain = useMemo(() => radiationDomain(site), [site]);

  const storeys = useMemo(
    () => (model.hero?.storeys ?? []).map((s) => ({ id: s.id, name: s.name, below: s.belowGrade })),
    [model.hero],
  );
  const storeyBase = props.storeyId ?? storeyOwn ?? storeys.find((s) => !s.below)?.id;
  const roomBase = props.roomId ?? roomOwn;

  // ------------------------------------------------------------------ find (focus)
  const [ownFocus, setOwnFocus] = useState<CityFocus | null>(null);
  const focus = props.focus !== undefined ? props.focus : ownFocus;
  const setFocus = useCallback(
    (f: CityFocus | null) => {
      setOwnFocus(f);
      setZoom(1);
      props.onFocusChange?.(f);
    },
    [props.onFocusChange],
  );
  useImperativeHandle(props.ref, () => ({ flyTo: setFocus }), [setFocus]);

  const layout = layoutOf(size.width);
  const legendShown = showLegend && lens !== 'none';
  const insets = useMemo(() => {
    const own = controls
      ? chromeInsets(layout, size.height, legendShown)
      : { left: 12, top: 12, right: 12, bottom: 12 };
    const extra = props.insets ?? {};
    return {
      left: own.left + (extra.left ?? 0),
      top: own.top + (extra.top ?? 0),
      right: own.right + (extra.right ?? 0),
      bottom: own.bottom + (extra.bottom ?? 0),
    };
  }, [controls, layout, size.height, legendShown, props.insets]);
  const safeW = Math.max(80, size.width - insets.left - insets.right);
  const safeH = Math.max(80, size.height - insets.top - insets.bottom);
  const aspect = safeW / safeH;
  const focusRes = useMemo(
    () =>
      focus
        ? resolveFocus({ focus, hero: model.hero, masses: model.masses, azimuthDeg: azimuth, aspect })
        : null,
    [focus, model.hero, model.masses, azimuth, aspect],
  );
  const level: ZoomLevel =
    focusRes?.kind === 'hero' ? focusRes.level : focusRes?.kind === 'frame' ? 'building' : ladderLevel;
  const storeyId = focusRes?.kind === 'hero' && focusRes.storeyId ? focusRes.storeyId : storeyBase;
  const roomId = focusRes?.kind === 'hero' && focusRes.roomId ? focusRes.roomId : roomBase;
  const highlight = useMemo(
    () =>
      focus && focusRes
        ? {
            ...(focusRes.kind === 'frame' && focusRes.contextId ? { contextId: focusRes.contextId } : {}),
            ...(focusRes.kind === 'frame' && focusRes.bboxMm ? { bboxMm: focusRes.bboxMm } : {}),
            ...(focusRes.kind === 'hero' ? { hero: true } : {}),
            ...(focusRes.kind === 'hero' && focusRes.level === 'room' && focusRes.roomId
              ? { roomId: focusRes.roomId }
              : {}),
            ...(focusRes.kind === 'hero' && focusRes.level === 'floor' && focusRes.storeyId
              ? { storeyId: focusRes.storeyId }
              : {}),
          }
        : null,
    [focus, focusRes],
  );

  // ------------------------------------------------------------------ the sweep (moment 1)
  const [sweepState, setSweep] = useState<{ i: number; start: number; dates: readonly string[] } | null>(
    null,
  );
  const startSweep = useCallback(
    (dates: readonly string[]) => {
      if (!dates.length) return;
      if (reducedMotion) {
        // Reduced motion: no sweep; land on noon of the last date with the whole day's map.
        setSweep(null);
        setTime({ date: dates[dates.length - 1]!, minutes: 720 });
        props.onSweepEnd?.();
        return;
      }
      setLensRaw('sun-hours');
      setSweep({ i: 0, start: performance.now(), dates });
    },
    [reducedMotion, setTime, props.onSweepEnd, setLensRaw],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: replay only when the key changes
  useEffect(() => {
    if (props.sweep) startSweep(props.sweep.dates);
  }, [props.sweep?.key]);
  useEffect(() => {
    if (!sweepState) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number): void => {
      const date = sweepState.dates[sweepState.i]!;
      const w = dayWindow(date, model.place.lat, model.place.lon, model.place.tzHours);
      const k = (now - sweepState.start) / SWEEP_MS;
      if (now - last > 33) {
        last = now;
        setTime({ date, minutes: sweepMinutes(k, w) });
      }
      if (k >= 1) {
        if (sweepState.i + 1 < sweepState.dates.length)
          setSweep({ ...sweepState, i: sweepState.i + 1, start: now });
        else {
          setSweep(null);
          props.onSweepEnd?.();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sweepState, model.place, setTime, props.onSweepEnd]);
  const sweeping = !!sweepState;

  const view = useMemo(() => {
    const v =
      focusRes?.kind === 'frame'
        ? focusRes.view
        : levelView({
            level,
            hero: model.hero,
            cityBox: model.cityBox,
            azimuthDeg: azimuth,
            aspect,
            ...(storeyId ? { storeyId } : {}),
            ...(roomId ? { roomId } : {}),
          });
    // With the daylight drawer out the camera pulls back so drawer and building both fit (QA B5).
    const drawerOut = (level === 'floor' || level === 'room') && lens === 'daylight';
    return { ...v, halfH: v.halfH * zoom * (drawerOut ? 1.75 : 1) };
  }, [focusRes, level, model.hero, model.cityBox, azimuth, aspect, storeyId, roomId, zoom, lens]);

  // ------------------------------------------------------------------ input: drag, wheel, keys
  const drag = useRef<{ x: number; az: number } | null>(null);
  const onAz = useCallback(
    (deg: number) => {
      setAzOwn(deg);
      props.onAzimuthChange?.(deg);
    },
    [props.onAzimuthChange],
  );
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 || (e.target as HTMLElement).tagName !== 'CANVAS') return;
    drag.current = { x: e.clientX, az: azimuth };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag.current || e.buttons !== 1) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 3) onAz(drag.current.az - dx * 0.4);
  };
  const onPointerUp = (): void => {
    if (!drag.current) return;
    drag.current = null;
    onAz(Math.round(azimuth / 45) * 45);
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
    setZoom((z) => Math.min(3, Math.max(0.3, z * (e.deltaY > 0 ? 1.12 : 1 / 1.12))));
  };
  const goLevel = useCallback(
    (l: ZoomLevel) => {
      if (focus) setFocus(null);
      setZoom(1);
      setLadderLevel(l);
    },
    [focus, setFocus, setLadderLevel],
  );
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onAz(Math.round(azimuth / 45) * 45 + (e.key === 'ArrowLeft' ? 45 : -45));
    } else if (e.key === '[' || e.key === ']') {
      const i = LEVELS.indexOf(level);
      goLevel(LEVELS[Math.min(LEVELS.length - 1, Math.max(0, i + (e.key === ']' ? 1 : -1)))]!);
    } else if (e.key === 'n' || e.key === 'N') {
      // Cycle neighbours with estimated heights and pin their chip (QA M11).
      const est = model.masses.filter((m) => m.user === undefined && m.hi - m.lo > 0.5);
      if (!est.length) return;
      const i = est.findIndex((m) => m.id === pinned?.id);
      const next = est[(i + (e.shiftKey ? -1 : 1) + est.length) % est.length]!;
      setPinned({ id: next.id, floors: Math.max(1, Math.round(next.likely / 3.5)) });
    }
  };

  const onPick = useCallback(
    (t: CityTarget) => {
      if (t.kind === 'hero' && t.roomId && (level === 'floor' || level === 'room')) setRoomOwn(t.roomId);
      if (t.kind === 'context') {
        const m = model.masses.find((x) => x.id === t.id);
        if (m) setPinned({ id: m.id, floors: m.levels ?? Math.max(1, Math.round(drawnHeightOf(m) / 3.5)) });
      }
      props.onSelect?.(t);
    },
    [props.onSelect, level, model.masses],
  );
  const onHover = useCallback((t: CityTarget | null, at: { x: number; y: number } | null) => {
    setHover(t && at ? { t, at } : null);
  }, []);
  const enterHeight = (): void => {
    if (!pinned) return;
    const mm = Math.round(pinned.floors * 3500);
    setOwnOverrides((o) => ({ ...o, [pinned.id]: mm }));
    props.onHeightEnter?.(pinned.id, mm);
    const m = model.masses.find((x) => x.id === pinned.id);
    setToast(
      `Shadow fixed: ${pinned.floors} floors, ${(mm / 1000).toFixed(1)} m${m?.name ? ` for ${m.name}` : ''}. The hatched band is closed.`,
    );
    setPinned(null);
  };
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  // Day and night crossfade (QA M9): the previous ground fades out over `--t-season`.
  const [fade, setFade] = useState<{ colour: string; key: number } | null>(null);
  const prevTheme = useRef(theme);
  useEffect(() => {
    if (prevTheme.current === theme) return;
    setFade({ colour: prevTheme.current === 'yoru' ? '#15120f' : '#f4eee3', key: performance.now() });
    prevTheme.current = theme;
  }, [theme]);
  const [fadeOn, setFadeOn] = useState(false);
  useEffect(() => {
    if (!fade) return;
    setFadeOn(true);
    const r = requestAnimationFrame(() => setFadeOn(false));
    const id = setTimeout(() => setFade(null), reducedMotion ? 200 : 1300);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(id);
    };
  }, [fade, reducedMotion]);

  // Polite live line, debounced so scrubbing sends one sentence (QA M11).
  const [live, setLive] = useState('');
  const sunLine = sun.up
    ? `Sun ${Math.round(sun.altitudeDeg)}° high in the ${compass(sun.azimuthDeg)}`
    : 'Sun below the horizon';
  useEffect(() => {
    if (sweeping) return;
    const id = setTimeout(
      () => setLive(`${dateLabel(timeNow.date)} ${clockLabel(timeNow.minutes)}. ${sunLine}.`),
      600,
    );
    return () => clearTimeout(id);
  }, [timeNow, sunLine, sweeping]);

  const dayWin = useMemo(
    () => dayWindow(timeNow.date, model.place.lat, model.place.lon, model.place.tzHours),
    [timeNow.date, model.place],
  );
  const altitudes = useMemo(
    () =>
      Array.from(
        { length: 25 },
        (_, h) =>
          sunOf(
            { date: timeNow.date, minutes: h * 60 },
            model.place.lat,
            model.place.lon,
            model.place.tzHours,
          ).altitudeDeg,
      ),
    [timeNow.date, model.place],
  );

  const useSvg = style === 'svg' || !glOk || lost;
  const gridMinutes = sweeping ? timeNow.minutes : 1440;
  const estimated =
    lens === 'radiation' || lens === 'sun-hours'
      ? props.site === undefined
      : lens === 'daylight'
        ? props.daylight === undefined
        : true;
  const dayGrid = daylight?.find((g) => g.storeyId === storeyId);
  const legend = legendFor({
    lens,
    date: timeNow.date,
    estimated,
    stamp: props.stamp,
    daylightShare: dayGrid ? sdaShare(dayGrid) : null,
    sweeping,
    radiationDomain: radDomain,
  });
  const hoverRoom =
    hover?.t.kind === 'hero'
      ? model.hero?.rooms.find((r) => r.id === (hover.t as { roomId?: string }).roomId)
      : undefined;
  const hoverMass =
    hover?.t.kind === 'context'
      ? model.masses.find((m) => m.id === (hover.t as { id: string }).id)
      : undefined;
  const pinnedMass = pinned ? model.masses.find((m) => m.id === pinned.id) : undefined;
  const photoLabel = props.phototropic
    ? props.phototropic.steps?.length
      ? (() => {
          const steps = props.phototropic.steps;
          const k = steps.reduce(
            (b, s, i) =>
              Math.abs(s.t - props.phototropic!.t) < Math.abs(steps[b]!.t - props.phototropic!.t) ? i : b,
            0,
          );
          const s = steps[k]!;
          return `Evaluated design ${k + 1} of ${steps.length}: EUI ${s.euiKwhM2.toFixed(0)} kWh/m²·yr${s.label ? `, ${s.label}` : ''}`;
        })()
      : 'Sun bent variant: an illustration until the search runs'
    : null;
  const storeyName = storeys.find((s) => s.id === storeyId)?.name;
  const room = model.hero?.rooms.find((r) => r.id === roomId);
  const detail: Partial<Record<ZoomLevel, string>> = {
    ...(model.hero ? { building: focusRes?.kind === 'frame' ? 'Neighbour' : model.hero.name } : {}),
    ...(storeyName ? { floor: storeyName } : {}),
    ...(room ? { room: USE_LABEL[room.use ?? ''] ?? room.name ?? 'Room' } : {}),
  };
  const enabled: readonly ZoomLevel[] = model.hero ? LEVELS : ['city', 'site'];
  // Room needs a room: the first room of the floor stands in when none is chosen.
  const firstRoom = model.hero?.rooms.find((r) => r.storeyId === storeyId)?.id;
  const metresPerPx = (2 * view.halfH) / safeH;
  const grain = theme === 'yoru' ? 'var(--grain-yoru)' : 'var(--grain-hiru)';
  const mayNote =
    sweeping &&
    timeNow.date.slice(5, 7) === '05' &&
    Math.abs(timeNow.minutes - (dayWin.rise + dayWin.set) / 2) < 70;

  const ladderEl = (
    <Ladder
      level={level}
      onLevel={(l) => {
        if (l === 'room' && !roomId && firstRoom) setRoomOwn(firstRoom);
        goLevel(l);
      }}
      layout={layout === 'desktop' ? 'vertical' : 'breadcrumb'}
      detail={detail}
      enabled={enabled}
    />
  );
  const storeyStack =
    (level === 'floor' || level === 'room') && storeys.length ? (
      <StoreyStack
        storeys={storeys}
        storeyId={storeyId}
        onStorey={(id) => {
          if (focus) setFocus(null);
          setStoreyOwn(id);
          setRoomOwn(undefined);
        }}
      />
    ) : null;
  const timeStrip = (
    <div className="ib-city-time">
      <div className="ib-city-time__row">
        <button
          type="button"
          className="ib-city-btn"
          aria-pressed={sweeping}
          onClick={() => (sweeping ? setSweep(null) : startSweep(SWEEP_DATES))}
        >
          {sweeping ? 'Pause' : 'Sweep 21 Mar, then 21 May'}
        </button>
        <span className="ib-city-num" style={{ minInlineSize: 96 }}>
          {dateLabel(timeNow.date)} {clockLabel(timeNow.minutes)}
        </span>
        <span className="ib-city-unit">{sunLine}</span>
      </div>
      <div className="ib-city-time__row">
        <SunScrubber
          minutes={timeNow.minutes}
          onChange={(m) => setTime({ ...timeNow, minutes: m })}
          sunriseMin={dayWin.rise}
          sunsetMin={dayWin.set}
          altitude={(m) => altitudes[Math.max(0, Math.min(24, Math.round(m / 60)))] ?? 0}
        />
        <MonthStrip date={timeNow.date} onDate={(d) => setTime({ ...timeNow, date: d })} />
      </div>
    </div>
  );
  const legendEl =
    legendShown && legend ? (
      <CityLegend
        spec={computing ? { ...legend, method: `${legend.method}; computing, rough until it lands` } : legend}
      />
    ) : null;
  const standInEl =
    model.standIn.context || model.standIn.hero ? (
      <PreviewStamp
        title={`Stand in ${[model.standIn.context ? 'city' : '', model.standIn.hero ? 'building' : ''].filter(Boolean).join(' and ')}: shaped like the real data, not measured.`}
      />
    ) : null;
  const compassEl = (
    <Compass
      azimuthDeg={azimuth}
      onTurn={(d) => onAz(Math.round(azimuth / 45) * 45 + d)}
      onNorth={() => onAz(180)}
      onZoom={(f) => setZoom((z) => Math.min(3, Math.max(0.3, z * f)))}
    />
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: a canvas region, not a form group
    <div
      ref={container}
      className={`ib-city ${props.className ?? ''}`}
      data-style={style}
      data-theme={theme}
      data-layout={layout}
      data-renderer={useSvg ? 'svg' : 'webgl'}
      data-level={level}
      data-lens={lens}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the stage takes arrow keys to turn the city
      tabIndex={0}
      role="group"
      aria-roledescription="3D city"
      aria-label={`${model.place.name ?? 'City'}, ${level} view. Arrow keys turn, [ and ] change scale, N cycles estimated neighbours.`}
      onKeyDown={onKey}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: theme === 'yoru' ? '#15120f' : '#f4eee3',
        touchAction: 'none',
        ...props.style_,
      }}
    >
      <style>{CITY_CSS}</style>
      {!useSvg ? (
        <Canvas
          orthographic
          frameloop="demand"
          dpr={[1, settings.dpr]}
          shadows={{ type: PCFShadowMap, enabled: settings.shadows }}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          style={{ position: 'absolute', inset: 0 }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor(0x000000, 0);
            gl.toneMapping = ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
            gl.outputColorSpace = SRGBColorSpace;
            scene.background = null;
            gl.domElement.addEventListener('webglcontextlost', (ev) => {
              ev.preventDefault();
              dispatch('context-lost');
              setLost(true);
            });
          }}
          onPointerMissed={() => setHover(null)}
        >
          <CityScene
            model={model}
            theme={theme}
            lens={lens}
            level={level}
            view={view}
            safe={insets}
            storeyId={storeyId}
            roomId={roomId}
            time={timeNow}
            sun={sun}
            sunGrid={sunGrid}
            gridMinutes={gridMinutes}
            sweeping={sweeping}
            site={site}
            radiationDomain={radDomain}
            daylight={daylight}
            lanterns={lanterns}
            phototropic={props.phototropic ?? null}
            penumbra={props.penumbra ?? true}
            closing={closing}
            settings={settings}
            reducedMotion={reducedMotion}
            onHover={onHover}
            onPick={onPick}
            highlight={highlight}
            {...(props.stats ? { stats: props.stats } : {})}
          />
          <PerformanceMonitor
            onDecline={() => dispatch('decline')}
            onIncline={() => dispatch('incline')}
            flipflops={4}
          />
        </Canvas>
      ) : (
        <div style={{ position: 'absolute', inset: 0 }}>
          <CitySvg
            model={model}
            theme={theme}
            lens={lens}
            level={level}
            view={view}
            sun={sun}
            storeyId={storeyId}
            site={site}
            daylight={daylight}
            penumbra={props.penumbra ?? true}
            width={size.width}
            height={size.height}
            onPick={(t) => onPick(t)}
            highlight={highlight}
            marks={!controls}
          />
        </div>
      )}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: grain,
          backgroundSize: '180px 180px',
          mixBlendMode: theme === 'yoru' ? 'screen' : 'multiply',
          opacity: theme === 'yoru' ? 0.06 : 0.1,
        }}
      />
      {fade ? (
        <div
          key={fade.key}
          className="ib-city-fade"
          aria-hidden="true"
          style={{
            background: fade.colour,
            opacity: fadeOn ? 0.85 : 0,
            transitionDuration: fadeOn ? '0ms' : reducedMotion ? '150ms' : '1200ms',
          }}
        />
      ) : null}

      {controls && layout === 'desktop' ? (
        <>
          <div
            className="ib-city-panel"
            style={{
              position: 'absolute',
              left: 16,
              top: 16,
              width: 100,
              display: 'grid',
              gap: 8,
              padding: '4px 0',
            }}
          >
            {ladderEl}
          </div>
          {storeyStack ? <div style={{ position: 'absolute', left: 124, top: 16 }}>{storeyStack}</div> : null}
          <div style={{ position: 'absolute', right: 16, top: 16, maxWidth: 'calc(100% - 180px)' }}>
            <LensChips lens={lens} onLens={setLens} />
          </div>
          <div
            className="ib-city-panel"
            style={{
              position: 'absolute',
              left: 16,
              right: legendShown ? 312 : 16,
              bottom: 16,
              maxWidth: 900,
            }}
          >
            {timeStrip}
          </div>
          {legendEl ? (
            <div
              className="ib-city-panel ib-city-panel--pad"
              style={{ position: 'absolute', right: 16, bottom: 16, width: 280 }}
            >
              {legendEl}
            </div>
          ) : null}
          <div style={{ position: 'absolute', right: legendShown ? 312 : 16, bottom: 148 }}>{compassEl}</div>
          <div
            style={{
              position: 'absolute',
              left: 132,
              bottom: 148,
              display: 'flex',
              gap: 12,
              alignItems: 'end',
            }}
          >
            {standInEl}
            <ScaleBar metresPerPx={metresPerPx} />
          </div>
        </>
      ) : null}

      {controls && layout === 'tablet' ? (
        <>
          <div className="ib-city-panel" style={{ position: 'absolute', left: 12, top: 12, maxWidth: '46%' }}>
            {ladderEl}
          </div>
          {storeyStack ? <div style={{ position: 'absolute', left: 12, top: 72 }}>{storeyStack}</div> : null}
          <div style={{ position: 'absolute', right: 12, top: 12, maxWidth: '52%' }}>
            <LensChips lens={lens} onLens={setLens} />
          </div>
          <div className="ib-city-panel" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            {timeStrip}
          </div>
          {legendEl ? (
            <div
              className="ib-city-panel ib-city-panel--pad"
              style={{
                position: 'absolute',
                right: 12,
                top: 72,
                width: 276,
                maxHeight: 'calc(100% - 220px)',
                overflow: 'auto',
              }}
            >
              {legendEl}
            </div>
          ) : null}
          <div style={{ position: 'absolute', right: legendShown ? 300 : 12, bottom: 140 }}>{compassEl}</div>
          <div
            style={{
              position: 'absolute',
              left: 16,
              bottom: 144,
              display: 'flex',
              gap: 12,
              alignItems: 'end',
            }}
          >
            {standInEl}
            <ScaleBar metresPerPx={metresPerPx} />
          </div>
        </>
      ) : null}

      {controls && layout === 'phone' ? (
        <>
          <div style={{ position: 'absolute', right: 8, top: 8 }}>
            <div className="ib-city-compass" style={{ gridTemplateColumns: '44px' }}>
              <button
                type="button"
                aria-label="Turn 45 degrees"
                onClick={() => onAz(Math.round(azimuth / 45) * 45 + 45)}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="-14 -14 28 28"
                  aria-hidden="true"
                  style={{ transform: `rotate(${-((azimuth + 180) % 360)}deg)` }}
                >
                  <circle r="12" fill="none" stroke="var(--ink-3)" />
                  <path d="M0 -10 L4 4 L0 1 L-4 4 Z" fill="var(--ink)" />
                </svg>
              </button>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 8, bottom: `calc(55% + 12px)` }}>{standInEl}</div>
          <section
            className="ib-city-panel ib-city-sheet"
            style={{ height: '55%' }}
            aria-label="Stage controls"
          >
            <span className="ib-city-sheet__grip" aria-hidden="true" />
            {ladderEl}
            {storeyStack ? <div style={{ display: 'flex' }}>{storeyStack}</div> : null}
            <LensChips lens={lens} onLens={setLens} />
            {timeStrip}
            {legendEl}
          </section>
        </>
      ) : null}

      {!controls && legendEl ? (
        <div
          className="ib-city-panel ib-city-panel--pad"
          style={{ position: 'absolute', right: 12, bottom: 12, width: 280 }}
        >
          {legendEl}
        </div>
      ) : null}

      {sweeping ? (
        <div
          style={{
            position: 'absolute',
            left: insets.left,
            right: insets.right,
            top: insets.top - 56,
            display: 'grid',
            justifyItems: 'center',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          <span className="ib-city-panel ib-city-big-clock">
            {dateLabel(timeNow.date)} {clockLabel(timeNow.minutes)}
          </span>
          {mayNote ? (
            <span className="ib-city-panel ib-city-note">Noon sun in the north, 10 May to 2 August</span>
          ) : null}
        </div>
      ) : null}

      {photoLabel ? (
        <div
          className="ib-city-panel ib-city-note"
          style={{ position: 'absolute', left: insets.left, top: insets.top }}
        >
          {props.phototropic?.steps?.length ? null : <PreviewStamp compact />} {photoLabel}
        </div>
      ) : null}

      {hoverMass && hover && !pinned ? (
        <div
          className="ib-city-panel ib-city-note"
          style={{ position: 'absolute', left: hover.at.x + 14, top: hover.at.y + 14, pointerEvents: 'none' }}
        >
          {hoverMass.name ?? 'Neighbour'}
          {hoverMass.hi - hoverMass.lo > 0.5 && hoverMass.user === undefined ? (
            <span className="ib-city-unit">
              {' '}
              about <span className="ib-city-num">{hoverMass.likely.toFixed(0)} m</span>, tap for source
            </span>
          ) : null}
        </div>
      ) : null}
      {hoverRoom && hover ? (
        <div
          className="ib-city-panel ib-city-note"
          style={{ position: 'absolute', left: hover.at.x + 14, top: hover.at.y + 14, pointerEvents: 'none' }}
        >
          {USE_LABEL[hoverRoom.use ?? ''] ?? hoverRoom.name ?? 'Room'},{' '}
          {storeys.find((s) => s.id === hoverRoom.storeyId)?.name}{' '}
          <span className="ib-city-num">{Math.round(Math.abs(ringArea(hoverRoom.ring)))} m²</span>
        </div>
      ) : null}
      {pinnedMass && pinned ? (
        <div style={{ position: 'absolute', left: insets.left, top: insets.top }}>
          <PinnedChip
            mass={pinnedMass}
            floors={pinned.floors}
            onFloors={(n) => setPinned({ ...pinned, floors: n })}
            onEnter={enterHeight}
            onClose={() => setPinned(null)}
          />
        </div>
      ) : null}
      {toast ? (
        <div
          role="status"
          className="ib-city-panel ib-city-toast"
          style={{ position: 'absolute', left: '50%', top: insets.top, transform: 'translateX(-50%)' }}
        >
          {toast}
        </div>
      ) : null}
      <div
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
      >
        {live}
      </div>
    </div>
  );
}

function drawnHeightOf(m: { user?: number; likely: number }): number {
  return m.user ?? m.likely;
}
