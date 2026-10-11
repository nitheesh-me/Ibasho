/**
 * The city scene graph inside the stage's `<Canvas>`: paper ground, merged context massing with
 * honest outlines, the penumbra, trees, the hero on its site board by storey with lens paint, the
 * daylight drawer, the phototropic variant, night lanterns, the sun and the find highlight.
 * Owner: WP-07.
 *
 * Frame cost: `frameloop="demand"` means nothing renders while the city rests (still life). A
 * frame is asked for only when an input changes or while a move, sweep, wick, lift or drawer plays.
 */
import type { SiteResult } from '@ibasho/core';
import { Html } from '@react-three/drei';
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
  type Mesh,
  MeshStandardMaterial,
  Object3D,
  type OrthographicCamera,
} from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import { type Theme, token } from '../colour/palette.ts';
import type { TierSettings } from '../quality/ladder.ts';
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
import { annualKwh } from './preview.ts';
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
import { penumbraPolygons, type SunHoursGrid, shadowHours, sunHoursUpTo } from './shadow.ts';
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

export interface CityStats {
  phase: 'loading' | 'moving' | 'resting';
  frames: number;
  calls: number;
  triangles: number;
  tier: number;
}

export interface CitySceneProps {
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
  /** Find: what to outline or light; the rest of the city dims. */
  highlight?: {
    contextId?: string;
    hero?: boolean;
    storeyId?: string;
    roomId?: string;
    /** A place or building part found by search: its box is drawn on the ground. */
    bboxMm?: { minX: number; minY: number; maxX: number; maxY: number };
  } | null;
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
        wall: '#dccdb6',
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
        // Tops one step up from the ground; walls darker through the vertex shade (QA B1).
        context: '#2a251f',
        contextLine: t('ink-3'),
        contextLineOpacity: 0.45,
        wall: '#3a3129',
        roof: '#2f2924',
        glass: '#1d2326',
        floor: '#3a322a',
        ink: t('ink'),
        outline: t('ink-3'),
        outlineOpacity: 0.6,
        hatch: t('ink-3'),
        tree: '#0f1310',
        pv: '#1c252c',
        fin: '#2b2520',
        paper: t('paper'),
        plinth: '#221d18',
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
    });
    const roof = lensMaterial({ vertexColors: true, roughness: 0.95, emissive: new Color(0) }, uniforms, {
      grid: true,
      wick: true,
    });
    const glass = new MeshStandardMaterial({
      color: look.glass,
      roughness: 0.25,
      metalness: 0.2,
      emissive: new Color(0),
    });
    return {
      ground: lensMaterial({ color: look.ground, roughness: 1 }, uniforms, { grid: true }),
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
  const lanternMasses = useMemo(
    () => model.masses.filter((m) => lanternIds.has(m.id)),
    [model.masses, lanternIds],
  );
  const night = yoru;
  const hour = p.time.minutes / 60;
  const lanternGeo = useMemo(() => {
    const g = contextGeometry(lanternMasses, (m) => drawnHeight(m) + 0.05);
    const bid = g.getAttribute('aBid');
    const col = new Float32Array(bid.count * 3);
    const lamp = new Color(look.lamp);
    for (let v = 0; v < bid.count; v++) {
      const m = lanternMasses[bid.getX(v)]!;
      const l = lanternIds.get(m.id)!;
      const k = lanternStrength(l, hour) * 0.55;
      col[v * 3] = lamp.r * k;
      col[v * 3 + 1] = lamp.g * k;
      col[v * 3 + 2] = lamp.b * k;
    }
    g.setAttribute('color', new BufferAttribute(col, 3));
    return g;
  }, [lanternMasses, lanternIds, hour, look.lamp]);
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
  const ghostGeo = useMemo(
    () =>
      ghostGeometry(
        model.masses
          .filter((m) => m.user === undefined && m.hi - m.likely > 0.25)
          .map((m) => ({ ring: m.ring, from: m.likely, to: m.hi })),
      ),
    [model.masses],
  );
  const roadGeo = useMemo(() => flatGeometry(roadPolys(model.roads), 0.04), [model.roads]);

  // The penumbra: hatched band from the likely to the plausible shadow, closing on user heights.
  const ranges = useMemo(
    () =>
      model.masses
        .filter((m) => m.hi - m.likely > 0.25 && (m.user === undefined || p.closing.has(m.id)))
        .map((m) => ({ id: m.id, ring: m.ring, likely: drawnHeight(m), hi: m.hi })),
    [model.masses, p.closing],
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
    for (const s of p.site?.surfaces ?? []) m.set(s.id, s);
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
      const d = siteById.get(s.id) ?? siteById.get(s.ownerId);
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
  useLayoutEffect(() => {
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
  }, [gridSpec, gridTex, sunGrid, shadowH, lens, p.gridMinutes, p.sweeping, uniforms, invalidate]);

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
    // Slide towards the screen left, away from the legend (QA B5): camera left is (cos az, 0, sin az).
    const az = (p.view.azimuthDeg * Math.PI) / 180;
    const span = Math.max(hero.box.maxE - hero.box.minE, hero.box.maxN - hero.box.minN);
    const d = span * 0.62 + 10;
    return [Math.cos(az) * d, 0, Math.sin(az) * d];
  }, [hero, p.view.azimuthDeg]);
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
  const heroLantern = hero ? lanternIds.get(hero.id) : undefined;
  useEffect(() => {
    const k = heroLantern ? lanternStrength(heroLantern, hour) : 0;
    const lamp = new Color(look.lamp);
    const glow = new Color(token('glow', 'yoru'));
    // Window light is lamplight graded by the hourly load; the body takes a warm bounce (QA B1).
    mats.glass.emissive = night && heroLantern ? lamp.clone().multiplyScalar(0.55 + 0.9 * k) : new Color(0);
    mats.wall.emissive = night && heroLantern ? glow.clone().multiplyScalar(0.09 * k) : new Color(0);
    mats.roof.emissive = night && heroLantern ? glow.clone().multiplyScalar(0.05 * k) : new Color(0);
    invalidate();
  }, [mats, heroLantern, hour, night, look.lamp, invalidate]);
  const pools = useMemo(() => {
    if (!night) return [];
    const out: { key: string; c: EN; span: number; h: number; colour: string; k: number }[] = [];
    for (const l of p.lanterns) {
      const k = lanternStrength(l, hour);
      const colour = token(DOMINANT_TOKEN[l.dominant], 'yoru');
      if (hero && l.buildingId === hero.id) {
        const { c, span } = ringCentre(hero.prisms.flatMap((x) => x.ring));
        out.push({ key: l.buildingId, c, span, h: hero.height, colour, k });
        continue;
      }
      const m = model.masses.find((x) => x.id === l.buildingId);
      if (m) {
        const { c, span } = ringCentre(m.ring);
        out.push({ key: l.buildingId, c, span, h: drawnHeight(m), colour, k });
      }
    }
    return out.map((o) => ({ ...o, pool: poolMaterial(o.colour, o.k), halo: haloMaterial(look.lamp, o.k) }));
  }, [night, p.lanterns, hour, hero, model.masses, look.lamp]);
  useEffect(
    () => () => {
      for (const o of pools) {
        o.pool.dispose();
        o.halo.dispose();
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
    if (p.reducedMotion) {
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
    if (moving) invalidate();
  });
  useFrame(() => {
    gl.render(scene, camera);
    frames.current++;
    if (p.stats) {
      const info = gl.info.render;
      p.stats.current = {
        phase: anim.current || wick.current.on ? 'moving' : 'resting',
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

  // Room labels at Floor level (QA M2): use and area on a raised paper plate, big rooms only.
  const labels = useMemo(() => {
    if (!hero || !cut || !selStorey || drawer) return [];
    return hero.rooms
      .filter((r) => r.storeyId === selStorey.id)
      .map((r) => ({ r, area: Math.abs(ringArea(r.ring)), c: ringCentre(r.ring).c }))
      .filter((x) => (level === 'room' ? x.r.id === p.roomId : x.area > 90))
      .slice(0, 28);
  }, [hero, cut, selStorey, drawer, level, p.roomId]);

  const heroGroupY = PLINTH_M;
  const locator = level === 'city' && hero ? ringCentre(hero.prisms.flatMap((x) => x.ring)) : null;

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
        <planeGeometry args={[3200, 3200]} />
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
            position={[o.c[0], 0.08, -o.c[1]]}
            rotation-x={-Math.PI / 2}
            scale={[o.span * 1.6, o.span * 1.6, 1]}
            raycast={noRaycast}
            renderOrder={3}
          />
          <sprite
            material={o.halo}
            position={[o.c[0], o.h * 0.7, -o.c[1]]}
            scale={[o.span * 0.9, o.span * 0.9, 1]}
          />
        </group>
      ))}

      {plinth ? (
        <>
          <mesh
            geometry={plinth.geo}
            material={mats.plinth}
            castShadow={shadowOn}
            receiveShadow
            raycast={noRaycast}
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
              <mesh geometry={glassGeo} material={ghost ? mats.ghostGlass : mats.glass} raycast={noRaycast} />
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
        {hlFill ? <mesh geometry={hlFill} material={hlFillMat} raycast={noRaycast} renderOrder={4} /> : null}
        {labels.map(({ r, area, c }) => (
          <Html
            key={r.id}
            position={[c[0], r.z0 + 1.6, -c[1]]}
            center
            zIndexRange={[20, 10]}
            style={{ pointerEvents: 'none' }}
          >
            <span className="ib-city-label">
              <b>{USE_LABEL[r.use ?? ''] ?? r.name ?? 'Room'}</b>
              <span className="ib-city-num">{Math.round(area)} m²</span>
            </span>
          </Html>
        ))}
      </group>
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

      {locator ? (
        <Html
          position={[locator.c[0], (hero?.height ?? 0) + PLINTH_M, -locator.c[1]]}
          zIndexRange={[20, 10]}
          style={{ pointerEvents: 'none' }}
        >
          <span className="ib-city-locator">
            <span className="ib-city-locator__plate">{model.hero?.name}</span>
            <span className="ib-city-locator__leader" aria-hidden="true" />
          </span>
        </Html>
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
