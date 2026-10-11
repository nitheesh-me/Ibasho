/**
 * Tile loading (ARCH 15.7): gzip JSON, decompressed with the native `DecompressionStream`.
 * The reader is injectable so Node tests read files and the app fetches URLs (and caches them in
 * the store's `cityTiles` table). A server that already sent `Content-Encoding: gzip` hands over
 * plain JSON, which is detected by the missing gzip magic bytes.
 */
import type { CityTile } from '@ibasho/core';
import { CityTileSchema } from '@ibasho/core/schemas';

/** Reads a tile URL to bytes. */
export type TileReader = (url: string) => Promise<Uint8Array>;

interface StreamCtor {
  new (format: 'gzip'): { readable: unknown; writable: unknown };
}
interface ResponseLike {
  arrayBuffer(): Promise<ArrayBuffer>;
  ok: boolean;
  status: number;
}
const g = globalThis as unknown as {
  DecompressionStream?: StreamCtor;
  Response?: new (body: unknown) => ResponseLike;
  Blob?: new (parts: Uint8Array[]) => { stream(): { pipeThrough(t: unknown): unknown } };
  fetch?: (url: string) => Promise<ResponseLike>;
  TextDecoder: new () => { decode(b: Uint8Array): string };
};

/** Default reader: `fetch`. */
export const fetchReader: TileReader = async (url) => {
  if (!g.fetch) throw new Error('fetch is not available; pass a TileReader');
  const res = await g.fetch(url);
  if (!res.ok) throw new Error(`city tile ${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
};

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (!g.DecompressionStream || !g.Blob || !g.Response)
    throw new Error('DecompressionStream is not available');
  const stream = new g.Blob([bytes]).stream().pipeThrough(new g.DecompressionStream('gzip'));
  return new Uint8Array(await new g.Response(stream).arrayBuffer());
}

/** Decode one tile's bytes (gzip or plain JSON) and validate it. */
export async function decodeTile(bytes: Uint8Array): Promise<CityTile> {
  const plain = bytes[0] === 0x1f && bytes[1] === 0x8b ? await gunzip(bytes) : bytes;
  return CityTileSchema.parse(JSON.parse(new g.TextDecoder().decode(plain)));
}
