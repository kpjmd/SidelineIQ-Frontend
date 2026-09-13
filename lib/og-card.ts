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

export const OG_SITE_NAME = 'SidelineIQ';
export const OG_TAGLINE = 'Clinical sports injury intelligence';
export const OG_HEADLINE_MAX = 110;

const TYPE_LABEL: Record<ContentType, string> = {
  BREAKING: 'BREAKING',
  TRACKING: 'TRACKING',
  DEEP_DIVE: 'DEEP DIVE',
  CONFLICT_FLAG: 'CONFLICT FLAG',
};

/** Accent per type, matching ContentTypeBadge's hues. */
const TYPE_ACCENT: Record<ContentType, string> = {
  BREAKING: '#f87171',
  TRACKING: '#fbbf24',
  DEEP_DIVE: '#60a5fa',
  CONFLICT_FLAG: '#fb7185',
};

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
  const type = TYPE_LABEL[post.content_type] ?? '';
  const sport = SPORT_LABEL[post.sport] ?? '';
  const headline = clampHeadline(post.headline ?? '');
  return {
    eyebrow: [type, sport].filter(Boolean).join(' · '),
    accent: TYPE_ACCENT[post.content_type] ?? '#94a3b8',
    headline,
    headlineSize: headlineSizeFor(headline),
    siteName: OG_SITE_NAME,
    tagline: OG_TAGLINE,
  };
}
