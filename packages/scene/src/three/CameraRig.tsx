/**
 * Cameras (ARCH 10): orthographic by default with 45 degree azimuth snaps; perspective only
 * for the roof lift, blended to orthographic by projection matrix. Driven by the shared
 * `CameraModel`, so WebGL and SVG agree (G4). Owner: WP-07.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { OrthographicCamera, PerspectiveCamera } from 'three';
import { type CameraModel, eyeDirection, snapAzimuth } from '../camera/model.ts';
import {
  blendMatrices,
  type CameraKey,
  type CameraSequence,
  sampleSequence,
  sequenceDuration,
} from '../camera/sequence.ts';

export interface PlayingSequence {
  seq: CameraSequence;
  /** `performance.now()` at the start. */
  start: number;
}

export interface CameraRigProps {
  model: CameraModel;
  reducedMotion: boolean;
  sequence: PlayingSequence | null;
  onSequenceFrame?: (k: CameraKey) => void;
  onSequenceEnd?: () => void;
  /** Called with the snapped azimuth after a drag. */
  onAzimuth?: (deg: number) => void;
}

/** Apply a camera model to a three.js orthographic camera (exactly what the SVG projects). */
export function applyOrtho(cam: OrthographicCamera, m: CameraModel, zoomK = 1): void {
  const d = eyeDirection(m.azimuthDeg, m.elevationDeg);
  cam.left = -m.viewport.width / 2;
  cam.right = m.viewport.width / 2;
  cam.top = m.viewport.height / 2;
  cam.bottom = -m.viewport.height / 2;
  cam.zoom = m.zoom * zoomK;
  cam.near = 0.1;
  cam.far = m.distance * 2 + 60;
  cam.position.set(
    m.target[0] + d[0] * m.distance,
    m.target[1] + d[1] * m.distance,
    m.target[2] + d[2] * m.distance,
  );
  cam.up.set(0, 1, 0);
  cam.lookAt(m.target[0], m.target[1], m.target[2]);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

const shortest = (from: number, to: number): number => {
  let d = ((((to - from) % 360) + 540) % 360) - 180;
  if (d < -180) d += 360;
  return d;
};

export function CameraRig({
  model,
  reducedMotion,
  sequence,
  onSequenceFrame,
  onSequenceEnd,
  onAzimuth,
}: CameraRigProps) {
  const set = useThree((s) => s.set);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const cams = useMemo(() => {
    const ortho = new OrthographicCamera();
    const persp = new PerspectiveCamera(30, 1, 0.1, 200);
    (ortho as OrthographicCamera & { manual?: boolean }).manual = true;
    (persp as PerspectiveCamera & { manual?: boolean }).manual = true;
    return { ortho, persp };
  }, []);
  const az = useRef(model.azimuthDeg);
  const el = useRef(model.elevationDeg);
  const drag = useRef<{ x: number; az0: number; moved: boolean } | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    set({ camera: sequence ? cams.persp : cams.ortho });
    ended.current = false;
    invalidate();
  }, [sequence, cams, set, invalidate]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new camera model is the trigger to render
  useEffect(() => {
    invalidate();
  }, [model, invalidate]);

  // Drag to turn; release snaps to 45 degrees.
  useEffect(() => {
    const el2 = gl.domElement;
    const down = (e: PointerEvent): void => {
      if (sequence) return;
      drag.current = { x: e.clientX, az0: az.current, moved: false };
    };
    const move = (e: PointerEvent): void => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 4) d.moved = true;
      if (d.moved) {
        az.current = d.az0 - dx * 0.35;
        invalidate();
      }
    };
    const up = (): void => {
      const d = drag.current;
      drag.current = null;
      if (d?.moved) onAzimuth?.(snapAzimuth(az.current));
    };
    el2.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el2.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl, sequence, onAzimuth, invalidate]);

  useFrame((_, delta) => {
    if (sequence) {
      const t = (performance.now() - sequence.start) / 1000;
      const k = sampleSequence(sequence.seq, t);
      const p = cams.persp;
      const d = eyeDirection(k.azimuthDeg, k.elevationDeg);
      const tg = model.target;
      p.fov = k.fovDeg;
      p.aspect = model.viewport.width / Math.max(1, model.viewport.height);
      p.near = 0.1;
      p.far = 200;
      p.position.set(tg[0] + d[0] * k.distance, tg[1] + d[1] * k.distance, tg[2] + d[2] * k.distance);
      p.up.set(0, 1, 0);
      p.lookAt(tg[0], tg[1], tg[2]);
      p.updateProjectionMatrix();
      p.updateMatrixWorld(true);
      if (k.ortho > 0) {
        applyOrtho(
          cams.ortho,
          { ...model, azimuthDeg: k.azimuthDeg, elevationDeg: k.elevationDeg, distance: k.distance },
          k.zoomK,
        );
        const m = blendMatrices(p.projectionMatrix.elements, cams.ortho.projectionMatrix.elements, k.ortho);
        p.projectionMatrix.fromArray(m);
        p.projectionMatrixInverse.copy(p.projectionMatrix).invert();
      }
      az.current = k.azimuthDeg;
      el.current = k.elevationDeg;
      onSequenceFrame?.(k);
      if (t >= sequenceDuration(sequence.seq)) {
        if (!ended.current) {
          ended.current = true;
          onSequenceEnd?.();
        }
      } else {
        invalidate();
      }
      return;
    }
    // Ease towards the model unless dragging; reduced motion jumps.
    if (!drag.current) {
      const dAz = shortest(az.current, model.azimuthDeg);
      const dEl = model.elevationDeg - el.current;
      if (reducedMotion || (Math.abs(dAz) < 0.05 && Math.abs(dEl) < 0.05)) {
        az.current = model.azimuthDeg;
        el.current = model.elevationDeg;
      } else {
        const k = 1 - Math.exp(-delta * 7);
        az.current += dAz * k;
        el.current += dEl * k;
        invalidate();
      }
    }
    applyOrtho(cams.ortho, { ...model, azimuthDeg: az.current, elevationDeg: el.current });
  });

  return null;
}
