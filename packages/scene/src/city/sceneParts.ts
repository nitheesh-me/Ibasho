/**
 * City scene building blocks: fat ink lines, the hero's site plinth, lantern light pools and halos,
 * the daylight tray, the sun path and the orthographic camera with a chrome safe area.
 * Owner: WP-07.
 */
import type { BuildingDoc } from '@ibasho/core';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  DoubleSide,
  NearestFilter,
  type OrthographicCamera,
  RGBAFormat,
  ShaderMaterial,
  SpriteMaterial,
  UnsignedByteType,
} from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { boxOf, type EN, planToEN } from './frame.ts';
import type { HeroModel } from './hero.ts';
import { rampTexture } from './materials.ts';
import { passMask } from './preview.ts';
import type { DaylightGrid } from './types.ts';
import { type CityView, eyeVector } from './view.ts';

/** Height of the hero's site board, metres (a card plinth in a studio model, QA B4). */
export const PLINTH_M = 0.6;

/** Screen space insets (CSS px) the chrome covers; the camera frames inside the rest. */
export interface SafeArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export const NO_INSETS: SafeArea = { left: 0, top: 0, right: 0, bottom: 0 };

/**
 * Place the orthographic camera so the view's target sits at the centre of the safe rectangle and
 * `halfH` spans the safe height. `shift` moves the target in world metres (drawer).
 */
export function applyView(
  camera: OrthographicCamera,
  v: CityView,
  size: { width: number; height: number },
  safe: SafeArea = NO_INSETS,
  shift: [number, number] = [0, 0],
): void {
  const eye = eyeVector(v.azimuthDeg, v.elevationDeg);
  const dist = 2500;
  const tE = v.target[0] + shift[0];
  const tH = v.target[1];
  const tN = v.target[2] - shift[1];
  camera.position.set(tE + eye[0] * dist, tH + eye[1] * dist, -tN + eye[2] * dist);
  camera.up.set(0, 1, 0);
  camera.lookAt(tE, tH, -tN);
  const W = Math.max(1, size.width);
  const H = Math.max(1, size.height);
  const safeH = Math.max(80, H - safe.top - safe.bottom);
  const wpp = (2 * v.halfH) / safeH;
  const cx = safe.left + (W - safe.left - safe.right) / 2;
  const cy = safe.top + safeH / 2;
  camera.left = -cx * wpp;
  camera.right = (W - cx) * wpp;
  camera.top = cy * wpp;
  camera.bottom = -(H - cy) * wpp;
  camera.near = 1;
  camera.far = 6000;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
}

/** Screen pixel lines (DS 13.1: the hero's 1.5 px ink outline), from segment pairs in world metres. */
export function fatLines(
  positions: readonly number[],
  colour: string,
  widthPx: number,
  opts: { opacity?: number; dashed?: boolean; depthTest?: boolean } = {},
): LineSegments2 {
  const g = new LineSegmentsGeometry();
  g.setPositions(positions.length ? (positions as number[]) : [0, 0, 0, 0, 0, 0]);
  const m = new LineMaterial({
    color: new Color(colour).getHex(),
    linewidth: widthPx,
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
    dashed: !!opts.dashed,
    dashSize: 1.6,
    gapSize: 1.2,
    depthTest: opts.depthTest ?? true,
  });
  const l = new LineSegments2(g, m);
  if (opts.dashed) l.computeLineDistances();
  l.raycast = () => {};
  return l;
}

/** The plan rectangle of the hero grown by `margin` m, in the pack frame (rotated with the plan). */
export function plinthRing(doc: BuildingDoc | null, hero: HeroModel, margin = 9): EN[] {
  if (!doc) {
    const b = hero.box;
    return [
      [b.minE - margin, b.minN - margin],
      [b.maxE + margin, b.minN - margin],
      [b.maxE + margin, b.maxN + margin],
      [b.minE - margin, b.maxN + margin],
    ];
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const st of doc.storeys)
    for (const r of st.rooms)
      for (const [x, y] of r.floor.outer) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  const m = margin * 1000;
  return [
    planToEN(doc, [x0 - m, y0 - m]),
    planToEN(doc, [x1 + m, y0 - m]),
    planToEN(doc, [x1 + m, y1 + m]),
    planToEN(doc, [x0 - m, y1 + m]),
  ];
}

