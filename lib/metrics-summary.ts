/**
 * The numbers on the MD dashboard's Metrics tab (monetization plan, Phase 0.3).
 *
 * Every later gate is measured against these, so three rules hold:
 *   - The BASELINE is the first reading of a series, with its date, and it
 *     never moves. A reading taken later is not a better baseline.
 *   - A missing day is missing. The snapshot loop writes NO row when a read
 *     fails (mcp migration 024), so there is nothing here to interpolate and
 *     nothing is defaulted to 0.
 *   - Week-over-week growth — gate G2's unit — needs a reading at least 7 days
 *     before the latest. Until one exists it is null ("n/a"), not 0%.
 *
 * Pure, and imported relatively for the same no-alias-under-vitest reason as
 * lib/reject.ts.
 */

export const METRIC_NAMES = [
  'x_followers',
  'farcaster_followers',
  'web_monthly_uniques',
  'web_monthly_pageviews',
] as const;
export type MetricName = (typeof METRIC_NAMES)[number];

/** The metrics a person may type in. Follower counts come from the snapshot loop. */
export const MANUAL_METRICS = ['web_monthly_uniques', 'web_monthly_pageviews'] as const;
export type ManualMetric = (typeof MANUAL_METRICS)[number];

export interface MetricSnapshot {
  metric: MetricName;
  /** 'YYYY-MM-DD', UTC. */
  day: string;
  value: number;
  source: 'neynar' | 'x_api' | 'manual';
  detail: Record<string, unknown> | null;
  recorded_at: string;
}

export interface MetricReading {
  day: string;
  value: number;
}

export interface WeekOverWeek {
  /** The earlier reading compared against: the latest one at least 7 days before `latest`. */
  from: MetricReading;
  delta: number;
  /** Percent change, or null when the earlier value is 0 (a rate from zero is undefined). */
  pct: number | null;
}

export interface MetricSeriesSummary {
  metric: MetricName;
  baseline: MetricReading | null;
  latest: MetricReading | null;
  weekOverWeek: WeekOverWeek | null;
  readings: MetricReading[];
}

const DAY_MS = 86_400_000;

function dayMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

export function summarizeMetric(metric: MetricName, snapshots: MetricSnapshot[]): MetricSeriesSummary {
  const readings = snapshots
    .filter((s) => s.metric === metric)
    .map((s) => ({ day: s.day, value: Number(s.value) }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const baseline = readings[0] ?? null;
  const latest = readings[readings.length - 1] ?? null;

  let weekOverWeek: WeekOverWeek | null = null;
  if (latest) {
    const cutoff = dayMs(latest.day) - 7 * DAY_MS;
    const from = [...readings].reverse().find((r) => dayMs(r.day) <= cutoff);
    if (from) {
      const delta = latest.value - from.value;
      weekOverWeek = {
        from,
        delta,
        pct: from.value === 0 ? null : Math.round((delta / from.value) * 1000) / 10,
      };
    }
  }

  return { metric, baseline, latest, weekOverWeek, readings };
}

export function summarizeMetrics(snapshots: MetricSnapshot[]): MetricSeriesSummary[] {
  return METRIC_NAMES.map((metric) => summarizeMetric(metric, snapshots));
}

export type ManualEntryError = 'metric' | 'value' | 'day';

/** Validate a typed-in reading before it reaches the mcp tool. */
export function validateManualEntry(body: {
  metric?: unknown;
  value?: unknown;
  day?: unknown;
}): { ok: true; metric: ManualMetric; value: number; day?: string } | { ok: false; error: ManualEntryError } {
  if (typeof body.metric !== 'string' || !(MANUAL_METRICS as readonly string[]).includes(body.metric)) {
    return { ok: false, error: 'metric' };
  }
  if (typeof body.value !== 'number' || !Number.isInteger(body.value) || body.value < 0) {
    return { ok: false, error: 'value' };
  }
  if (body.day !== undefined) {
    if (typeof body.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.day) || Number.isNaN(dayMs(body.day))) {
      return { ok: false, error: 'day' };
    }
    return { ok: true, metric: body.metric as ManualMetric, value: body.value, day: body.day };
  }
  return { ok: true, metric: body.metric as ManualMetric, value: body.value };
}

/** web_list_cta_clicks, verbatim (mcp migration 024). */
export interface CtaClickSummary {
  rows: Array<{ day: string; post_slug: string; link: 'cta' | 'byline'; clicks: number }>;
  total: number;
  by_link: { cta: number; byline: number };
  by_post: Array<{ post_slug: string; clicks: number }>;
}
