/**
 * Overlay helpers: everything under `<OverlayGroup>` renders on the overlay layer, which the
 * still-life composite draws over the baked frame. Owner: WP-07.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import type { Group } from 'three';
import { OVERLAY_LAYER } from './context.tsx';

export function OverlayGroup({ children, name }: { children: ReactNode; name?: string }) {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => o.layers.set(OVERLAY_LAYER));
  });
  // Children mounted by Suspense or lazily get their layer on the next frame.
  useFrame(() => {
    ref.current?.traverse((o) => {
      if (o.layers.mask !== 1 << OVERLAY_LAYER) o.layers.set(OVERLAY_LAYER);
    });
  });
  return (
    <group ref={ref} {...(name ? { name } : {})}>
      {children}
    </group>
  );
}

/** Ask for frames at about `fps` while `on` (overlays animate over the still life). */
export function useTicker(on: boolean, fps = 30): void {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => invalidate(), 1000 / fps);
    return () => clearInterval(id);
  }, [on, fps, invalidate]);
}
