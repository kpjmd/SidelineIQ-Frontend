'use client';

import { useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type {
  DateConfidence,
  ThreadDetail,
  ThreadListItem,
} from '@/lib/types';
import { SportBadge } from '@/components/shared/SportBadge';

type View = 'active' | 'date_review' | 'accuracy';

interface Props {
  initialActive: ThreadListItem[];
}

const CONFIDENCE_COLOR: Record<DateConfidence, string> = {
  confirmed: 'bg-green-900/60 text-green-300 border-green-700',
  probable: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  possible: 'bg-amber-900/40 text-amber-300 border-amber-800',
  unknown: 'bg-red-900/40 text-red-300 border-red-800',
};

function injuryDescriptor(t: ThreadListItem): string {
  return [
    t.laterality && t.laterality !== 'UNSPECIFIED' ? t.laterality.toLowerCase() : null,
    t.body_part,
    t.injury_type,
  ]
    .filter(Boolean)
    .join(' ');
}

// MD dashboard "Threads" tab. Three sub-views over injury_entities:
//   active       — open threads: trajectory, projection, edit-dates + close
//   date_review  — threads with unresolved dates awaiting MD manual input
//   accuracy     — closed threads with the OTM projection-vs-actual record
export function ThreadsQueue({ initialActive }: Props) {
  const [view, setView] = useState<View>('active');
  const [byView, setByView] = useState<Record<View, ThreadListItem[] | null>>({
    active: initialActive,
    date_review: null,
    accuracy: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (v: View) => {
    setLoading(true);
    setError(null);
    try {
      const apiView = v === 'accuracy' ? 'closed' : v;
      const res = await fetch(`/api/admin/threads?view=${apiView}`);
      if (!res.ok) throw new Error('Failed to load threads');
      const data = (await res.json()) as { threads: ThreadListItem[] };
      setByView((prev) => ({ ...prev, [v]: data.threads }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads');
    } finally {
      setLoading(false);
    }
  }, []);

  function switchView(v: View) {
    setView(v);
    if (byView[v] === null) void load(v);
  }

  function refreshCurrent() {
    void load(view);
  }

  const threads = byView[view] ?? [];
  const tabs: [View, string][] = [
    ['active', 'Active'],
    ['date_review', 'Date review'],
    ['accuracy', 'Accuracy'],
  ];

  return (
    <div>
      <div className="flex items-center gap-1 mb-4">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => switchView(key)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              view === key
                ? 'bg-slate-800 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={refreshCurrent}
          disabled={loading}
          className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {view === 'accuracy' ? (
        <AccuracyView threads={threads} loading={loading} />
      ) : (
        <ThreadList threads={threads} view={view} loading={loading} onChanged={refreshCurrent} />
      )}
    </div>
  );
}

function ThreadList({
  threads,
  view,
  loading,
  onChanged,
}: {
  threads: ThreadListItem[];
  view: 'active' | 'date_review';
  loading: boolean;
  onChanged: () => void;
}) {
  if (loading && threads.length === 0) {
    return <p className="text-center py-12 text-slate-500 text-sm">Loading…</p>;
  }
  if (threads.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>{view === 'date_review' ? 'No threads awaiting date review.' : 'No active threads.'}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {threads.map((t) => (
        <ThreadCard key={t.id} thread={t} view={view} onChanged={onChanged} />
      ))}
    </div>
  );
}

function ThreadCard({
  thread,
  view,
  onChanged,
}: {
  thread: ThreadListItem;
  view: 'active' | 'date_review';
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // date-entry form
  const [injuryDate, setInjuryDate] = useState(thread.injury_date ?? '');
  const [confidence, setConfidence] = useState<DateConfidence>(thread.injury_date_confidence);
  // close form
  const [returnDate, setReturnDate] = useState('');

  async function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail) {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/admin/threads/${thread.id}`);
        if (res.ok) setDetail((await res.json()) as ThreadDetail);
      } finally {
        setDetailLoading(false);
      }
    }
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/threads/${thread.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Action failed');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const proj = thread.otm_projection;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={toggle}
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-800/50 transition-colors"
      >
        {thread.sport && <SportBadge sport={thread.sport} />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {thread.athlete_name ?? 'Unknown athlete'}
          </p>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {injuryDescriptor(thread) || '—'}
            {thread.team_name ? ` · ${thread.team_name}` : ''}
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold border ${CONFIDENCE_COLOR[thread.injury_date_confidence]}`}
          title="injury-date confidence"
        >
          {thread.injury_date ?? 'no date'} · {thread.injury_date_confidence}
        </span>
        <time className="text-xs text-slate-600 shrink-0">
          {formatDistanceToNow(new Date(thread.last_updated_at), { addSuffix: true })}
        </time>
      </button>

      {error && <p className="px-4 pb-3 -mt-1 text-xs text-red-400">{error}</p>}

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800 space-y-4">
          {/* Dates + projection */}
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-500 uppercase tracking-wide">Injury date</p>
              <p className="text-slate-300">
                {thread.injury_date ?? '—'} ({thread.injury_date_confidence})
              </p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wide">Surgery</p>
              <p className="text-slate-300">
                {thread.surgery_date ?? (thread.surgery_confirmed ? 'confirmed, date unknown' : '—')}
              </p>
            </div>
            {proj && (
              <div className="col-span-2">
                <p className="text-slate-500 uppercase tracking-wide">OTM projection</p>
                <p className="text-slate-300">
                  {proj.min_weeks}–{proj.max_weeks}w
                  {proj.projected_return_date ? ` · projected return ${proj.projected_return_date}` : ''}
                </p>
              </div>
            )}
          </div>

          {/* Trajectory */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Timeline trajectory
            </p>
            {detailLoading && <p className="text-xs text-slate-600">Loading…</p>}
            {detail && detail.updates.length > 0 ? (
              <ul className="text-xs text-slate-400 space-y-0.5 font-mono">
                {detail.updates.map((u) => (
                  <li key={u.id}>
                    {new Date(u.created_at).toISOString().slice(0, 10)} · {u.update_kind} ·{' '}
                    {u.team_timeline_weeks ?? '?'}w team / {u.otm_min_weeks ?? '?'}w OTM
                    {u.severity_at_time ? ` · ${u.severity_at_time}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              detail && <p className="text-xs text-slate-600">No trajectory rows yet.</p>
            )}
          </div>

          {/* Date-entry form (primary action in the date_review view) */}
          <div className="rounded border border-slate-800 p-3 space-y-2">
            <p className="text-xs font-medium text-slate-400">Set injury date</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={injuryDate}
                onChange={(e) => setInjuryDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
              />
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as DateConfidence)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="confirmed">confirmed</option>
                <option value="probable">probable</option>
                <option value="possible">possible</option>
                <option value="unknown">unknown</option>
              </select>
              <button
                onClick={() =>
                  post({
                    action: 'update_dates',
                    injury_date: injuryDate || undefined,
                    injury_date_confidence: confidence,
                  })
                }
                disabled={busy}
                className="px-3 py-1 text-xs font-medium rounded bg-blue-800 text-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {busy ? '…' : 'Save dates'}
              </button>
            </div>
          </div>

          {/* Close-thread action (active view) */}
          {view === 'active' && (
            <div className="rounded border border-slate-800 p-3 space-y-2">
              <p className="text-xs font-medium text-slate-400">Close thread (athlete returned)</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                />
                <button
                  onClick={() => post({ action: 'close', outcome: 'RESOLVED', actual_return_date: returnDate || undefined })}
                  disabled={busy || !returnDate}
                  className="px-3 py-1 text-xs font-medium rounded bg-green-800 text-green-100 hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Mark returned
                </button>
                <button
                  onClick={() => post({ action: 'close', outcome: 'RETIRED' })}
                  disabled={busy}
                  className="px-3 py-1 text-xs font-medium rounded bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 transition-colors"
                >
                  Retired
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AccuracyView({ threads, loading }: { threads: ThreadListItem[]; loading: boolean }) {
  if (loading && threads.length === 0) {
    return <p className="text-center py-12 text-slate-500 text-sm">Loading…</p>;
  }
  const withRecord = threads.filter((t) => t.accuracy_record?.error_days != null);
  const mae =
    withRecord.length > 0
      ? Math.round(
          withRecord.reduce((sum, t) => sum + Math.abs(t.accuracy_record!.error_days!), 0) /
            withRecord.length,
        )
      : null;
  const withinCount = threads.filter((t) => t.accuracy_record?.within_range === true).length;

  if (threads.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No closed threads yet.</p>
        <p className="text-xs mt-1">Accuracy records populate as threads are closed on return.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-900 p-4">
        <div>
          <p className="text-2xl font-black text-white tabular-nums">{mae ?? '—'}</p>
          <p className="text-xs text-slate-500">mean abs. error (days)</p>
        </div>
        <div>
          <p className="text-2xl font-black text-white tabular-nums">
            {withinCount}/{threads.length}
          </p>
          <p className="text-xs text-slate-500">returns within OTM window</p>
        </div>
      </div>

      {threads.map((t) => {
        const rec = t.accuracy_record;
        return (
          <div key={t.id} className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex items-center gap-3">
            {t.sport && <SportBadge sport={t.sport} />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{t.athlete_name ?? 'Unknown'}</p>
              <p className="text-xs text-slate-500 truncate">{injuryDescriptor(t) || '—'}</p>
            </div>
            <div className="text-right text-xs">
              <p className="text-slate-400">
                proj {rec?.projected_return_date ?? '—'} · actual {rec?.actual_return_date ?? '—'}
              </p>
              <p
                className={
                  rec?.within_range === true
                    ? 'text-green-400'
                    : rec?.within_range === false
                      ? 'text-red-400'
                      : 'text-slate-500'
                }
              >
                {rec?.error_days != null ? `${rec.error_days > 0 ? '+' : ''}${rec.error_days}d` : 'no record'}
                {rec?.within_range === true ? ' · within window' : rec?.within_range === false ? ' · outside window' : ''}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
