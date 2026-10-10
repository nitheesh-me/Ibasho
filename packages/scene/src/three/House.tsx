/**
 * The procedural house: one mesh per twin element (walls with brick outside and plaster inside,
 * roof, floors, openings), plus derived structure. Meshes carry `userData.elementId` for
 * picking (ARCH 10). Owner: WP-07.
 */
import { Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import type { Material } from 'three';
import type { Vec3 } from '@ibasho/core';
import type { ComposedSurface } from '../camera/compose.ts';
import { targetOfHit } from '../select/store.ts';
import type { SurfaceRole } from '../twin/house.ts';
import { capOf, geometryOf, partsOf, stairsOf } from './cache.ts';
import { useSceneData } from './context.tsx';
import type { HouseMaterials } from './materials.ts';

function materialsFor(role: SurfaceRole, m: HouseMaterials): Material[] {
  switch (role) {
    case 'wall':
      return [m.brick, m.plaster, m.brick];
    case 'party-wall':
      return [m.partyPlaster, m.partyPlaster, m.partyPlaster];
    case 'gable':
      return [m.brick, m.brick, m.brick];
    case 'roof-slope':
      return [m.slate, m.rafter, m.rafter];
    case 'loft-floor':
      return [m.quilt, m.ceiling, m.quilt];
    case 'ground-floor':
      return [m.plaster, m.boards, m.joist];
    case 'intermediate-floor':
      return [m.boards, m.ceiling, m.joist];
    case 'partition':
      return [m.plaster, m.plaster, m.plaster];
    case 'chimney':
      return [m.brick, m.brick, m.brick];
  }
}

function useHandlers() {
  const { store } = useSceneData();
  return useMemo(
    () => ({
      onPointerOver(e: ThreeEvent<PointerEvent>) {
        e.stopPropagation();
        store.setFocus(targetOfHit(e));
      },
      onPointerOut() {
        store.setFocus(null);
      },
      onClick(e: ThreeEvent<MouseEvent>) {
        e.stopPropagation();
        const t = targetOfHit(e);
        if (t) store.select(t, 'scene');
      },
    }),
    [store],
  );
}

function SurfaceMesh({ c }: { c: ComposedSurface }) {
  const { house, materials, palette, settings } = useSceneData();
  const h = useHandlers();
  const s = c.surface;
  const mats = useMemo(() => {
    if (!materials) return [];
    const base = materialsFor(s.role, materials);
    if (c.opacity >= 0.999) return base;
    return base.map((m) => {
      const k = m.clone();
      k.transparent = true;
      k.opacity = c.opacity;
      k.depthWrite = c.opacity > 0.6;
      return k;
    });
  }, [materials, s.role, c.opacity]);
  if (c.mode === 'hidden' || !materials) return null;
  if (c.mode === 'cut') {
    const pts = [...s.polygon, s.polygon[0]!].map((p) => [p[0] + c.offset[0], p[1] + c.offset[1], p[2] + c.offset[2]] as Vec3);
    return (
      <group>
        <Line points={pts} color={palette.sectionCut} lineWidth={2.2} dashed dashSize={0.25} gapSize={0.12} />
        {/* Invisible hit target so the cut wall can still be picked from the section line. */}
        <mesh
          geometry={capOf(house, s, 'outer')}
          position={c.offset}
          userData={s.elementId ? { elementId: s.elementId } : {}}
          visible={false}
          {...h}
        />
      </group>
    );
  }
  return (
    <mesh
      geometry={geometryOf(house, s)}
      material={mats}
      position={c.offset}
      castShadow={settings.shadows && s.role !== 'loft-floor'}
      receiveShadow={settings.shadows}
      userData={s.elementId ? { elementId: s.elementId } : {}}
      {...(s.elementId ? h : {})}
    />
  );
}

function Openings() {
  const { house, materials, settings } = useSceneData();
  const h = useHandlers();
  if (!materials) return null;
  return (
    <group>
      {house.openings.map((o) => {
        const p = partsOf(house, o);
        const ud = { elementId: o.elementId };
        return (
          <group key={o.elementId}>
            <mesh geometry={p.frame} material={materials.frame} userData={ud} castShadow={settings.shadows} {...h} />
            {p.glass ? <mesh geometry={p.glass} material={materials.glass} userData={ud} {...h} /> : null}
            {p.sill ? <mesh geometry={p.sill} material={materials.stone} userData={ud} castShadow={settings.shadows} receiveShadow {...h} /> : null}
            <mesh geometry={p.lintel} material={materials.brickDressing} userData={ud} {...h} />
            {p.leaf ? <mesh geometry={p.leaf} material={materials.leaf} userData={ud} castShadow={settings.shadows} {...h} /> : null}
          </group>
        );
      })}
    </group>
  );
}

function Chimneys({ lift }: { lift: number }) {
  const { house, materials, settings } = useSceneData();
  const h = useHandlers();
  if (!materials) return null;
  return (
    <group position={[0, lift, 0]}>
      {house.chimneys.map((c, i) => {
        const ud = c.elementId ? { elementId: c.elementId } : {};
        const top = c.base[1] + c.size[1];
        return (
          <group key={`ch${i}`}>
            <mesh
              position={[c.base[0], c.base[1] + c.size[1] / 2, c.base[2]]}
              material={materials.brick}
              userData={ud}
              castShadow={settings.shadows}
              receiveShadow
              {...h}
            >
              <boxGeometry args={c.size} />
            </mesh>
            <mesh position={[c.base[0], top + 0.04, c.base[2]]} material={materials.stone} userData={ud} {...h}>
              <boxGeometry args={[c.size[0] + 0.1, 0.08, c.size[2] + 0.1]} />
            </mesh>
            {[-0.22, 0.22].map((dz, k) => {
              const along = c.size[2] >= c.size[0];
              return (
                <mesh
                  key={k}
                  position={[c.base[0] + (along ? 0 : dz), top + 0.24, c.base[2] + (along ? dz : 0)]}
                  material={materials.pot}
                  userData={ud}
                  castShadow={settings.shadows}
                  {...h}
                >
                  <cylinderGeometry args={[0.09, 0.11, 0.34, 12]} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function StairFlights() {
  const { house, materials, settings } = useSceneData();
  if (!materials) return null;
  return (
    <group>
      {stairsOf(house).map((g, i) => (
        <mesh key={`st${i}`} geometry={g} material={materials.stair} castShadow={settings.shadows} receiveShadow />
      ))}
    </group>
  );
}

export function House() {
  const { composed, view } = useSceneData();
  return (
    <group name="house">
      {composed.map((c) => (
        <SurfaceMesh key={c.surface.key} c={c} />
      ))}
      <Openings />
      <StairFlights />
      <Chimneys lift={view.view === 'cutaway' ? view.roofLiftM : 0} />
    </group>
  );
}
