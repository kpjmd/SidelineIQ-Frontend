/**
 * The Metrics tab's numbers. The baseline never moves, a missing day stays
 * missing, and week-over-week is null until there is a week to compare.
 */
import { describe, it, expect } from 'vitest';
import {
  summarizeMetric,
  summarizeMetrics,
  validateManualEntry,
  METRIC_NAMES,
  type MetricSnapshot,
} from '../lib/metrics-summary';
import { isTrackedPath } from '../lib/analytics-filter';
import schemaFixture from './fixtures/metrics-tools-schema.json' with { type: 'json' };

const snap = (metric: MetricSnapshot['metric'], day: string, value: number): MetricSnapshot => ({
  metric,
  day,
  value,
  source: 'x_api',
  detail: null,
  recorded_at: `${day}T12:00:00Z`,
});

describe('summarizeMetric', () => {
  it('reports no data as null everywhere, never 0', () => {
    expect(summarizeMetric('x_followers', [])).toEqual({
      metric: 'x_followers',
      baseline: null,
      latest: null,
      weekOverWeek: null,
      readings: [],
    });
  });

  it('takes the FIRST reading as the baseline regardless of input order', () => {
    const s = summarizeMetric('x_followers', [
      snap('x_followers', '2026-09-20', 14),
      snap('x_followers', '2026-09-13', 11),
      snap('farcaster_followers', '2026-09-01', 99),
    ]);
    expect(s.baseline).toEqual({ day: '2026-09-13', value: 11 });
    expect(s.latest).toEqual({ day: '2026-09-20', value: 14 });
  });

  it('has no week-over-week until a reading is at least 7 days before the latest', () => {
    const s = summarizeMetric('x_followers', [
      snap('x_followers', '2026-09-13', 11),
      snap('x_followers', '2026-09-19', 12),
    ]);
    expect(s.weekOverWeek).toBeNull();
  });

  it('compares against the most recent reading at least 7 days back, across gaps', () => {
    const s = summarizeMetric('x_followers', [
      snap('x_followers', '2026-09-01', 8),
      snap('x_followers', '2026-09-12', 10),
      // 09-13 .. 09-18 missing: a failed snapshot writes no row
      snap('x_followers', '2026-09-19', 12),
      snap('x_followers', '2026-09-20', 11),
    ]);
    expect(s.weekOverWeek).toEqual({ from: { day: '2026-09-12', value: 10 }, delta: 1, pct: 10 });
  });

  it('gives a delta but no percentage from a zero base', () => {
    const s = summarizeMetric('farcaster_followers', [
      snap('farcaster_followers', '2026-09-01', 0),
      snap('farcaster_followers', '2026-09-08', 3),
    ]);
    expect(s.weekOverWeek).toEqual({ from: { day: '2026-09-01', value: 0 }, delta: 3, pct: null });
  });

  it('summarizes every metric, in allowlist order', () => {
    expect(summarizeMetrics([]).map((s) => s.metric)).toEqual([...METRIC_NAMES]);
  });
});

describe('validateManualEntry', () => {
  it('accepts a monthly web number', () => {
    expect(validateManualEntry({ metric: 'web_monthly_uniques', value: 1200, day: '2026-10-13' })).toEqual({
      ok: true,
      metric: 'web_monthly_uniques',
      value: 1200,
      day: '2026-10-13',
    });
  });

  it.each([
    ['a follower count (the loop owns those)', { metric: 'x_followers', value: 11 }, 'metric'],
    ['an unknown metric', { metric: 'uniques', value: 1 }, 'metric'],
    ['a negative value', { metric: 'web_monthly_uniques', value: -1 }, 'value'],
    ['a string value', { metric: 'web_monthly_uniques', value: '12' }, 'value'],
    ['a fractional value', { metric: 'web_monthly_uniques', value: 1.5 }, 'value'],
    ['a malformed day', { metric: 'web_monthly_uniques', value: 1, day: '2026-10' }, 'day'],
  ])('rejects %s', (_label, body, error) => {
    expect(validateManualEntry(body)).toEqual({ ok: false, error });
  });

  it('only ever produces values the recorded mcp schema accepts', () => {
    const props = (schemaFixture as unknown as {
      tools: { web_record_metric_snapshot: { inputSchema: { properties: Record<string, { enum?: string[] }> } } };
    }).tools.web_record_metric_snapshot.inputSchema.properties;
    const entry = validateManualEntry({ metric: 'web_monthly_pageviews', value: 5 });
    expect(entry.ok).toBe(true);
    if (entry.ok) expect(props.metric.enum).toContain(entry.metric);
    expect(props.source.enum).toContain('manual');
  });
});

describe('isTrackedPath (Vercel Analytics beforeSend)', () => {
  it.each(['https://sidelineiq.vercel.app/', 'https://sidelineiq.vercel.app/post/acl-tears', '/post/acl?x=1'])(
    'tracks audience page %s',
    (url) => expect(isTrackedPath(url)).toBe(true),
  );

  it.each([
    'https://sidelineiq.vercel.app/admin',
    'https://sidelineiq.vercel.app/admin?tab=metrics',
    '/desk/abc',
    '/signin/check-email',
    '/go/aequos?post=acl&from=cta',
  ])('drops the MD surface or redirect %s', (url) => expect(isTrackedPath(url)).toBe(false));

  it('does not drop a page that merely starts with the same letters', () => {
    expect(isTrackedPath('/administration-of-hamstring-injuries')).toBe(true);
  });
});
