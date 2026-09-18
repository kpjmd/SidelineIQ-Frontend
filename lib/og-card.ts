/**
 * What a shared post's card image says — kept pure so it is testable without
 * rendering, and deliberately short.
 *
 * Headline, content type and sport only. NO return-to-play weeks or
 * percentages, NO severity, NO athlete photo: X and Farcaster cache a card
 * image independently of the page, so a figure an MD later corrects on the
 * post would keep circulating in every card already shared.
 *
 * No emoji either (ContentTypeBadge's CONFLICT FLAG carries one): next/og
 * fetches emoji glyphs from a CDN at render time.
 */
import type { ContentType, InjuryPost, Sport } from './types';
import { BRAND_NAME, BRAND_TAGLINE } from './brand';
import { CONTENT_TYPE_STYLES, NEUTRAL_ACCENT, NEUTRAL_INK } from './brand-visual';

export const OG_SITE_NAME = BRAND_NAME;
/* One tagline, not two. This used to read 'Clinical sports injury intelligence'
   while lib/brand.ts's BRAND_TAGLINE read 'Clinical Sports Intelligence' — the
   card and the page disagreed about what the platform is called doing. */
export const OG_TAGLINE = BRAND_TAGLINE;
export const OG_HEADLINE_MAX = 110;

/*
 * Labels and accents come from CONTENT_TYPE_STYLES, which ContentTypeBadge also
 * reads. They used to be duplicated here as Tailwind v3's *-400 hex values,
 * frozen at the moment they were copied, while the badges used *-300/*-600
 * utilities — so the card image and the on-page badge were already different
 * colours. `label` deliberately carries no ⚑: next/og fetches emoji glyphs from
 * a CDN at render time.
 */

const SPORT_LABEL: Record<Sport, string> = {
  NFL: 'NFL',
  NBA: 'NBA',
  PREMIER_LEAGUE: 'Premier League',
  UFC: 'UFC',
  OTHER: '',
};

export interface OgCard {
  eyebrow: string;
  accent: string;
  /**
   * Text colour for a solid `accent` fill. Bone and amber need dark ink; without
   * this the card would print the eyebrow in the accent on the accent.
   */
  ink: string;
  headline: string;
  /** Px. Steps down with length so the longest clamp stays clear of the footer. */
  headlineSize: number;
  siteName: string;
  tagline: string;
}

/** Cut at a word boundary and mark the cut; never mid-word, never silently. */
export function clampHeadline(text: string, max = OG_HEADLINE_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:—–-]+$/, '')}…`;
}

export function headlineSizeFor(headline: string): number {
  if (headline.length <= 60) return 68;
  if (headline.length <= 90) return 60;
  return 54;
}

export function ogCardFor(
  post: Pick<InjuryPost, 'headline' | 'content_type' | 'sport'>,
): OgCard {
  const type = CONTENT_TYPE_STYLES[post.content_type]?.label ?? '';
  const sport = SPORT_LABEL[post.sport] ?? '';
  const headline = clampHeadline(post.headline ?? '');
  return {
    eyebrow: [type, sport].filter(Boolean).join(' · '),
    accent: CONTENT_TYPE_STYLES[post.content_type]?.accent ?? NEUTRAL_ACCENT,
    ink: CONTENT_TYPE_STYLES[post.content_type]?.ink ?? NEUTRAL_INK,
    headline,
    headlineSize: headlineSizeFor(headline),
    siteName: OG_SITE_NAME,
    tagline: OG_TAGLINE,
  };
}
