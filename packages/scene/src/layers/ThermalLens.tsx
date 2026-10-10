/**
 * Thermal lens, "Netsu" (SV 3.3): a draggable viewfinder. Inside it, surfaces take the Netsu
 * ramp by modelled surface temperature (inside faces theta_in - U R_si dT, outside faces
 * theta_out + U R_se dT) and junction lines glow by psi times dT (W/m). Outside it, nothing
 * changes. Owner: WP-07.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BoxGeometry, type BufferGeometry, Color, DoubleSide, LessEqualDepth, Matrix4, ShaderMaterial, Vector3 } from 'three';
import type { ComposedSurface } from '../camera/compose.ts';
import { NETSU_RANGE, netsuLinear, tempToT } from '../colour/palette.ts';
import type { SceneQuantities } from '../quantities/types.ts';
import { capOf } from '../three/cache.ts';
import type { LensState } from '../three/context.tsx';
import { OverlayGroup } from '../three/overlay.tsx';
import type { HouseModel } from '../twin/house.ts';

export const R_SE = 0.04;

const VERT = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLens;
uniform float uAlpha;
void main() {
  vec2 d = gl_FragCoord.xy - uLens.xy;
  if (dot(d, d) > uLens.z * uLens.z) discard;
  gl_FragColor = vec4(uColor, uAlpha);
  #include <colorspace_fragment>
}
`;

const FULLSCREEN = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function lensMaterial(
  color: [number, number, number],
  alpha: number,
  depthTest = true,
  vertexShader = VERT,
): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: new Color(...color) },
      uLens: { value: new Vector3(0, 0, 0) },
      uAlpha: { value: alpha },
    },
    transparent: alpha < 1,
    depthTest,
    depthWrite: false,
    depthFunc: LessEqualDepth,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export interface ThermalLensProps {
  house: HouseModel;
  composed: readonly ComposedSurface[];
  quantities: SceneQuantities;
  lens: LensState;
}

interface Piece {
  key: string;
  geometry: BufferGeometry;
  material: ShaderMaterial;
  matrix?: Matrix4;
  junctionId?: string;
  elementId?: string;
}

export function ThermalLens({ house, composed, quantities, lens }: ThermalLensProps) {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const pieces = useMemo(() => {
    const out: Piece[] = [];
    const c = quantities.condition;
    const dT = c.thetaInC - c.thetaOutC;
    const flows = new Map(quantities.elements.map((e) => [e.elementId, e]));
    for (const cs of composed) {
      const s = cs.surface;
      if (cs.mode !== 'solid' || !s.elementId) continue;
      if (s.role === 'roof-slope' || s.role === 'gable') continue;
      const f = flows.get(s.elementId);
      if (!f) continue;
      const inside = netsuLinear(tempToT(f.surfaceC));
      out.push({ key: `${s.key}:in`, geometry: capOf(house, s, 'inner'), material: lensMaterial(inside, 0.92), elementId: s.elementId });
      if (s.role === 'wall' || s.role === 'loft-floor') {
        const outside = netsuLinear(tempToT(c.thetaOutC + f.u * R_SE * dT));
        out.push({ key: `${s.key}:out`, geometry: capOf(house, s, 'outer'), material: lensMaterial(outside, 0.92), elementId: s.elementId });
      }
    }
    for (const o of house.openings) {
      const f = flows.get(o.elementId);
      if (!f) continue;
      const t = tempToT(f.surfaceC);
      const g = new BoxGeometry(o.width, o.height, 0.02);
      const m = new Matrix4().makeBasis(new Vector3(...o.frame.u), new Vector3(...o.frame.v), new Vector3(...o.frame.n));
      m.setPosition(...o.corner);
      g.translate(o.width / 2, o.height / 2, -0.09);
      g.applyMatrix4(m);
      out.push({ key: `op:${o.elementId}`, geometry: g, material: lensMaterial(netsuLinear(t), 0.95), elementId: o.elementId });
    }
    const jf = new Map(quantities.junctions.map((j) => [j.junctionId, j]));
    for (const j of house.junctions) {
      const q = jf.get(j.junctionId);
      if (!q || j.path.length < 2) continue;
      // Brightness proportional to psi dT: 8 W/m maps to the top of the ramp.
      const t = Math.min(1, 0.35 + q.wPerM / 8);
      for (let i = 1; i < j.path.length; i++) {
        const a = new Vector3(...j.path[i - 1]!);
        const b = new Vector3(...j.path[i]!);
        const len = a.distanceTo(b);
        const w = 0.035 + Math.min(0.06, q.wPerM * 0.01);
        const g = new BoxGeometry(w, w, len);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const m = new Matrix4().lookAt(a, b, Math.abs(b.y - a.y) > 0.9 * len ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0));
        m.setPosition(mid);
        g.applyMatrix4(m);
        out.push({ key: `jn:${j.junctionId}:${i}`, geometry: g, material: lensMaterial(netsuLinear(t), 1), junctionId: j.junctionId });
      }
    }
    return out;
  }, [house, composed, quantities]);

  const backdrop = useMemo(() => lensMaterial(netsuLinear(0), 0.62, false, FULLSCREEN), []);
  useEffect(
    () => () => {
      for (const p of pieces) {
        p.material.dispose();
        if (p.key.startsWith('op:') || p.key.startsWith('jn:')) p.geometry.dispose();
      }
    },
    [pieces],
  );
  useEffect(() => () => backdrop.dispose(), [backdrop]);

  useFrame(() => {
    const x = lens.x * dpr;
    const y = (size.height - lens.y) * dpr;
    const r = lens.r * dpr;
    backdrop.uniforms.uLens!.value.set(x, y, r);
    for (const p of pieces) p.material.uniforms.uLens!.value.set(x, y, r);
  });

  return (
    <OverlayGroup name="thermal-lens">
      <mesh material={backdrop} frustumCulled={false} renderOrder={-1}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      {pieces.map((p) => (
        <mesh
          key={p.key}
          geometry={p.geometry}
          material={p.material}
          renderOrder={p.junctionId ? 2 : 1}
          userData={p.junctionId ? { junctionId: p.junctionId } : { elementId: p.elementId }}
        />
      ))}
    </OverlayGroup>
  );
}

/** Legend range shared with the DOM legend. */
export const LENS_RANGE = NETSU_RANGE;
