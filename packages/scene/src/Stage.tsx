/**
 * The stage (ARCH 10): one `<Canvas>` with `frameloop="demand"`, the still-life controller,
 * Washi or Yoru, the T1 layers over the baked frame, the SVG renderer as fallback and Pencil
 * stage, the `a11y-scene` outline, the quality ladder and context-loss recovery.
 * Owner: WP-07.
 */
import type { HomeTwin, QualityTier, SearchResult, Vec3, VisualLayerPlugin } from '@ibasho/core';
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { washiTileSvg } from '@ibasho/ui/tokens';
import {
  type CSSProperties,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import { buildOutline } from './a11y/model.ts';
import { fc } from './fc.ts';
import { SceneOutline } from './a11y/SceneOutline.tsx';
import { composeView, type ViewKind } from './camera/compose.ts';
import { type CameraModel, cameraBasis, DEFAULT_ELEVATION, fitCamera, projectOrtho, snapAzimuth } from './camera/model.ts';
import type { CameraKey, CameraSequence } from './camera/sequence.ts';
import { palette as paletteOf } from './colour/palette.ts';
import { T1_LAYERS } from './layers/plugins.tsx';
import { effectiveTier, initialLadder, type LadderEvent, stepLadder, TIERS } from './quality/ladder.ts';
import { fromGraph } from './quantities/from-graph.ts';
import { fromTwin, JANUARY_NIGHT } from './quantities/from-twin.ts';
import type { SceneCondition, SceneQuantities } from './quantities/types.ts';
import { createSelectionStore, type SelectionStore } from './select/store.ts';
import { bakeRecipe, T1_STYLES, themeOfStyle } from './styles/styles.tsx';
import { plinthOf } from './svg/project.ts';
import { SvgHouse } from './svg/SvgHouse.tsx';
import type { SceneAssets } from './three/assets.ts';
import { CameraRig, type PlayingSequence } from './three/CameraRig.tsx';
import { disposeHouse } from './three/cache.ts';
import { type LensState, type SceneData, SceneDataContext } from './three/context.tsx';
import { Highlight } from './three/Highlight.tsx';
import { House } from './three/House.tsx';
import { createMaterials, type HouseMaterials, loadTextures, type TextureBundle } from './three/materials.ts';
import { Plinth } from './three/Plinth.tsx';
import { Props } from './three/Props.tsx';
import { StillLife, type StillStats } from './three/StillLife.tsx';
import { buildHouse, type HouseModel } from './twin/house.ts';

export type StageStyle = 'washi' | 'yoru' | 'svg';

export interface StageProps {
  twin: HomeTwin;
  result?: SearchResult | null;
  /** Explicit quantities (fixtures, tests). Otherwise from `result.graph`, else from the twin. */
  quantities?: SceneQuantities;
  condition?: SceneCondition;
  style?: StageStyle;
  /** Active layer ids (`heat-flow`, `thermal-lens`, `zone-tint`). */
  layers?: readonly string[];
  view?: ViewKind;
  azimuthDeg?: number;
  onAzimuthChange?: (deg: number) => void;
  reducedMotion?: boolean;
  /** Highest tier allowed (the ladder starts here). */
  tierCap?: QualityTier;
  llmGenerating?: boolean;
  assets?: SceneAssets | null;
  store?: SelectionStore;
  /** Show the pencil underdrawing over the stage (while the engine computes). */
  pencil?: boolean;
  /** Play this sequence each time `sequenceKey` changes. */
  sequence?: CameraSequence | null;
  sequenceKey?: number;
  onSequenceEnd?: () => void;
  stats?: MutableRefObject<StillStats | null>;
  showOutline?: boolean;
  /** Plugins to draw; defaults to the T1 layers. */
  layerPlugins?: readonly VisualLayerPlugin[];
  className?: string;
  style_?: CSSProperties;
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
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/** Points the camera must keep in frame: plinth, ridge, chimney and the lifted roof. */
export function framingPoints(house: HouseModel, liftM: number): Vec3[] {
  const p = plinthOf(house);
  const b = house.bounds;
  return [
    [p.x0, -p.depth, p.z0],
    [p.x1, -p.depth, p.z0],
    [p.x0, -p.depth, p.z1],
    [p.x1, -p.depth, p.z1],
    [p.x0, 0, p.z0],
    [p.x1, 0, p.z1],
    [b.min[0], b.max[1] + liftM, b.min[2]],
    [b.max[0], b.max[1] + liftM, b.max[2]],
    [b.min[0], b.max[1] + liftM, b.max[2]],
    [b.max[0], b.max[1] + liftM, b.min[2]],
  ];
}

export function stageCamera(
  house: HouseModel,
  azimuthDeg: number,
  viewport: { width: number; height: number },
  liftM: number,
): CameraModel {
  return fitCamera(
    { azimuthDeg, elevationDeg: DEFAULT_ELEVATION, distance: 40, viewport },
    framingPoints(house, liftM),
    0.07,
  );
}

const grainCache = new Map<string, string>();
function grainUri(theme: 'hiru' | 'yoru'): string {
  let u = grainCache.get(theme);
  if (!u) {
    const svg = washiTileSvg(theme);
    u = `url("data:image/svg+xml,${svg.replace(/[<>#%"{}\n]/g, (c) => encodeURIComponent(c))}")`;
    grainCache.set(theme, u);
  }
  return u;
}

const LIFT_M = 2;

export function Stage(props: StageProps) {
  const {
    twin,
    result = null,
    style = 'washi',
    layers = [],
    view = 'cutaway',
    llmGenerating = false,
    assets = null,
    pencil = false,
    sequence = null,
    showOutline = false,
  } = props;
  const reducedMotion = useReducedMotion(props.reducedMotion);
  const [ownStore] = useState(createSelectionStore);
  const store = props.store ?? ownStore;
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 960, height: 640 });
  const [azLocal, setAzLocal] = useState(props.azimuthDeg ?? 45);
  const azimuth = snapAzimuth(props.azimuthDeg ?? azLocal);
  const [ladder, dispatch] = useReducer(
    (s: ReturnType<typeof initialLadder>, e: LadderEvent) => stepLadder(s, e),
    props.tierCap ?? 3,
    (cap: QualityTier) => initialLadder(cap),
  );
  const [glOk] = useState(webglAvailable);
  const [lost, setLost] = useState(false);
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const [playing, setPlaying] = useState<PlayingSequence | null>(null);
  const [seqKey, setSeqKey] = useState<CameraKey | null>(null);
  const [lens, setLens] = useState<LensState>({ x: 0, y: 0, r: 120 });
  const [textures, setTextures] = useState<TextureBundle>({});

  useEffect(() => {
    dispatch(llmGenerating ? 'llm-start' : 'llm-end');
  }, [llmGenerating]);

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

  useEffect(() => {
    setLens((l) => (l.x === 0 && l.y === 0 ? { x: size.width * 0.42, y: size.height * 0.52, r: Math.min(150, size.height * 0.24) } : l));
  }, [size]);

  useEffect(() => {
    if (props.sequenceKey === undefined || !sequence) return;
    if (reducedMotion) {
      // Reduced motion: no flight, land on the end state.
      setPlaying(null);
      setSeqKey(null);
      props.onSequenceEnd?.();
      return;
    }
    setPlaying({ seq: sequence, start: performance.now() });
    // biome-ignore lint/correctness/useExhaustiveDependencies: replay only when the key changes
  }, [props.sequenceKey]);

  useEffect(() => {
    let live = true;
    loadTextures(assets).then((t) => {
      if (live) {
        setTextures(t);
        bump();
      }
    });
    return () => {
      live = false;
    };
  }, [assets]);

  const house = useMemo(() => buildHouse(twin), [twin]);
  useEffect(() => () => disposeHouse(house), [house]);
  const quantities = useMemo<SceneQuantities>(() => {
    if (props.quantities) return props.quantities;
    if (result) return fromGraph(twin, result.graph, props.condition ?? JANUARY_NIGHT);
    return fromTwin(twin, props.condition ?? JANUARY_NIGHT);
  }, [twin, result, props.quantities, props.condition]);

  const theme = themeOfStyle(style);
  const pal = useMemo(() => paletteOf(theme), [theme]);
  const materials = useMemo<HouseMaterials | null>(
    () => (typeof document === 'undefined' ? null : createMaterials(theme, textures)),
    [theme, textures],
  );
  useEffect(() => () => materials?.dispose(), [materials]);

  const tier = effectiveTier(ladder);
  const settings = TIERS[tier];
  const lift = seqKey ? seqKey.roofLiftM : view === 'cutaway' ? LIFT_M : 0;
  const camera = useMemo(() => stageCamera(house, azimuth, size, LIFT_M), [house, azimuth, size]);
  const viewSpec = useMemo(
    () => ({
      view: seqKey ? (seqKey.cut >= 0.5 ? ('cutaway' as const) : ('exterior' as const)) : view,
      azimuthDeg: seqKey ? seqKey.azimuthDeg : azimuth,
      elevationDeg: seqKey ? seqKey.elevationDeg : DEFAULT_ELEVATION,
      roofLiftM: lift,
      ceiling: seqKey ? seqKey.ceiling : view === 'cutaway' ? 0.35 : 1,
    }),
    [seqKey, view, azimuth, lift],
  );
  const composed = useMemo(() => composeView(house, viewSpec), [house, viewSpec]);
  const outline = useMemo(() => buildOutline(twin, quantities), [twin, quantities]);

  const invalidateBake = useCallback(() => bump(), []);
  const data: SceneData = {
    twin,
    house,
    quantities,
    result,
    theme,
    palette: pal,
    camera,
    view: viewSpec,
    composed,
    materials,
    assets,
    store,
    reducedMotion,
    tier,
    settings,
    lens,
    invalidateBake,
  };

  const active = (props.layerPlugins ?? T1_LAYERS).filter((p) => layers.includes(p.layerId));
  const style3d = T1_STYLES.find((s) => s.styleId === style) ?? T1_STYLES[0]!;
  const StyleLive = fc(style3d.Live);
  const StyleBake = fc(style3d.Bake);
  const recipe = useMemo(() => bakeRecipe(style3d.styleId, settings), [style3d.styleId, settings]);
  const useSvg = style === 'svg' || !glOk || lost;
  const layerProps = { result, reducedMotion, tier };
  const sel = useSyncExternalStore(store.subscribe, store.get, store.get);

  const onAz = useCallback(
    (deg: number) => {
      setAzLocal(deg);
      props.onAzimuthChange?.(deg);
    },
    [props.onAzimuthChange],
  );

  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onAz(snapAzimuth(azimuth + (e.key === 'ArrowLeft' ? 45 : -45)));
    }
  };

  const paper = pal.background;
  const grain = grainUri(theme);

  return (
    <SceneDataContext.Provider value={data}>
      <div
        ref={container}
        className={`ib-stage ${props.className ?? ''}`}
        data-style={style}
        data-tier={tier}
        data-renderer={useSvg ? 'svg' : 'webgl'}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the stage takes arrow keys to turn the house
        tabIndex={0}
        role="group"
        aria-roledescription="3D stage"
        aria-label="Your home. Use the left and right arrow keys to turn it. The outline lists every part."
        onKeyDown={onKey}
        style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: paper, ...props.style_ }}
      >
        {!useSvg || lost ? (
          <Canvas
            frameloop="demand"
            dpr={[1, settings.dpr]}
            shadows={{ type: PCFSoftShadowMap, enabled: settings.shadows }}
            gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
            style={{ position: 'absolute', inset: 0, visibility: lost ? 'hidden' : 'visible' }}
            onCreated={({ gl, scene }) => {
              gl.setClearColor(0x000000, 0);
              gl.toneMapping = ACESFilmicToneMapping;
              gl.toneMappingExposure = theme === 'yoru' ? 1.1 : 1.0;
              gl.outputColorSpace = SRGBColorSpace;
              scene.background = null;
              const canvas = gl.domElement;
              canvas.addEventListener('webglcontextlost', (ev) => {
                ev.preventDefault();
                dispatch('context-lost');
                setLost(true);
              });
              canvas.addEventListener('webglcontextrestored', () => {
                setLost(false);
                bump();
              });
            }}
            onPointerMissed={() => store.select(null, 'scene')}
          >
            <CameraRig
              model={camera}
              reducedMotion={reducedMotion}
              sequence={playing}
              onSequenceFrame={setSeqKey}
              onSequenceEnd={() => {
                setPlaying(null);
                setSeqKey(null);
                props.onSequenceEnd?.();
              }}
              onAzimuth={onAz}
            />
            <StyleLive />
            <StyleBake />
            <House />
            <Plinth />
            <Props />
            <Highlight />
            {active.map((p) => {
              const L = fc(reducedMotion ? p.ReducedMotion : p.Overlay);
              return <L key={p.id} {...layerProps} />;
            })}
            <StillLife recipe={recipe} allowBake={!playing} version={version} {...(props.stats ? { stats: props.stats } : {})} />
            <PerformanceMonitor
              onDecline={() => dispatch('decline')}
              onIncline={() => dispatch('incline')}
              flipflops={4}
            />
          </Canvas>
        ) : null}
        {useSvg ? (
          <div style={{ position: 'absolute', inset: 0 }}>
            <SvgHouse
              house={house}
              composed={composed}
              camera={camera}
              palette={pal}
              variant="ink"
              reducedMotion={reducedMotion}
              highlight={sel.focus ?? sel.selected}
              onPick={(t) => store.select(t, 'scene')}
              showJunctions={layers.includes('thermal-lens')}
            >
              {active.map((p) => {
                if (!p.Svg) return null;
                const S = fc(p.Svg);
                return <S key={p.id} {...layerProps} />;
              })}
            </SvgHouse>
          </div>
        ) : null}
        <div
          aria-hidden="true"
          className="ib-stage-grain"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: grain,
            backgroundSize: '280px 280px',
            mixBlendMode: theme === 'hiru' ? 'multiply' : 'screen',
            opacity: theme === 'hiru' ? 0.55 : 0.18,
          }}
        />
        {!useSvg ? (
          <div
            aria-hidden="true"
            className="ib-stage-pencil"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: pencil ? 1 : 0,
              transition: reducedMotion ? 'none' : 'opacity 600ms ease',
              background: pencil ? paper : 'transparent',
            }}
          >
            {pencil ? (
              <SvgHouse house={house} composed={composed} camera={camera} palette={pal} variant="pencil" reducedMotion={reducedMotion} />
            ) : null}
          </div>
        ) : null}
        {layers.includes('zone-tint') && !playing ? <ZoneLabels camera={camera} /> : null}
        {layers.includes('thermal-lens') && !useSvg ? <LensRing lens={lens} setLens={setLens} size={size} /> : null}
        <div
          className="ib-stage-legends"
          style={{ position: 'absolute', left: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}
        >
          {active.map((p) => {
            if (!p.Legend) return null;
            const L = fc(p.Legend);
            return <L key={p.id} result={result} />;
          })}
        </div>
        <SceneOutline groups={outline} store={store} visible={showOutline} />
      </div>
    </SceneDataContext.Provider>
  );
}

