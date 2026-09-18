/**
 * The ParatrOs mark, as data.
 *
 * Seven axis-aligned rects on a 64x64 grid. The kit draws the bracket "strokes"
 * as filled rects rather than SVG strokes, which is what lets the mark rasterise
 * exactly at any size — see scripts/build-icons.mjs, which reuses this geometry
 * to write the favicon.
 *
 * It lives in lib/ rather than beside the component because three consumers need
 * it and only one of them renders React: components/shared/Mark.tsx, the icon
 * generator, and the OG card images.
 *
 * Construction, from the kit: GRID 64x64 · STROKE 6u · ARM 13u · INNER SPAN 10u
 * · GAP TO BAR 3u.
 *
 * MISUSE (the kit's own list, all five):
 *  - Don't rotate the brackets or set them at an angle — they read as a chevron.
 *  - Don't put anything between the brackets except the bar.
 *  - Don't round the corners. The square terminals are what keep it clinical.
 *  - Don't tint the bar to a team or league colour. Amber is the only sanctioned
 *    swap, for Breaking-only assets.
 *  - Don't outline, emboss or add a glow. One weight, no depth.
 */
import { BRAND_COLORS } from './brand-visual';

/** Bracket stroke width in grid units. The kit's ramp uses exactly these four. */
export type MarkWeight = 6 | 7 | 8 | 9;

/**
 * STROKES THICKEN AS THE MARK SHRINKS. The right bracket's x and the lower arms'
 * y shift with the weight so the silhouette stays centred on the grid. These are
 * transcribed from the kit's ramp tiles, not derived — the ramp is hand-tuned, so
 * do not "simplify" them into arithmetic.
 */
export const MARK_GEOMETRY: Record<
  MarkWeight,
  { stroke: number; rightX: number; lowerArmY: number }
> = {
  6: { stroke: 6, rightX: 44, lowerArmY: 41 },
  7: { stroke: 7, rightX: 43, lowerArmY: 40 },
  8: { stroke: 8, rightX: 42, lowerArmY: 39 },
  9: { stroke: 9, rightX: 41, lowerArmY: 38 },
};

const ARM = 13;

/** Identical at every weight. A weight-dependent bar would be a redesign. */
export const MARK_BAR = { x: 30, y: 23, width: 4, height: 18 } as const;

export function markWeightFor(px: number): MarkWeight {
  if (px <= 16) return 9;
  if (px <= 24) return 8;
  if (px <= 48) return 7;
  return 6;
}

export interface MarkRect {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

/**
 * Order: left stem, left top arm, left bottom arm, right stem, right top arm,
 * right bottom arm, bar. The bar is last so it paints over nothing — the
 * brackets never overlap it.
 */
export function markRects(
  weight: MarkWeight,
  bracketColor: string,
  barColor: string,
): MarkRect[] {
  const { stroke, rightX, lowerArmY } = MARK_GEOMETRY[weight];
  return [
    { x: 14, y: 17, width: stroke, height: 30, fill: bracketColor },
    { x: 14, y: 17, width: ARM, height: stroke, fill: bracketColor },
    { x: 14, y: lowerArmY, width: ARM, height: stroke, fill: bracketColor },
    { x: rightX, y: 17, width: stroke, height: 30, fill: bracketColor },
    { x: 37, y: 17, width: ARM, height: stroke, fill: bracketColor },
    { x: 37, y: lowerArmY, width: ARM, height: stroke, fill: bracketColor },
    { ...MARK_BAR, fill: barColor },
  ];
}

export type MarkTone = 'color' | 'mono-bone' | 'mono-navy';

/**
 * At 16px the cyan bar is the first thing to go muddy in a platform downscale,
 * so it ships in bone and the silhouette still reads. This keys on the RENDERED
 * size, which is why it is a function here and not a decision at each call site.
 */
export function markBarColor(px: number, tone: MarkTone): string {
  if (tone === 'mono-navy') return BRAND_COLORS.panel;
  if (tone === 'mono-bone') return BRAND_COLORS.bone;
  return px <= 16 ? BRAND_COLORS.bone : BRAND_COLORS.signalCyan;
}

export function markBracketColor(tone: MarkTone): string {
  return tone === 'mono-navy' ? BRAND_COLORS.panel : BRAND_COLORS.bone;
}
