/**
 * Generate the favicon and the Apple touch icon from the ParatrOs mark.
 *
 * WHY THIS EXISTS: the repo was still shipping create-next-app's favicon.ico,
 * and this machine has no ImageMagick, rsvg or Inkscape (`sips` cannot read
 * SVG). But the mark is seven axis-aligned rectangles, so rasterising it is
 * arithmetic, and an ICO is just PNGs in a container. Zero dependencies —
 * node:zlib is the only import. Deterministic: same input, same bytes.
 *
 * Run: node scripts/build-icons.mjs
 * Outputs (committed): app/favicon.ico, app/apple-icon.png, app/icon.svg
 *
 * The geometry is duplicated from components/shared/Mark.tsx on purpose: this
 * script must run under plain node with no TS/JSX toolchain. The values are
 * asserted against that file by tests/brand-icons.test.ts, so they cannot drift.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const BONE = '#F4F7F9';
const PANEL = '#11202D';
const SIGNAL_CYAN = '#4FC9E6';
/** App-icon-inverse bar. Used once in the kit, and only here. */
const APP_ICON_BAR = '#0E7E9B';

/** Per-weight geometry, from the kit's size ramp. Mirrors MARK_GEOMETRY. */
const GEOMETRY = {
  6: { stroke: 6, rightX: 44, lowerArmY: 41 },
  7: { stroke: 7, rightX: 43, lowerArmY: 40 },
  8: { stroke: 8, rightX: 42, lowerArmY: 39 },
  9: { stroke: 9, rightX: 41, lowerArmY: 38 },
};
const ARM = 13;
const BAR = { x: 30, y: 23, width: 4, height: 18 };

export function markWeightFor(px) {
  if (px <= 16) return 9;
  if (px <= 24) return 8;
  if (px <= 48) return 7;
  return 6;
}

export function markRects(weight, bracketColor, barColor) {
  const { stroke, rightX, lowerArmY } = GEOMETRY[weight];
  return [
    { x: 14, y: 17, width: stroke, height: 30, fill: bracketColor },
    { x: 14, y: 17, width: ARM, height: stroke, fill: bracketColor },
    { x: 14, y: lowerArmY, width: ARM, height: stroke, fill: bracketColor },
    { x: rightX, y: 17, width: stroke, height: 30, fill: bracketColor },
    { x: 37, y: 17, width: ARM, height: stroke, fill: bracketColor },
    { x: 37, y: lowerArmY, width: ARM, height: stroke, fill: bracketColor },
    { ...BAR, fill: barColor },
  ];
}

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/**
 * Render the 64-unit grid at `size` px. Supersampled 8x then box-averaged: the
 * useful sizes (16/32/48/180) are not integer multiples of 64, so rect edges
 * land mid-pixel and a nearest-neighbour fill would leave one arm a pixel
 * thicker than the other.
 */
function rasterize(size, rects, background) {
  const SS = 8;
  const hi = size * SS;
  const bg = hex(background);
  // Accumulate per output pixel: [r, g, b] weighted by covered subsamples.
  const acc = new Float64Array(size * size * 3);

  /*
   * Snap every edge to a whole output pixel before sampling — icon hinting.
   * Without it the 16px bar (4 grid units = exactly 1 px) straddled two pixels
   * and averaged to a mid-grey: bone blended with panel is grey, which is the
   * very muddiness the kit's 16px bone-bar rule exists to avoid. A 1px minimum
   * keeps a snapped-to-nothing rect from vanishing.
   */
  const snap = (gridValue) => Math.round((gridValue / 64) * size) * SS;
  const layers = [{ x: 0, y: 0, width: hi, height: hi, rgb: bg }].concat(
    rects.map((r) => {
      const x = snap(r.x);
      const y = snap(r.y);
      return {
        x,
        y,
        width: Math.max(SS, snap(r.x + r.width) - x),
        height: Math.max(SS, snap(r.y + r.height) - y),
        rgb: hex(r.fill),
      };
    }),
  );

  for (let sy = 0; sy < hi; sy++) {
    for (let sx = 0; sx < hi; sx++) {
      // Topmost covering layer wins; the ground rect guarantees one always does.
      let rgb = bg;
      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i];
        if (sx >= l.x && sx < l.x + l.width && sy >= l.y && sy < l.y + l.height) {
          rgb = l.rgb;
          break;
        }
      }
      const o = (Math.floor(sy / SS) * size + Math.floor(sx / SS)) * 3;
      acc[o] += rgb[0];
      acc[o + 1] += rgb[1];
      acc[o + 2] += rgb[2];
    }
  }

  const n = SS * SS;
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = Math.round(acc[i * 3] / n);
    px[i * 4 + 1] = Math.round(acc[i * 3 + 1] / n);
    px[i * 4 + 2] = Math.round(acc[i * 3 + 2] / n);
    px[i * 4 + 3] = 255; // opaque: a favicon sits on an unknown tab colour
  }
  return px;
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10-12: compression, filter, interlace — all 0

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** ICO container holding PNG images (valid since Vista, and what browsers read). */
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const img of images) {
    const e = Buffer.alloc(16);
    e[0] = img.size >= 256 ? 0 : img.size;
    e[1] = img.size >= 256 ? 0 : img.size;
    e[2] = 0; // palette size
    e[3] = 0;
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(img.png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += img.png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

/**
 * At 16px the cyan bar is the first thing to go muddy in a platform downscale,
 * so it ships in bone and the silhouette still reads. The kit's rule, and the
 * only place the 16px tile differs from the rest of the ramp.
 */
function faviconImage(size) {
  const weight = markWeightFor(size);
  const bar = size <= 16 ? BONE : SIGNAL_CYAN;
  return { size, png: encodePng(size, rasterize(size, markRects(weight, BONE, bar), PANEL)) };
}

function svgIcon() {
  // Stroke 8 (the kit's 24px tile): reads at 16 and at 32. Full-bleed panel
  // ground rather than transparency — the brackets are bone, so on a light
  // browser tab a transparent version would disappear.
  const rects = markRects(8, BONE, SIGNAL_CYAN)
    .map((r) => `  <rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${r.fill}"/>`)
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="ParatrOs">
  <rect x="0" y="0" width="64" height="64" fill="${PANEL}"/>
${rects}
</svg>
`;
}

const ico = encodeIco([16, 32, 48].map(faviconImage));
writeFileSync(join(ROOT, 'app/favicon.ico'), ico);

// The kit's "App icon · inverse": navy brackets on a bone ground, bar #0E7E9B.
// iOS applies its own corner rounding, so no radius is baked in.
const apple = encodePng(180, rasterize(180, markRects(6, PANEL, APP_ICON_BAR), BONE));
writeFileSync(join(ROOT, 'app/apple-icon.png'), apple);

writeFileSync(join(ROOT, 'app/icon.svg'), svgIcon());

console.log(`app/favicon.ico   ${ico.length} bytes (16, 32, 48)`);
console.log(`app/apple-icon.png ${apple.length} bytes (180)`);
console.log(`app/icon.svg      written`);
