/**
 * The committed icons, and the geometry behind them.
 *
 * Two things can go wrong independently, so both are checked.
 *
 * 1. scripts/build-icons.mjs duplicates the mark's rect geometry, because it has
 *    to run under plain node with no TS/JSX toolchain. Duplication is a drift
 *    risk, so the two copies are compared here rather than trusted.
 *
 * 2. The icons are build OUTPUT that is committed, so nothing re-runs the
 *    generator in CI. If someone edits the geometry and forgets to re-run it,
 *    the repo ships a stale favicon. Decoding the bytes catches that.
 *
 * The palette assertions are exact — every size must be 2 or 3 PURE colours.
 * Anti-aliasing mud is the specific failure the kit warns about: at 16px the bar
 * is 4 grid units, exactly one pixel, and before the generator snapped edges to
 * the pixel grid it straddled two and averaged bone with panel into a mid-grey.
 * That is why edges are snapped and why "no blended colours" is the check.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { MARK_GEOMETRY, markRects, markWeightFor } from '../lib/mark-geometry';
import {
  markRects as genRects,
  markWeightFor as genWeightFor,
} from '../scripts/build-icons.mjs';

const BONE = '#F4F7F9';
const PANEL = '#11202D';
const CYAN = '#4FC9E6';
const APP_ICON_BAR = '#0E7E9B';

const rgb = (h: string) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
].join(',');

interface Png {
  width: number;
  height: number;
  rows: Buffer[];
}

function decodePng(buf: Buffer): Png {
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  let i = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString('ascii');
    const data = buf.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8); // 8-bit channels
      expect(data[9]).toBe(6); // RGBA
    } else if (type === 'IDAT') idat.push(data);
    i += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    expect(raw[y * (stride + 1)]).toBe(0); // filter: none
    rows.push(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride));
  }
  return { width, height, rows };
}

function palette(png: Png): Set<string> {
  const seen = new Set<string>();
  for (const row of png.rows) {
    for (let x = 0; x < png.width; x++) {
      seen.add(`${row[x * 4]},${row[x * 4 + 1]},${row[x * 4 + 2]}`);
      expect(row[x * 4 + 3]).toBe(255); // fully opaque
    }
  }
  return seen;
}

/** ICO: 6-byte header, then 16-byte entries, then the PNG payloads. */
function decodeIco(buf: Buffer): Array<{ declared: number; png: Png }> {
  expect(buf.readUInt16LE(0)).toBe(0);
  expect(buf.readUInt16LE(2)).toBe(1); // type 1 = icon
  const count = buf.readUInt16LE(4);
  const out = [];
  for (let k = 0; k < count; k++) {
    const e = buf.subarray(6 + k * 16, 22 + k * 16);
    expect(e.readUInt16LE(4)).toBe(1); // colour planes
    expect(e.readUInt16LE(6)).toBe(32); // bpp
    const size = e.readUInt32LE(8);
    const offset = e.readUInt32LE(12);
    out.push({ declared: e[0], png: decodePng(buf.subarray(offset, offset + size)) });
  }
  return out;
}

describe('the mark geometry is not duplicated by accident', () => {
  it('matches between Mark.tsx and the icon generator at every weight', () => {
    for (const weight of Object.keys(MARK_GEOMETRY).map(Number) as Array<6 | 7 | 8 | 9>) {
      expect(genRects(weight, BONE, CYAN)).toEqual(markRects(weight, BONE, CYAN));
    }
  });

  it('agrees on the size ramp, including the boundaries', () => {
    for (const px of [8, 16, 17, 24, 25, 32, 48, 49, 64, 96, 180]) {
      expect(genWeightFor(px)).toBe(markWeightFor(px));
    }
  });

  it("keeps the kit's bar geometry identical at every weight", () => {
    const bars = (Object.keys(MARK_GEOMETRY).map(Number) as Array<6 | 7 | 8 | 9>).map((w) => {
      const { fill, ...bar } = markRects(w, BONE, CYAN)[6];
      return bar;
    });
    // The kit's bar is x=30 y=23 w=4 h=18 at every size. A weight-dependent bar
    // would be a redesign, not a hint.
    expect(new Set(bars.map((b) => JSON.stringify(b))).size).toBe(1);
    expect(bars[0]).toEqual({ x: 30, y: 23, width: 4, height: 18 });
  });
});

describe('the committed favicon', () => {
  const ico = decodeIco(readFileSync(join(process.cwd(), 'app/favicon.ico')));

  it('holds 16, 32 and 48 as PNG entries', () => {
    expect(ico.map((i) => i.declared)).toEqual([16, 32, 48]);
    expect(ico.map((i) => [i.png.width, i.png.height])).toEqual([
      [16, 16],
      [32, 32],
      [48, 48],
    ]);
  });

  it('is pixel-crisp — no blended colours at any size', () => {
    for (const { png } of ico) {
      // 3 colours at 32/48 (bone, panel, cyan), 2 at 16 (no cyan). Anything more
      // means an edge landed mid-pixel and averaged.
      expect(palette(png).size).toBeLessThanOrEqual(3);
      expect(palette(png)).toContain(rgb(BONE));
      expect(palette(png)).toContain(rgb(PANEL));
    }
  });

  it("ships the 16px bar in bone, not cyan", () => {
    const [at16, at32, at48] = ico.map((i) => palette(i.png));
    // The kit: at 16px the cyan bar is the first thing to go muddy in a platform
    // downscale, so it goes bone and the silhouette still reads.
    expect(at16).not.toContain(rgb(CYAN));
    expect(at32).toContain(rgb(CYAN));
    expect(at48).toContain(rgb(CYAN));
  });
});

describe('the committed apple touch icon', () => {
  const png = decodePng(readFileSync(join(process.cwd(), 'app/apple-icon.png')));

  it("is 180px and uses the kit's inverse treatment", () => {
    expect([png.width, png.height]).toEqual([180, 180]);
    // Bone ground, navy brackets, and the one-off #0E7E9B bar the kit uses here
    // and nowhere else. No baked corner radius: iOS applies its own.
    expect(palette(png)).toEqual(new Set([rgb(BONE), rgb(PANEL), rgb(APP_ICON_BAR)]));
  });
});
