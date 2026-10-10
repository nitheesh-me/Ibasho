/**
 * Selection highlight, drawn as an overlay so the baked frame never re-renders for a hover.
 * DOM focus in the outline and pointer hover both land here (ARCH 10). Owner: WP-07.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Color, LessEqualDepth, MeshBasicMaterial } from 'three';
import { capOf, partsOf } from './cache.ts';
import { useSceneData } from './context.tsx';
import { OverlayGroup } from './overlay.tsx';

export function Highlight() {
  const { store, house, composed, palette } = useSceneData();
  const s = useSyncExternalStore(store.subscribe, store.get, store.get);
  const t = s.focus ?? s.selected;
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(palette.windowGlow),
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        depthFunc: LessEqualDepth,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
    [palette.windowGlow],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  if (t?.kind !== 'element') return null;
  const surfaces = composed.filter((c) => c.surface.elementId === t.id && c.mode === 'solid');
  const opening = house.openings.find((o) => o.elementId === t.id);
  return (
    <OverlayGroup name="highlight">
      {surfaces.flatMap((c) => [
        <mesh
          key={`${c.surface.key}:o`}
          geometry={capOf(house, c.surface, 'outer')}
          material={mat}
          position={c.offset}
          renderOrder={3}
        />,
        <mesh
          key={`${c.surface.key}:i`}
          geometry={capOf(house, c.surface, 'inner')}
          material={mat}
          position={c.offset}
          renderOrder={3}
        />,
      ])}
      {opening ? (
        <mesh
          geometry={partsOf(house, opening).glass ?? partsOf(house, opening).frame}
          material={mat}
          renderOrder={3}
        />
      ) : null}
    </OverlayGroup>
  );
}
