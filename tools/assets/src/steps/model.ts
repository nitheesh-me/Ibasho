/**
 * Model step: GLB to a metre-scaled, matte, meshopt-compressed GLB. Owner: WP-11.
 *
 * 1. Read with @gltf-transform/core. Extensions we do not register are dropped on read; for the
 *    2018 Kenney GLBs that is `KHR_materials_unlit`, which would otherwise ignore scene light.
 * 2. Materials go matte (metallic 0, roughness 0.85): DS 10 asks for a painted miniature, and the
 *    FBX2glTF exports of Quaternius carry a shiny metallic 0.4 default.
 * 3. Rescale uniformly to metres from the spec's real-world fit, then move the model so its base
 *    sits on y = 0 and it is centred on x and z. Scene code can place it without offsets.
 * 4. Validate that file with the Khronos glTF validator (via the gltf-transform CLI); errors fail.
 * 5. `gltf-transform optimize`: dedup, prune, weld, flatten, join, palette, meshopt (quantised,
 *    `EXT_meshopt_compression` plus `KHR_mesh_quantization`). No simplification, no instancing.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBounds, Logger, NodeIO } from '@gltf-transform/core';
import type { Fit } from '../config.ts';
import { TOOL_DIR } from '../util.ts';
import { round, type StepResult } from './types.ts';

export const MATTE = { metallic: 0, roughness: 0.85 } as const;
const CLI = join(TOOL_DIR, 'node_modules', '.bin', 'gltf-transform');

export const OPTIMIZE_ARGS = [
  '--compress',
  'meshopt',
  '--instance',
  'false',
  '--simplify',
  'false',
  '--texture-compress',
  'webp',
  '--texture-size',
  '512',
] as const;

/** Minimal CSV row splitter (quoted fields with commas, as `gltf-transform inspect --format csv` prints). */
export function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Rows of one section of `gltf-transform inspect --format csv` output, keyed by header. */
export function inspectSection(csv: string, section: string): Record<string, string>[] {
  const lines = csv.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === section);
  if (start < 0) return [];
  let i = start + 1;
  while (i < lines.length && !lines[i]!.includes(',')) i++;
  const header = splitCsv(lines[i]!);
  const rows: Record<string, string>[] = [];
  for (i++; i < lines.length && lines[i]!.includes(','); i++) {
    const cells = splitCsv(lines[i]!);
    rows.push(Object.fromEntries(header.map((h, k) => [h, cells[k] ?? ''])));
  }
  return rows;
}

function cli(args: string[]): string {
  return execFileSync(CLI, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

export async function processModel(rel: string, glb: Uint8Array, fit: Fit): Promise<StepResult> {
  // Silence the expected 'Missing optional extension' warning for the unlit extension we drop.
  const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR));
  const doc = await io.readBinary(glb);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) throw new Error(`${rel}: no scene`);

  for (const m of root.listMaterials()) {
    m.setMetallicFactor(MATTE.metallic).setRoughnessFactor(MATTE.roughness).setMetallicRoughnessTexture(null);
  }

  const src = getBounds(scene);
  const ext = [0, 1, 2].map((a) => src.max[a]! - src.min[a]!) as [number, number, number];
  const measured = fit.dim === 'height' ? ext[1] : Math.max(ext[0], ext[2]);
  if (!(measured > 0)) throw new Error(`${rel}: zero ${fit.dim} extent`);
  const s = fit.metres / measured;
  const cx = (src.min[0]! + src.max[0]!) / 2;
  const cz = (src.min[2]! + src.max[2]!) / 2;
  const wrapper = doc
    .createNode('ibasho-fit')
    .setScale([s, s, s])
    .setTranslation([-cx * s, -src.min[1]! * s, -cz * s]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    wrapper.addChild(child);
  }
  scene.addChild(wrapper);
  const fitted = getBounds(scene);

  let triangles = 0;
  for (const mesh of root.listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4) throw new Error(`${rel}: non-triangle primitive (mode ${p.getMode()})`);
      const idx = p.getIndices();
      triangles += (idx ? idx.getCount() : p.getAttribute('POSITION')!.getCount()) / 3;
    }
  }

  const tmp = mkdtempSync(join(tmpdir(), 'ibasho-model-'));
  try {
    const mid = join(tmp, 'fitted.glb');
    const out = join(tmp, 'out.glb');
    writeFileSync(mid, await io.writeBinary(doc));
    const report = cli(['validate', mid, '--format', 'csv']);
    const errors = report
      .split(/\r?\n/)
      .slice(1)
      .map(splitCsv)
      .filter((r) => r.length >= 3 && r[2] === '0');
    if (errors.length > 0)
      throw new Error(`${rel}: glTF validator errors: ${errors.map((r) => r[1]).join('; ')}`);
    cli(['optimize', mid, out, ...OPTIMIZE_ARGS]);
    const data = new Uint8Array(readFileSync(out));
    const inspect = cli(['inspect', out, '--format', 'csv']);
    const meshes = inspectSection(inspect, 'MESHES');
    const used = inspectSection(inspect, 'OVERVIEW').find((r) => r.key === 'extensionsUsed')?.value ?? '';
    const extensions = used
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e !== '' && e !== 'none')
      .sort();
    const drawCalls = meshes.reduce((n, r) => n + Number(r.meshPrimitives) * Number(r.instances || 1), 0);
    return {
      files: [{ rel, role: 'glb', mime: 'model/gltf-binary', data }],
      processing: [
        'Dropped unregistered extensions on read (KHR_materials_unlit on Kenney 2018 GLBs).',
        `Materials set matte: metallic ${MATTE.metallic}, roughness ${MATTE.roughness}; base colours kept.`,
        `Scaled by ${round(s, 6)} so its ${fit.dim} is ${fit.metres} m; base on y = 0, centred on x and z.`,
        'Validated with the Khronos glTF validator (no errors).',
        `gltf-transform optimize ${OPTIMIZE_ARGS.join(' ')}.`,
      ],
      details: {
        fit: { dim: fit.dim, metres: fit.metres, scale: round(s, 6) },
        boundsM: {
          min: fitted.min.map((v) => round(v)),
          max: fitted.max.map((v) => round(v)),
        },
        triangles,
        drawCalls,
        extensionsUsed: extensions,
      },
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
