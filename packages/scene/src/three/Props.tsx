/**
 * Furniture from the hero asset set (Kenney, Quaternius; WP-11 manifest), muted towards paper.
 * Each prop falls back to a soft paper block when its model is missing or fails to load.
 * Owner: WP-07.
 */
import { useGLTF } from '@react-three/drei';
import { Component, type ReactNode, Suspense, useEffect, useMemo } from 'react';
import { Color, type Material, type Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { layoutProps, type PropItem } from '../twin/layout.ts';
import { modelUrl } from './assets.ts';
import { useSceneData } from './context.tsx';

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Block({ p }: { p: PropItem }) {
  const { palette, settings } = useSceneData();
  return (
    <mesh position={[p.position[0], p.position[1] + p.size[1] / 2, p.position[2]]} rotation={[0, p.rotY, 0]} castShadow={settings.shadows} receiveShadow>
      <boxGeometry args={p.size} />
      <meshStandardMaterial color={palette.ceiling} roughness={1} />
    </mesh>
  );
}

function Model({ p, url }: { p: PropItem; url: string }) {
  const { palette, settings, invalidateBake, theme } = useSceneData();
  const gltf = useGLTF(url, false, true);
  const obj = useMemo(() => {
    const paper = new Color(palette.ceiling);
    const root = gltf.scene.clone(true) as Object3D;
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = settings.shadows;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const muted = mats.map((x: Material) => {
        const k = x.clone() as MeshStandardMaterial;
        if (k instanceof MeshStandardMaterial) {
          k.color.lerp(paper, theme === 'yoru' ? 0.15 : 0.32);
          k.roughness = Math.max(k.roughness, 0.8);
          k.metalness = 0;
        }
        return k;
      });
      m.material = Array.isArray(m.material) ? muted : muted[0]!;
    });
    return root;
  }, [gltf, palette.ceiling, settings.shadows, theme]);
  useEffect(() => {
    invalidateBake();
  }, [obj, invalidateBake]);
  return <primitive object={obj} position={p.position} rotation={[0, p.rotY, 0]} />;
}

export function Props() {
  const { house, assets, settings } = useSceneData();
  const items = useMemo(() => layoutProps(house), [house]);
  if (!settings.furniture) return null;
  return (
    <group name="props">
      {items.map((p) => {
        const url = modelUrl(assets, p.assetId);
        if (!url) return <Block key={p.key} p={p} />;
        return (
          <Boundary key={p.key} fallback={<Block p={p} />}>
            <Suspense fallback={null}>
              <Model p={p} url={url} />
            </Suspense>
          </Boundary>
        );
      })}
    </group>
  );
}
