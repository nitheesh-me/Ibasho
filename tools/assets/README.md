# @ibasho/tools-assets

Fetches, processes and lists every external asset the web app serves. Output lives in
`apps/web/public/assets/` (served at `/app/assets/`).

- **Owner:** WP-11 (Assets). Owns `tools/assets/**` and `apps/web/public/assets/**`.
- **Layer:** Tool (ARCHITECTURE 3). Node only, never bundled into an app.
- **Gate:** M-A (hero tier, done). M-D (lazy sets, not started).

## Commands

| Command | Does |
|---|---|
| `pnpm --filter @ibasho/tools-assets fetch` | Downloads sources into `tools/assets/.cache/` (git ignored) and pins each in `sources.lock.json` (url, bytes, sha256, Poly Haven md5). With a lock it only re-downloads pinned URLs and checks hashes. `-- --refresh` re-resolves upstream. |
| `pnpm assets` | Clears and rebuilds `apps/web/public/assets/` from the pinned cache, writes `manifest.json` and `attribution.html`, then runs the K1 to K4 check. About 40 s. Byte-identical across runs. |
| `pnpm --filter @ibasho/tools-assets check` | K1 to K4 only, no rebuild, no cache needed. |
| `pnpm --filter @ibasho/tools-assets test` | Unit tests plus K1 to K4 on the committed output (no network, no cache). |
| `pnpm --filter @ibasho/tools-assets typecheck` | `tsc`. |

## Sources (all CC0-1.0)

| Kind | Provider | How |
|---|---|---|
| HDRIs | Poly Haven | `api.polyhaven.com/info` and `/files`, 1k `.hdr`, md5 checked |
| Textures | Poly Haven | same API, PNG `Diffuse`, `nor_gl`, `arm` (2k for `red_brick_03`, 1k otherwise) |
| Furniture | Kenney Furniture Kit 2.0 | zip from the kit page, `Models/GLTF format/*.glb` via `unzip -p`, licence read from `License.txt` |
| Furniture | Quaternius Ultimate House Interior | Poly Pizza bundle mirror (GLB). The author's Drive copy is OBJ and FBX only. Licence read per record |

The hero list is `src/config.ts` (4 HDRIs, 4 texture sets, 27 Kenney and 11 Quaternius models for GH1).

## Processing

- **HDRI** (`src/steps/hdri.ts`, `src/gainmap.ts`, `src/hdr.ts`): a 1k `.hdr` is about 1.4 MB, so each sky ships as a gain map triple in the gainmap-js "separate files" format: `sdr.webp` (q85), `gain.webp` (lossless), `meta.json`, plus `preview.webp` (256 by 128). Reconstruction error is recorded in the manifest (worst p99 2.5%, worst mean luminance 0.36%). Load with gainmap-js `GainMapLoader` or drei `<Environment files={[sdr, gain, meta]} />`.
- **Texture** (`src/steps/texture.ts`): resized, diffuse mixed 15% towards paper (DS 10), WebP. Normal is OpenGL convention; ARM is R AO, G roughness, B metalness. **KTX2 is not produced** because `toktx` is not installed (ARCH 13); switch in this step once it is.
- **Model** (`src/steps/model.ts`): matte materials (metallic 0, roughness 0.85), rescaled to metres from a real-world fit, base on y = 0 and centred on x and z, Khronos validator must report no errors, then `gltf-transform optimize` with meshopt. Consumers need the meshopt decoder (three.js `GLTFLoader.setMeshoptDecoder`).

## Output and public API

`manifest.json` lists every served file with path, role, mime, bytes and sha256, and each asset with tier, status, licence, licence URL, authors, source URLs and source sha256, the processing applied, and kind facts (HDRI error, texture colour spaces, model bounds in metres, triangles, draw calls). Types are exported from `src/index.ts` (`Manifest`, `ManifestAsset`, `checkManifest`, `renderAttribution`, `checkAssetsDir`).

`attribution.html` is the credits page source, rendered from the manifest by `renderAttribution` (K4) and itself listed in the manifest as `doc-attribution`.

Hero tier: 5,726,633 bytes of files plus the manifest, 5,828,301 bytes of 8,000,000 (K2).

## Not done (stubbed or deferred)

- Lazy sets (SV 6, gate M-D): `config.ts` takes `tier: 'lazy'` and `pnpm assets -- --tier=all` builds them; none are listed yet.
- Fonts (subset-font) and SVG (svgo) steps: dependencies are declared, no step yet.
- KTX2 textures (needs `toktx`).
- Sound assets are T5.
