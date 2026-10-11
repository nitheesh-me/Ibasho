/**
 * The city scene graph inside the stage's `<Canvas>`: paper ground, merged context massing with
 * honest outlines, the penumbra, trees, the hero on its site board by storey with lens paint, the
 * daylight drawer, the phototropic variant, night lanterns, the sun and the find highlight.
 * Owner: WP-07.
 *
 * Frame cost: `frameloop="demand"` means nothing renders while the city rests (still life). A
 * frame is asked for only when an input changes or while a move, sweep, wick, lift or drawer plays.
 */
import { facadeBin, type SiteResult } from '@ibasho/core';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  type DirectionalLight,
  DoubleSide,
  IcosahedronGeometry,
  type InstancedMesh,
  LineBasicMaterial,
  LineDashedMaterial,
  type LineSegments,
  type Matrix4,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  type OrthographicCamera,
  PlaneGeometry,
  Vector3,
} from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import { type Theme, token } from '../colour/palette.ts';
import type { TierSettings } from '../quality/ladder.ts';
import { paperBake } from './bake.ts';
import { type FacadeStorey, facadeOf } from './facade.ts';
import { type EN, ringArea } from './frame.ts';
import {
  contextGeometry,
  drawnHeight,
  flatGeometry,
  ghostGeometry,
  heroGeometry,
  heroOutline,
  outlineGeometry,
  paintHero,
  roadPolys,
} from './geometry.ts';
import type { HeroSurface } from './hero.ts';
import {
  createLensUniforms,
  gridTexture,
  lensMaterial,
  linearOf,
  rampTexture,
  writeGrid,
} from './materials.ts';
import { type CityModel, lanternStrength } from './model.ts';
import { phototropicGeometry } from './phototropic.ts';
import type { PlacementCheck } from './placement.ts';
import { annualKwh, surfaceKey } from './preview.ts';
import { rampLinear } from './ramps.ts';
import {
  applyView,
  daylightMesh,
  fatLines,
  haloMaterial,
  type LineMaterial,
  type LineSegments2,
  PLINTH_M,
  plinthRing,
  poolMaterial,
  ringCentre,
  type SafeArea,
  sunPathSegments,
} from './sceneParts.ts';
import { type Grid, penumbraPolygons, type SunHoursGrid, shadowHours, sunHoursUpTo } from './shadow.ts';
import { type CitySun, type CityTime, dayWindow, sunOf } from './sun.ts';
import type {
  CityLensId,
  CityTarget,
  DaylightGrid,
  LanternDatum,
  PhototropicSpec,
  ZoomLevel,
} from './types.ts';
import { blendView, type CityView, easeOri, LEVEL_MOVE_MS } from './view.ts';

/** A DOM label the stage draws over the canvas at a projected point (no drei Html roots). */
export interface SceneOverlayItem {
  key: string;
  kind: 'room' | 'locator';
  x: number;
  y: number;
  title: string;
  sub?: string;
  area?: number;
  full?: boolean;
}

export interface CityStats {
  phase: 'loading' | 'moving' | 'resting';
  frames: number;
  calls: number;
  triangles: number;
  tier: number;
}

export interface CitySceneProps {
  /** Room labels and the City locator, placed when the camera rests. */
  onOverlay?: (items: SceneOverlayItem[]) => void;
  model: CityModel;
  theme: Theme;
  lens: CityLensId;
  level: ZoomLevel;
  view: CityView;
  safe: SafeArea;
  storeyId: string | undefined;
  roomId: string | undefined;
  time: CityTime;
  sun: CitySun;
  /** Roof radiation at grid resolution (worker kernel), kWh/m² a year, NaN off the roof. */
  roofRad?: { grid: Grid; kwh: Float32Array } | null;
  /** Sun hours over the day (worker kernel), or null while it computes. */
  sunGrid: SunHoursGrid | null;
  /** Sun hours accumulate up to this local minute (the sweep builds it up; 1440 = whole day). */
  gridMinutes: number;
  sweeping: boolean;
  site: SiteResult | null;
  radiationDomain: [number, number];
  daylight: readonly DaylightGrid[] | null;
  lanterns: readonly LanternDatum[];
  phototropic: PhototropicSpec | null;
  penumbra: boolean;
  /** Ids whose height the person just entered: their band closes with a crease. */
  closing: ReadonlySet<string>;
  settings: TierSettings;
  reducedMotion: boolean;
  onHover: (t: CityTarget | null, at: { x: number; y: number } | null) => void;
  onPick: (t: CityTarget, at: { x: number; y: number }) => void;
  stats?: MutableRefObject<CityStats | null>;
  /** Moment 7: floors added on top of the hero (m), and neighbours that lose winter sun. */
  addedFloorsM?: number;
  castLosers?: readonly string[];
  /** Compare: outline these facade bins (Kotai warm for more, green for less). */
  emphasis?: { bins: readonly string[]; tone: 'more' | 'less' } | null;
  /** Find: what to outline or light; the rest of the city dims. */
  highlight?: {
    contextId?: string;
    hero?: boolean;
    storeyId?: string;
    roomId?: string;
    /** A place or building part found by search: its box is drawn on the ground. */
    bboxMm?: { minX: number; minY: number; maxX: number; maxY: number };
  } | null;
  /** Design before you build (SPEC 27): the hero can be dragged and turned on the ground. */
  placeMode?: boolean;
  /** Plot ground level, metres above the city datum. */
  groundM?: number;
  /** A finished drag: the move (m, east and north) and the turn (degrees clockwise) about the hero's centre. */
  onPlaceDrop?: (move: EN, turnDeg: number) => void;
  /** A drag starts or ends (the stage pauses its own camera drag meanwhile). */
  onPlaceDrag?: (active: boolean) => void;
  /** Site check result to draw: overlaps in warm, shading neighbours in the focus colour. */
  siteCheck?: PlacementCheck | null;
  /** Neighbours the person is looking at (pinned, hovered): they always show their penumbra. */
  attentionIds?: readonly string[];
}

const USE_TINT: Record<string, string> = {
  lab: '#e3dccf',
  'lab-heavy': '#ddd5c6',
  office: '#ece4d5',
  'office-open': '#ece4d5',
  classroom: '#e9dcc6',
  library: '#e0d5c0',
  'data-centre': '#d7d3cc',
  circulation: '#f1ebe0',
  stair: '#efe8dc',
  'toilet-core': '#ebe4d9',
  assembly: '#e5d6c2',
  lobby: '#efe6d6',
  bank: '#eadccb',
  retail: '#eadccb',
  plant: '#dcd6cc',
};

export const USE_LABEL: Record<string, string> = {
  lab: 'Lab',
  'lab-heavy': 'Heavy lab',
  office: 'Office',
  'office-open': 'Open office',
  classroom: 'Classroom',
  library: 'Library',
  'data-centre': 'Data centre',
  circulation: 'Corridor',
  stair: 'Stair',
  'toilet-core': 'Toilets',
  assembly: 'Hall',
  lobby: 'Lobby',
  bank: 'Bank',
  retail: 'Shop',
  plant: 'Plant',
};

interface Look {
  ground: string;
  road: string;
  context: string;
  contextLine: string;
  contextLineOpacity: number;
  wall: string;
  roof: string;
  glass: string;
  floor: string;
  ink: string;
  outline: string;
  outlineOpacity: number;
  hatch: string;
  tree: string;
  pv: string;
  fin: string;
  paper: string;
  plinth: string;
  warm: string;
  deep: string;
  lamp: string;
  tray: string;
}

function mix(a: string, b: string, t: number): string {
  return `#${new Color(a).lerp(new Color(b), t).getHexString()}`;
}

function lookOf(theme: Theme): Look {
  const t = (n: Parameters<typeof token>[0]): string => token(n, theme);
  // Window light is always lamplight: --glow (Yoru) 70% into --ink (Yoru) for a warm white (QA B1).
  const lamp = mix(token('ink', 'yoru'), token('glow', 'yoru'), 0.7);
  return theme === 'hiru'
    ? {
        ground: t('paper'),
        road: mix(t('paper'), t('paper-sunk'), 0.5),
        context: t('paper-raised'),
        contextLine: t('ink'),
        contextLineOpacity: 0.16,
        // Warm RCC render, desaturated towards paper (QA B4: about oklch 86% 0.03 75).
        wall: '#e4d8c4',
        roof: t('paper-sunk'),
        glass: '#6f8387',
        floor: '#ece4d6',
        ink: t('ink'),
        outline: t('ink'),
        outlineOpacity: 1,
        hatch: t('ink-3'),
        tree: t('good-soft'),
        pv: '#33414b',
        fin: t('paper-raised'),
        paper: t('paper'),
        plinth: t('paper-raised'),
        warm: t('warm'),
        deep: t('deep'),
        lamp,
        tray: mix(t('ink'), t('paper'), 0.12),
      }
    : {
        ground: t('paper-sunk'),
        road: t('paper'),
        // Tops at --paper-raised (Yoru), walls near #15120F through the vertex shade; never lit (S-B1).
        context: t('paper-raised'),
        contextLine: t('ink-3'),
        contextLineOpacity: 0.45,
        wall: '#4a3e33',
        roof: '#3a3129',
        glass: '#1d2326',
        floor: '#3a322a',
        ink: t('ink'),
        outline: t('ink-3'),
        outlineOpacity: 0.6,
        hatch: t('ink-3'),
        // Dim discs, a step above the night ground (round 4: no white rings).
        tree: '#060705',
        pv: '#1c252c',
        fin: '#2b2520',
        paper: t('paper'),
        // The site board at night sits close to the ground value, so no dark slab under the lantern.
        plinth: '#2b251f',
        warm: t('warm'),
        deep: t('deep'),
        lamp,
        tray: t('paper-sunk'),
      };
}

const DOMINANT_TOKEN = { cooling: 'deep', lighting: 'glow', equipment: 'ember' } as const;

/** Sun and shadow hours domain, hours per day. */
export const HOURS_DOMAIN: [number, number] = [0, 13];

function useBvh(ref: MutableRefObject<Mesh | null>, geometry: BufferGeometry): void {
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    // drei pulls an older three-mesh-bvh whose module augmentation types `boundsTree`.
    (geometry as unknown as { boundsTree: unknown }).boundsTree = new MeshBVH(geometry);
    m.raycast = acceleratedRaycast;
  }, [geometry, ref]);
}

const noRaycast = (): null => null;
/** A neighbour whose height nobody knows: drawn, hatched, never a caster. */
export const isGuess = (m: { source: string; user?: number }): boolean =>
  m.source === 'unknown' && m.user === undefined;
