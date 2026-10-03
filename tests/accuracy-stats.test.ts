/**
 * The accuracy tab's numbers, in the pre-registration's terms.
 *
 * The within-window figure used to divide by every closed thread, so a RETIRED
 * thread or one with no accuracy record counted as a miss; the "denominator"
 * block FAILS against that formula (`withinCount / threads.length`). The
 * "one return" block FAILS against any per-thread count: Brian Burns' one
 * return sat on two threads and was scored twice. The grouping itself is pinned
 * by tests/accuracy-observations.test.ts against the shared fixture.
 */
import { describe, it, expect } from 'vitest';
import { computeAccuracyStats } from '../lib/accuracy-stats';
import type { AccuracyRecord, ThreadListItem } from '../lib/types';

function thread(
  id: string,
  status: ThreadListItem['status'],
  record: Partial<AccuracyRecord> | null,
  extra: Partial<ThreadListItem> = {},
): ThreadListItem {
  return {
    id,
    player_id: `player-${id}`,
    status,
    sport: 'NFL',
    first_reported_at: '2026-09-01T12:00:00Z',
    actual_return_date: null,
    accuracy_record: record
      ? {
          projected_return_date: null,
          actual_return_date: null,
          error_days: null,
          within_range: null,
          otm_min_weeks: null,
          otm_max_weeks: null,
          ...record,
        }
      : null,
    ...extra,
  } as ThreadListItem;
}

describe('within-window denominator', () => {
  const threads = [
    thread('in', 'RESOLVED', { within_range: true, error_days: 3 }),
    thread('out', 'RESOLVED', { within_range: false, error_days: -40 }),
    thread('retired', 'RETIRED', null),
    thread('unscored', 'RESOLVED', null),
    thread('null-verdict', 'RESOLVED', { within_range: null, error_days: null }),
  ];
  const stats = computeAccuracyStats(threads);

  it('divides by returns that carry a verdict, not by every closed thread', () => {
    expect(stats.withinCount).toBe(1);
    expect(stats.withinDenominator).toBe(2);
  });

  it('counts what it left out, so the exclusion is visible', () => {
    expect(stats.excludedByReason).toEqual({ retired: 1, no_record: 1, no_verdict: 1 });
    expect(stats.withinDenominator + stats.excludedTotal).toBe(threads.length);
  });

  it('a RETIRED thread that somehow carries a verdict is scored on it', () => {
    const s = computeAccuracyStats([thread('r', 'RETIRED', { within_range: false })]);
    expect(s.withinDenominator).toBe(1);
    expect(s.excludedTotal).toBe(0);
  });

  it('ignores ACTIVE and VOID threads entirely', () => {
    const s = computeAccuracyStats([
      thread('a', 'ACTIVE', null),
      thread('v', 'VOID', null),
    ]);
    expect(s.withinDenominator).toBe(0);
    expect(s.excludedTotal).toBe(0);
  });
});

describe('one return, one observation (Amendment 2)', () => {
  it('counts two threads closed on the same return game once (the Burns case)', () => {
    const same = { player_id: 'burns', actual_return_date: '2026-09-27' };
    const s = computeAccuracyStats([
      thread('sprain', 'RESOLVED', { scoreable: true, within_range: false, error_days: -4, otm_min_weeks: 1, otm_max_weeks: 2 }, {
        ...same,
        first_reported_at: '2026-09-22T09:31:57Z',
      }),
      thread('surgery', 'RESOLVED', { scoreable: true, within_range: false, error_days: -27, otm_min_weeks: 1, otm_max_weeks: 8 }, {
        ...same,
        first_reported_at: '2026-09-23T23:44:46Z',
      }),
    ]);
    expect(s.withinDenominator).toBe(1);
    expect(s.collapsedGroups).toBe(1);
    // The earliest-opened thread is the verdict, so its error and window are the ones counted.
    expect(s.medianErrorDays).toBe(-4);
    expect(s.windowWeeks.median).toBe(1);
  });
});

