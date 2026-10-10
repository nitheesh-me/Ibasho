import { Document, NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { inspectSection, MATTE, processModel, splitCsv } from '../src/steps/model.ts';

/** A box 4 by 2 by 1 units, offset off-centre and below zero, with a shiny material. */
async function boxGlb(): Promise<Uint8Array> {
  const doc = new Document();
  const buf = doc.createBuffer();
  const [x0, y0, z0, x1, y1, z1] = [3, -1, 5, 7, 1, 6];
  const pos = new Float32Array([
    x0,
    y0,
    z0,
    x1,
    y0,
    z0,
    x1,
    y1,
    z0,
    x0,
    y1,
    z0,
    x0,
    y0,
    z1,
    x1,
    y0,
    z1,
    x1,
    y1,
    z1,
    x0,
    y1,
    z1,
  ]);
  const idx = new Uint16Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6,
    5,
  ]);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buf))
    .setMaterial(doc.createMaterial('shiny').setMetallicFactor(0.4).setRoughnessFactor(0.2));
  const mesh = doc.createMesh('box').addPrimitive(prim);
  doc.createScene('s').addChild(doc.createNode('n').setMesh(mesh));
  return new Uint8Array(await new NodeIO().writeBinary(doc));
}

describe('model step', () => {
  it('splits quoted CSV cells', () => {
    expect(splitCsv('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    expect(splitCsv('"x ""y"""')).toEqual(['x "y"']);
  });

  it('reads one section of gltf-transform inspect CSV', () => {
    const csv = 'OVERVIEW\nkey,value\nextensionsUsed,"A, B"\n\nMESHES\nname,meshPrimitives\nm,2\n';
    expect(inspectSection(csv, 'OVERVIEW')).toEqual([{ key: 'extensionsUsed', value: 'A, B' }]);
    expect(inspectSection(csv, 'MESHES')).toEqual([{ name: 'm', meshPrimitives: '2' }]);
    expect(inspectSection(csv, 'NOPE')).toEqual([]);
  });

  it('scales to metres, grounds, centres, mattes and meshopt-compresses', async () => {
    const r = await processModel('models/test/box.glb', await boxGlb(), { dim: 'height', metres: 0.5 });
    expect(r.files).toHaveLength(1);
    const d = r.details as {
      fit: { scale: number };
      boundsM: { min: number[]; max: number[] };
      triangles: number;
      extensionsUsed: string[];
    };
    expect(d.fit.scale).toBe(0.25);
    expect(d.boundsM.min).toEqual([-0.5, 0, -0.125]);
    expect(d.boundsM.max).toEqual([0.5, 0.5, 0.125]);
    expect(d.triangles).toBe(12);
    expect(d.extensionsUsed).toContain('EXT_meshopt_compression');

    // Output is a GLB whose bytes the manifest will hash.
    const out = r.files[0]!.data;
    expect(new TextDecoder().decode(out.subarray(0, 4))).toBe('glTF');
    expect(r.processing.join(' ')).toContain(`metallic ${MATTE.metallic}, roughness ${MATTE.roughness}`);
  }, 60_000);
});
