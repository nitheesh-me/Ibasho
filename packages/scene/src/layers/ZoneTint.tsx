/**
 * Zone tint (SPEC 5.3, DESIGN_SYSTEM 10): rooms take the Netsu colour of their SAP zone
 * temperature (living area, rest of home). The zone is named on the stage; no single-room claim.
 * Owner: WP-07.
 */
import { useEffect, useMemo } from 'react';
import { BoxGeometry, Color, DoubleSide, LessEqualDepth, MeshBasicMaterial, PlaneGeometry } from 'three';
import { netsuLinear, tempToT } from '../colour/palette.ts';
import type { SceneQuantities } from '../quantities/types.ts';
import { OverlayGroup } from '../three/overlay.tsx';
import type { HouseModel, Room } from '../twin/house.ts';

export interface ZoneTintProps {
  house: HouseModel;
  quantities: SceneQuantities;
  /** Room tints get a little stronger when a zone is focused. */
  focusZone?: 'living' | 'rest' | null;
}

function tintMaterial(rgb: [number, number, number], opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: new Color(...rgb),
    transparent: true,
    opacity,
    depthWrite: false,
    depthFunc: LessEqualDepth,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

export function ZoneTint({ house, quantities, focusZone }: ZoneTintProps) {
  const parts = useMemo(() => {
    const temps = new Map(quantities.zones.map((z) => [z.zone, z.tempC]));
    return house.rooms.map((r: Room) => {
      const c = netsuLinear(tempToT(temps.get(r.zone) ?? quantities.condition.thetaInC));
      const w = r.max[0] - r.min[0] - 0.06;
      const h = r.max[1] - r.min[1] - 0.04;
      const d = r.max[2] - r.min[2] - 0.06;
      const floor = new PlaneGeometry(w, d);
      floor.rotateX(-Math.PI / 2);
      floor.translate((r.min[0] + r.max[0]) / 2, r.min[1] + 0.015, (r.min[2] + r.max[2]) / 2);
      const vol = new BoxGeometry(w, h, d);
      vol.translate((r.min[0] + r.max[0]) / 2, (r.min[1] + r.max[1]) / 2, (r.min[2] + r.max[2]) / 2);
      return { room: r, floor, vol, floorMat: tintMaterial(c, 0.5), volMat: tintMaterial(c, 0.1) };
    });
  }, [house, quantities]);
  useEffect(
    () => () => {
      for (const p of parts) {
        p.floor.dispose();
        p.vol.dispose();
        p.floorMat.dispose();
        p.volMat.dispose();
      }
    },
    [parts],
  );
  useEffect(() => {
    for (const p of parts) {
      const on = focusZone === p.room.zone;
      p.floorMat.opacity = on ? 0.7 : 0.5;
      p.volMat.opacity = on ? 0.2 : 0.1;
    }
  }, [parts, focusZone]);
  return (
    <OverlayGroup name="zone-tint">
      {parts.map((p) => (
        <group key={p.room.id} userData={{ zone: p.room.zone }}>
          <mesh geometry={p.floor} material={p.floorMat} renderOrder={1} userData={{ zone: p.room.zone }} />
          <mesh geometry={p.vol} material={p.volMat} renderOrder={1} userData={{ zone: p.room.zone }} />
        </group>
      ))}
    </OverlayGroup>
  );
}
