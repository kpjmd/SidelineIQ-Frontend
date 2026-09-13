'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MANUAL_METRICS,
  summarizeMetrics,
  type CtaClickSummary,
  type ManualMetric,
  type MetricName,
  type MetricSeriesSummary,
  type MetricSnapshot,
} from '@/lib/metrics-summary';

interface MetricsResponse {
  snapshots: MetricSnapshot[] | null;
  snapshots_error: string | null;
  clicks: CtaClickSummary | null;
  clicks_error: string | null;
  clicks_since: string;
}

const LABEL: Record<MetricName, string> = {
  x_followers: 'X followers',
  farcaster_followers: 'Farcaster followers',
  web_monthly_uniques: 'Web monthly uniques',
  web_monthly_pageviews: 'Web monthly page views',
};

const NOTE: Record<MetricName, string> = {
  x_followers: 'Daily, automated (agents metrics snapshot).',
  farcaster_followers: 'Daily, automated (agents metrics snapshot).',
  web_monthly_uniques:
    'Typed in from Vercel Analytics. The first honest month exists ~30 days after analytics was enabled.',
  web_monthly_pageviews: 'Typed in from Vercel Analytics, same cadence as uniques.',
};

function WowCell({ s }: { s: MetricSeriesSummary }) {
  if (!s.weekOverWeek) {
    return <span className="text-slate-600" title="Needs a reading at least 7 days before the latest">n/a</span>;
  }
  const { delta, pct, from } = s.weekOverWeek;
  const sign = delta > 0 ? '+' : '';
  return (
    <span className={delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-400'}>
      {sign}
      {delta}
      {pct !== null && ` (${sign}${pct}%)`}
      <span className="text-slate-600"> vs {from.day}</span>
    </span>
  );
}

// MD dashboard "Metrics" tab — the baseline every growth gate is measured
// against (monetization plan Phase 0.3). A metric with no readings shows
// "no data", never 0: a failed snapshot writes no row.
export function MetricsView() {
  const router = useRouter();
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{ metric: ManualMetric; value: string; day: string }>({
    metric: 'web_monthly_uniques',
    value: '',
    day: '',
  });
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [openSeries, setOpenSeries] = useState<MetricName | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/metrics');
      if (res.status === 401) {
        router.push('/signin');
        return;
      }
      if (!res.ok) throw new Error('Failed to load metrics');
      setData((await res.json()) as MetricsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);
    const value = Number(form.value);
    if (form.value.trim() === '' || !Number.isInteger(value) || value < 0) {
      setFormMessage('Enter a whole number, 0 or more.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric: form.metric, value, ...(form.day ? { day: form.day } : {}) }),
      });
      if (res.status === 401) {
        router.push('/signin');
        return;
      }
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed to record');
      setForm((f) => ({ ...f, value: '' }));
      setFormMessage('Recorded.');
      await load();
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : 'Failed to record');
    } finally {
      setSaving(false);
    }
  };

  const series = data?.snapshots ? summarizeMetrics(data.snapshots) : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Baseline = the first reading of each series. Week-over-week is gate G2&apos;s unit.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Series */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-3">Audience</h3>
        {data?.snapshots_error && <p className="text-xs text-red-400 mb-2">{data.snapshots_error} — unavailable, not zero.</p>}
        {series && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800">
                  <th className="py-2 pr-3 font-medium">Metric</th>
                  <th className="py-2 pr-3 font-medium">Baseline</th>
                  <th className="py-2 pr-3 font-medium">Latest</th>
                  <th className="py-2 font-medium">Week over week</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.metric} className="border-b border-slate-900 align-top">
                    <td className="py-2 pr-3">
                      <button
                        onClick={() => setOpenSeries(openSeries === s.metric ? null : s.metric)}
                        className="text-slate-200 hover:text-white text-left"
                        disabled={s.readings.length === 0}
                      >
                        {LABEL[s.metric]}
                        {s.readings.length > 0 && <span className="text-slate-600"> · {s.readings.length}d</span>}
                      </button>
                      <p className="text-slate-600 mt-0.5">{NOTE[s.metric]}</p>
                    </td>
                    <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">
                      {s.baseline ? (
                        <>
                          {s.baseline.value} <span className="text-slate-600">on {s.baseline.day}</span>
                        </>
                      ) : (
                        <span className="text-slate-600">no data</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">
                      {s.latest ? (
                        <>
                          {s.latest.value} <span className="text-slate-600">on {s.latest.day}</span>
                        </>
                      ) : (
                        <span className="text-slate-600">no data</span>
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <WowCell s={s} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {series && openSeries && (
          <div className="mt-3 max-h-64 overflow-y-auto border border-slate-800 rounded p-3">
            <p className="text-xs text-slate-400 mb-2">{LABEL[openSeries]} — daily readings (missing days had no reading)</p>
            <table className="text-xs">
              <tbody>
                {[...(series.find((s) => s.metric === openSeries)?.readings ?? [])].reverse().map((r) => (
                  <tr key={r.day}>
                    <td className="pr-4 text-slate-500">{r.day}</td>
                    <td className="text-slate-300">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Manual entry */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-3">Record a web number</h3>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">
            Metric
            <select
              value={form.metric}
              onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as ManualMetric }))}
              className="block mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
            >
              {MANUAL_METRICS.map((m) => (
                <option key={m} value={m}>
                  {LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Value
            <input
              type="number"
              min={0}
              step={1}
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              className="block mt-1 w-28 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
            />
          </label>
          <label className="text-xs text-slate-500">
            Day (UTC, optional)
            <input
              type="date"
              value={form.day}
              onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
              className="block mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 rounded bg-amber-700 hover:bg-amber-600 text-white text-xs font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Record'}
          </button>
          {formMessage && <span className="text-xs text-slate-400">{formMessage}</span>}
        </form>
        <p className="text-xs text-slate-600 mt-2">
          One reading per metric per day; recording again on the same day replaces it.
        </p>
      </section>

      {/* CTA clicks */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-3">
          AequOs link clicks{data ? <span className="text-slate-500 font-normal"> · since {data.clicks_since}</span> : null}
        </h3>
        {data?.clicks_error && <p className="text-xs text-red-400 mb-2">{data.clicks_error} — unavailable, not zero.</p>}
        {data?.clicks && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              {data.clicks.total} total · {data.clicks.by_link.cta} from the CTA · {data.clicks.by_link.byline} from the byline
            </p>
            {data.clicks.by_post.length > 0 ? (
              <table className="w-full text-xs">
                <tbody>
                  {data.clicks.by_post.map((p) => (
                    <tr key={p.post_slug} className="border-b border-slate-900">
                      <td className="py-1.5 pr-3">
                        <a href={`/post/${p.post_slug}`} className="text-slate-300 hover:text-white">
                          {p.post_slug}
                        </a>
                      </td>
                      <td className="py-1.5 text-slate-300 text-right">{p.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-slate-600">
                No counted clicks. Web page links only — social CTAs link to aequos.io directly and are not counted here.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
