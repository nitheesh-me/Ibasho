/**
 * City materials: paper model look, lens paint by shader injection (no extra draw calls), wick and
 * hatch. Owner: WP-07.
 */
import {
  type BufferAttribute,
  Color,
  DataTexture,
  LinearFilter,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  RedFormat,
  RGBAFormat,
  SRGBColorSpace,
  type Texture,
  UnsignedByteType,
} from 'three';
import { type CityRampId, rampBytes } from './ramps.ts';
import type { Grid } from './shadow.ts';

/** Uniforms shared by every lens painted material in one stage. */
export interface LensUniforms {
  uGrid: { value: Texture | null };
  /** minE, minN, sizeE, sizeN of the grid (m). */
  uGridBox: { value: [number, number, number, number] };
  uGridOn: { value: number };
  uRamp: { value: Texture | null };
  /** Wick front height (m): above it, painted surfaces stay paper (moment 3). */
  uWick: { value: number };
  uPaper: { value: Color };
  uPixelRatio: { value: number };
  /** Night lantern skin (moment 8): 0 by day, 1 at night. */
  uNight: { value: number };
  /** Lamplight colour (linear) and strength for the hero's lit window grid. */
  uLamp: { value: Color };
  uLampK: { value: number };
  /** Storey height and the height of the hero's ground floor (plinth top), metres. */
  uFloorH: { value: number };
  uBase: { value: number };
}

export function createLensUniforms(): LensUniforms {
  return {
    uGrid: { value: null },
    uGridBox: { value: [0, 0, 1, 1] },
    uGridOn: { value: 0 },
    uRamp: { value: null },
    uWick: { value: 1e6 },
    uPaper: { value: new Color('#f4eee3') },
    uPixelRatio: { value: 1 },
    uNight: { value: 0 },
    uLamp: { value: new Color('#ffd9a0') },
    uLampK: { value: 1 },
    uFloorH: { value: 3.9 },
    uBase: { value: 0 },
  };
}

const rampCache = new Map<CityRampId, DataTexture>();
export function rampTexture(id: CityRampId): DataTexture {
  let t = rampCache.get(id);
  if (!t) {
    t = new DataTexture(rampBytes(id), 256, 1, RGBAFormat, UnsignedByteType);
    t.colorSpace = SRGBColorSpace;
    t.magFilter = LinearFilter;
    t.minFilter = LinearFilter;
    t.needsUpdate = true;
    rampCache.set(id, t);
  }
  return t;
}

