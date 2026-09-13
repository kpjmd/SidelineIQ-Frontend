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
