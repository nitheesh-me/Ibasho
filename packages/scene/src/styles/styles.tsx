/**
 * T1 render styles (ARCH 10, DESIGN_SYSTEM 10, 11): Washi (Hiru, day ink on paper) and Yoru
 * (night lantern). Each is a `render-style` plugin with a `Live` part (lights and sky, always
 * mounted) and a `Bake` part (what only the still-life bake adds), plus the bake recipe the
 * still-life controller runs. Owner: WP-07.
 */
import type { RenderStylePlugin } from '@ibasho/core';
import { AccumulativeShadows, Environment, Lightformer, RandomizedLight } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Component, type ReactNode, Suspense, useEffect, useMemo } from 'react';
import { CanvasTexture, SpriteMaterial, AdditiveBlending, SRGBColorSpace } from 'three';
import type { Vec3 } from '@ibasho/core';
import { netsuHex } from '../colour/palette.ts';
import type { Theme } from '../colour/palette.ts';
import { plinthOf } from '../svg/project.ts';
import { hdriFiles } from '../three/assets.ts';
import { useSceneData } from '../three/context.tsx';
import type { BakeRecipe } from '../three/StillLife.tsx';
import type { TierSettings } from '../quality/ladder.ts';
import { DEFAULT_SUN_TIME, sunAt } from './sun.ts';

class Quiet extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function useCentre(): { c: Vec3; r: number } {
  const { house } = useSceneData();
  const b = house.bounds;
  const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const r = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2;
  return { c, r };
}

function useSun() {
  const { twin } = useSceneData();
  return useMemo(() => sunAt(new Date(DEFAULT_SUN_TIME), twin.location.lat, twin.location.lon), [twin.location]);
}

/** Procedural sky for when the HDRI is missing: soft paper light from above, warm sideways. */
function PaperSky({ night }: { night: boolean }) {
  return (
    <Environment resolution={64} frames={1}>
      <Lightformer form="rect" intensity={night ? 0.25 : 1.6} color={night ? '#4a5a78' : '#fff8ee'} scale={[20, 20, 1]} position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={night ? 0.1 : 0.7} color={night ? '#2a2620' : '#f4e2c8'} scale={[20, 6, 1]} position={[0, 2, -12]} />
      <Lightformer form="rect" intensity={night ? 0.1 : 0.5} color={night ? '#2a2620' : '#e8eef0'} scale={[20, 6, 1]} position={[0, 2, 12]} rotation={[0, Math.PI, 0]} />
    </Environment>
  );
}

function Sky({ id, intensity, night }: { id: string; intensity: number; night: boolean }) {
  const { assets, invalidateBake } = useSceneData();
  const files = hdriFiles(assets, id);
  useEffect(() => {
    invalidateBake();
  }, [invalidateBake]);
  if (!files) return <PaperSky night={night} />;
  return (
    <Quiet fallback={<PaperSky night={night} />}>
      <Suspense fallback={<PaperSky night={night} />}>
        <Environment files={files} environmentIntensity={intensity} background={false} />
      </Suspense>
    </Quiet>
  );
}

