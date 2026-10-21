import { describe, it, expect } from 'vitest';
import { parseCorrectTitleBody, seedDraftTitle } from '../lib/desk-title';

describe('seedDraftTitle', () => {
  it('seeds the athlete name only — never the lowercase injury descriptor', () => {
    expect(seedDraftTitle({ athlete_name: 'Ben Simmons' })).toBe('Ben Simmons');
    expect(seedDraftTitle({ athlete_name: '  Ben Simmons ' })).toBe('Ben Simmons');
  });
  it('falls back when the entity has no athlete', () => {
    expect(seedDraftTitle({ athlete_name: null })).toBe('Athlete');
    expect(seedDraftTitle({ athlete_name: '  ' })).toBe('Athlete');
  });
});

describe('parseCorrectTitleBody', () => {
  const valid = {
    title: '  Ben Simmons: Torn Achilles Ends Comeback Before Opening Night ',
    reason: 'lowercase seeded title',
    reviewed_source_reports: true,
    edited_for_accuracy: true,
    framing_confirmed: true,
  };

  it('trims and accepts a complete body', () => {
    const r = parseCorrectTitleBody(valid);
    expect(r).toEqual({
      ok: true,
      value: { ...valid, title: 'Ben Simmons: Torn Achilles Ends Comeback Before Opening Night' },
    });
  });

  it('refuses reviewer identity from the body (and any other undeclared key)', () => {
    const r = parseCorrectTitleBody({ ...valid, reviewer_user_id: 'x' });
    expect(r).toEqual({ ok: false, error: 'Unrecognized field(s): reviewer_user_id' });
  });

  it.each([
    ['title', { ...valid, title: '   ' }],
    ['reason', { ...valid, reason: '' }],
    ['confirmation', { ...valid, framing_confirmed: 'yes' }],
    ['long title', { ...valid, title: 'x'.repeat(513) }],
  ])('refuses a missing or bad %s', (_label, body) => {
    expect(parseCorrectTitleBody(body).ok).toBe(false);
  });

  it('refuses a non-object body', () => {
    expect(parseCorrectTitleBody(null).ok).toBe(false);
    expect(parseCorrectTitleBody([]).ok).toBe(false);
  });

  it('passes false confirmations through so mcp, the authority, refuses them', () => {
    const r = parseCorrectTitleBody({ ...valid, edited_for_accuracy: false });
    expect(r.ok).toBe(true);
  });
});