/** A soft additive pool of light on the ground (lantern end use hue, QA B1). */
export function poolMaterial(colour: string, strength: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColour: { value: new Color(colour) }, uStrength: { value: strength } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`,
    fragmentShader: /* glsl */ `
uniform vec3 uColour;
uniform float uStrength;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.0, 1.0, r));
  gl_FragColor = vec4(uColour * a * a * 0.4 * uStrength, 1.0);
}
`,
  });
}

let haloTex: CanvasTexture | null = null;
/** A radial halo sprite (the tier 0 stand in for bloom on emissives). */
export function haloMaterial(colour: string, strength: number): SpriteMaterial {
  if (!haloTex && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    haloTex = new CanvasTexture(c);
  }
  return new SpriteMaterial({
    ...(haloTex ? { map: haloTex } : {}),
    color: new Color(colour),
    transparent: true,
    opacity: Math.min(0.85, 0.3 * strength),
    depthWrite: false,
    // A glow is light in the air: never cut by the ground plane (round 4 night city).
    depthTest: false,
    blending: AdditiveBlending,
  });
}

/** Footprint centre and span (m) of a ring. */
export function ringCentre(ring: readonly EN[]): { c: EN; span: number } {
  const b = boxOf(ring);
  return {
    c: [(b.minE + b.maxE) / 2, (b.minN + b.maxN) / 2],
    span: Math.max(b.maxE - b.minE, b.maxN - b.minN),
  };
}

/**
 * The daylight map on a dark tray (moment 4, QA B5): passing points take the Akari ramp and read as
 * light spreading in from the glass; failing points stay tray with a fine dot grid; ASE over 250 h
 * takes the warm 45 degree hatch; the pass boundary is one crisp `--glow` line.
 */
export function daylightMesh(
  g: DaylightGrid,
  doc: Pick<BuildingDoc, 'origin' | 'rotationMdeg'>,
  y: number,
  colours: { tray: string; dot: string; warm: string; line: string },
): { geometry: BufferGeometry; material: ShaderMaterial; dispose: () => void } {
  const data = new Uint8Array(g.cols * g.rows * 4);
  const pass = passMask(g);
  for (let i = 0; i < g.cols * g.rows; i++) {
    const v = g.sda[i];
    if (v === null || v === undefined) continue;
    data[i * 4] = Math.round(Math.max(0, Math.min(100, v)) * 2.55);
    data[i * 4 + 1] = pass[i] ? 255 : 0;
    data[i * 4 + 2] = (g.ase?.[i] ?? 0) > 250 ? 255 : 0;
    data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, g.cols, g.rows, RGBAFormat, UnsignedByteType);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.needsUpdate = true;
  const [ox, oy] = g.originMm;
  const corner = (cx: number, cy: number): number[] => {
    const [e, n] = planToEN(doc, [ox + cx * g.cellMm, oy + cy * g.cellMm]);
    return [e, y, -n];
  };
  const pos = new Float32Array([
    ...corner(0, 0),
    ...corner(g.cols, 0),
    ...corner(g.cols, g.rows),
    ...corner(0, g.rows),
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const material = new ShaderMaterial({
    uniforms: {
      uData: { value: tex },
      uRamp: { value: rampTexture('akari') },
      uSize: { value: [g.cols, g.rows] },
      uTray: { value: new Color(colours.tray) },
      uDot: { value: new Color(colours.dot) },
      uWarm: { value: new Color(colours.warm) },
      uLine: { value: new Color(colours.line) },
    },
    side: DoubleSide,
    vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`,
    fragmentShader: /* glsl */ `
uniform sampler2D uData;
uniform sampler2D uRamp;
uniform vec2 uSize;
uniform vec3 uTray;
uniform vec3 uDot;
uniform vec3 uWarm;
uniform vec3 uLine;
varying vec2 vUv;
float passAt(vec2 cell) {
  vec4 d = texture2D(uData, (floor(cell) + 0.5) / uSize);
  return d.a > 0.5 ? d.g : -1.0;
}
void main() {
  vec4 d = texture2D(uData, vUv);
  if (d.a < 0.5) discard;
  vec2 cell = vUv * uSize;
  vec2 f = fract(cell);
  vec3 c = d.g > 0.5 ? texture2D(uRamp, vec2(0.35 + 0.65 * d.r, 0.5)).rgb : uTray;
  if (d.g < 0.5 && length(f - 0.5) < 0.12) c = mix(uTray, uDot, 0.3);
  if (d.b > 0.5 && fract((cell.x + cell.y) * 1.5) < 0.28) c = uWarm;
  // Pass boundary: a crisp line where a neighbouring room cell flips pass and fail.
  float me = d.g;
  float w = 0.09;
  float l = passAt(cell - vec2(1.0, 0.0));
  float r = passAt(cell + vec2(1.0, 0.0));
  float b = passAt(cell - vec2(0.0, 1.0));
  float t = passAt(cell + vec2(0.0, 1.0));
  bool edge = (f.x < w && l >= 0.0 && l != me) || (f.x > 1.0 - w && r >= 0.0 && r != me)
    || (f.y < w && b >= 0.0 && b != me) || (f.y > 1.0 - w && t >= 0.0 && t != me);
  if (edge) c = uLine;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,
  });
  return {
    geometry,
    material,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      tex.dispose();
    },
  };
}

/** The sun's path over one day as segment pairs (world), at radius `r` around `centre` (QA M6). */
export function sunPathSegments(
  dirs: readonly [number, number, number][],
  centre: [number, number, number],
  r: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < dirs.length; i++) {
    const a = dirs[i]!;
    const b = dirs[i + 1]!;
    out.push(centre[0] + a[0] * r, centre[1] + a[1] * r, centre[2] + a[2] * r);
    out.push(centre[0] + b[0] * r, centre[1] + b[1] * r, centre[2] + b[2] * r);
  }
  return out;
}

export { LineMaterial, LineSegments2 };
