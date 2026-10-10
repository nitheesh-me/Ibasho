/**
 * Radiance RGBE (.hdr) reader and writer. Owner: WP-11.
 *
 * Supports the `-Y H +X W` orientation with flat or new-style run length encoded scanlines,
 * which is what Poly Haven serves. Decoding follows three.js `RGBELoader`
 * (value = mantissa * 2^(exponent - 136)), so a decoded pixel equals what the app would have
 * seen had it loaded the original file.
 */

export interface HdrImage {
  readonly width: number;
  readonly height: number;
  /** Linear RGB, row major, top row first, 3 floats per pixel. */
  readonly data: Float32Array;
}

const NEWLINE = 0x0a;

function readLine(buf: Uint8Array, pos: number): { line: string; next: number } {
  let end = pos;
  while (end < buf.length && buf[end] !== NEWLINE) end++;
  if (end >= buf.length) throw new Error('hdr: truncated header');
  return { line: new TextDecoder('latin1').decode(buf.subarray(pos, end)), next: end + 1 };
}

/** Parses an RGBE file into linear float RGB. */
export function parseHdr(buf: Uint8Array): HdrImage {
  let pos = 0;
  let first = readLine(buf, pos);
  if (!first.line.startsWith('#?')) throw new Error('hdr: missing #? signature');
  pos = first.next;
  let format = '';
  for (;;) {
    first = readLine(buf, pos);
    pos = first.next;
    if (first.line === '') break;
    if (first.line.startsWith('FORMAT=')) format = first.line.slice(7).trim();
  }
  if (format !== '' && format !== '32-bit_rle_rgbe') throw new Error(`hdr: unsupported FORMAT ${format}`);
  const res = readLine(buf, pos);
  pos = res.next;
  const m = /^-Y (\d+) \+X (\d+)$/.exec(res.line.trim());
  if (!m) throw new Error(`hdr: unsupported resolution line "${res.line}"`);
  const height = Number(m[1]);
  const width = Number(m[2]);
  const rgbe = new Uint8Array(width * height * 4);
  const scan = new Uint8Array(width * 4);

  for (let y = 0; y < height; y++) {
    const isRle =
      width >= 8 &&
      width < 32768 &&
      buf[pos] === 2 &&
      buf[pos + 1] === 2 &&
      ((buf[pos + 2]! << 8) | buf[pos + 3]!) === width &&
      (buf[pos + 2]! & 0x80) === 0;
    if (!isRle) {
      // Flat scanline (old-style RLE is not produced by any tool we read from).
      if (pos + width * 4 > buf.length) throw new Error('hdr: truncated flat scanline');
      rgbe.set(buf.subarray(pos, pos + width * 4), y * width * 4);
      pos += width * 4;
      continue;
    }
    pos += 4;
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < width) {
        if (pos >= buf.length) throw new Error('hdr: truncated RLE scanline');
        let count = buf[pos++]!;
        if (count > 128) {
          count -= 128;
          if (count === 0 || x + count > width) throw new Error('hdr: bad run');
          const v = buf[pos++]!;
          for (let i = 0; i < count; i++) scan[x++ * 4 + c] = v;
        } else {
          if (count === 0 || x + count > width) throw new Error('hdr: bad literal');
          for (let i = 0; i < count; i++) scan[x++ * 4 + c] = buf[pos++]!;
        }
      }
    }
    rgbe.set(scan, y * width * 4);
  }

  const data = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < rgbe.length; i += 4, j += 3) {
    const e = rgbe[i + 3]!;
    if (e === 0) continue;
    const f = 2 ** (e - 136);
    data[j] = rgbe[i]! * f;
    data[j + 1] = rgbe[i + 1]! * f;
    data[j + 2] = rgbe[i + 2]! * f;
  }
  return { width, height, data };
}

/** Float RGB to one RGBE quadruple (Radiance `float2rgbe`). */
export function toRgbe(r: number, g: number, b: number): [number, number, number, number] {
  const v = Math.max(r, g, b);
  if (v < 1e-32) return [0, 0, 0, 0];
  // frexp: v = m * 2^e with m in [0.5, 1).
  let e = Math.floor(Math.log2(v)) + 1;
  if (v / 2 ** e >= 1) e++;
  else if (v / 2 ** e < 0.5) e--;
  const scale = 256 / 2 ** e;
  const q = (x: number) => Math.min(255, Math.floor(x * scale));
  return [q(r), q(g), q(b), e + 128];
}

/**
 * Writes an RGBE file. `rle` selects new-style run length scanlines (as Poly Haven ships) or
 * flat ones. Used by tests to build fixtures; the pipeline never writes .hdr.
 */
export function writeHdr(img: HdrImage, rle = true): Uint8Array {
  const { width, height, data } = img;
  const header = new TextEncoder().encode(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`);
  const out: number[] = [...header];
  const scan = new Uint8Array(width * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const j = (y * width + x) * 3;
      scan.set(toRgbe(data[j]!, data[j + 1]!, data[j + 2]!), x * 4);
    }
    if (!rle || width < 8 || width >= 32768) {
      out.push(...scan);
      continue;
    }
    out.push(2, 2, width >> 8, width & 0xff);
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < width) {
        // Find a run of at least 3 equal bytes starting at x.
        let run = 1;
        while (x + run < width && run < 127 && scan[(x + run) * 4 + c] === scan[x * 4 + c]) run++;
        if (run >= 3) {
          out.push(128 + run, scan[x * 4 + c]!);
          x += run;
          continue;
        }
        // Literal block up to the next run of 3 or 128 bytes.
        let len = 0;
        while (x + len < width && len < 128) {
          const a = scan[(x + len) * 4 + c];
          if (x + len + 2 < width && a === scan[(x + len + 1) * 4 + c] && a === scan[(x + len + 2) * 4 + c])
            break;
          len++;
        }
        if (len === 0) len = 1;
        out.push(len);
        for (let i = 0; i < len; i++) out.push(scan[(x + i) * 4 + c]!);
        x += len;
      }
    }
  }
  return new Uint8Array(out);
}
