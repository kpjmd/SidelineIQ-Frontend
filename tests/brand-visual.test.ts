/**
 * The content-type colours, pinned to the ParatrOs brand kit.
 *
 * This system was duplicated in SEVEN places before it was consolidated —
 * ContentTypeBadge, three feed cards' left accents, ConflictFlagCard's
 * hand-rolled header, ConflictGapDisplay's on-page panel, and lib/og-card.ts —
 * and two of them had already drifted: the OG card froze Tailwind v3's `*-400`
 * hex values while the badges used `*-300`/`*-600` utilities, so a shared card
 * and the page it linked to were different colours.
 *
 * There is no way to assert "nobody added an eighth copy", so this asserts the
 * values instead. If a colour changes, exactly one place fails, and it fails
 * loudly rather than diverging quietly.
 */
import { describe, it, expect } from 'vitest';
import { BRAND_COLORS, CONTENT_TYPE_STYLES, RTP_STATUS_COLORS } from '../lib/brand-visual';
import { ogCardFor } from '../lib/og-card';
import type { ContentType } from '../lib/types';

describe('the kit palette', () => {
  it('holds the named swatches at their kit values', () => {
    expect(BRAND_COLORS.navy).toBe('#0A121B'); // Chart Navy
    expect(BRAND_COLORS.panel).toBe('#11202D'); // Slate Panel
    expect(BRAND_COLORS.bone).toBe('#F4F7F9');
    expect(BRAND_COLORS.signalCyan).toBe('#4FC9E6');
    expect(BRAND_COLORS.alertAmber).toBe('#F0A02A');
    expect(BRAND_COLORS.conflictRed).toBe('#E0533F');
  });
});

describe('content-type colours', () => {
  it("uses the kit's assignment, which is not the one this repo shipped before", () => {
    // BREAKING moved red -> amber, and CONFLICT_FLAG became the only red. If
    // someone "restores" BREAKING to red, this is the failure that says why not.
    expect(CONTENT_TYPE_STYLES.BREAKING.fill).toBe(BRAND_COLORS.alertAmber);
    expect(CONTENT_TYPE_STYLES.TRACKING.fill).toBe(BRAND_COLORS.signalCyan);
    expect(CONTENT_TYPE_STYLES.DEEP_DIVE.fill).toBe(BRAND_COLORS.bone);
    expect(CONTENT_TYPE_STYLES.CONFLICT_FLAG.fill).toBe(BRAND_COLORS.conflictRed);
  });

  it('reserves Conflict Red for CONFLICT_FLAG alone', () => {
    // "Conflict Flag is the one saturated red in the system and is reserved — it
    // never appears as decoration." A second type wearing it would mean a reader
    // cannot tell a contradiction from an ordinary update.
    const wearingRed = (Object.keys(CONTENT_TYPE_STYLES) as ContentType[]).filter(
      (t) =>
        CONTENT_TYPE_STYLES[t].fill === BRAND_COLORS.conflictRed ||
        CONTENT_TYPE_STYLES[t].accent === BRAND_COLORS.conflictRed,
    );
    expect(wearingRed).toEqual(['CONFLICT_FLAG']);
  });

  it('gives every fill a dark ink, so text on a solid chip is legible', () => {
    // Bone and amber especially: accent-on-accent is invisible, and that is the
    // exact bug the OG card's solid eyebrow chip could have shipped.
    for (const type of Object.keys(CONTENT_TYPE_STYLES) as ContentType[]) {
      const { fill, ink } = CONTENT_TYPE_STYLES[type];
      expect(ink).not.toBe(fill);
      const luminance = (hex: string) =>
        [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0) / 3;
      expect(luminance(ink)).toBeLessThan(luminance(fill));
    }
  });

  it('keeps the accent equal to the fill, so badge and card edge cannot drift', () => {
    for (const type of Object.keys(CONTENT_TYPE_STYLES) as ContentType[]) {
      expect(CONTENT_TYPE_STYLES[type].accent).toBe(CONTENT_TYPE_STYLES[type].fill);
    }
  });

  it('carries no emoji in any label — next/og fetches emoji glyphs from a CDN', () => {
    for (const type of Object.keys(CONTENT_TYPE_STYLES) as ContentType[]) {
      expect(/\p{Extended_Pictographic}/u.test(CONTENT_TYPE_STYLES[type].label)).toBe(false);
    }
  });
});

describe('the OG card reads the same map', () => {
  it('gives each type the kit accent and ink, not a frozen copy', () => {
    for (const type of Object.keys(CONTENT_TYPE_STYLES) as ContentType[]) {
      const card = ogCardFor({ headline: 'H', content_type: type, sport: 'NFL' });
      expect(card.accent).toBe(CONTENT_TYPE_STYLES[type].accent);
      expect(card.ink).toBe(CONTENT_TYPE_STYLES[type].ink);
    }
  });
});

describe('the RTP confidence scale', () => {
  it('matches the kit, and reuses Conflict Red only for "disputed"', () => {
    expect(RTP_STATUS_COLORS).toEqual({
      confirmed: BRAND_COLORS.signalCyan,
      reported: BRAND_COLORS.monoMeta,
      estimated: BRAND_COLORS.alertAmber,
      disputed: BRAND_COLORS.conflictRed,
    });
  });
});
