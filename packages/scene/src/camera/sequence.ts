/**
 * Camera sequences as plain JSON keyframes (ARCH 10, DEC: no Theatre.js). Owner: WP-07.
 * The roof lift (SV 3.1): street-level perspective, the roof floats up 2 m, the ceiling
 * dissolves, and the projection blends to the orthographic cutaway over 1.4 s.
 */

export interface CameraKey {
  /** Seconds from the start. */
  t: number;
  azimuthDeg: number;
  elevationDeg: number;
  /** Eye distance from target, metres. */
  distance: number;
  /** Perspective vertical field of view, degrees. */
  fovDeg: number;
  /** 0 is perspective, 1 is orthographic. */
  ortho: number;
  /** How far the roof has lifted, metres. */
  roofLiftM: number;
  /** 1 is a solid ceiling, 0 has dissolved. */
  ceiling: number;
  /** Fraction of the fitted orthographic zoom (1 is fitted). */
  zoomK: number;
  /** Section cut of the camera-facing party wall: 0 closed, 1 open (switches at 0.5). */
  cut: number;
}

export interface CameraSequence {
  id: string;
  keys: CameraKey[];
  /** Ease applied between keys. */
  ease: 'smooth' | 'linear';
}

export const ROOF_LIFT: CameraSequence = {
  id: 'roof-lift',
  ease: 'smooth',
  keys: [
    {
      t: 0,
      azimuthDeg: 20,
      elevationDeg: 6,
      distance: 17,
      fovDeg: 38,
      ortho: 0,
      roofLiftM: 0,
      ceiling: 1,
      zoomK: 1,
      cut: 0,
    },
    {
      t: 1.2,
      azimuthDeg: 30,
      elevationDeg: 12,
      distance: 18,
      fovDeg: 36,
      ortho: 0,
      roofLiftM: 0,
      ceiling: 1,
      zoomK: 1,
      cut: 0,
    },
    {
      t: 2.4,
      azimuthDeg: 40,
      elevationDeg: 24,
      distance: 22,
      fovDeg: 30,
      ortho: 0,
      roofLiftM: 2,
      ceiling: 0.6,
      zoomK: 1,
      cut: 1,
    },
    {
      t: 3.8,
      azimuthDeg: 45,
      elevationDeg: 30,
      distance: 30,
      fovDeg: 24,
      ortho: 1,
      roofLiftM: 2,
      ceiling: 0,
      zoomK: 1,
      cut: 1,
    },
  ],
};

export function sequenceDuration(s: CameraSequence): number {
  return s.keys[s.keys.length - 1]?.t ?? 0;
}

const smooth = (x: number): number => x * x * (3 - 2 * x);

/** Keyframe state at time t (clamped to the sequence). */
export function sampleSequence(s: CameraSequence, t: number): CameraKey {
  const keys = s.keys;
  if (keys.length === 0) throw new Error(`sequence ${s.id} has no keys`);
  if (t <= keys[0]!.t) return { ...keys[0]! };
  const last = keys[keys.length - 1]!;
  if (t >= last.t) return { ...last };
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1]!.t) i++;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const raw = (t - a.t) / (b.t - a.t);
  const f = s.ease === 'smooth' ? smooth(raw) : raw;
  const mix = (x: number, y: number): number => x + (y - x) * f;
  return {
    t,
    azimuthDeg: mix(a.azimuthDeg, b.azimuthDeg),
    elevationDeg: mix(a.elevationDeg, b.elevationDeg),
    distance: mix(a.distance, b.distance),
    fovDeg: mix(a.fovDeg, b.fovDeg),
    ortho: mix(a.ortho, b.ortho),
    roofLiftM: mix(a.roofLiftM, b.roofLiftM),
    ceiling: mix(a.ceiling, b.ceiling),
    zoomK: mix(a.zoomK, b.zoomK),
    cut: mix(a.cut, b.cut),
  };
}

/** Reduced motion: no travel, the end state at once (DESIGN_SYSTEM 5, BUILD_PLAN G6). */
export function reducedSequence(s: CameraSequence): CameraSequence {
  const last = s.keys[s.keys.length - 1]!;
  return { id: `${s.id}:reduced`, ease: 'linear', keys: [{ ...last, t: 0 }] };
}

/**
 * Column-major 4x4 blend of a perspective and an orthographic projection matrix. Element-wise
 * mixing keeps both endpoints exact, which is what the handover parity test needs.
 */
export function blendMatrices(persp: ArrayLike<number>, ortho: ArrayLike<number>, k: number): number[] {
  const out: number[] = [];
  // (1 - k) * a + k * b, not a + (b - a) * k: only this form is exact in floats at k = 1.
  for (let i = 0; i < 16; i++) out.push((1 - k) * persp[i]! + k * ortho[i]!);
  return out;
}
