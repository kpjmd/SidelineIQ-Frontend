import { describe, it, expect } from 'vitest';
import { validateDraftInput, tweetIdFromUrl, forbiddenWordsIn, hashPreviewFor } from '../lib/ledger-draft-form';
import type { LedgerForecast } from '../lib/ledger-types';

const good = {
  player: 'Example Player', team: 'BUF', position: 'WR', injury_date: '2026-10-04',
  reported_injury: 'Grade 2 hamstring strain', source_tier: 'B', source_urls: ['https://x.com/example/status/1'],
  mechanism: 'Non-contact. Q3 2:14.', base_rate_row: 'hamstring_strain', base_rate_strength: 'moderate',
  f1_ir: '0.18', f2_next: 0.12, f3_4wk: 0.61, f4_point: 3, f4_low: 2, f4_high: 5, f5_reinjury: '0.22',
  season_ending: false, what_moves_this: 'An IR designation.', tier: '1',
  reply_to_url: 'https://x.com/AdamSchefter/status/1972000000000000001',
};

describe('validateDraftInput', () => {
  it('accepts a complete draft and coerces numbers and the tier', () => {
    const v = validateDraftInput(good, false);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.f1_ir).toBe(0.18);
      expect(v.value.tier).toBe(1);
      expect(v.value.f5_reinjury).toBe(0.22);
      expect(v.value.trigger).toBeNull();
    }
  });

  it('reports every problem at once', () => {
    const v = validateDraftInput({ ...good, player: '', f1_ir: 1.5, f4_low: 4, source_urls: [], reply_to_url: 'https://x.com/AdamSchefter', injury_date: 'Oct 4' }, true);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors).toEqual(expect.arrayContaining([
        'player is required',
        'f1_ir must be a probability from 0 to 1',
        'F4 interval must satisfy low ≤ point ≤ high',
        'at least one source URL is required (every entry names its inputs)',
        expect.stringContaining('reply_to_url is not a tweet URL'),
        expect.stringContaining('injury_date must be YYYY-MM-DD'),
        expect.stringContaining('a revision needs a public trigger'),
      ]));
    }
  });

  it('an EMPTY required probability is missing, never 0 (the PT-2026-001 defect)', () => {
    const v = validateDraftInput({ ...good, f1_ir: '', f2_next: '  ', f3_4wk: '', f4_point: '' }, false);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors).toEqual(expect.arrayContaining([
        'f1_ir must be a probability from 0 to 1',
        'f2_next must be a probability from 0 to 1',
        'f3_4wk must be a probability from 0 to 1',
        expect.stringContaining('f4_point, f4_low and f4_high'),
      ]));
    }
    const zero = validateDraftInput({ ...good, f1_ir: '0' }, false);
    expect(zero.ok && zero.value.f1_ir).toBe(0);
  });

  it('forecastWarnings flags certainties and a zero-width interval without blocking', async () => {
    const { forecastWarnings } = await import('../lib/ledger-draft-form');
    expect(forecastWarnings({ f1_ir: '0.0000', f2_next: '0.1200', f3_4wk: '1', f5_reinjury: null, f4_low: 2, f4_high: 2, base_rate_strength: 'moderate' })).toEqual([
      expect.stringContaining('F1 is 0%'),
      expect.stringContaining('F3 is 100%'),
      expect.stringContaining('zero width'),
    ]);
    expect(forecastWarnings({ f1_ir: '0.18', f2_next: '0.12', f3_4wk: '0.61', f5_reinjury: '0.22', f4_low: 2, f4_high: 5, base_rate_strength: 'moderate' })).toEqual([]);
  });

  it('an empty F5 is the concussion rule, not an error', () => {
    const v = validateDraftInput({ ...good, f5_reinjury: '' }, false);
    expect(v.ok && v.value.f5_reinjury).toBeNull();
  });
});

describe('tweetIdFromUrl mirrors the agents parser', () => {
  it.each([
    ['https://x.com/AdamSchefter/status/1972000000000000001', '1972000000000000001'],
    ['https://www.twitter.com/i/web/status/42?s=20', '42'],
    ['https://x.com/AdamSchefter', null],
    ['https://example.com/a/status/1', null],
  ])('%s', (u, id) => expect(tweetIdFromUrl(u)).toBe(id));
});

describe('pre-confirm checks', () => {
  it('finds forbidden words per prose field', () => {
    expect(forbiddenWordsIn({ mechanism: 'Pick play, non-contact.', what_moves_this: 'Whether he should sit.' })).toEqual([
      { field: 'mechanism', words: ['pick'] },
      { field: 'what_moves_this', words: ['should'] },
    ]);
  });

  it('the hash preview shows the canonical input minus the two confirm-stamped fields, and surfaces a normalisation error', () => {
    const draft = { ...good, f1_ir: '0.1800', f2_next: '0.1200', f3_4wk: '0.6100', f5_reinjury: '0.2200', tier: 1, version: 1, entry_id: null, published_at: null, trigger: null } as unknown as LedgerForecast;
    const p = hashPreviewFor(draft);
    expect(p.error).toBeNull();
    expect(p.input).not.toHaveProperty('entry_id');
    expect(p.input).toMatchObject({ f1_ir: '0.1800', f4_point: 3, hash_version: 1 });
    const bad = hashPreviewFor({ ...draft, version: 2 });
    expect(bad.error).toMatch(/trigger/);
  });
});

describe('validateBaseRateInput', () => {
  it('accepts a thin row with only F4, normalises the key, and rejects a disordered interval', async () => {
    const { validateBaseRateInput } = await import('../lib/ledger-draft-form');
    const ok = validateBaseRateInput({ row_key: 'Low_Ankle_Sprain', injury_type: 'Low ankle sprain', strength: 'thin', f4_point: '1', f4_low: '0', f4_high: '2', f1_ir: '', source_rank: '4' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value).toMatchObject({ row_key: 'low_ankle_sprain', f1_ir: null, f4_point: 1, source_rank: 4, n: null });
    const bad = validateBaseRateInput({ row_key: 'x y', strength: 'firm', f2_next: 1.5, f4_point: 3, f4_low: 4, f4_high: 5, source_rank: 7 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors).toEqual(expect.arrayContaining([expect.stringContaining('row_key'), 'injury_type is required', expect.stringContaining('strength'), 'f2_next must be a probability from 0 to 1', 'F4 interval must satisfy low ≤ point ≤ high', expect.stringContaining('source_rank')]));
  });
});
