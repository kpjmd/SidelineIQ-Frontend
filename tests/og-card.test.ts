import { describe, it, expect } from 'vitest';
import { clampHeadline, headlineSizeFor, ogCardFor, OG_HEADLINE_MAX } from '../lib/og-card';

describe('clampHeadline', () => {
  it('leaves a short headline alone, whitespace normalized', () => {
    expect(clampHeadline('  Bowers  hamstring   strain ')).toBe('Bowers hamstring strain');
  });

  it('cuts at a word boundary and marks the cut', () => {
    const long =
      'Hamstring Strains Are Clustering in the NBA — Here Is What the Biology Actually Means for Return to Play This Season and Beyond';
    const out = clampHeadline(long);
    expect(out.length).toBeLessThanOrEqual(OG_HEADLINE_MAX);
    expect(out.endsWith('…')).toBe(true);
    expect(long.startsWith(out.slice(0, -1))).toBe(true);
    expect(out.slice(0, -1).endsWith(' ')).toBe(false);
  });

  it('does not leave a dangling dash before the ellipsis', () => {
    const out = clampHeadline(`${'a'.repeat(70)} — ${'b'.repeat(60)}`, 80);
    expect(out).toBe(`${'a'.repeat(70)}…`);
  });
});

describe('ogCardFor', () => {
  it('labels type and sport without emoji', () => {
    const card = ogCardFor({ headline: 'X', content_type: 'CONFLICT_FLAG', sport: 'PREMIER_LEAGUE' });
    expect(card.eyebrow).toBe('CONFLICT FLAG · Premier League');
    expect(/\p{Extended_Pictographic}/u.test(card.eyebrow)).toBe(false);
  });

  it('carries nothing but the headline, labels and brand — no clinical figures', () => {
    const card = ogCardFor({ headline: 'H', content_type: 'DEEP_DIVE', sport: 'NFL' });
    expect(Object.keys(card).sort()).toEqual(['accent', 'eyebrow', 'headline', 'headlineSize', 'siteName', 'tagline']);
  });
});

describe('headlineSizeFor', () => {
  it('steps down as the headline grows, never growing', () => {
    const sizes = [20, 60, 61, 90, 91, OG_HEADLINE_MAX].map((n) => headlineSizeFor('x'.repeat(n)));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
    expect(sizes[sizes.length - 1]).toBeLessThan(sizes[0]);
  });
});