const at = (e: { nativeEvent: { offsetX: number; offsetY: number } }) => ({
  x: e.nativeEvent.offsetX,
  y: e.nativeEvent.offsetY,
});

export function CityScene(p: CitySceneProps) {
  const { model, theme, lens, level, sun } = p;
  const yoru = theme === 'yoru';
  const look = useMemo(() => lookOf(theme), [theme]);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const uniforms = useMemo(createLensUniforms, []);
  useEffect(() => {
    uniforms.uPaper.value = new Color(look.paper);
    uniforms.uPixelRatio.value = dpr;
    invalidate();
  }, [look, uniforms, dpr, invalidate]);

  // ---------------------------------------------------------------- materials
  const mats = useMemo(() => {
    const ghost = (src: MeshStandardMaterial): MeshStandardMaterial => {
      const m = src.clone();
      m.transparent = true;
      m.opacity = 0.22;
      m.depthWrite = false;
      return m;
    };
    const wall = lensMaterial({ vertexColors: true, roughness: 0.92, emissive: new Color(0) }, uniforms, {
      wick: true,
      lantern: 'wall',
    });
    // Walls sit a hair behind their ink outline so storey lines never break into dashes.
    wall.polygonOffset = true;
    wall.polygonOffsetFactor = 1;
    wall.polygonOffsetUnits = 2;
    const roof = lensMaterial({ vertexColors: true, roughness: 0.95, emissive: new Color(0) }, uniforms, {
      grid: true,
      wick: true,
      lantern: 'roof',
    });
    const glass = new MeshStandardMaterial({
      color: look.glass,
      roughness: 0.25,
      metalness: 0.2,
      emissive: new Color(0),
    });
    return {
      ground: lensMaterial({ color: look.ground, roughness: 1 }, uniforms, { grid: true, ground: true }),
      road: new MeshStandardMaterial({ color: look.road, roughness: 1 }),
      context: new MeshStandardMaterial({ color: look.context, roughness: 0.95, vertexColors: true }),
      guess: new MeshStandardMaterial({
        color: mix(look.context, look.ground, 0.35),
        roughness: 1,
        vertexColors: true,
        transparent: true,
        opacity: 0.82,
      }),
      lantern: lensMaterial({ color: '#0a0806', roughness: 0.9, vertexColors: true }, uniforms, {
        vertexEmissive: true,
      }),
      contextLine: yoru
        ? new LineDashedMaterial({
            color: look.contextLine,
            dashSize: 2.2,
            gapSize: 1.6,
            transparent: true,
            opacity: look.contextLineOpacity,
          })
        : new LineBasicMaterial({
            color: look.contextLine,
            transparent: true,
            opacity: look.contextLineOpacity,
          }),
      ghost: lensMaterial(
        { color: look.hatch, transparent: true, opacity: 0.25, depthWrite: false, side: DoubleSide },
        uniforms,
        { hatch: { pitch: 6, duty: 0.2, screen: true } },
      ),
      penumbra: lensMaterial(
        {
          color: look.hatch,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        },
        uniforms,
        { hatch: { pitch: 6, duty: 0.2, screen: true } },
      ),
      tree: new MeshStandardMaterial({ color: look.tree, roughness: 1 }),
      wall,
      roof,
      glass,
      facadeFrame: new MeshStandardMaterial({ color: yoru ? '#3a3229' : look.fin, roughness: 0.95 }),
      facadeShade: new MeshStandardMaterial({
        color: yoru ? '#332c25' : look.plinth,
        roughness: 0.95,
        side: DoubleSide,
      }),
      ghostWall: ghost(wall),
      ghostRoof: ghost(roof),
      ghostGlass: ghost(glass),
      floor: new MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      rooms: new LineBasicMaterial({ color: look.ink, transparent: true, opacity: 0.7 }),
      plinth: new MeshStandardMaterial({ color: look.plinth, roughness: 1, vertexColors: true }),
      pv: new MeshStandardMaterial({ color: look.pv, roughness: 0.35, metalness: 0.4, side: DoubleSide }),
      fin: new MeshStandardMaterial({ color: look.fin, roughness: 0.9, side: DoubleSide }),
    };
  }, [yoru, look, uniforms]);
  useEffect(
    () => () => {
      for (const m of Object.values(mats)) m.dispose();
    },
    [mats],
  );

  // Fat lines need the canvas size for their pixel width.
  const lineMats = useRef(new Set<LineMaterial>());
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const track = useCallback((l: LineSegments2): LineSegments2 => {
    lineMats.current.add(l.material);
    l.material.resolution.set(sizeRef.current.width, sizeRef.current.height);
    return l;
  }, []);
  useEffect(() => {
    for (const m of lineMats.current) m.resolution.set(size.width, size.height);
    invalidate();
  }, [size, invalidate]);

  // ---------------------------------------------------------------- context
  const closingT = useRef(new Map<string, number>());
  // Neighbours whose height is unknown never shade (Agent A, QA round 1): they draw as uncast
  // paper with the hatched penumbra out to their plausible height, never as a solid caster.
  const [knownMasses, guessMasses] = useMemo(() => {
    const k: typeof model.masses = [];
    const g: typeof model.masses = [];
    for (const m of model.masses) (isGuess(m) ? g : k).push(m);
    return [k, g];
  }, [model.masses]);
  const contextGeo = useMemo(() => contextGeometry(knownMasses, drawnHeight), [knownMasses]);
  const guessGeo = useMemo(() => contextGeometry(guessMasses, drawnHeight), [guessMasses]);
  const contextRef = useRef<Mesh>(null);
  const guessRef = useRef<Mesh>(null);
  useBvh(contextRef, contextGeo);
  useBvh(guessRef, guessGeo);
  const lanternIds = useMemo(() => new Map(p.lanterns.map((l) => [l.buildingId, l])), [p.lanterns]);
  const night = yoru;
  const hour = p.time.minutes / 60;
  // The hero is the one fully modelled building: it is always a lantern at night, and the brightest
  // (studio review S-B1). Preview neighbours stay well below it.
  const heroLantern = useMemo<LanternDatum | undefined>(
    () =>
      model.hero
        ? (lanternIds.get(model.hero.id) ?? { buildingId: model.hero.id, euiKwhM2: 168, dominant: 'cooling' })
        : undefined,
    [model.hero, lanternIds],
  );
  const heroK = heroLantern ? Math.max(0.85, lanternStrength(heroLantern, hour)) : 0;
  const lanternMasses = useMemo(
    () => model.masses.filter((m) => lanternIds.has(m.id)),
    [model.masses, lanternIds],
  );
  const cityWide = level === 'city';
  const lanternGeo = useMemo(() => {
    const g = contextGeometry(lanternMasses, (m) => drawnHeight(m) + 0.05);
    const bid = g.getAttribute('aBid');
    const col = new Float32Array(bid.count * 3);
    const lamp = new Color(look.lamp);
    for (let v = 0; v < bid.count; v++) {
      const m = lanternMasses[bid.getX(v)]!;
      const l = lanternIds.get(m.id)!;
      // Neighbours glow well below the hero (S-B1): a dim warm wash, never cream. Over the whole
      // city they lift a little so the lanterns read as a field around the brightest one.
      const k = cityWide
        ? Math.min(lanternStrength(l, hour) * 0.3, heroK * 0.28)
        : Math.min(lanternStrength(l, hour) * 0.08, heroK * 0.05);
      col[v * 3] = lamp.r * k;
      col[v * 3 + 1] = lamp.g * k;
      col[v * 3 + 2] = lamp.b * k;
    }
    g.setAttribute('color', new BufferAttribute(col, 3));
    return g;
  }, [lanternMasses, lanternIds, hour, look.lamp, heroK, cityWide]);
  useEffect(() => () => lanternGeo.dispose(), [lanternGeo]);
  const outlineGeo = useMemo(
    () =>
      outlineGeometry(
        model.masses.flatMap((m) => [
          { ring: m.ring, h: drawnHeight(m) },
          ...m.holes.map((h) => ({ ring: h, h: drawnHeight(m) })),
        ]),
      ),
    [model.masses],
  );
  const outlineRef = useRef<LineSegments>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: new geometry or material needs fresh dash distances
  useLayoutEffect(() => {
    outlineRef.current?.computeLineDistances();
  }, [outlineGeo, mats]);
  // Penumbra only where it matters (studio review S-M1): the 6 to 10 estimated neighbours whose
  // plausible shadow can reach the hero's site (preferring the site stage's unknownHeightIds), plus
  // whatever is selected or hovered. Every other estimated height shows a dashed top edge only, and
  // City level shows no hatch at all.
  const estimated = useMemo(
    () => model.masses.filter((m) => m.user === undefined && m.hi - m.likely > 0.25),
    [model.masses],
  );
  const unknownIds = p.site?.unknownHeightIds;
  const attention = p.attentionIds;
  const relevantIds = useMemo(() => {
    const ids = new Set<string>(attention ?? []);
    const focusId = p.highlight?.contextId;
    if (focusId) ids.add(focusId);
    if (!model.hero || level === 'city') return ids;
    const b = model.hero.box;
    const pref = unknownIds?.length ? new Set(unknownIds) : null;
    const near = estimated
      .map((m) => {
        const { c } = ringCentre(m.ring);
        const dx = Math.max(b.minE - c[0], 0, c[0] - b.maxE);
        const dy = Math.max(b.minN - c[1], 0, c[1] - b.maxN);
        // Shadow length at a 20 degree sun is about 2.75 times the height.
        return { m, d: Math.hypot(dx, dy), reach: m.hi * 2.75 + 20 };
      })
      .filter((x) => x.d < x.reach && (!pref || pref.has(x.m.id) || x.d < 40))
      .sort((a, z) => a.d - z.d)
      .slice(0, 10);
    for (const x of near) ids.add(x.m.id);
    return ids;
  }, [estimated, unknownIds, attention, p.highlight?.contextId, model.hero, level]);
  const ghostGeo = useMemo(
    () =>
      ghostGeometry(
        estimated
          .filter((m) => relevantIds.has(m.id))
          .map((m) => ({ ring: m.ring, from: m.likely, to: m.hi })),
      ),
    [estimated, relevantIds],
  );
  const dashedTops = useMemo(() => {
    const pos: number[] = [];
    for (const m of estimated) {
      if (relevantIds.has(m.id)) continue;
      const h = drawnHeight(m) + 0.05;
      m.ring.forEach((a, i) => {
        const q = m.ring[(i + 1) % m.ring.length]!;
        pos.push(a[0], h, -a[1], q[0], h, -q[1]);
      });
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    return g;
  }, [estimated, relevantIds]);
  useEffect(() => () => dashedTops.dispose(), [dashedTops]);
  const dashedRef = useRef<LineSegments>(null);
  const dashedMat = useMemo(
    () =>
      new LineDashedMaterial({
        color: look.hatch,
        dashSize: 1.4,
        gapSize: 1.2,
        transparent: true,
        opacity: yoru ? 0.45 : 0.55,
      }),
    [look.hatch, yoru],
  );
  useEffect(() => () => dashedMat.dispose(), [dashedMat]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: new geometry needs fresh dash distances
  useLayoutEffect(() => {
    dashedRef.current?.computeLineDistances();
  }, [dashedTops]);
  const roadGeo = useMemo(() => flatGeometry(roadPolys(model.roads), 0.04), [model.roads]);

  // The penumbra: hatched band from the likely to the plausible shadow, closing on user heights.
  const ranges = useMemo(
    () =>
      model.masses
        .filter(
          (m) =>
            m.hi - m.likely > 0.25 &&
            ((m.user === undefined && relevantIds.has(m.id)) || p.closing.has(m.id)),
        )
        .map((m) => ({ id: m.id, ring: m.ring, likely: drawnHeight(m), hi: m.hi })),
    [model.masses, p.closing, relevantIds],
  );
  const penumbraRef = useRef<Mesh>(null);
  const buildPenumbra = (now: number): BufferGeometry => {
    if (!p.penumbra) return new BufferGeometry();
    const rs = ranges.map((r) => {
      if (!p.closing.has(r.id)) return r;
      const t0 = closingT.current.get(r.id) ?? now;
      closingT.current.set(r.id, t0);
      const k = p.reducedMotion ? 1 : Math.min(1, (now - t0) / LEVEL_MOVE_MS);
      return { ...r, hi: r.hi + (r.likely - r.hi) * easeOri(k) };
    });
    return flatGeometry(penumbraPolygons(rs, sun), 0.06);
  };
  const buildPenumbraRef = useRef(buildPenumbra);
  buildPenumbraRef.current = buildPenumbra;
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuilt when its inputs change
  const penumbraGeo = useMemo(
    () => buildPenumbra(performance.now()),
    [ranges, sun, p.penumbra, p.closing, p.reducedMotion],
  );
  useEffect(() => () => penumbraGeo.dispose(), [penumbraGeo]);

  // ---------------------------------------------------------------- trees (instanced, smooth card crowns)
  const treeRef = useRef<InstancedMesh>(null);
  const treeGeo = useMemo(() => new IcosahedronGeometry(1, 3), []);
  useLayoutEffect(() => {
    const m = treeRef.current;
    if (!m) return;
    const o = new Object3D();
    model.trees.forEach((t, i) => {
      o.position.set(t.at[0], Math.max(t.r, t.h - t.r * 0.9), -t.at[1]);
      o.scale.set(t.r, Math.min(t.r * 1.15, t.h * 0.6), t.r);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [model.trees, invalidate]);

  // ---------------------------------------------------------------- hero by storey
  const hero = model.hero;
  const selStorey = hero
    ? (hero.storeys.find((s) => s.id === p.storeyId) ?? hero.storeys.find((s) => !s.belowGrade))
    : undefined;
  const cut = level === 'floor' || level === 'room';
  const drawer = cut && lens === 'daylight' && !!p.daylight;
  const storeyMeshes = useMemo(() => {
    if (!hero) return [];
    return hero.storeys.map((st) => {
      const of = (k: HeroSurface['kind']): HeroSurface[] =>
        hero.surfaces.filter((s) => s.storeyId === st.id && s.kind === k);
      const walls = of('wall');
      const roofs = of('roof');
      const glass = of('window');
      const floors = of('floor');
      const cutY = st.z0 + 1.5;
      const clamp = (ss: HeroSurface[]): HeroSurface[] =>
        ss.map((s) => ({ ...s, tris: s.tris.map((v, i) => (i % 3 === 1 ? Math.min(v, cutY) : v)) }));
      const roomLines: number[] = [];
      for (const r of hero.rooms)
        if (r.storeyId === st.id)
          r.ring.forEach((a, i) => {
            const b = r.ring[(i + 1) % r.ring.length]!;
            roomLines.push(a[0], st.z0 + 0.06, -a[1], b[0], st.z0 + 0.06, -b[1]);
          });
      const lines = new BufferGeometry();
      lines.setAttribute('position', new BufferAttribute(new Float32Array(roomLines), 3));
      const outlinePos = heroOutline(walls).getAttribute('position').array as Float32Array;
      return {
        st,
        walls,
        roofs,
        floors,
        wallGeo: heroGeometry(walls),
        roofGeo: heroGeometry(roofs),
        glassGeo: heroGeometry(glass),
        floorGeo: heroGeometry(floors),
        cutWalls: clamp(walls),
        cutWallGeo: heroGeometry(clamp(walls)),
        cutGlassGeo: heroGeometry(clamp(glass)),
        outlinePos: Array.from(outlinePos),
        roomLines: lines,
      };
    });
  }, [hero]);
  useEffect(
    () => () => {
      for (const s of storeyMeshes)
        for (const g of [
          s.wallGeo,
          s.roofGeo,
          s.glassGeo,
          s.floorGeo,
          s.cutWallGeo,
          s.cutGlassGeo,
          s.roomLines,
        ])
          g.dispose();
    },
    [storeyMeshes],
  );
  // Facade detail from the document: openings, heads, sills, jambs and shading (round 6).
  const facadeBy = useMemo(() => {
    const m = new Map<string, FacadeStorey>();
    if (model.heroDoc) for (const f of facadeOf(model.heroDoc)) m.set(f.storeyId, f);
    return m;
  }, [model.heroDoc]);

  // 1.5 px ink outline per storey (DS 13.1), lantern rim colour at night.
  const outlines = useMemo(
    () =>
      storeyMeshes.map((sm) =>
        track(fatLines(sm.outlinePos, look.outline, 1.5, { opacity: look.outlineOpacity })),
      ),
    [storeyMeshes, look, track],
  );
  useEffect(
    () => () => {
      for (const l of outlines) {
        lineMats.current.delete(l.material);
        l.geometry.dispose();
        l.material.dispose();
      }
    },
    [outlines],
  );

  // The site board (QA B4): a card plinth under the hero with a cut edge and a contact shadow.
  const plinth = useMemo(() => {
    if (!hero) return null;
    const ring = plinthRing(model.heroDoc, hero);
    const geo = contextGeometry(
      [
        {
          id: 'plinth',
          ring,
          holes: [],
          lo: PLINTH_M,
          likely: PLINTH_M,
          hi: PLINTH_M,
          source: 'user',
          sources: [],
        },
      ],
      () => PLINTH_M,
    );
    const edge: number[] = [];
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      edge.push(a[0], PLINTH_M + 0.01, -a[1], b[0], PLINTH_M + 0.01, -b[1]);
    });
    return { geo, edge: track(fatLines(edge, look.hatch, 1, { opacity: 0.8 })) };
  }, [hero, model.heroDoc, look, track]);
  useEffect(
    () => () => {
      plinth?.geo.dispose();
      if (plinth) {
        lineMats.current.delete(plinth.edge.material);
        plinth.edge.geometry.dispose();
        plinth.edge.material.dispose();
      }
    },
    [plinth],
  );

  // Lens paint (vertex colours): radiation and sun hours from the site result, use tints on floors.
  const siteById = useMemo(() => {
    const m = new Map<string, SiteResult['surfaces'][number]>();
    for (const s of p.site?.surfaces ?? []) {
      m.set(s.id, s);
      const k = surfaceKey(s.id);
      if (!m.has(k)) m.set(k, s);
    }
    return m;
  }, [p.site]);
  const [d0, d1] = p.radiationDomain;
  useLayoutEffect(() => {
    const wall = linearOf(look.wall);
    const roof = linearOf(look.roof);
    const floorC = linearOf(look.floor);
    const tint = new Map(Object.entries(USE_TINT).map(([k, v]) => [k, linearOf(v)]));
    const colourOf = (s: HeroSurface): readonly [number, number, number] => {
      const base = s.kind === 'roof' ? roof : s.kind === 'floor' ? floorC : wall;
      if (s.kind === 'floor') {
        const use = hero?.rooms.find((r) => r.id === s.roomId)?.use;
        return theme === 'hiru' && use ? (tint.get(use) ?? base) : base;
      }
      const d = siteById.get(s.id) ?? siteById.get(surfaceKey(s.id)) ?? siteById.get(s.ownerId);
      if (lens === 'radiation' && d) {
        const k = annualKwh(d);
        if (k !== null) return rampLinear('hinata', (k - d0) / Math.max(1, d1 - d0));
      }
      if (lens === 'sun-hours' && d?.sunHours && s.kind === 'wall')
        return rampLinear('hidamari', d.sunHours.annual / 365 / HOURS_DOMAIN[1]);
      return base;
    };
    for (const sm of storeyMeshes) {
      paintHero(sm.wallGeo, sm.walls, colourOf);
      paintHero(sm.cutWallGeo, sm.cutWalls, colourOf);
      paintHero(sm.roofGeo, sm.roofs, colourOf);
      paintHero(sm.floorGeo, sm.floors, colourOf);
    }
    invalidate();
  }, [storeyMeshes, siteById, lens, look, theme, hero, d0, d1, invalidate]);

  // ---------------------------------------------------------------- sun hours grid (ground and roofs)
  const sunGrid = lens === 'sun-hours' || lens === 'shadows' ? p.sunGrid : null;
  const gridSpec = sunGrid?.grid ?? null;
  const gridTex = useMemo(() => (gridSpec ? gridTexture(gridSpec) : null), [gridSpec]);
  useEffect(() => () => gridTex?.dispose(), [gridTex]);
  const shadowH = useMemo(
    () => (sunGrid && lens === 'shadows' ? shadowHours(sunGrid) : null),
    [sunGrid, lens],
  );
  // Roof radiation (round 6): the roof shows where taller neighbours take its sun.
  const roofRad = lens === 'radiation' ? (p.roofRad ?? null) : null;
  const roofTex = useMemo(() => (roofRad ? gridTexture(roofRad.grid) : null), [roofRad]);
  useEffect(() => () => roofTex?.dispose(), [roofTex]);
  useLayoutEffect(() => {
    if (roofRad && roofTex) {
      uniforms.uGrid.value = roofTex;
      const g = roofRad.grid;
      uniforms.uGridBox.value = [g.minE, g.minN, g.cols * g.cell, g.rows * g.cell];
      uniforms.uRamp.value = rampTexture('hinata');
      const v = fillNaN(roofRad.kwh, g.cols, g.rows);
      for (let i = 0; i < v.length; i++) v[i] = Math.min(1, Math.max(0, (v[i]! - d0) / Math.max(1, d1 - d0)));
      writeGrid(roofTex, v, 1);
      uniforms.uGridGround.value = 0;
      uniforms.uGridOn.value = 1;
      invalidate();
      return;
    }
    uniforms.uGridGround.value = 1;
    if (!gridSpec || !gridTex || !sunGrid) {
      uniforms.uGridOn.value = 0;
      invalidate();
      return;
    }
    uniforms.uGrid.value = gridTex;
    uniforms.uGridBox.value = [
      gridSpec.minE,
      gridSpec.minN,
      gridSpec.cols * gridSpec.cell,
      gridSpec.rows * gridSpec.cell,
    ];
    const max = HOURS_DOMAIN[1];
    if (lens === 'shadows' && shadowH) {
      // Kage, read reversed: no shadow is paper, 13 h is ink (QA M10).
      uniforms.uRamp.value = rampTexture('kage');
      const v = new Float32Array(shadowH.length);
      for (let i = 0; i < v.length; i++) v[i] = max - shadowH[i]!;
      writeGrid(gridTex, v, max, sunGrid.covered);
    } else if (p.sweeping) {
      // Hinode, read reversed: no sun yet is paper, and the ground fills towards gold (QA M6).
      uniforms.uRamp.value = rampTexture('hinode');
      const h = sunHoursUpTo(sunGrid, p.gridMinutes);
      for (let i = 0; i < h.length; i++) h[i] = max - h[i]!;
      writeGrid(gridTex, h, max);
    } else {
      uniforms.uRamp.value = rampTexture('hidamari');
      writeGrid(gridTex, sunHoursUpTo(sunGrid, p.gridMinutes), max);
    }
    uniforms.uGridOn.value = 1;
    invalidate();
  }, [
    gridSpec,
    gridTex,
    sunGrid,
    shadowH,
    lens,
    p.gridMinutes,
    p.sweeping,
    uniforms,
    invalidate,
    roofRad,
    roofTex,
    d0,
    d1,
  ]);

  // ---------------------------------------------------------------- sun path (moment 1)
  const sunPath = useMemo(() => {
    if (!p.sweeping || !hero) return null;
    const w = dayWindow(p.time.date, model.place.lat, model.place.lon, model.place.tzHours);
    const dirs: [number, number, number][] = [];
    for (let m = w.rise; m <= w.set; m += 10)
      dirs.push(
        sunOf({ date: p.time.date, minutes: m }, model.place.lat, model.place.lon, model.place.tzHours).dir,
      );
    const c = ringCentre(hero.prisms.flatMap((x) => x.ring));
    const r = Math.max(60, p.view.halfH * 0.8);
    return {
      line: track(
        fatLines(sunPathSegments(dirs, [c.c[0], 0, -c.c[1]], r), token('ember', 'hiru'), 1.5, {
          opacity: 0.5,
        }),
      ),
      centre: [c.c[0], 0, -c.c[1]] as [number, number, number],
      r,
    };
  }, [p.sweeping, p.time.date, hero, model.place, p.view.halfH, track]);
  useEffect(
    () => () => {
      if (sunPath) {
        lineMats.current.delete(sunPath.line.material);
        sunPath.line.geometry.dispose();
        sunPath.line.material.dispose();
      }
    },
    [sunPath],
  );
  const sunDisc = useMemo(() => haloMaterial(token('glow', 'hiru'), 3), []);

  // ---------------------------------------------------------------- wick (moment 3)
  const wick = useRef<{ start: number; on: boolean }>({ start: 0, on: false });
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new site result replays the wick
  useEffect(() => {
    if (lens === 'radiation' && hero && !p.reducedMotion) {
      wick.current = { start: performance.now(), on: true };
      uniforms.uWick.value = -1;
    } else {
      wick.current.on = false;
      uniforms.uWick.value = 1e6;
    }
    invalidate();
  }, [lens, hero, p.reducedMotion, p.site, uniforms, invalidate]);

  // ---------------------------------------------------------------- daylight drawer (moment 4)
  const dayGrid = useMemo(
    () => (drawer && selStorey ? (p.daylight?.find((g) => g.storeyId === selStorey.id) ?? null) : null),
    [drawer, selStorey, p.daylight],
  );
  const dayMesh = useMemo(
    () =>
      dayGrid && model.heroDoc && selStorey
        ? daylightMesh(
            dayGrid,
            model.heroDoc,
            selStorey.z0 + PLINTH_M + (dayGrid.workPlaneMm ?? 850) / 1000,
            {
              tray: look.tray,
              dot: look.paper,
              warm: look.warm,
              line: token('glow', 'yoru'),
            },
          )
        : null,
    [dayGrid, model.heroDoc, selStorey, look],
  );
  useEffect(() => () => dayMesh?.dispose(), [dayMesh]);
  const drawerOffset = useMemo<[number, number, number]>(() => {
    if (!hero) return [0, 0, 0];
    // Slide towards free space (studio review S-M2): try screen left, right, down and up, and take
    // the side whose landing box holds the fewest neighbours (left wins a tie, away from the legend).
    const az = (p.view.azimuthDeg * Math.PI) / 180;
    const b = hero.box;
    const span = Math.max(b.maxE - b.minE, b.maxN - b.minN);
    const d = span * 0.62 + 10;
    // World xz directions: camera left, right, towards the viewer, away from it.
    const dirs: [number, number][] = [
      [Math.cos(az), Math.sin(az)],
      [-Math.cos(az), -Math.sin(az)],
      [Math.sin(az), -Math.cos(az)],
      [-Math.sin(az), Math.cos(az)],
    ];
    let best = dirs[0]!;
    let bestN = Infinity;
    for (const [x, z] of dirs) {
      const dE = x * d;
      const dN = -z * d;
      let n = 0;
      for (const m of model.masses) {
        const { c } = ringCentre(m.ring);
        if (
          c[0] > b.minE + dE - 5 &&
          c[0] < b.maxE + dE + 5 &&
          c[1] > b.minN + dN - 5 &&
          c[1] < b.maxN + dN + 5
        )
          n++;
      }
      if (n < bestN) {
        bestN = n;
        best = [x, z];
      }
    }
    return [best[0] * d, 0, best[1] * d];
  }, [hero, p.view.azimuthDeg, model.masses]);
  // While the drawer is open the city steps back to 30% so the drawer never draws over it (S-M2).
  useEffect(() => {
    for (const m of [mats.context, mats.guess, mats.tree]) {
      m.transparent = drawer || m === mats.guess;
      m.opacity = drawer ? 0.3 : m === mats.guess ? 0.82 : 1;
      m.depthWrite = !drawer;
      m.needsUpdate = true;
    }
    invalidate();
  }, [drawer, mats, invalidate]);
  const drawerRef = useRef<Object3D>(null);
  const drawerAnim = useRef({ from: 0, to: 0, start: 0 });
  const drawerShift = useRef<[number, number]>([0, 0]);
  const [drawerOut, setDrawerOut] = useState(false);
  useEffect(() => {
    drawerAnim.current = { from: 0, to: drawer ? 1 : 0, start: performance.now() };
    setDrawerOut(drawer && p.reducedMotion);
    invalidate();
  }, [drawer, p.reducedMotion, invalidate]);

  // ---------------------------------------------------------------- phototropic (moment 6)
  const photo = useMemo(() => {
    if (!p.phototropic || !hero || !model.heroDoc) return null;
    const g = phototropicGeometry(model.heroDoc, hero, p.phototropic);
    const mk = (tris: number[]): BufferGeometry => {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(tris), 3));
      geo.computeVertexNormals();
      return geo;
    };
    return { canopy: mk(g.canopy), fins: mk(g.fins) };
  }, [p.phototropic, hero, model.heroDoc]);
  useEffect(
    () => () => {
      photo?.canopy.dispose();
      photo?.fins.dispose();
    },
    [photo],
  );

  // ---------------------------------------------------------------- lanterns (moment 8)
  useEffect(() => {
    const k = heroK;
    const lamp = new Color(look.lamp);
    const glow = new Color(token('glow', 'yoru'));
    // Window light is lamplight graded by the hourly load; the body takes a warm bounce (QA B1).
    // The hero is the lantern of the scene (round 3): paper walls lit from within and a lit window
    // grid per storey (materials.ts `lantern`), drawn in lamplight warmed toward --glow.
    mats.glass.emissive = night && heroLantern ? lamp.clone().multiplyScalar(1.4 + 1.2 * k) : new Color(0);
    mats.wall.emissive = new Color(0);
    mats.roof.emissive = new Color(0);
    const lit = night && !!heroLantern && !!hero;
    uniforms.uNight.value = lit ? 1 : 0;
    uniforms.uLamp.value = lamp.clone().lerp(glow, 0.25);
    uniforms.uLampK.value = 0.7 + 0.5 * k;
    const first = hero?.storeys.find((st) => !st.belowGrade);
    uniforms.uFloorH.value = first ? Math.max(2.6, first.z1 - first.z0) : 3.9;
    uniforms.uBase.value = PLINTH_M + (first?.z0 ?? 0);
    invalidate();
  }, [mats, heroLantern, heroK, night, look.lamp, hero, uniforms, invalidate]);
  const pools = useMemo(() => {
    if (!night) return [];
    const out: { key: string; c: EN; span: number; h: number; colour: string; k: number }[] = [];
    const list =
      heroLantern && !lanternIds.has(heroLantern.buildingId) ? [heroLantern, ...p.lanterns] : p.lanterns;
    for (const l of list) {
      // Warm lamplight by default with only a quarter of the end use hue (round 4: no teal wash).
      const colour = mix(look.lamp, token(DOMINANT_TOKEN[l.dominant], 'yoru'), 0.25);
      if (hero && l.buildingId === hero.id) {
        const { c, span } = ringCentre(hero.prisms.flatMap((x) => x.ring));
        // The hero's halo never shrinks below a readable size, so it marks the building at City level.
        out.push({
          key: l.buildingId,
          c,
          span: Math.max(span, p.view.halfH * 0.18),
          h: hero.height,
          colour,
          k: heroK * 0.9,
        });
        continue;
      }
      const k = Math.min(lanternStrength(l, hour), heroK) * 0.22;
      const m = model.masses.find((x) => x.id === l.buildingId);
      if (m) {
        const { c, span } = ringCentre(m.ring);
        out.push({ key: l.buildingId, c, span, h: drawnHeight(m), colour, k });
      }
    }
    return out.map((o) => ({
      ...o,
      pool: poolMaterial(o.colour, o.k),
      halo: haloMaterial(look.lamp, o.k),
      // A wide second halo on the hero alone: the soft bloom of the scene's one true lantern.
      bloom: hero && o.key === hero.id ? haloMaterial(look.lamp, 1.1) : null,
    }));
  }, [night, p.lanterns, hour, hero, model.masses, look.lamp, heroLantern, heroK, lanternIds, p.view.halfH]);
  useEffect(
    () => () => {
      for (const o of pools) {
        o.pool.dispose();
        o.halo.dispose();
        o.bloom?.dispose();
      }
    },
    [pools],
  );
  const circle = useMemo(() => new CircleGeometry(0.5, 48), []);

  // ---------------------------------------------------------------- find (focus highlight)
  const hl = p.highlight ?? null;
  useEffect(() => {
    // Dim the rest: context 45% towards the ground, lines at half strength (QA M3).
    const base = new Color(look.context);
    mats.context.color = hl ? base.clone().lerp(new Color(look.ground), 0.45) : base;
    const gb = new Color(mix(look.context, look.ground, 0.35));
    mats.guess.color = hl ? gb.lerp(new Color(look.ground), 0.45) : gb;
    (mats.contextLine as LineBasicMaterial).opacity = look.contextLineOpacity * (hl ? 0.5 : 1);
    mats.tree.color = hl ? new Color(look.tree).lerp(new Color(look.ground), 0.45) : new Color(look.tree);
    invalidate();
  }, [hl, mats, look, invalidate]);
  const hlLines = useMemo(() => {
    if (!hl) return null;
    const focusColour = yoru ? token('glow', 'yoru') : look.deep;
    let pos: number[] = [];
    if (hl.bboxMm && !hl.contextId) {
      const b = hl.bboxMm;
      const r: EN[] = [
        [b.minX / 1000, b.minY / 1000],
        [b.maxX / 1000, b.minY / 1000],
        [b.maxX / 1000, b.maxY / 1000],
        [b.minX / 1000, b.maxY / 1000],
      ];
      r.forEach((a, i) => {
        const q = r[(i + 1) % 4]!;
        pos.push(a[0], 0.3, -a[1], q[0], 0.3, -q[1]);
      });
    } else if (hl.contextId) {
      const m = model.masses.find((x) => x.id === hl.contextId);
      if (!m) return null;
      pos = Array.from(
        outlineGeometry([{ ring: m.ring, h: drawnHeight(m) + 0.05 }]).getAttribute('position').array,
      );
    } else if (hero) {
      const rooms = hl.roomId
        ? hero.rooms.filter((r) => r.id === hl.roomId)
        : hl.storeyId
          ? hero.rooms.filter((r) => r.storeyId === hl.storeyId)
          : [];
      for (const r of rooms) {
        // A 0.15 m band at the cut for a storey; the room outline up to the cut for a room.
        const y = r.z0 + PLINTH_M + (hl.roomId ? 0.1 : 1.5);
        r.ring.forEach((a, i) => {
          const b = r.ring[(i + 1) % r.ring.length]!;
          pos.push(a[0], y, -a[1], b[0], y, -b[1]);
          if (hl.roomId) pos.push(a[0], r.z0 + PLINTH_M + 0.1, -a[1], a[0], r.z0 + PLINTH_M + 1.5, -a[1]);
        });
      }
      if (!pos.length) return null;
    } else return null;
    return track(fatLines(pos, focusColour, 2.5, { depthTest: true }));
  }, [hl, model.masses, hero, yoru, look, track]);
  useEffect(
    () => () => {
      if (hlLines) {
        lineMats.current.delete(hlLines.material);
        hlLines.geometry.dispose();
        hlLines.material.dispose();
      }
    },
    [hlLines],
  );
  const hlFill = useMemo(() => {
    if (!hl?.roomId || !hero) return null;
    const r = hero.rooms.find((x) => x.id === hl.roomId);
    return r ? flatGeometry([r.ring], r.z0 + PLINTH_M + 0.07) : null;
  }, [hl, hero]);
  const hlFillMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: yoru ? '#3a2c18' : look.deep,
        emissive: yoru ? new Color(token('glow', 'yoru')).multiplyScalar(0.5) : new Color(0),
        transparent: true,
        opacity: yoru ? 0.8 : 0.14,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [yoru, look.deep],
  );
  useEffect(() => () => hlFillMat.dispose(), [hlFillMat]);

  // ---------------------------------------------------------------- sun and night light
  const sunRef = useRef<DirectionalLight>(null);
  const sunTarget = useMemo(() => new Object3D(), []);
  useEffect(() => {
    scene.add(sunTarget);
    return () => {
      scene.remove(sunTarget);
    };
  }, [scene, sunTarget]);
  const shadowOn = p.settings.shadows && sun.up && !yoru;
  const mapSize = p.settings.dpr >= 2 ? 4096 : p.settings.dpr > 1 ? 2048 : 1536;
  useLayoutEffect(() => {
    const l = sunRef.current;
    if (!l) return;
    const [tE, tH, tN] = p.view.target;
    sunTarget.position.set(tE, tH, -tN);
    sunTarget.updateMatrixWorld();
    l.target = sunTarget;
    // At night a low cool moon from the south west separates faces by value.
    const d = !yoru && sun.up ? sun.dir : ([-0.45, 0.6, 0.55] as [number, number, number]);
    l.position.set(tE + d[0] * 1500, tH + d[1] * 1500, -tN + d[2] * 1500);
    const half = Math.min(1300, p.view.halfH * 2.3);
    const cam = l.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 4000;
    cam.updateProjectionMatrix();
    // City scale texels are large: a normal offset of about two texels keeps walls free of acne.
    l.shadow.bias = -0.0008;
    l.shadow.normalBias = Math.max(0.1, (2 * half) / mapSize) * 1.5;
    l.shadow.needsUpdate = true;
    invalidate();
  }, [sun, yoru, p.view.target, p.view.halfH, sunTarget, mapSize, invalidate]);
  const lift = sun.up ? Math.min(1, sun.altitudeDeg / 12) : 0;
  const sunIntensity = yoru ? 0.35 : 0.25 + 2.6 * lift;
  const sunColour = useMemo(() => {
    if (yoru) return new Color('#8a9cc4');
    const warmth = 1 - lift;
    return new Color().setRGB(1, 0.93 - 0.18 * warmth, 0.84 - 0.34 * warmth);
  }, [lift, yoru]);

  // ---------------------------------------------------------------- camera rig and frame loop
  const anim = useRef<{ from: CityView; to: CityView; start: number } | null>(null);
  const current = useRef<CityView>(p.view);
  useEffect(() => {
    if (p.reducedMotion || p.view.instant) {
      current.current = p.view;
      anim.current = null;
    } else anim.current = { from: current.current, to: p.view, start: performance.now() };
    invalidate();
  }, [p.view, p.reducedMotion, invalidate]);
  const safeRef = useRef(p.safe);
  useEffect(() => {
    safeRef.current = p.safe;
    invalidate();
  }, [p.safe, invalidate]);

  // Cutaway: on entering a floor or room the floors above lift 16 m (`--t-ori`) and stay as faint
  // paper sheets, so the person sees where the floor came from (QA M2).
  const selIndex = selStorey ? (hero?.storeys.indexOf(selStorey) ?? 0) : 0;
  const liftKey = cut && !drawer ? `${selStorey?.id ?? ''}` : '';
  const liftStart = useRef(0);
  const liftRefs = useRef(new Map<string, Object3D>());
  useEffect(() => {
    if (liftKey) liftStart.current = performance.now();
    invalidate();
  }, [liftKey, invalidate]);
  const frames = useRef(0);
  useFrame(() => {
    const now = performance.now();
    let moving = false;
    if (anim.current) {
      const k = (now - anim.current.start) / LEVEL_MOVE_MS;
      current.current = blendView(anim.current.from, anim.current.to, easeOri(Math.min(1, k)));
      if (k >= 1) anim.current = null;
      else moving = true;
    }
    // Wick: ten sky patch batches of 160 ms (`--t-wick`).
    if (wick.current.on && hero) {
      const k = (now - wick.current.start) / 1600;
      uniforms.uWick.value = -1 + k * (hero.height + 3);
      if (k >= 1) {
        wick.current.on = false;
        uniforms.uWick.value = 1e6;
      } else moving = true;
    }
    // Drawer: `--t-drawer` 700 ms; the camera follows half the slide so both fit.
    const dr = drawerRef.current;
    if (dr && drawer) {
      const a = drawerAnim.current;
      const k = p.reducedMotion ? 1 : Math.min(1, (now - a.start) / 700);
      const v = a.from + (a.to - a.from) * easeOri(k);
      dr.position.set(drawerOffset[0] * v, 0, drawerOffset[2] * v);
      drawerShift.current = [drawerOffset[0] * v * 0.5, drawerOffset[2] * v * 0.5];
      if (k < 1) moving = true;
      else if (!drawerOut) setDrawerOut(true);
    } else drawerShift.current = [0, 0];
    applyView(camera, current.current, size, safeRef.current, drawerShift.current);
    // Floors above lift away.
    if (liftKey && liftRefs.current.size) {
      const k = p.reducedMotion ? 1 : Math.min(1, (now - liftStart.current) / LEVEL_MOVE_MS);
      for (const o of liftRefs.current.values()) o.position.y = 16 * easeOri(k);
      if (k < 1) moving = true;
    }
    // Penumbra crease.
    if (p.closing.size && !p.reducedMotion && penumbraRef.current) {
      let creasing = false;
      for (const [, t0] of closingT.current) if (now - t0 < LEVEL_MOVE_MS + 50) creasing = true;
      if (creasing) {
        const old = penumbraRef.current.geometry;
        penumbraRef.current.geometry = buildPenumbraRef.current(now);
        if (old !== penumbraGeo) old.dispose();
        moving = true;
      }
    }
    if (moving) {
      invalidate();
      report([]);
    } else placeRef.current();
  });
  // Paper model bake (QA M1): AO and ink edges on the resting frame, tier 1 and up.
  const bake = useMemo(
    () =>
      p.settings.ao || p.settings.shadows
        ? paperBake(gl, scene, camera, { ink: yoru ? '#070605' : look.ink, night: yoru, far: 6000 })
        : null,
    [gl, scene, camera, look.ink, yoru, p.settings.ao, p.settings.shadows],
  );
  useEffect(() => () => bake?.dispose(), [bake]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a DPR change resizes the drawing buffer
  useEffect(() => {
    bake?.setSize(size.width, size.height);
  }, [bake, size.width, size.height, dpr]);
  const bakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bakeNow = useRef(false);
  const baked = useRef(false);
  useEffect(
    () => () => {
      if (bakeTimer.current) clearTimeout(bakeTimer.current);
    },
    [],
  );
  useFrame(() => {
    if (bake && bakeNow.current) {
      bakeNow.current = false;
      gl.info.reset();
      bake.render();
      baked.current = true;
    } else {
      gl.render(scene, camera);
      baked.current = false;
      if (bake) {
        // Bake once the city has rested for 350 ms (still life).
        if (bakeTimer.current) clearTimeout(bakeTimer.current);
        bakeTimer.current = setTimeout(() => {
          bakeNow.current = true;
          invalidate();
        }, 350);
      }
    }
    frames.current++;
    if (p.stats) {
      const info = gl.info.render;
      p.stats.current = {
        phase: anim.current || wick.current.on || (bake && !baked.current) ? 'moving' : 'resting',
        frames: frames.current,
        calls: info.calls,
        triangles: info.triangles,
        tier: p.settings.dpr,
      };
    }
  }, 1);

  // ---------------------------------------------------------------- picking
  const massAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const guess = e.object === guessRef.current;
    const v = e.face?.a;
    const bid = v === undefined ? undefined : (guess ? guessGeo : contextGeo).getAttribute('aBid')?.getX(v);
    return bid === undefined ? undefined : (guess ? guessMasses : knownMasses)[bid];
  };
  const hoverContext = (e: ThreeEvent<PointerEvent>): void => {
    e.stopPropagation();
    const m = massAt(e);
    p.onHover(m ? { kind: 'context', id: m.id } : null, at(e));
  };
  const pickContext = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    const m = massAt(e);
    if (m) p.onPick({ kind: 'context', id: m.id }, at(e));
  };
  const heroTarget = (
    surfaces: HeroSurface[],
    geo: BufferGeometry,
    face: number | undefined,
  ): CityTarget | null => {
    if (face === undefined || !hero) return null;
    const s = surfaces[geo.getAttribute('aSurf')!.getX(face)];
    return s
      ? { kind: 'hero', buildingId: hero.id, roomId: s.roomId, surfaceId: s.id, storeyId: s.storeyId }
      : null;
  };
  const pickGround = (e: ThreeEvent<MouseEvent>): void => {
    if (level === 'city' || level === 'site')
      p.onPick({ kind: 'ground', east: e.point.x, north: -e.point.z }, at(e));
  };

  // Room labels at Floor level (QA M2, studio review B-M5): one label rule, function first then
  // the room's own name; a label shows only when it fits inside its room on screen (else it
  // collapses to the function, else it hides), rooms under 40 px are skipped, and overlapping
  // labels are culled, biggest room first.
  const candidates = useMemo(() => {
    if (!hero || !cut || !selStorey || drawer) return [];
    return hero.rooms
      .filter((r) => r.storeyId === selStorey.id && (level !== 'room' || r.id === p.roomId))
      .map((r) => {
        const fn = USE_LABEL[r.use ?? ''] ?? 'Room';
        const name = r.name && r.name.toLowerCase() !== fn.toLowerCase() ? r.name : undefined;
        return { r, fn, name, area: Math.abs(ringArea(r.ring)), c: ringCentre(r.ring).c };
      })
      .sort((a, b) => b.area - a.area);
  }, [hero, cut, selStorey, drawer, level, p.roomId]);
  const labelKey = useRef('');
  const locatorAt = level === 'city' && hero ? ringCentre(hero.prisms.flatMap((x) => x.ring)) : null;
  const report = (items: SceneOverlayItem[]): void => {
    const key = items
      .map((o) => `${o.key}:${Math.round(o.x)},${Math.round(o.y)}${o.full ? '+' : ''}`)
      .join(';');
    if (key === labelKey.current) return;
    labelKey.current = key;
    p.onOverlay?.(items);
  };
  const placeLabels = (): void => {
    camera.updateMatrixWorld();
    const W = size.width;
    const H = size.height;
    const v = new Vector3();
    const taken: [number, number, number, number][] = [];
    const out: SceneOverlayItem[] = [];
    if (locatorAt && hero) {
      v.set(locatorAt.c[0], hero.height + PLINTH_M, -locatorAt.c[1]).project(camera);
      out.push({
        key: 'locator',
        kind: 'locator',
        x: ((v.x + 1) / 2) * W,
        y: ((1 - v.y) / 2) * H,
        title: hero.name,
      });
    }
    for (const c of candidates) {
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const [e, n] of c.r.ring) {
        v.set(e, c.r.z0 + PLINTH_M, -n).project(camera);
        const px = ((v.x + 1) / 2) * W;
        const py = ((1 - v.y) / 2) * H;
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
      const w = (x1 - x0) * 0.8;
      const h = (y1 - y0) * 0.8;
      if (Math.min(w, h) < 40 && level !== 'room') continue;
      const long = Math.max(c.fn.length, c.name?.length ?? 0, 7);
      const fullW = long * 6.6 + 14;
      const shortW = c.fn.length * 6.6 + 14;
      const full = fullW <= w && (c.name ? 44 : 32) <= h;
      const fits = full || (shortW <= w && 20 <= h);
      if (!fits) continue;
      v.set(c.c[0], c.r.z0 + PLINTH_M + 1.6, -c.c[1]).project(camera);
      const cx = ((v.x + 1) / 2) * W;
      const cy = ((1 - v.y) / 2) * H;
      const lw = (full ? fullW : shortW) / 2;
      const lh = (full ? (c.name ? 44 : 32) : 20) / 2;
      const box: [number, number, number, number] = [cx - lw, cy - lh, cx + lw, cy + lh];
      if (taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1])) continue;
      taken.push(box);
      out.push({
        key: c.r.id,
        kind: 'room',
        x: cx,
        y: cy,
        full,
        title: c.fn,
        ...(c.name ? { sub: c.name } : {}),
        area: Math.round(c.area),
      });
      if (out.length >= 40) break;
    }
    report(out);
  };
  const placeRef = useRef(placeLabels);
  placeRef.current = placeLabels;

  // ---------------------------------------------------------------- placing (SPEC 27)
  const pivot = useMemo<EN>(() => (hero ? ringCentre(hero.prisms.flatMap((x) => x.ring)).c : [0, 0]), [hero]);
  const placeOuter = useRef<Object3D>(null);
  const placeInner = useRef<Object3D>(null);
  const groundM = p.groundM ?? 0;
  const resetPlace = useCallback(() => {
    placeOuter.current?.position.set(pivot[0], groundM, -pivot[1]);
    placeOuter.current?.rotation.set(0, 0, 0);
    placeInner.current?.position.set(-pivot[0], 0, pivot[1]);
    invalidate();
  }, [pivot, groundM, invalidate]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new hero (after a drop) resets the drag transform
  useLayoutEffect(() => resetPlace(), [resetPlace, hero]);
  const dragRef = useRef<{ mode: 'move' | 'turn'; start: EN; a0: number; move: EN; turn: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);
  const groundAt = (e: ThreeEvent<PointerEvent>): EN | null => {
    const r = e.ray;
    if (Math.abs(r.direction.y) < 1e-6) return null;
    const t = (groundM - r.origin.y) / r.direction.y;
    return [r.origin.x + r.direction.x * t, -(r.origin.z + r.direction.z * t)];
  };
  const startDrag =
    (mode: 'move' | 'turn') =>
    (e: ThreeEvent<PointerEvent>): void => {
      if (!p.placeMode || e.button !== 0) return;
      e.stopPropagation();
      const g = groundAt(e);
      if (!g) return;
      (e.nativeEvent.target as Element | null)?.setPointerCapture?.(e.pointerId);
      dragRef.current = {
        mode,
        start: g,
        a0: Math.atan2(g[0] - pivot[0], g[1] - pivot[1]),
        move: [0, 0],
        turn: 0,
      };
      setDragging(true);
      p.onPlaceDrag?.(true);
    };
  const onDragMove = (e: ThreeEvent<PointerEvent>): void => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    const g = groundAt(e);
    if (!g) return;
    if (d.mode === 'move') {
      d.move = [Math.round((g[0] - d.start[0]) * 2) / 2, Math.round((g[1] - d.start[1]) * 2) / 2];
      placeOuter.current?.position.set(pivot[0] + d.move[0], groundM, -(pivot[1] + d.move[1]));
    } else {
      const a = Math.atan2(g[0] - pivot[0], g[1] - pivot[1]);
      d.turn = Math.round(((a - d.a0) * 180) / Math.PI);
      // A clockwise bearing turn is a negative turn about world +y.
      placeOuter.current?.rotation.set(0, (-d.turn * Math.PI) / 180, 0);
    }
    invalidate();
  };
  const endDrag = (e: ThreeEvent<PointerEvent>): void => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    dragRef.current = null;
    setDragging(false);
    p.onPlaceDrag?.(false);
    if (d.move[0] !== 0 || d.move[1] !== 0 || d.turn !== 0) p.onPlaceDrop?.(d.move, d.turn);
    else resetPlace();
  };
  const handleR = hero ? ringCentre(hero.prisms.flatMap((x) => x.ring)).span * 0.62 + 10 : 0;
  const handleMat = useMemo(
    () => new MeshStandardMaterial({ color: look.deep, emissive: new Color(look.deep).multiplyScalar(0.3) }),
    [look.deep],
  );
  useEffect(() => () => handleMat.dispose(), [handleMat]);
  const catcherMat = useMemo(
    () => new MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  useEffect(() => () => catcherMat.dispose(), [catcherMat]);
  // Site check lines: overlaps warm, shading neighbours in the focus colour (dashed).
  const checkLines = useMemo(() => {
    const c = p.siteCheck;
    if (!c || (!c.overlaps.length && !c.shading.length)) return null;
    const ring = (ids: Iterable<string>): number[] => {
      const pos: number[] = [];
      for (const id of ids) {
        const m = model.masses.find((x) => x.id === id);
        if (!m) continue;
        pos.push(
          ...(outlineGeometry([{ ring: m.ring, h: drawnHeight(m) + 0.1 }]).getAttribute('position')
            .array as Float32Array),
        );
      }
      return pos;
    };
    const warm = ring(c.overlaps);
    const shade = ring(c.shading.map((x) => x.id));
    return {
      warm: warm.length ? track(fatLines(warm, look.warm, 2.5)) : null,
      shade: shade.length ? track(fatLines(shade, look.deep, 1.5, { dashed: true, opacity: 0.9 })) : null,
    };
  }, [p.siteCheck, model.masses, look.warm, look.deep, track]);
  useEffect(
    () => () => {
      for (const l of [checkLines?.warm, checkLines?.shade]) {
        if (!l) continue;
        lineMats.current.delete(l.material);
        l.geometry.dispose();
        l.material.dispose();
      }
    },
    [checkLines],
  );

  // ---------------------------------------------------------------- moment 7: the shadow you cast
  const added = p.addedFloorsM ?? 0;
  const topSm = useMemo(
    () => [...storeyMeshes].reverse().find((sm) => !sm.st.belowGrade) ?? null,
    [storeyMeshes],
  );
  const ghostLevels =
    topSm && added > 0 ? Math.max(1, Math.round(added / Math.max(2.6, topSm.st.z1 - topSm.st.z0))) : 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `track` reads the current size only
  const ghostLines = useMemo(() => {
    if (!topSm || !ghostLevels) return null;
    const f2f = added / ghostLevels;
    const pos: number[] = [];
    for (let j = 1; j <= ghostLevels; j++)
      for (let i = 0; i < topSm.outlinePos.length; i += 3)
        pos.push(topSm.outlinePos[i]!, topSm.outlinePos[i + 1]! + f2f * j, topSm.outlinePos[i + 2]!);
    return track(fatLines(pos, look.ink, 1.2, { dashed: true, opacity: 0.85 }));
  }, [topSm, ghostLevels, added, look.ink]);
  useEffect(
    () => () => {
      if (ghostLines) {
        lineMats.current.delete(ghostLines.material);
        ghostLines.geometry.dispose();
        ghostLines.material.dispose();
      }
    },
    [ghostLines],
  );
  const loserMasses = useMemo(
    () => model.masses.filter((m) => (p.castLosers ?? []).includes(m.id)),
    [model.masses, p.castLosers],
  );
  const flashGeo = useMemo(
    () => (loserMasses.length ? contextGeometry(loserMasses, (m) => drawnHeight(m) + 0.08) : null),
    [loserMasses],
  );
  useEffect(() => () => flashGeo?.dispose(), [flashGeo]);
  // Kotai warm (losing sun), flashing for 700 ms then settling to a faint wash.
  const flashMat = useMemo(
    () => new MeshBasicMaterial({ color: '#D7644D', transparent: true, opacity: 0.85, depthWrite: false }),
    [],
  );
  useEffect(() => () => flashMat.dispose(), [flashMat]);
  const flashStart = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new set of losers replays the flash
  useEffect(() => {
    flashStart.current = performance.now();
    flashMat.opacity = p.reducedMotion ? 0.3 : 0.85;
    invalidate();
  }, [flashGeo, flashMat, p.reducedMotion, invalidate]);
  useFrame(() => {
    if (!flashGeo || p.reducedMotion) return;
    const k = (performance.now() - flashStart.current) / 700;
    if (k <= 1) {
      flashMat.opacity = 0.85 - 0.55 * easeOri(Math.min(1, k));
      invalidate();
    }
  });

  // ---------------------------------------------------------------- compare emphasis
  // biome-ignore lint/correctness/useExhaustiveDependencies: `track` reads the current size only
  const emphasisLines = useMemo(() => {
    const em = p.emphasis;
    if (!em?.bins.length || !hero) return null;
    const walls = hero.surfaces.filter(
      (s) => s.kind === 'wall' && em.bins.includes(facadeBin(Math.round(s.bearingDeg * 1000))),
    );
    if (!walls.length) return null;
    const pos = Array.from(heroOutline(walls).getAttribute('position').array as Float32Array);
    return track(fatLines(pos, em.tone === 'more' ? '#D7644D' : '#306C45', 2.5));
  }, [p.emphasis, hero]);
  useEffect(
    () => () => {
      if (emphasisLines) {
        lineMats.current.delete(emphasisLines.material);
        emphasisLines.geometry.dispose();
        emphasisLines.material.dispose();
      }
    },
    [emphasisLines],
  );

  // ---------------------------------------------------------------- moment 3: the radiation rose
  // biome-ignore lint/correctness/useExhaustiveDependencies: `track` reads the current size only
  const rose = useMemo(() => {
    if (lens !== 'radiation' || !hero || !p.site) return null;
    const bins = new Array<number>(16).fill(0);
    const area = new Array<number>(16).fill(0);
    for (const s of hero.surfaces) {
      if (s.kind !== 'wall') continue;
      const d = siteById.get(s.id) ?? siteById.get(surfaceKey(s.id));
      const k = d ? annualKwh(d) : null;
      if (k === null) continue;
      const b = Math.round(s.bearingDeg / 22.5) % 16;
      bins[b]! += k * s.area;
      area[b]! += s.area;
    }
    const v = bins.map((x, i) => (area[i] ? x / area[i]! : 0));
    const max = Math.max(...v);
    if (!max) return null;
    const { c, span } = ringCentre(hero.prisms.flatMap((x) => x.ring));
    const R = Math.max(10, span * 0.22);
    const pos: number[] = [];
    const col: number[] = [];
    const edge: number[] = [];
    const y = hero.height + 2.5;
    v.forEach((val, i) => {
      if (!val) return;
      const r = (R * val) / max;
      const a0 = ((i - 0.42) * 22.5 * Math.PI) / 180;
      const a1 = ((i + 0.42) * 22.5 * Math.PI) / 180;
      const P = (a: number, rr: number): number[] => [c[0] + Math.sin(a) * rr, y, -(c[1] + Math.cos(a) * rr)];
      const cc = rampLinear('hinata', (val - d0) / Math.max(1, d1 - d0));
      const tri = [...P(0, 0), ...P(a0, r), ...P(a1, r)];
      pos.push(...tri);
      for (let k = 0; k < 3; k++) col.push(cc[0], cc[1], cc[2]);
      edge.push(...P(0, 0), ...P(a0, r), ...P(a0, r), ...P(a1, r), ...P(a1, r), ...P(0, 0));
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
    return {
      g,
      lines: track(fatLines(edge, look.ink, 1, { opacity: 0.8 })),
      centre: [c[0], y, -c[1]] as [number, number, number],
    };
  }, [lens, hero, p.site, siteById, d0, d1, look.ink]);
  useEffect(
    () => () => {
      if (rose) {
        rose.g.dispose();
        lineMats.current.delete(rose.lines.material);
        rose.lines.geometry.dispose();
        rose.lines.material.dispose();
      }
    },
    [rose],
  );
  const roseMat = useMemo(
    () => new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, transparent: true, opacity: 0.92 }),
    [],
  );
  useEffect(() => () => roseMat.dispose(), [roseMat]);
  const roseRef = useRef<Object3D>(null);
  useFrame(() => {
    // The rose unfolds with the wick (moment 3): petals scale from the centre as colour rises.
    const g = roseRef.current;
    if (!g || !rose) return;
    const k = wick.current.on ? Math.min(1, (performance.now() - wick.current.start) / 1600) : 1;
    const e = easeOri(k);
    g.position.set(rose.centre[0] * (1 - e), 0, rose.centre[2] * (1 - e));
    g.scale.set(e, 1, e);
  });

  const heroGroupY = PLINTH_M;

  return (
    <>
      <hemisphereLight
        args={[yoru ? '#2A3346' : '#fbf3e4', yoru ? '#0c0a08' : '#d9cbb4', yoru ? 0.55 : 0.9]}
      />
      <ambientLight intensity={yoru ? 0.1 : 0.18} />
      <directionalLight
        ref={sunRef}
        color={sunColour}
        intensity={sunIntensity}
        castShadow={shadowOn}
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
      />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: three.js mesh, not DOM; keyboard users use the ladder and outline */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={mats.ground} onClick={pickGround}>
        <planeGeometry args={[20000, 20000]} />
      </mesh>
      <mesh geometry={roadGeo} material={mats.road} receiveShadow raycast={noRaycast} />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: three.js mesh, not DOM; keyboard users use the ladder and outline */}
      <mesh
        ref={contextRef}
        geometry={contextGeo}
        material={mats.context}
        castShadow={shadowOn}
        receiveShadow
        onPointerMove={hoverContext}
        onPointerOut={() => p.onHover(null, null)}
        onClick={pickContext}
      />
      {flashGeo ? <mesh geometry={flashGeo} material={flashMat} raycast={noRaycast} renderOrder={4} /> : null}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: three.js mesh, not DOM; keyboard users press N to cycle */}
      <mesh
        ref={guessRef}
        geometry={guessGeo}
        material={mats.guess}
        receiveShadow
        onPointerMove={hoverContext}
        onPointerOut={() => p.onHover(null, null)}
        onClick={pickContext}
      />
      {night && lanternMasses.length ? (
        <mesh geometry={lanternGeo} material={mats.lantern} raycast={noRaycast} />
      ) : null}
      <lineSegments ref={outlineRef} geometry={outlineGeo} material={mats.contextLine} raycast={noRaycast} />
      <lineSegments ref={dashedRef} geometry={dashedTops} material={dashedMat} raycast={noRaycast} />
      {p.penumbra ? (
        <mesh geometry={ghostGeo} material={mats.ghost} raycast={noRaycast} renderOrder={2} />
      ) : null}
      {p.penumbra && sun.up && !yoru ? (
        <mesh
          ref={penumbraRef}
          geometry={penumbraGeo}
          material={mats.penumbra}
          receiveShadow
          raycast={noRaycast}
          renderOrder={1}
        />
      ) : null}

      <instancedMesh
        ref={treeRef}
        args={[treeGeo, mats.tree, model.trees.length]}
        castShadow={shadowOn && p.settings.ao}
        receiveShadow
        raycast={noRaycast}
      />

      {pools.map((o) => (
        <group key={o.key}>
          <mesh
            geometry={circle}
            material={o.pool}
            position={[o.c[0], PLINTH_M + 0.03, -o.c[1]]}
            rotation-x={-Math.PI / 2}
            scale={[o.span * 1.2, o.span * 1.2, 1]}
            raycast={noRaycast}
            renderOrder={3}
          />
          <sprite
            material={o.halo}
            position={[o.c[0], o.h * 0.7, -o.c[1]]}
            scale={[o.span * 0.9, o.span * 0.9, 1]}
          />
          {o.bloom ? (
            <sprite
              material={o.bloom}
              position={[o.c[0], o.h * 0.5, -o.c[1]]}
              scale={[o.span * 2, o.span * 2, 1]}
            />
          ) : null}
        </group>
      ))}

      <group ref={placeOuter} {...(p.placeMode ? { onPointerDown: startDrag('move') } : {})}>
        <group ref={placeInner}>
          {plinth ? (
            <>
              <mesh
                geometry={plinth.geo}
                material={mats.plinth}
                castShadow={shadowOn}
                receiveShadow
                {...(p.placeMode ? {} : { raycast: noRaycast })}
              />
              <primitive object={plinth.edge} />
            </>
          ) : null}

          <group position-y={heroGroupY}>
            {storeyMeshes.map((sm, i) => {
              if (sm.st.belowGrade && !(cut && selStorey?.id === sm.st.id)) return null;
              const isSel = cut && selStorey?.id === sm.st.id;
              const above = cut && i > selIndex;
              // With the drawer out, everything but the drawer fades to a ghost (QA B5).
              const ghost = (above && !drawer) || (drawer && drawerOut && !isSel);
              const wallGeo = isSel ? sm.cutWallGeo : sm.wallGeo;
              const glassGeo = isSel ? sm.cutGlassGeo : sm.glassGeo;
              const walls = isSel ? sm.cutWalls : sm.walls;
              const body = (
                <>
                  <HeroMesh
                    geometry={wallGeo}
                    material={ghost ? mats.ghostWall : mats.wall}
                    cast={shadowOn && !ghost}
                    onHover={(e) => p.onHover(heroTarget(walls, wallGeo, e.face?.a), at(e))}
                    onPick={(e) => {
                      const t = heroTarget(walls, wallGeo, e.face?.a);
                      if (t) p.onPick(t, at(e));
                    }}
                  />
                  {!isSel ? (
                    <HeroMesh
                      geometry={sm.roofGeo}
                      material={ghost ? mats.ghostRoof : mats.roof}
                      cast={shadowOn && !ghost}
                      onHover={(e) => p.onHover(heroTarget(sm.roofs, sm.roofGeo, e.face?.a), at(e))}
                      onPick={(e) => {
                        const t = heroTarget(sm.roofs, sm.roofGeo, e.face?.a);
                        if (t) p.onPick(t, at(e));
                      }}
                    />
                  ) : null}
                  {facadeBy.has(sm.st.id) ? (
                    ghost ? null : (
                      <FacadeMeshes
                        f={facadeBy.get(sm.st.id)!}
                        cut={isSel}
                        glass={mats.glass}
                        frame={mats.facadeFrame}
                        shade={mats.facadeShade}
                        cast={shadowOn}
                      />
                    )
                  ) : (
                    <mesh
                      geometry={glassGeo}
                      material={ghost ? mats.ghostGlass : mats.glass}
                      raycast={noRaycast}
                    />
                  )}
                  {isSel ? (
                    <>
                      <HeroMesh
                        geometry={sm.floorGeo}
                        material={mats.floor}
                        cast={false}
                        onHover={(e) => p.onHover(heroTarget(sm.floors, sm.floorGeo, e.face?.a), at(e))}
                        onPick={(e) => {
                          const t = heroTarget(sm.floors, sm.floorGeo, e.face?.a);
                          if (t) p.onPick(t, at(e));
                        }}
                      />
                      <lineSegments geometry={sm.roomLines} material={mats.rooms} raycast={noRaycast} />
                    </>
                  ) : null}
                  {!ghost ? <primitive object={outlines[i]!} /> : null}
                </>
              );
              if (isSel && drawer)
                return (
                  <group key={sm.st.id} ref={drawerRef as unknown as MutableRefObject<never>}>
                    {body}
                  </group>
                );
              if (above && !drawer)
                return (
                  <group
                    key={sm.st.id}
                    ref={(o) => {
                      if (o) liftRefs.current.set(sm.st.id, o);
                      else liftRefs.current.delete(sm.st.id);
                    }}
                  >
                    {body}
                  </group>
                );
              return <group key={sm.st.id}>{body}</group>;
            })}
            {topSm && ghostLevels
              ? Array.from({ length: ghostLevels }, (_, j) => (
                  <mesh
                    // biome-ignore lint/suspicious/noArrayIndexKey: stacked ghost floors
                    key={j}
                    geometry={topSm.wallGeo}
                    material={mats.ghostWall}
                    position-y={(added / ghostLevels) * (j + 1)}
                    raycast={noRaycast}
                  />
                ))
              : null}
            {ghostLines ? <primitive object={ghostLines} /> : null}
            {emphasisLines ? <primitive object={emphasisLines} /> : null}
            {rose ? (
              <group ref={roseRef as unknown as MutableRefObject<never>}>
                <mesh geometry={rose.g} material={roseMat} raycast={noRaycast} renderOrder={5} />
                <primitive object={rose.lines} />
              </group>
            ) : null}
            {photo ? (
              <>
                <mesh
                  geometry={photo.canopy}
                  material={mats.pv}
                  castShadow={shadowOn}
                  receiveShadow
                  raycast={noRaycast}
                />
                <mesh geometry={photo.fins} material={mats.fin} castShadow={shadowOn} raycast={noRaycast} />
              </>
            ) : null}
            {hlFill ? (
              <mesh geometry={hlFill} material={hlFillMat} raycast={noRaycast} renderOrder={4} />
            ) : null}
          </group>
        </group>
        {p.placeMode && hero ? (
          <mesh
            geometry={circle}
            material={handleMat}
            position={[handleR, PLINTH_M + 0.3, 0]}
            rotation-x={-Math.PI / 2}
            scale={[Math.max(4, p.view.halfH * 0.05), Math.max(4, p.view.halfH * 0.05), 1]}
            onPointerDown={startDrag('turn')}
          />
        ) : null}
      </group>
      {dragging ? (
        <mesh
          rotation-x={-Math.PI / 2}
          position-y={groundM + 0.02}
          material={catcherMat}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
        >
          <planeGeometry args={[6000, 6000]} />
        </mesh>
      ) : null}
      {checkLines?.warm ? <primitive object={checkLines.warm} /> : null}
      {checkLines?.shade ? <primitive object={checkLines.shade} /> : null}
      {dayMesh ? (
        <DrawerFollower target={drawerRef}>
          <mesh geometry={dayMesh.geometry} material={dayMesh.material} raycast={noRaycast} renderOrder={3} />
        </DrawerFollower>
      ) : null}
      {hlLines ? <primitive object={hlLines} /> : null}

      {sunPath ? (
        <>
          <primitive object={sunPath.line} />
          {sun.up ? (
            <sprite
              material={sunDisc}
              position={[
                sunPath.centre[0] + sun.dir[0] * sunPath.r,
                sunPath.centre[1] + sun.dir[1] * sunPath.r,
                sunPath.centre[2] + sun.dir[2] * sunPath.r,
              ]}
              scale={[p.view.halfH * 0.12, p.view.halfH * 0.12, 1]}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** Keeps the daylight tray on the drawer as it slides (the tray sits outside the plinth group). */
function DrawerFollower({
  target,
  children,
}: {
  target: MutableRefObject<Object3D | null>;
  children: ReactNode;
}) {
  const ref = useRef<Object3D>(null);
  useFrame(() => {
    if (ref.current && target.current) ref.current.position.copy(target.current.position);
  });
  return <group ref={ref as unknown as MutableRefObject<never>}>{children}</group>;
}

function HeroMesh(props: {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  cast: boolean;
  onHover: (e: ThreeEvent<PointerEvent>) => void;
  onPick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const ref = useRef<Mesh>(null);
  useBvh(ref, props.geometry);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: three.js mesh, not DOM
    <mesh
      ref={ref}
      geometry={props.geometry}
      material={props.material}
      castShadow={props.cast}
      receiveShadow
      onPointerMove={(e) => {
        e.stopPropagation();
        props.onHover(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        props.onPick(e);
      }}
    />
  );
}

const UNIT_PLANE = new PlaneGeometry(1, 1);
const UNIT_BOX = new BoxGeometry(1, 1, 1);

/** One storey's facade detail as up to three instanced draws (glass, card frames, shading). */
function FacadeMeshes(props: {
  f: FacadeStorey;
  cut: boolean;
  glass: MeshStandardMaterial;
  frame: MeshStandardMaterial;
  shade: MeshStandardMaterial;
  cast: boolean;
}) {
  const { f, cut } = props;
  // At a cut storey only pieces starting below the 1.5 m cut plane stay (sills, balconies).
  const pick = (ms: readonly Matrix4[], tops: readonly number[]): Matrix4[] =>
    cut ? ms.filter((_, i) => tops[i]! < 0.85) : [...ms];
  const glass = useMemo(() => (cut ? [] : [...f.glass]), [f, cut]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `pick` only reads f and cut
  const frame = useMemo(() => pick(f.frame, f.frameTop), [f, cut]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `pick` only reads f and cut
  const shade = useMemo(() => pick(f.shade, f.shadeTop), [f, cut]);
  return (
    <>
      {glass.length ? (
        <Instances geometry={UNIT_PLANE} material={props.glass} items={glass} cast={false} />
      ) : null}
      {frame.length ? (
        <Instances geometry={UNIT_BOX} material={props.frame} items={frame} cast={props.cast} />
      ) : null}
      {shade.length ? (
        <Instances geometry={UNIT_BOX} material={props.shade} items={shade} cast={props.cast} />
      ) : null}
    </>
  );
}

function Instances(props: {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  items: readonly Matrix4[];
  cast: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    props.items.forEach((x, i) => {
      m.setMatrixAt(i, x);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [props.items, invalidate]);
  return (
    <instancedMesh
      key={props.items.length}
      ref={ref}
      args={[props.geometry, props.material, props.items.length]}
      castShadow={props.cast}
      receiveShadow
      raycast={noRaycast}
    />
  );
}

/** Fill NaN cells from their nearest filled neighbours (a few dilation passes), so roof rims never read dark. */
function fillNaN(src: Float32Array, cols: number, rows: number): Float32Array {
  let a = Float32Array.from(src);
  for (let pass = 0; pass < 3; pass++) {
    const b = Float32Array.from(a);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (!Number.isNaN(a[i]!)) continue;
        let sum = 0;
        let n = 0;
        for (const [dr, dc] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ] as const) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          const v = a[rr * cols + cc]!;
          if (!Number.isNaN(v)) {
            sum += v;
            n++;
          }
        }
        if (n) b[i] = sum / n;
      }
    a = b;
  }
  for (let i = 0; i < a.length; i++) if (Number.isNaN(a[i]!)) a[i] = 0;
  return a;
}
