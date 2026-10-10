/**
 * Heat-flow layer, "Kaze" (SV 3.2): motes leave each element in proportion to its heat loss,
 * one mote per 10 W, drifting out along the surface normal. One draw call. Owner: WP-07.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, NormalBlending, ShaderMaterial } from 'three';
import { netsuLinear } from '../colour/palette.ts';
import type { SceneQuantities } from '../quantities/types.ts';
import type { SelectionStore } from '../select/store.ts';
import { OverlayGroup, useTicker } from '../three/overlay.tsx';
import type { HouseModel } from '../twin/house.ts';
import { buildMotes, type MoteField } from './motes.ts';

export const MAX_MOTES = 20000;

const VERT = /* glsl */ `
attribute vec3 aDir;
attribute vec4 aParam;
attribute vec3 aColor;
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
uniform float uReduced;
uniform float uHl;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float life = 4.2;
  float ph = fract(aParam.x + uTime * aParam.y / life);
  if (uReduced > 0.5) ph = 0.18 + 0.55 * aParam.x;
  float s = aParam.x * 37.0;
  vec3 curl = vec3(sin(ph * 5.0 + s), 0.55 + 0.3 * sin(s * 1.7), cos(ph * 4.0 + s * 1.3));
  vec3 p = position + aDir * (0.05 + ph * 1.35) + curl * (0.35 * ph * ph);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float hl = (uHl >= 0.0 && abs(aParam.w - uHl) < 0.5) ? 1.7 : 1.0;
  gl_PointSize = uSize * uPixelRatio * hl * (1.15 - 0.45 * ph);
  vColor = aColor;
  vAlpha = smoothstep(0.0, 0.1, ph) * (1.0 - smoothstep(0.62, 1.0, ph));
  if (uReduced > 0.5) vAlpha = 0.85;
}
`;
const FRAG = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.18, d) * vAlpha * uOpacity;
  gl_FragColor = vec4(vColor, a);
  #include <colorspace_fragment>
}
`;

export interface HeatFlowMotesProps {
  house: HouseModel;
  quantities: SceneQuantities;
  reducedMotion: boolean;
  night: boolean;
  store?: SelectionStore;
}

export function moteGeometry(field: MoteField): BufferGeometry {
  const n = Math.min(field.count, MAX_MOTES);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(field.origins.slice(0, n * 3), 3));
  g.setAttribute('aDir', new BufferAttribute(field.dirs.slice(0, n * 3), 3));
  g.setAttribute('aParam', new BufferAttribute(field.params.slice(0, n * 4), 4));
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = netsuLinear(field.params[i * 4 + 2]!);
    colors.set(c, i * 3);
  }
  g.setAttribute('aColor', new BufferAttribute(colors, 3));
  g.computeBoundingSphere();
  return g;
}

export function HeatFlowMotes({ house, quantities, reducedMotion, night, store }: HeatFlowMotesProps) {
  const dpr = useThree((s) => s.viewport.dpr);
  const field = useMemo(() => buildMotes(house, quantities), [house, quantities]);
  const geom = useMemo(() => moteGeometry(field), [field]);
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: 7 },
          uPixelRatio: { value: 1 },
          uReduced: { value: 0 },
          uHl: { value: -1 },
          uOpacity: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => geom.dispose(), [geom]);
  useEffect(() => () => mat.dispose(), [mat]);
  const sel = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.get ?? nullState,
    store?.get ?? nullState,
  );
  const hlIndex = useMemo(() => {
    const t = sel?.focus ?? sel?.selected;
    if (!t) return -1;
    return field.sources.findIndex((s) =>
      t.kind === 'element' ? s.elementId === t.id : t.kind === 'junction' ? s.junctionId === t.id : false,
    );
  }, [sel, field]);
  const start = useRef(performance.now());
  useTicker(!reducedMotion, 30);
  useFrame(() => {
    const u = mat.uniforms;
    u.uTime!.value = reducedMotion ? 0 : (performance.now() - start.current) / 1000;
    u.uPixelRatio!.value = dpr;
    u.uReduced!.value = reducedMotion ? 1 : 0;
    u.uHl!.value = hlIndex;
    u.uSize!.value = night ? 8 : 7;
    mat.blending = night ? AdditiveBlending : NormalBlending;
  });
  return (
    <OverlayGroup name="heat-flow">
      <points geometry={geom} material={mat} frustumCulled={false} />
    </OverlayGroup>
  );
}

const noopSubscribe = (): (() => void) => () => {};
const nullState = (): null => null;