function ZoneLabels({ camera }: { camera: CameraModel }) {
  const d = useSceneDataSafe();
  if (!d) return null;
  const basis = cameraBasis(camera);
  const temps = new Map(d.quantities.zones.map((z) => [z.zone, z.tempC]));
  const shown = new Set<string>();
  const labels = d.house.rooms
    .slice()
    .sort((a, b) => (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) - (a.max[0] - a.min[0]) * (a.max[2] - a.min[2]))
    .filter((r) => (shown.has(r.zone) ? false : (shown.add(r.zone), true)))
    .map((r) => {
      const q = projectOrtho(camera, [(r.min[0] + r.max[0]) / 2, r.min[1] + 1.2, (r.min[2] + r.max[2]) / 2], basis);
      return { r, q };
    });
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {labels.map(({ r, q }) => (
        <div
          key={r.zone}
          style={{
            position: 'absolute',
            left: q.x,
            top: q.y,
            transform: 'translate(-50%, -50%)',
            font: '600 12px/1.2 var(--font-sans, system-ui, sans-serif)',
            color: 'var(--text, #26221f)',
            background: 'var(--surface-raised, #faf6ef)',
            border: '1px solid var(--rule, #c6c2b6)',
            borderRadius: 4,
            padding: '3px 6px',
            whiteSpace: 'nowrap',
          }}
        >
          {r.zone === 'living' ? 'Living area' : 'Rest of home'} · {Math.round((temps.get(r.zone) ?? 0) * 10) / 10} °C
        </div>
      ))}
    </div>
  );
}

