/**
 * The ParatrOs rename (Phase 1). The persona rewrite here is a COPY of the
 * agents' src/config/brand.ts rebrandPersona and must produce the same output;
 * the cases are the same live phrasings.
 */
import { describe, it, expect } from 'vitest';
import { BRAND_NAME, BRAND_SLUG, rebrandPersona, rebrandPost } from '../lib/brand';
import { aequosTarget } from '../lib/cta-click';
import { OG_SITE_NAME } from '../lib/og-card';

describe('brand', () => {
  it('uses the decided styling and slug everywhere it is read', () => {
    expect(BRAND_NAME).toBe('ParatrOs');
    expect(BRAND_SLUG).toBe('paratros');
    expect(OG_SITE_NAME).toBe('ParatrOs');
    const url = new URL(aequosTarget('cta'));
    expect(url.searchParams.get('ref')).toBe('paratros');
    expect(url.searchParams.get('utm_source')).toBe('paratros');
  });

  const cases: Array<[string, string]> = [
    ['OTM will update as grade and imaging details emerge.', 'ParatrOs will update as grade and imaging details emerge.'],
    ['does not fit the OTM three-axis tissue taxonomy.', 'does not fit the three-axis tissue taxonomy.'],
    ['**OTM Three-Axis Classification:**', '**Three-Axis Classification:**'],
    ["sit at the top of OTM's stress injury watch list.", 'sit at the top of our stress injury watch list.'],
    ["The site is clear. OTM's rules are clear.", 'The site is clear. Our rules are clear.'],
    ['Questionable Tag as OTM Tracks Recovery Arc', 'Questionable Tag as ParatrOs Tracks Recovery Arc'],
    ['— OrthoTriage Master', '— ParatrOs'],
  ];
  it.each(cases)('rebrandPersona: %s', (input, expected) => {
    expect(rebrandPersona(input)).toBe(expected);
  });

  it('leaves identifiers alone', () => {
    for (const s of ['otm_projection', 'BOTTOM line', 'OTMX']) expect(rebrandPersona(s)).toBe(s);
  });

  it('rebrandPost rewrites only the model prose fields and keeps nulls', () => {
    const out = rebrandPost({
      headline: 'OTM Tracks Recovery',
      clinical_summary: 'OTM is tracking.',
      conflict_reason: null,
      athlete_name: 'OTM Smith',
    });
    expect(out.headline).toBe('ParatrOs Tracks Recovery');
    expect(out.clinical_summary).toBe('ParatrOs is tracking.');
    expect(out.conflict_reason).toBeNull();
    expect(out.athlete_name).toBe('OTM Smith');
  });
});
