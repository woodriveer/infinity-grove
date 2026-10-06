/**
 * Minimal PNG codec for the art tools: 8-bit RGBA, non-interlaced (what every
 * source sheet in this repo is). No dependencies beyond node:zlib.
 */
import { crc32, deflateSync, inflateSync } from 'node:zlib';

export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array;
}

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function decodePng(buf: Buffer, label = 'png'): Rgba {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error(`${label}: not a PNG`);
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, color, , , interlace] = [body[8], body[9], body[10], body[11], body[12]];
      if (depth !== 8 || color !== 6 || interlace !== 0) {
        throw new Error(`${label}: only 8-bit RGBA non-interlaced PNGs are supported (depth ${depth}, color ${color}, interlace ${interlace})`);
      }
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] as number;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x] as number;
      const a = x >= 4 ? (out[dst + x - 4] as number) : 0;
      const b = y > 0 ? (out[dst - stride + x] as number) : 0;
      const c = x >= 4 && y > 0 ? (out[dst - stride + x - 4] as number) : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[dst + x] = (v + pred) & 0xff;
    }
  }
  return { width, height, data: out };
}

export function encodePng(img: Rgba): Buffer {
  const stride = img.width * 4;
  const raw = Buffer.alloc((stride + 1) * img.height);
  for (let y = 0; y < img.height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(img.data.buffer, img.data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
  return Buffer.concat([head, body, crc]);
}

export function blank(width: number, height: number): Rgba {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

/** Copies a w×h region of src at (sx, sy) into dst at (dx, dy). */
export function blit(src: Rgba, sx: number, sy: number, w: number, h: number, dst: Rgba, dx: number, dy: number): void {
  for (let row = 0; row < h; row++) {
    const from = ((sy + row) * src.width + sx) * 4;
    const to = ((dy + row) * dst.width + dx) * 4;
    dst.data.set(src.data.subarray(from, from + w * 4), to);
  }
}