function useSceneDataSafe(): SceneData | null {
  return useContext(SceneDataContext);
}

function LensRing({
  lens,
  setLens,
  size,
}: {
  lens: LensState;
  setLens: (f: (l: LensState) => LensState) => void;
  size: { width: number; height: number };
}) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const clamp = (l: LensState): LensState => ({
    ...l,
    x: Math.min(size.width - 20, Math.max(20, l.x)),
    y: Math.min(size.height - 20, Math.max(20, l.y)),
  });
  const down = (e: ReactPointerEvent<HTMLDivElement>): void => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - lens.x, dy: e.clientY - lens.y };
    e.stopPropagation();
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d) return;
    setLens((l) => clamp({ ...l, x: e.clientX - d.dx, y: e.clientY - d.dy }));
  };
  const up = (): void => {
    drag.current = null;
  };
  const key = (e: KeyboardEvent<HTMLDivElement>): void => {
    const step = e.shiftKey ? 40 : 12;
    const m: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const v = m[e.key];
    if (!v) return;
    e.preventDefault();
    e.stopPropagation();
    setLens((l) => clamp({ ...l, x: l.x + v[0], y: l.y + v[1] }));
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Thermal lens position. Arrow keys move it."
      aria-valuetext={`Lens at ${Math.round(lens.x)}, ${Math.round(lens.y)}`}
      aria-valuenow={Math.round(lens.x)}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onKeyDown={key}
      style={{
        position: 'absolute',
        left: lens.x - lens.r,
        top: lens.y - lens.r,
        width: lens.r * 2,
        height: lens.r * 2,
        borderRadius: '50%',
        boxShadow: '0 0 0 2px var(--ink, #26221f), 0 0 0 5px var(--surface-raised, #faf6ef), 0 0 0 6px var(--rule, #c6c2b6)',
        cursor: 'grab',
        touchAction: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -30,
          transform: 'translateX(-50%)',
          font: '600 11px/1 var(--font-sans, system-ui, sans-serif)',
          color: 'var(--text, #26221f)',
          background: 'var(--surface-raised, #faf6ef)',
          border: '1px solid var(--rule, #c6c2b6)',
          borderRadius: 10,
          padding: '4px 8px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        Modelled, not measured
      </div>
    </div>
  );
}