function WashiLive() {
  const { settings } = useSceneData();
  const sun = useSun();
  const { c, r } = useCentre();
  const pos: Vec3 = [c[0] + sun.dir[0] * 30, c[1] + sun.dir[1] * 30, c[2] + sun.dir[2] * 30];
  return (
    <>
      <Sky id="hdri-kloofendal-overcast-puresky" intensity={0.75} night={false} />
      <hemisphereLight args={['#fff6e8', '#b9a98f', 0.45]} />
      <directionalLight
        position={pos}
        intensity={2.4}
        color="#ffe7c4"
        castShadow={settings.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-camera-left={-r * 1.2}
        shadow-camera-right={r * 1.2}
        shadow-camera-top={r * 1.2}
        shadow-camera-bottom={-r * 1.2}
        shadow-camera-near={1}
        shadow-camera-far={80}
      >
        <object3D attach="target" position={c} />
      </directionalLight>
    </>
  );
}

function WashiBake() {
  const { settings, house, palette } = useSceneData();
  const sun = useSun();
  const { r } = useCentre();
  const gl = useThree((s) => s.gl);
  if (!settings.shadows || !gl) return null;
  // The soft shadow catcher covers exactly the plinth top, so nothing floats over the paper.
  const p = plinthOf(house);
  const w = p.x1 - p.x0;
  const d = p.z1 - p.z0;
  const up = Math.max(0.35, sun.dir[1]);
  return (
    <AccumulativeShadows
      key={`${house.twinId}:${settings.bakeFrames}`}
      frames={settings.bakeFrames}
      temporal={false}
      alphaTest={0.85}
      opacity={0.8}
      // drei types `scale` as a number but forwards it to the plane mesh, which takes a vector.
      {...({ scale: [w, d, 1] } as unknown as { scale: number })}
      position={[(p.x0 + p.x1) / 2, 0.006, (p.z0 + p.z1) / 2]}
      color={palette.ink}
      colorBlend={2}
    >
      {/* Intensity PI: a white Lambert surface in full light reads 1, so only real shadow darkens. */}
      <RandomizedLight
        amount={8}
        radius={4}
        intensity={Math.PI}
        ambient={0.35}
        size={r * 1.6}
        mapSize={1024}
        position={[sun.dir[0] * 20, up * 20, sun.dir[2] * 20]}
        bias={0.001}
      />
    </AccumulativeShadows>
  );
}

let glowTex: CanvasTexture | null = null;
function glowTexture(): CanvasTexture | null {
  if (glowTex || typeof document === 'undefined') return glowTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new CanvasTexture(c);
  glowTex.colorSpace = SRGBColorSpace;
  return glowTex;
}

/**
 * Leak glows (DESIGN_SYSTEM 10, Yoru): sprites at infiltration paths, size and brightness
 * proportional to the modelled leakage in W. Drawn with the house (baked), not an overlay.
 */
function LeakGlows() {
  const { house, quantities, palette } = useSceneData();
  const mat = useMemo(() => {
    const t = glowTexture();
    return new SpriteMaterial({
      ...(t ? { map: t } : {}),
      color: palette.windowGlow,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
    });
  }, [palette.windowGlow]);
  useEffect(() => () => mat.dispose(), [mat]);
  const sprites: { key: string; p: Vec3; s: number }[] = [];
  const max = Math.max(1, ...quantities.leaks.map((l) => l.watts));
  quantities.leaks.forEach((l, i) => {
    const k = Math.sqrt(l.watts / max);
    if (l.kind === 'chimney') {
      const c = house.chimneys[0];
      if (c) sprites.push({ key: `leak${i}`, p: [c.base[0], c.base[1] + c.size[1] + 0.45, c.base[2]], s: 0.35 + 0.7 * k });
      return;
    }
    const o = house.openings.find((x) => x.elementId === l.elementId);
    if (!o) return;
    const top: Vec3 = [
      o.corner[0] + o.frame.u[0] * o.width / 2 + o.frame.n[0] * 0.08,
      o.corner[1] + o.height + 0.02,
      o.corner[2] + o.frame.u[2] * o.width / 2 + o.frame.n[2] * 0.08,
    ];
    sprites.push({ key: `leak${i}`, p: top, s: 0.3 + 1.1 * k });
  });
  return (
    <group name="leak-glows">
      {sprites.map((s) => (
        <sprite key={s.key} position={s.p} scale={[s.s, s.s, 1]} material={mat} />
      ))}
    </group>
  );
}

function YoruLive() {
  const { house } = useSceneData();
  const { c } = useCentre();
  return (
    <>
      <Sky id="hdri-qwantani-dusk-2" intensity={0.22} night />
      <hemisphereLight args={['#334a6a', '#120e0a', 0.25]} />
      <directionalLight position={[c[0] - 14, 16, c[2] - 10]} intensity={0.35} color="#9fb6e0" />
      {house.rooms.map((r) => (
        <pointLight
          key={r.id}
          position={[(r.min[0] + r.max[0]) / 2, r.max[1] - 0.45, (r.min[2] + r.max[2]) / 2]}
          intensity={r.use === 'living' ? 9 : 5}
          distance={7}
          decay={1.6}
          color={netsuHex(0.86)}
        />
      ))}
      <LeakGlows />
    </>
  );
}

function YoruBake() {
  return null;
}

export const washiStyle: RenderStylePlugin = {
  kind: 'render-style',
  id: 'scene.style.washi',
  version: '1.0.0',
  title: 'scene.style.washi',
  side: 'ui',
  styleId: 'washi',
  Live: WashiLive,
  Bake: WashiBake,
  tier: 0,
};

export const yoruStyle: RenderStylePlugin = {
  kind: 'render-style',
  id: 'scene.style.yoru',
  version: '1.0.0',
  title: 'scene.style.yoru',
  side: 'ui',
  styleId: 'yoru',
  Live: YoruLive,
  Bake: YoruBake,
  tier: 0,
};

export const T1_STYLES: readonly RenderStylePlugin[] = [washiStyle, yoruStyle];

export function themeOfStyle(styleId: string): Theme {
  return styleId === 'yoru' ? 'yoru' : 'hiru';
}

export function bakeRecipe(styleId: string, s: TierSettings): BakeRecipe {
  const night = styleId === 'yoru';
  return {
    ao: s.ao,
    aoColor: night ? '#0b0907' : '#3b2f26',
    aoIntensity: night ? 2 : 3,
    bloom: s.bloom && night ? { intensity: 1.1, threshold: 0.85 } : null,
    multisampling: s.dpr > 1 ? 4 : 0,
  };
}
