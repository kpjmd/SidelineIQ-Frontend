/**
 * The words beside the gap.
 *
 * Every test FAILS against pre-fix code: there was no shared vocabulary at all.
 * Three components each computed the gap themselves, with three different
 * formulas (`min - team` twice, `max - team` once) against a detector that used
 * the window midpoint — so one post could read "+0 weeks" in the admin browser,
 * "conflict threshold met" in the feed, and something else again on its page.
 *
 * The "no anchor" tests are the load-bearing ones. Pre-fix, a post with no
 * injury_date still printed a confident delta, and the feed card printed
 * nothing at all — indistinguishable from a post whose timelines agreed.
 */
import { describe, it, expect } from 'vitest';
import { describeConflictGap, describePostConflictGap } from '../lib/conflict-gap-display';
import { computeConflictGap } from '../lib/conflict-gap';

const post = (over: Record<string, unknown> = {}) => ({
  team_timeline_weeks: 1,
  return_to_play_min_weeks: 39,
  return_to_play_max_weeks: 52,
  injury_date: '2025-09-21',
  created_at: '2026-09-02T00:00:00.000Z',
  ...over,
});

describe('describePostConflictGap', () => {
  it('the Nick Bosa row reads as inside the window, not as a 38-week gap', () => {
    // Pre-fix: 39 - 1 = "+38 weeks — conflict threshold met" for an athlete
    // whose team-implied return is 50 weeks, inside a 39-52 window.
    const d = describePostConflictGap(post());
    expect(d.label).toContain('inside the ParatrOs window');
    expect(d.tone).toBe('info');
    expect(d.gap.team_total_weeks).toBe(50);
  });

  it('measures from created_at, so the gap cannot drift as the page ages', () => {
    // Reading "now" would make a stored post's discrepancy grow every week it
    // sat on the site, with no data change behind it.
    const a = describePostConflictGap(post());
    const b = describePostConflictGap(post({ created_at: '2026-09-02T00:00:00.000Z' }));
    expect(a.label).toBe(b.label);
  });

  it('names the distance and the direction when the timelines really diverge', () => {
    const d = describePostConflictGap(post({ team_timeline_weeks: 33, injury_date: '2026-01-11' }));
    expect(d.label).toBe('14 weeks beyond the ParatrOs window — conflict threshold met');
    expect(d.badge).toBe('Δ+14w');
    expect(d.tone).toBe('conflict');
  });

  it('says why there is no number when the injury date is unresolved', () => {
    const d = describePostConflictGap(post({ injury_date: null }));
    expect(d.label).toContain('not computable');
    expect(d.badge).toBe('n/a');
    expect(d.tone).toBe('muted');
    expect(d.unavailableReason).toContain('injury date');
    expect(d.label).not.toMatch(/\d/);
  });

  it('distinguishes "no timeline disclosed" from "no anchor"', () => {
    // Fail-closed boundary. They mean different things to a reader, and the
    // pre-fix components rendered both as blank.
    const d = describePostConflictGap(post({ team_timeline_weeks: null }));
    expect(d.label).toContain('No team timeline disclosed');
    expect(d.unavailableReason).not.toContain('injury date');
  });
});

describe('describeConflictGap — tone and threshold', () => {
  const gap = (team: number, min: number, max: number, injury: string) =>
    computeConflictGap({
      team_timeline_weeks: team,
      min_weeks: min,
      max_weeks: max,
      injury_date: injury,
      as_of: '2026-09-02',
    });

  // 8 weeks elapsed at 2026-07-08, so `team` below is remaining weeks and the
  // implied total is team + 8 against a 10-20 window.
  it('is muted, not alarming, when the divergence is within tolerance', () => {
    const d = describeConflictGap(gap(14, 10, 20, '2026-07-08'));
    expect(d.label).toBe('2 weeks beyond the ParatrOs window');
    expect(d.tone).toBe('info');
  });

  it('escalates past the two-week threshold', () => {
    const d = describeConflictGap(gap(15, 10, 20, '2026-07-08'));
    expect(d.tone).toBe('conflict');
    expect(d.label).toContain('conflict threshold met');
  });

  it('says "week" not "weeks" at one', () => {
    expect(describeConflictGap(gap(13, 10, 20, '2026-07-08')).label).toContain('1 week beyond');
  });
});