describe('median signed error (the pre-registered secondary)', () => {
  it('is the median of signed errors over returns that carry one, with its own n', () => {
    const s = computeAccuracyStats([
      thread('a', 'RESOLVED', { within_range: true, error_days: 3 }),
      thread('b', 'RESOLVED', { within_range: false, error_days: -40 }),
      thread('c', 'RESOLVED', { within_range: true, error_days: 10 }),
      thread('d', 'RESOLVED', { within_range: true, error_days: null }),
      thread('e', 'RETIRED', null),
    ]);
    expect(s.medianErrorDays).toBe(3);
    expect(s.errorCount).toBe(3);
    expect(s.withinDenominator).toBe(4);
  });

  it('is null, not zero, with nothing to take the median of', () => {
    const s = computeAccuracyStats([thread('c', 'RETIRED', null)]);
    expect(s.medianErrorDays).toBeNull();
    expect(s.withinDenominator).toBe(0);
  });
});

describe('unscoreable reasons', () => {
  it('names why an excluded return was excluded', () => {
    const s = computeAccuracyStats([
      thread('a', 'RESOLVED', { within_range: true, error_days: 2 }),
      thread('b', 'RESOLVED', { scoreable: false, unscoreable_reason: 'no_projection' }),
      thread('c', 'RESOLVED', { scoreable: false, unscoreable_reason: 'no_injury_date' }),
      thread('d', 'RETIRED', { scoreable: false, unscoreable_reason: 'no_actual_return_date' }),
    ]);
    expect(s.withinDenominator).toBe(1);
    expect(s.excludedByReason).toEqual({
      no_projection: 1,
      no_injury_date: 1,
      no_actual_return_date: 1,
    });
  });

  it('treats an absent scoreable as "derive it", never as false, and flags it legacy', () => {
    const s = computeAccuracyStats([
      thread('a', 'RESOLVED', { within_range: true, error_days: 1 }),
      thread('b', 'RESOLVED', { within_range: false, error_days: 30 }),
    ]);
    expect(s.withinDenominator).toBe(2);
    expect(s.legacy).toBe(2);
    expect(s.excludedByReason).toEqual({});
  });

  it('counts a close outside the NFL/NBA scope as out of scope, not as a return', () => {
    const s = computeAccuracyStats([
      thread('pl', 'RESOLVED', { scoreable: true, within_range: true, error_days: 1 }, { sport: 'PREMIER_LEAGUE' }),
    ]);
    expect(s.withinDenominator).toBe(0);
    expect(s.outOfScope).toBe(1);
  });
});

describe('Amendment 1 — calendar censoring', () => {
  it('excludes a calendar_censored record from both numbers and names the reason', () => {
    const stats = computeAccuracyStats([
      thread('in', 'RESOLVED', { within_range: true, error_days: 3, scoreable: true }),
      thread('censored', 'RESOLVED', {
        within_range: null,
        error_days: null,
        scoreable: false,
        unscoreable_reason: 'calendar_censored',
        censored: true,
      }),
      // A censored return before the window floor is still a scored miss.
      thread('early-miss', 'RESOLVED', { within_range: false, error_days: -30, scoreable: true, censored: true }),
    ]);
    expect(stats.withinCount).toBe(1);
    expect(stats.withinDenominator).toBe(2);
    expect(stats.errorCount).toBe(2);
    expect(stats.excludedByReason).toEqual({ calendar_censored: 1 });
  });

  it('believes scoreable:false over a verdict, and still derives a legacy row', () => {
    const stats = computeAccuracyStats([
      thread('contradictory', 'RESOLVED', {
        within_range: false,
        error_days: 12,
        scoreable: false,
        unscoreable_reason: 'calendar_censored',
      }),
      thread('legacy', 'RESOLVED', { within_range: true, error_days: 2 }),
    ]);
    expect(stats.withinDenominator).toBe(1);
    expect(stats.withinCount).toBe(1);
    expect(stats.errorCount).toBe(1);
    expect(stats.medianErrorDays).toBe(2);
  });
});