/** A single channel grid texture (values 0 to 1, byte encoded), updated in place. */
export function gridTexture(g: Grid): DataTexture {
  const t = new DataTexture(new Uint8Array(g.cols * g.rows), g.cols, g.rows, RedFormat, UnsignedByteType);
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

export function writeGrid(t: DataTexture, values: Float32Array, max: number, mask?: Uint8Array): void {
  const data = t.image.data as Uint8Array;
  for (let i = 0; i < values.length; i++) {
    const v = mask?.[i] ? 0 : values[i]! / max;
    data[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
  }
  t.needsUpdate = true;
}

export interface LensFlags {
  /** Sample the grid lens by world position (ground and roofs). */
  grid?: boolean;
  /** Honour the wick front. */
  wick?: boolean;
  /**
   * 45 degree pencil hatch (penumbra, uncertain bands): discard between strokes. `screen` sets the
   * pitch in CSS pixels (DS 13.1: 6 px), so it never moirés at city zoom.
   */
  hatch?: { pitch: number; duty: number; vertical?: boolean; screen?: boolean };
  /** Emissive from the vertex colour (per building lantern light, one draw call). */
  vertexEmissive?: boolean;
  /**
   * Lantern skin: at night walls glow as paper lit from within, with a lit window grid per storey
   * (sill 0.9 m, head 2.4 m, 1.5 m bays) in lamplight; roofs take a soft inner glow.
   */
  lantern?: 'wall' | 'roof';
}

/** A standard material with the lens chunks injected. */
export function lensMaterial(
  params: MeshStandardMaterialParameters,
  u: LensUniforms,
  flags: LensFlags,
): MeshStandardMaterial {
  const m = new MeshStandardMaterial(params);
  const key = `city-lens-${flags.grid ? 'g' : ''}${flags.wick ? 'w' : ''}${flags.vertexEmissive ? 'e' : ''}${flags.lantern ? `l${flags.lantern}` : ''}${flags.hatch ? `h${flags.hatch.pitch}${flags.hatch.duty}${flags.hatch.vertical ? 'v' : ''}${flags.hatch.screen ? 's' : ''}` : ''}`;
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityWorld;\nvarying vec3 vCityN;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvCityWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCityN = normalize(mat3(modelMatrix) * objectNormal);',
      );
    let frag = `
varying vec3 vCityWorld;
varying vec3 vCityN;
uniform float uNight;
uniform vec3 uLamp;
uniform float uLampK;
uniform float uFloorH;
uniform float uBase;
uniform sampler2D uGrid;
uniform vec4 uGridBox;
uniform float uGridOn;
uniform sampler2D uRamp;
uniform float uWick;
uniform vec3 uPaper;
uniform float uPixelRatio;
`;
    frag = shader.fragmentShader.replace('#include <common>', `#include <common>\n${frag}`);
    let paint = '';
    if (flags.hatch) {
      const h = flags.hatch;
      const coord = h.screen
        ? '((gl_FragCoord.x + gl_FragCoord.y) / uPixelRatio)'
        : h.vertical
          ? '(vCityWorld.x - vCityWorld.z + vCityWorld.y)'
          : '(vCityWorld.x + vCityWorld.z)';
      paint += `if (fract(${coord} / ${h.pitch.toFixed(3)}) > ${h.duty.toFixed(3)}) discard;\n`;
    }
    if (flags.grid)
      paint += `
if (uGridOn > 0.5) {
  vec2 guv = (vec2(vCityWorld.x, -vCityWorld.z) - uGridBox.xy) / uGridBox.zw;
  if (guv.x > 0.0 && guv.x < 1.0 && guv.y > 0.0 && guv.y < 1.0) {
    float gv = texture2D(uGrid, guv).r;
    // Radial soft edge over the outer 12%, so the compute domain never shows as a square.
    float edge = 1.0 - smoothstep(0.76, 1.0, length(guv - 0.5) * 2.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uRamp, vec2(gv, 0.5)).rgb, edge);
  }
}
`;
    if (flags.wick)
      paint += `
float wk = smoothstep(uWick - 0.6, uWick + 0.6, vCityWorld.y);
diffuseColor.rgb = mix(diffuseColor.rgb, uPaper, wk);
`;
    let out = frag.replace('#include <color_fragment>', `#include <color_fragment>\n${paint}`);
    if (flags.lantern === 'wall')
      out = out.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
if (uNight > 0.0) {
  vec2 t = normalize(vec2(-vCityN.z, vCityN.x) + 1e-5);
  float u = dot(vCityWorld.xz, t);
  float h = vCityWorld.y - uBase;
  float v = mod(h, uFloorH);
  float band = smoothstep(0.85, 0.95, v) * (1.0 - smoothstep(2.35, 2.45, v));
  float bay = smoothstep(0.08, 0.14, fract(u / 1.5)) * (1.0 - smoothstep(0.86, 0.92, fract(u / 1.5)));
  float win = band * bay * step(0.0, h);
  // Floors differ a little, like lamps left on in some rooms and not others.
  float room = 0.75 + 0.25 * fract(sin(floor(u / 4.5) * 12.9898 + floor(h / uFloorH) * 78.233) * 43758.5453);
  totalEmissiveRadiance = uLamp * uNight * uLampK * (0.32 + 2.6 * win * room);
}`,
      );
    if (flags.lantern === 'roof')
      out = out.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\nif (uNight > 0.0) totalEmissiveRadiance = uLamp * uNight * uLampK * 0.22;',
      );
    if (flags.vertexEmissive)
      out = out.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance = vColor.rgb;',
      );
    shader.fragmentShader = out;
  };
  return m;
}

/** Linear RGB triple of a CSS hex colour. */
export function linearOf(hex: string): [number, number, number] {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

export function setColour(attr: BufferAttribute, i: number, c: readonly [number, number, number]): void {
  attr.setXYZ(i, c[0], c[1], c[2]);
}
