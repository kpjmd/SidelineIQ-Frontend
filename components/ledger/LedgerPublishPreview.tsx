'use client';

import { useState } from 'react';
import type { LedgerDistributeOutcome, LedgerForecast } from '@/lib/ledger-types';

interface Props {
  forecast: LedgerForecast;
  initialPreview: LedgerDistributeOutcome | null;
  initialPreviewError: string | null;
  onDone: () => void;
}

const statusTone = (s: string) =>
  s === 'ok' || s === 'committed' || s === 'already_recorded' || s === 'already_committed'
    ? 'text-emerald-300'
    : s === 'dry_run'
      ? 'text-slate-400'
      : s === 'skipped'
        ? 'text-amber-300'
        : 'text-red-400';

/**
 * What the agents WILL send for a published row (the dry run) and the button
 * that sends it. The row is already immutable and hashed by the time this
 * renders; this is the mechanical consequence of that confirmation (plan Part 4).
 * If the agents' LEDGER_PUBLISH_DRY_RUN env is on, "Post and commit" also
 * comes back as a dry run, and the banner says so.
 */
export function LedgerPublishPreview({ forecast, initialPreview, initialPreviewError, onDone }: Props) {
  const [outcome, setOutcome] = useState<LedgerDistributeOutcome | null>(initialPreview);
  const [error, setError] = useState<string | null>(initialPreviewError);
  const [busy, setBusy] = useState(false);
  const [forceStandalone, setForceStandalone] = useState(false);

  async function distribute(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ledger/forecasts/${forecast.id}/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: dryRun, force_standalone: forceStandalone }),
      });
      const data = (await res.json().catch(() => ({}))) as { outcome?: LedgerDistributeOutcome; error?: string; detail?: unknown };
      if (!res.ok || !data.outcome) {
        const detail = data.detail && typeof data.detail === 'object' && 'detail' in data.detail ? JSON.stringify((data.detail as { detail: unknown }).detail) : '';
        throw new Error(`${data.error ?? `Agents returned ${res.status}`}${detail ? ` — ${detail}` : ''}`);
      }
      setOutcome(data.outcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Distribution failed');
    } finally {
      setBusy(false);
    }
  }

  const hash8 = forecast.row_hash?.slice(0, 8) ?? '—';
  const live = outcome && !outcome.dry_run;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-bone">
            {forecast.entry_id} · v{forecast.version} · <span className="font-mono">{hash8}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Published {forecast.published_at ? new Date(forecast.published_at).toLocaleString() : '—'}. The row is immutable; what follows is its distribution.
          </p>
        </div>
        <button onClick={onDone} className="text-xs text-slate-500 hover:text-slate-300">Back to list</button>
      </div>

      {error && <p className="text-xs text-red-400 whitespace-pre-wrap">{error}</p>}

      {outcome && (
        <div className="space-y-4">
          {outcome.dry_run ? (
            <div className="rounded border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-200">
              DRY RUN — nothing was committed or posted. {outcome.warnings.some((w) => w.includes('LEDGER_GITHUB')) ? 'The agents service has no GitHub token configured. ' : ''}
              If you pressed “Post and commit” and still see this, LEDGER_PUBLISH_DRY_RUN=true is set on the agents service.
            </div>
          ) : (
            <div className={`rounded border p-3 text-xs ${outcome.mirrored ? 'border-emerald-800 bg-emerald-950/40 text-emerald-200' : 'border-red-800 bg-red-950/40 text-red-200'}`}>
              {outcome.mirrored ? 'Committed and posted on every platform.' : 'Committed, but at least one platform failed. Re-run “Post and commit” to fill the gaps; recorded steps are not repeated.'}
            </div>
          )}
          {outcome.warnings.length > 0 && (
            <ul className="text-xs text-amber-300 list-disc list-inside">
              {outcome.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400">COMMIT · {outcome.commit.path}</span>
              <span className={statusTone(outcome.commit.status)}>{outcome.commit.status}{outcome.commit.error ? ` — ${outcome.commit.error}` : ''}</span>
            </div>
            <div className="text-xs text-slate-500">{outcome.commit.message}</div>
            {outcome.commit.url && (
              <a href={outcome.commit.url} target="_blank" rel="noopener noreferrer" className="text-xs text-signal-cyan hover:text-signal-cyan-hover">
                {outcome.commit.url}
              </a>
            )}
            {outcome.commit.body && <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-slate-400">{outcome.commit.body}</pre>}
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400">X CARD REPLY{outcome.x.reply_to_id ? ` · replying to ${outcome.x.reply_to_id}` : ' · standalone'}</span>
              <span className={statusTone(outcome.x.status)}>{outcome.x.status}{outcome.x.post_id ? ` · ${outcome.x.post_id}` : ''}{outcome.x.error ? ` — ${outcome.x.error}` : ''}</span>
            </div>
            <pre className="whitespace-pre-wrap rounded bg-slate-950 p-3 text-sm text-bone">{outcome.x.text}</pre>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400">X SELF-REPLY</span>
              <span className={statusTone(outcome.x_self_reply.status)}>{outcome.x_self_reply.status}{outcome.x_self_reply.id ? ` · ${outcome.x_self_reply.id}` : ''}{outcome.x_self_reply.error ? ` — ${outcome.x_self_reply.error}` : ''}</span>
            </div>
            <pre className="whitespace-pre-wrap rounded bg-slate-950 p-3 text-sm text-bone">{outcome.x_self_reply.text}</pre>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400">FARCASTER MIRROR · {outcome.farcaster.byte_length}/320 bytes{outcome.farcaster.channel_id ? ` · /${outcome.farcaster.channel_id}` : ' · home feed'}</span>
              <span className={statusTone(outcome.farcaster.status)}>{outcome.farcaster.status}{outcome.farcaster.hash ? ` · ${outcome.farcaster.hash}` : ''}{outcome.farcaster.error ? ` — ${outcome.farcaster.error}` : ''}</span>
            </div>
            <pre className="whitespace-pre-wrap rounded bg-slate-950 p-3 text-sm text-bone">{outcome.farcaster.text}</pre>
            <div className="text-xs text-slate-500">embed: {outcome.farcaster.embeds.map((e) => e.url).join(', ')}</div>
          </section>

          {live && (
            <div className="text-xs text-slate-500">
              provenance {outcome.provenance.recorded ? 'recorded' : `NOT recorded — ${outcome.provenance.error ?? 'unknown'}`}
            </div>
          )}
        </div>
      )}

      <div className="border-t border-slate-800 pt-4 space-y-3">
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={forceStandalone} onChange={(e) => setForceStandalone(e.target.checked)} className="accent-amber-500" />
          Post standalone if the reply target URL cannot be parsed (reply_to_url is frozen on the row)
        </label>
        <div className="flex items-center gap-3">
          <button onClick={() => distribute(false)} disabled={busy} className="px-4 py-3 rounded-lg bg-emerald-700 text-emerald-50 font-bold text-sm hover:bg-emerald-600 disabled:opacity-50 ring-1 ring-emerald-500/40">
            {busy ? 'Working…' : 'Post and commit'}
          </button>
          <button onClick={() => distribute(true)} disabled={busy} className="px-4 py-3 rounded-lg bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 disabled:opacity-50">
            Re-run dry run
          </button>
        </div>
      </div>
    </div>
  );
}
