/**
 * The washi plinth the miniature stands on, with a strip of London pavement and a kerb at the
 * street side. Shared extent with the SVG renderer (`plinthOf`). Owner: WP-07.
 */
import { useEffect, useMemo } from 'react';
import { PlaneGeometry } from 'three';
import { plinthOf } from '../svg/project.ts';
import type { HouseModel } from '../twin/house.ts';
import { useSceneData } from './context.tsx';

/** A plane whose UVs are in metres, to match the texture tiling of the house. */
function metricPlane(w: number, d: number): PlaneGeometry {
  const g = new PlaneGeometry(w, d);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
  return g;
}

interface Strip {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Pavement between the front face and the street edge of the plinth, and the kerb beyond. */
function streetOf(house: HouseModel): { pave: Strip; kerb: Strip } {
  const p = plinthOf(house);
  const f = house.footprint;
  const n = house.frontNormal;
  const kerb = 0.32;
  if (Math.abs(n[2]) >= Math.abs(n[0])) {
    const front = n[2] < 0;
    const z0 = front ? p.z0 + kerb : f.z1;
    const z1 = front ? f.z0 : p.z1 - kerb;
    const kz = front ? p.z0 + kerb / 2 : p.z1 - kerb / 2;
    const w = p.x1 - p.x0;
    return {
      pave: { x: (p.x0 + p.x1) / 2, z: (z0 + z1) / 2, w, d: z1 - z0 },
      kerb: { x: (p.x0 + p.x1) / 2, z: kz, w, d: kerb },
    };
  }
  const front = n[0] < 0;
  const x0 = front ? p.x0 + kerb : f.x1;
  const x1 = front ? f.x0 : p.x1 - kerb;
  const kx = front ? p.x0 + kerb / 2 : p.x1 - kerb / 2;
  const d = p.z1 - p.z0;
  return {
    pave: { x: (x0 + x1) / 2, z: (p.z0 + p.z1) / 2, w: x1 - x0, d },
    kerb: { x: kx, z: (p.z0 + p.z1) / 2, w: kerb, d },
  };
}

export function Plinth() {
  const { house, materials, settings } = useSceneData();
  const p = plinthOf(house);
  const street = useMemo(() => streetOf(house), [house]);
  const paveGeom = useMemo(() => metricPlane(street.pave.w, street.pave.d), [street]);
  useEffect(() => () => paveGeom.dispose(), [paveGeom]);
  if (!materials) return null;
  const w = p.x1 - p.x0;
  const d = p.z1 - p.z0;
  const side = materials.plinthSide;
  return (
    <group name="plinth">
      <mesh
        position={[(p.x0 + p.x1) / 2, -p.depth / 2, (p.z0 + p.z1) / 2]}
        receiveShadow={settings.shadows}
        material={[side, side, materials.plinth, side, side, side]}
      >
        <boxGeometry args={[w, p.depth, d]} />
      </mesh>
      <mesh
        position={[street.pave.x, 0.012, street.pave.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        material={materials.pavement}
        geometry={paveGeom}
      />
      <mesh position={[street.kerb.x, 0.03, street.kerb.z]} material={materials.stone} receiveShadow>
        <boxGeometry args={[street.kerb.w, 0.06, street.kerb.d]} />
      </mesh>
    </group>
  );
}
