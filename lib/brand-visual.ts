/**
 * Every colour a reader sees, from the ParatrOs brand kit (Claude Design
 * project "Os Seal Brand Kit", v1 — Sept 2026).
 *
 * This is deliberately NOT in lib/brand.ts. That file is mirrored byte-for-byte
 * by sidelineiq-agents/src/config/brand.ts, which has no rendering surface and
 * must not grow frontend-only constants.
 *
 * The kit itself defines no CSS custom properties — every colour in it is an
 * inline hex literal — so the token names here are authored from the kit's own
 * swatch names and usage, not transcribed from a variable block.
 *
 * WHY ONE MAP: the content-type hue system was duplicated in five places
 * (ContentTypeBadge, the three feed cards' left accents, ConflictFlagCard's
 * hand-rolled header, and lib/og-card.ts's TYPE_ACCENT), and had already
 * drifted — the OG card froze Tailwind v3's *-400 hex values while the badges
 * used *-300/*-600 utilities. Detection and display disagreeing is the same
 * failure class as the conflict-gap midpoint bug. Change a colour here or
 * nowhere.
 */
import type { ContentType } from './types';

/** The kit's named palette. "Chart Navy" is the kit's own name for the base. */
export const BRAND_COLORS = {
  navy: '#0A121B',
  panel: '#11202D',
  inset: '#0E1924',
  bone: '#F4F7F9',
  signalCyan: '#4FC9E6',
  signalCyanHover: '#7FDCEF',
  alertAmber: '#F0A02A',
  conflictRed: '#E0533F',
  /** Inks for dark text on a bright fill. */
  inkOnCyan: '#06222B',
  inkOnAmber: '#2B1B03',
  inkOnBone: '#11202D',
  inkOnRed: '#2A0A05',
  /** Hairlines and muted labels, light to dark. */
  hairline: '#1E2C3A',
  cardBorder: '#24384A',
  divider: '#2B3D4E',
  mutedLabel: '#6C8497',
  monoMeta: '#7E97A8',
  bodySecondary: '#A8B8C6',
  bodyInk: '#E8EDF1',
} as const;

export interface TypeStyle {
  label: string;
  /** Solid badge fill. */
  fill: string;
  /** Text on that fill. */
  ink: string;
  /**
   * Card edge / OG top rule / injury-type text. Same as `fill`: the kit carries
   * the category colour on the rule as well as the badge, so the type stays
   * legible in a muted thumbnail, and a second hue would defeat that.
   */
  accent: string;
}

/**
 * The kit's assignment, which is NOT the one this repo shipped before. BREAKING
 * moves red -> amber and CONFLICT_FLAG becomes the only saturated red in the
 * system: "Conflict Flag is the one saturated red and is reserved — it never
 * appears as decoration." So nothing else may use conflictRed.
 *
 * The ⚑ prefix is the kit's (U+2691). It stays out of `label` because the OG
 * card renders these through next/og, which fetches emoji glyphs from a CDN at
 * render time; ContentTypeBadge adds it in markup instead.
 */
export const CONTENT_TYPE_STYLES: Record<ContentType, TypeStyle> = {
  BREAKING: {
    label: 'BREAKING',
    fill: BRAND_COLORS.alertAmber,
    ink: BRAND_COLORS.inkOnAmber,
    accent: BRAND_COLORS.alertAmber,
  },
  TRACKING: {
    label: 'TRACKING',
    fill: BRAND_COLORS.signalCyan,
    ink: BRAND_COLORS.inkOnCyan,
    accent: BRAND_COLORS.signalCyan,
  },
  DEEP_DIVE: {
    label: 'DEEP DIVE',
    fill: BRAND_COLORS.bone,
    ink: BRAND_COLORS.inkOnBone,
    accent: BRAND_COLORS.bone,
  },
  CONFLICT_FLAG: {
    label: 'CONFLICT FLAG',
    fill: BRAND_COLORS.conflictRed,
    ink: BRAND_COLORS.inkOnRed,
    accent: BRAND_COLORS.conflictRed,
  },
};

/** Fallbacks for a row whose content_type we do not recognise. */
export const NEUTRAL_ACCENT = BRAND_COLORS.monoMeta;
export const NEUTRAL_INK = BRAND_COLORS.navy;

/**
 * RTP confidence scale, from the kit. Not wired to a component yet — the
 * accuracy views render numbers, not a scale — but it is the kit's answer for
 * when they do, and it is here so it cannot be reinvented in a sixth place.
 */
export const RTP_STATUS_COLORS = {
  confirmed: BRAND_COLORS.signalCyan,
  reported: BRAND_COLORS.monoMeta,
  estimated: BRAND_COLORS.alertAmber,
  disputed: BRAND_COLORS.conflictRed,
} as const;

/**
 * The badge's form, from the kit: IBM Plex Mono 12/600, 0.12em tracking, solid
 * fill, 2px corners. The kit's prose says "square corners" while every badge in
 * it ships border-radius:2px — the code is the authority, so 2px.
 */
export const BADGE_CLASS =
  'inline-flex items-center font-mono text-xs font-semibold tracking-[0.12em] px-2.5 py-1.5 rounded-sm';
