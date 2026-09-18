/**
 * Shared pieces for the next/og card images.
 *
 * WHY A SHARED MODULE: there are two card routes (the post card and the site
 * card) plus a twitter-image re-export, and the brand furniture — fonts, the
 * mark, the wordmark, the footer rule — is identical in all of them. The last
 * time a visual constant was copied between card code and page code (the
 * content-type accents) the two silently diverged for months.
 *
 * CONSTRAINTS THAT MUST SURVIVE ANY EDIT HERE:
 *  - NO EMOJI. next/og fetches emoji glyphs from a CDN at render time, so a ⚑
 *    either fails or leaks a network dependency into image rendering. The badge
 *    on the page carries it; the card says CONFLICT FLAG in words.
 *  - NO CLINICAL FIGURES. X and Farcaster cache a card image independently of
 *    the page, so a figure an MD later corrects would keep circulating in every
 *    card already shared. See lib/og-card.ts.
 *  - NO HANDLE. The kit's social template prints `@paratros_intel`, which is not
 *    the real handle (@Paratrosinjury) — and a handle baked into a cached PNG
 *    outlives the next rename. The footer prints the domain only.
 */
import { readFile } from 'node:fs/promises';

import { BRAND_COLORS } from './brand-visual';
import { markBarColor, markBracketColor, markRects, markWeightFor } from './mark-geometry';

/**
 * satori needs font BUFFERS — it cannot read next/font/google, so a card with no
 * `fonts` array silently renders in satori's bundled fallback. That is what every
 * ParatrOs card did until these were vendored (app/fonts/NOTICE.md).
 *
 * `readFile(new URL(..., import.meta.url))`, for two separate reasons:
 *
 *  - NOT fetch(). The Next docs' font example uses fetch() because it is written
 *    for the edge runtime, where the bundler rewrites the URL into an asset
 *    request. These routes are Node runtime, where the same expression stays a
 *    `file:` URL — and undici refuses those. It fails at BUILD time, while
 *    prerendering the static site card, with a bare `TypeError: fetch failed` and
 *    a cause of `Error: not implemented... yet...`, which names nothing.
 *  - NOT join(process.cwd(), ...). An import.meta.url-relative literal is what
 *    Next's file tracing can follow into the serverless bundle; a path assembled
 *    at runtime it cannot, and that failure shows up only as a 500 on the
 *    deployed route while working perfectly here. next.config.ts also names this
 *    directory in outputFileTracingIncludes, as belt and braces.
 */
export async function brandFonts() {
  const load = async (file: string) => {
    const buf = await readFile(new URL(`../app/fonts/${file}`, import.meta.url));
    // Copy into a standalone ArrayBuffer: a Node Buffer is a view into a shared
    // pool, so passing .buffer directly can hand satori the whole pool.
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  };

  const [bold, medium, mono] = await Promise.all([
    load('Archivo-Bold.ttf'),
    load('Archivo-Medium.ttf'),
    load('IBMPlexMono-Regular.ttf'),
  ]);

  return [
    { name: 'Archivo', data: bold, weight: 700 as const, style: 'normal' as const },
    { name: 'Archivo', data: medium, weight: 500 as const, style: 'normal' as const },
    { name: 'IBM Plex Mono', data: mono, weight: 400 as const, style: 'normal' as const },
  ];
}

/** The mark, drawn from the same geometry as the favicon and the site header. */
export function OgMark({ size }: { size: number }) {
  const rects = markRects(markWeightFor(size), markBracketColor('color'), markBarColor(size, 'color'));
  return (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} fill={r.fill} />
      ))}
    </svg>
  );
}

/**
 * The wordmark: `Paratr` at 700 in bone, `Os` at 500 in Signal Cyan. Split from
 * the brand name rather than hardcoded, the same rule the React component follows.
 */
export function OgWordmark({ name, fontSize }: { name: string; fontSize: number }) {
  const endsWithOs = name.endsWith('Os');
  const stem = endsWithOs ? name.slice(0, -2) : name;
  const tail = endsWithOs ? 'Os' : '';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', fontSize, letterSpacing: -0.035 * fontSize }}>
      <div style={{ display: 'flex', fontWeight: 700, color: BRAND_COLORS.bone }}>{stem}</div>
      {tail ? (
        <div style={{ display: 'flex', fontWeight: 500, color: BRAND_COLORS.signalCyan }}>{tail}</div>
      ) : null}
    </div>
  );
}

/**
 * The kit's fixed footer slot: identity on the left, the disclaimer chip on the
 * right. The kit is explicit that the disclaimer "is part of the frame, not copy
 * that can be trimmed for length" — a clinical claim shared without it is the
 * thing this platform cannot afford, so it is rendered structurally, never
 * conditionally.
 */
export function OgFooter({ left }: { left: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: `1px solid ${BRAND_COLORS.cardBorder}`,
        paddingTop: 26,
        fontFamily: 'IBM Plex Mono',
        fontSize: 24,
      }}
    >
      <div style={{ display: 'flex', letterSpacing: 2.4, color: BRAND_COLORS.mutedLabel }}>{left}</div>
      <div
        style={{
          display: 'flex',
          letterSpacing: 2.4,
          color: BRAND_COLORS.monoMeta,
          border: `1px solid ${BRAND_COLORS.divider}`,
          borderRadius: 2,
          padding: '8px 14px',
        }}
      >
        NOT MEDICAL ADVICE
      </div>
    </div>
  );
}
