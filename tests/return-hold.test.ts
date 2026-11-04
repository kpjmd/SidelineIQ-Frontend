import { describe, it, expect, vi } from 'vitest';
import { describeReturnHold } from '../lib/return-hold';
import { listAllThreadPages } from '../lib/thread-paging';
import type { ThreadReturnHold } from '../lib/types';

const hold = (over: Partial<ThreadReturnHold>): ThreadReturnHold => ({
  action: 'return_before_first_report',
  candidate_return_date: '2026-10-21',
  game_url: null,
  first_report_date: null,
  earliest_credible_return: null,
  injury_date: '2025-09-22',
  at: '2026-11-03T00:00:00Z',
  ...over,
});

describe('describeReturnHold', () => {
  it('names the first report date', () => {
    expect(describeReturnHold(hold({ first_report_date: '2026-10-31' }))).toContain('2026-10-31');
  });

  it('names the earliest credible date', () => {
    const text = describeReturnHold(
      hold({ action: 'return_before_credible_window', earliest_credible_return: '2026-11-09' }),
    );
    expect(text).toContain('2026-11-09');
  });

  it.each(['return_before_first_report', 'return_before_credible_window'] as const)(
    'reads without a date on %s',
    (action) => {
      expect(describeReturnHold(hold({ action }))).toMatch(/^Held: /);
    },
  );
});

describe('listAllThreadPages and return_candidates', () => {
  it('sends the key only when asked: the mcp input is strict', async () => {
    const fetchPage = vi.fn(async () => ({ threads: [], has_more: false }));
    await listAllThreadPages(fetchPage, { status: 'ACTIVE' });
    expect(fetchPage.mock.calls[0]).toEqual([{ limit: 500, status: 'ACTIVE' }]);
    await listAllThreadPages(fetchPage, { return_candidates: true });
    expect(fetchPage.mock.calls[1]).toEqual([{ limit: 500, return_candidates: true }]);
  });
});
