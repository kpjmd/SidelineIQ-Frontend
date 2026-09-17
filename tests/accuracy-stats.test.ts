/**
 * The within-window figure divided by every closed thread, so a RETIRED thread
 * or one with no accuracy record counted as a miss. The "denominator" block
 * FAILS against the pre-fix formula (`withinCount / threads.length`).
 */
import { describe, it, expect } from 'vitest';
import { computeAccuracyStats } from '../lib/accuracy-stats';
import type { AccuracyRecord, ThreadListItem } from '../lib/types';

function thread(
  id: string,
  status: ThreadListItem['status'],
  record: Partial<AccuracyRecord> | null,
): ThreadListItem {
  return {
    id,
    status,
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

  it('divides by threads that carry a verdict, not by every closed thread', () => {
    expect(stats.withinCount).toBe(1);
    expect(stats.withinDenominator).toBe(2);
  });

  it('counts what it left out, so the exclusion is visible', () => {
    expect(stats.excluded).toEqual({ retired: 1, noRecord: 2 });
    expect(stats.withinDenominator + stats.excluded.retired + stats.excluded.noRecord).toBe(
      threads.length,
    );
  });

  it('a RETIRED thread that somehow carries a verdict is scored on it', () => {
    const s = computeAccuracyStats([thread('r', 'RETIRED', { within_range: false })]);
    expect(s.withinDenominator).toBe(1);
    expect(s.excluded.retired).toBe(0);
  });
});

describe('mean absolute error', () => {
  it('averages |error_days| over the threads that carry one', () => {
    const s = computeAccuracyStats([
      thread('a', 'RESOLVED', { within_range: true, error_days: 3 }),
      thread('b', 'RESOLVED', { within_range: false, error_days: -40 }),
      thread('c', 'RETIRED', null),
    ]);
    expect(s.mae).toBe(22); // (3 + 40) / 2 = 21.5
    expect(s.maeCount).toBe(2);
  });

  it('is null, not zero, with nothing to average', () => {
    const s = computeAccuracyStats([thread('c', 'RETIRED', null)]);
    expect(s.mae).toBeNull();
    expect(s.withinDenominator).toBe(0);
  });
});

describe('unscoreable reasons', () => {
  it('names why an excluded thread was excluded, when the record says so', () => {
    // mcp writes `scoreable: false` plus a reason where it used to write a
    // record of nulls, so "we got it wrong" and "we never had the inputs to
    // score it" stopped being the same row.
    const s = computeAccuracyStats([
      thread('a', 'RESOLVED', { within_range: true, error_days: 2 }),
      thread('b', 'RESOLVED', { scoreable: false, unscoreable_reason: 'no_projection' }),
      thread('c', 'RESOLVED', { scoreable: false, unscoreable_reason: 'no_injury_date' }),
      thread('d', 'RETIRED', { scoreable: false, unscoreable_reason: 'no_actual_return_date' }),
    ]);
    expect(s.withinDenominator).toBe(1);
    expect(s.unscoreableReasons).toEqual({
      no_projection: 1,
      no_injury_date: 1,
      no_actual_return_date: 1,
    });
    // The old buckets still hold, because they are the only thing a
    // pre-2026-09-15 row can answer.
    expect(s.excluded).toEqual({ retired: 1, noRecord: 2 });
  });

  it('treats an absent scoreable as "derive it", never as false', () => {
    // Every row written before mcp shipped the field.
    const s = computeAccuracyStats([
      thread('a', 'RESOLVED', { within_range: true, error_days: 1 }),
      thread('b', 'RESOLVED', { within_range: false, error_days: 30 }),
    ]);
    expect(s.withinDenominator).toBe(2);
    expect(s.unscoreableReasons).toEqual({});
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
    expect(stats.maeCount).toBe(2);
    expect(stats.unscoreableReasons).toEqual({ calendar_censored: 1 });
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
    expect(stats.maeCount).toBe(1);
    expect(stats.mae).toBe(2);
  });
});
