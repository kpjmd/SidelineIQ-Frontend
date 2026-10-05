'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LedgerBaseRate, LedgerDistributeOutcome, LedgerForecast } from '@/lib/ledger-types';
import { LedgerDraftForm } from './LedgerDraftForm';
import { LedgerPublishPreview } from './LedgerPublishPreview';

interface Props {
  initialBaseRates: LedgerBaseRate[];
  initialForecasts: LedgerForecast[];
}

type View =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'edit'; draft: LedgerForecast }
  | { kind: 'revise'; latest: LedgerForecast }
  | { kind: 'preview'; forecast: LedgerForecast; preview: LedgerDistributeOutcome | null; previewError: string | null };

const Badge = ({ on, label }: { on: boolean; label: string }) => (
  <span className={`font-mono text-[10px] tracking-wider px-1.5 py-0.5 rounded ${on ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>{label}</span>
);

export function LedgerAdmin({ initialBaseRates, initialForecasts }: Props) {
  const router = useRouter();
  const [forecasts, setForecasts] = useState(initialForecasts);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch('/api/admin/ledger/drafts');
    if (res.status === 401) return router.push('/signin');
    const data = (await res.json().catch(() => ({}))) as { forecasts?: LedgerForecast[]; error?: string };
    if (!res.ok || !data.forecasts) {
      setError(data.error ?? 'Failed to reload');
      return;
    }
    setForecasts(data.forecasts);
  }, [router]);

  const drafts = forecasts.filter((f) => f.status === 'draft');
  const published = forecasts.filter((f) => f.status === 'published');
  const latestByEntry = new Map<string, LedgerForecast>();
  for (const f of published) {
    const prev = latestByEntry.get(f.entry_id!);
    if (!prev || prev.version < f.version) latestByEntry.set(f.entry_id!, f);
  }

  if (view.kind === 'new' || view.kind === 'edit' || view.kind === 'revise') {
    return (
      <LedgerDraftForm
        baseRates={initialBaseRates}
        initial={view.kind === 'edit' ? view.draft : view.kind === 'revise' ? view.latest : null}
        parentEntryId={view.kind === 'revise' ? view.latest.entry_id : view.kind === 'edit' ? view.draft.entry_id : null}
        onPublished={(forecast, preview, previewError) => {
          void reload();
          setView({ kind: 'preview', forecast, preview, previewError });
        }}
        onCancel={() => {
          void reload();
          setView({ kind: 'list' });
        }}
      />
    );
  }

  if (view.kind === 'preview') {
    return (
      <LedgerPublishPreview
        forecast={view.forecast}
        initialPreview={view.preview}
        initialPreviewError={view.previewError}
        onDone={() => {
          void reload();
          setView({ kind: 'list' });
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Forecasting is never automated. A draft becomes a forecast only when you confirm it; a published row is immutable and revisions are new rows with a public trigger.</p>
        <button onClick={() => setView({ kind: 'new' })} className="px-4 py-2 rounded-lg bg-emerald-700 text-emerald-50 text-sm font-semibold hover:bg-emerald-600 whitespace-nowrap">
          New entry
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-bone">Drafts · {drafts.length}</h2>
        {drafts.length === 0 && <p className="text-xs text-slate-600">No drafts.</p>}
        {drafts.map((d) => (
          <div key={d.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-bone truncate">
                {d.player} · {d.position} · {d.team} — {d.reported_injury}
              </div>
              <div className="text-xs text-slate-500">
                {d.entry_id ? `revision of ${d.entry_id} (v${d.version})` : 'new entry'} · F4 {d.f4_point} ({d.f4_low}–{d.f4_high}) · tier {d.tier} · saved {new Date(d.updated_at).toLocaleString()}
              </div>
            </div>
            <button onClick={() => setView({ kind: 'edit', draft: d })} className="px-3 py-1.5 rounded bg-slate-800 text-slate-200 text-xs hover:bg-slate-700 whitespace-nowrap">
              Open
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-bone">Published · {latestByEntry.size} entries</h2>
        {latestByEntry.size === 0 && <p className="text-xs text-slate-600">Nothing published yet. The first entry will be PT-{new Date().getFullYear()}-001.</p>}
        {[...latestByEntry.values()].map((f) => (
          <div key={f.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-bone truncate">
                  <span className="font-mono">{f.entry_id} · v{f.version} · {f.row_hash?.slice(0, 8)}</span> — {f.player} · {f.position} · {f.team}
                </div>
                <div className="text-xs text-slate-500">
                  {f.reported_injury} · F4 {f.f4_point} ({f.f4_low}–{f.f4_high}) · published {f.published_at ? new Date(f.published_at).toLocaleString() : '—'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge on={!!f.commit_sha} label="COMMIT" />
                <Badge on={!!f.x_post_id} label="X" />
                <Badge on={!!f.x_self_reply_id} label="SELF" />
                <Badge on={!!f.farcaster_hash} label="FC" />
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <a href={`/ledger/${f.entry_id}`} target="_blank" rel="noopener noreferrer" className="text-signal-cyan hover:text-signal-cyan-hover">
                Public page
              </a>
              {f.commit_url && (
                <a href={f.commit_url} target="_blank" rel="noopener noreferrer" className="text-signal-cyan hover:text-signal-cyan-hover">
                  Commit
                </a>
              )}
              <button onClick={() => setView({ kind: 'preview', forecast: f, preview: null, previewError: null })} className="text-slate-300 hover:text-bone">
                {f.commit_sha && f.x_post_id && f.farcaster_hash ? 'Distribution' : 'Distribute / dry run'}
              </button>
              <button onClick={() => setView({ kind: 'revise', latest: f })} className="text-slate-300 hover:text-bone">
                Revise (v{f.version + 1})
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
