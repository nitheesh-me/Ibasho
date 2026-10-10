/**
 * House materials (DESIGN_SYSTEM 10: Poly Haven brick, slate and render, desaturated towards
 * paper; muted paper interiors; insulation as soft quilted paper in `--good-soft`).
 * Procedural canvas textures stand in when the hero assets are absent. Owner: WP-07.
 */

import { xoshiro128ss } from '@ibasho/core';
import {
  CanvasTexture,
  type Color,
  DoubleSide,
  LinearSRGBColorSpace,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from 'three';
import { palette, type Theme } from '../colour/palette.ts';
import { type SceneAssets, textureSet } from './assets.ts';

export interface HouseMaterials {
  brick: MeshStandardMaterial;
  brickDressing: MeshStandardMaterial;
  plaster: MeshStandardMaterial;
  partyPlaster: MeshStandardMaterial;
  slate: MeshStandardMaterial;
  rafter: MeshStandardMaterial;
  quilt: MeshStandardMaterial;
  ceiling: MeshStandardMaterial;
  boards: MeshStandardMaterial;
  joist: MeshStandardMaterial;
  frame: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  stone: MeshStandardMaterial;
  leaf: MeshStandardMaterial;
  stair: MeshStandardMaterial;
  plinth: MeshStandardMaterial;
  plinthSide: MeshStandardMaterial;
  pavement: MeshStandardMaterial;
  pot: MeshStandardMaterial;
  section: MeshBasicMaterial;
  dispose(): void;
}

export interface TextureBundle {
  brick?: LoadedSet;
  slate?: LoadedSet;
  stucco?: LoadedSet;
  pavement?: LoadedSet;
}
interface LoadedSet {
  diff: Texture;
  nor?: Texture;
  arm?: Texture;
}

const loader = new TextureLoader();

function loadTex(url: string, srgb: boolean, repeat: number): Promise<Texture> {
  return loader.loadAsync(url).then((t) => {
    t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    return t;
  });
}

async function loadSet(a: SceneAssets, id: string, repeat: number): Promise<LoadedSet | undefined> {
  const urls = textureSet(a, id);
  if (!urls) return undefined;
  try {
    const [diff, nor, arm] = await Promise.all([
      loadTex(urls.diff, true, repeat),
      urls.nor ? loadTex(urls.nor, false, repeat) : Promise.resolve(undefined),
      urls.arm ? loadTex(urls.arm, false, repeat) : Promise.resolve(undefined),
    ]);
    return { diff, ...(nor ? { nor } : {}), ...(arm ? { arm } : {}) };
  } catch {
    return undefined;
  }
}

/** Metres covered by one texture tile (UVs are in metres). */
export const TILE_M = { brick: 1.4, slate: 1.6, stucco: 2.2, pavement: 2 } as const;

export async function loadTextures(a: SceneAssets | null): Promise<TextureBundle> {
  if (!a) return {};
  const [brick, slate, stucco, pavement] = await Promise.all([
    loadSet(a, 'tex-red-brick-03', 1 / TILE_M.brick),
    loadSet(a, 'tex-roof-slates-02', 1 / TILE_M.slate),
    loadSet(a, 'tex-white-stucco', 1 / TILE_M.stucco),
    loadSet(a, 'tex-pavement-02', 1 / TILE_M.pavement),
  ]);
  return {
    ...(brick ? { brick } : {}),
    ...(slate ? { slate } : {}),
    ...(stucco ? { stucco } : {}),
    ...(pavement ? { pavement } : {}),
  };
}

/** Procedural London stock brick (stretcher bond), deterministic. Browser only. */
function brickCanvas(): Texture | undefined {
  if (typeof document === 'undefined') return undefined;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  if (!g) return undefined;
  const r = xoshiro128ss('brick');
  g.fillStyle = '#c9bca4';
  g.fillRect(0, 0, 512, 512);
  const rows = 16;
  const bh = 512 / rows;
  const bw = 512 / 5;
  for (let y = 0; y < rows; y++) {
    const off = y % 2 ? bw / 2 : 0;
    for (let x = -1; x < 6; x++) {
      const v = r.nextFloat();
      const l = 52 + v * 14;
      g.fillStyle = `hsl(${32 + r.nextFloat() * 10}, ${28 + v * 14}%, ${l}%)`;
      g.fillRect(x * bw + off + 2, y * bh + 2, bw - 4, bh - 4);
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(1 / 1.2, 1 / 1.2);
  return t;
}

/** Soft quilt bumps for insulation (paper pillows). */
function quiltCanvas(): Texture | undefined {
  if (typeof document === 'undefined') return undefined;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  if (!g) return undefined;
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 72);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(1, '#b8b8b8');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(1 / 0.6, 1 / 0.6);
  return t;
}

/** Floorboards: long strips with soft value noise. */
function boardsCanvas(base: string): Texture | undefined {
  if (typeof document === 'undefined') return undefined;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) return undefined;
  const r = xoshiro128ss('boards');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  const n = 12;
  const w = 256 / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${r.nextFloat() > 0.5 ? '255,240,220' : '60,40,20'},${0.04 + r.nextFloat() * 0.08})`;
    g.fillRect(i * w, 0, w, 256);
    g.fillStyle = 'rgba(40,25,10,0.25)';
    g.fillRect(i * w, 0, 1, 256);
    const cut = r.nextFloat() * 256;
    g.fillRect(i * w, cut, w, 1);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(1 / 1.8, 1 / 1.8);
  return t;
}

function std(opts: ConstructorParameters<typeof MeshStandardMaterial>[0]): MeshStandardMaterial {
  return new MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...opts });
}

function withSet(m: MeshStandardMaterial, s: LoadedSet | undefined): MeshStandardMaterial {
  if (!s) return m;
  m.map = s.diff;
  if (s.nor) {
    m.normalMap = s.nor;
    m.normalScale.set(0.8, 0.8);
  }
  if (s.arm) {
    m.aoMap = s.arm;
    m.roughnessMap = s.arm;
    m.aoMapIntensity = 0.6;
  }
  m.needsUpdate = true;
  return m;
}

export function createMaterials(theme: Theme, tex: TextureBundle): HouseMaterials {
  const p = palette(theme);
  const night = theme === 'yoru';
  const brickTex = tex.brick ? undefined : brickCanvas();
  const brick = withSet(
    std({
      color: tex.brick ? '#e8ddd2' : '#ffffff',
      ...(brickTex ? { map: brickTex } : {}),
      roughness: 0.92,
    }),
    tex.brick,
  );
  const brickDressing = std({ color: night ? '#6a5a4c' : '#e9dfcf', roughness: 0.85 });
  const plaster = withSet(std({ color: p.interiorWall, roughness: 0.95 }), tex.stucco);
  const partyPlaster = std({ color: p.interiorWall, roughness: 0.95, side: DoubleSide });
  const slate = withSet(std({ color: tex.slate ? '#c8c8cc' : p.slate, roughness: 0.8 }), tex.slate);
  const rafter = std({ color: p.timber, roughness: 0.85 });
  const quiltTex = quiltCanvas();
  const quilt = std({ color: p.quilt, roughness: 1, ...(quiltTex ? { map: quiltTex } : {}) });
  const ceiling = std({ color: p.ceiling, roughness: 0.95 });
  const boardsTex = boardsCanvas(p.floorBoards);
  const boards = std({
    color: boardsTex ? '#ffffff' : p.floorBoards,
    roughness: 0.75,
    ...(boardsTex ? { map: boardsTex } : {}),
  });
  const joist = std({ color: p.timber, roughness: 0.9 });
  const frame = std({ color: p.frame, roughness: 0.6 });
  const glass = std({
    color: p.glass,
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: night ? 0.95 : 0.55,
    envMapIntensity: 1.4,
    ...(night ? { emissive: p.windowGlow, emissiveIntensity: 2.2 } : {}),
  });
  glass.toneMapped = !night;
  const stone = std({ color: night ? '#77706a' : '#ece6db', roughness: 0.85 });
  const leaf = std({ color: night ? '#1d2a2b' : '#24403f', roughness: 0.5 });
  const stair = std({ color: p.timber, roughness: 0.7 });
  const plinth = std({ color: p.plinth, roughness: 1 });
  const plinthSide = std({ color: p.ground, roughness: 1 });
  const pavement = withSet(
    std({ color: tex.pavement ? '#e6e1d8' : p.ground, roughness: 0.95 }),
    tex.pavement,
  );
  const pot = std({ color: night ? '#5a3324' : '#b9694a', roughness: 0.8 });
  const section = new MeshBasicMaterial({ color: p.sectionCut, side: DoubleSide });
  const all = [
    brick,
    brickDressing,
    plaster,
    partyPlaster,
    slate,
    rafter,
    quilt,
    ceiling,
    boards,
    joist,
    frame,
    glass,
    stone,
    leaf,
    stair,
    plinth,
    plinthSide,
    pavement,
    pot,
    section,
  ];
  return {
    brick,
    brickDressing,
    plaster,
    partyPlaster,
    slate,
    rafter,
    quilt,
    ceiling,
    boards,
    joist,
    frame,
    glass,
    stone,
    leaf,
    stair,
    plinth,
    plinthSide,
    pavement,
    pot,
    section,
    dispose() {
      for (const m of all) m.dispose();
      for (const t of [brickTex, quiltTex, boardsTex]) t?.dispose();
    },
  };
}

/** Pull a prop's colours towards paper (DESIGN_SYSTEM 10: muted paper interiors). */
export function mutePropColour(c: Color, paper: Color, k = 0.35): void {
  c.lerp(paper, k);
}
