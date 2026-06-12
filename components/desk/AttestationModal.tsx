'use client';

import { useState } from 'react';
import type { DeskAttestation, DeskPost, DeskPostStatus, PublishGate, PublishResult } from '@/lib/types';

interface Props {
  deskPostId: string;
  status: DeskPostStatus;
  blockersPresent: boolean;
  isStale: boolean;
  onAttested: (attestation: DeskAttestation) => void;
  onPublished: (post: DeskPost) => void;
}

const CONFIRMATIONS = [
  { key: 'reviewed_source_reports', label: 'I have reviewed the underlying public source reports.' },
  { key: 'edited_for_accuracy', label: 'I have edited this commentary for clinical accuracy.' },
  { key: 'framing_confirmed', label: 'The framing is general educational analysis, not a diagnosis of these athletes.' },
] as const;

type ConfirmKey = (typeof CONFIRMATIONS)[number]['key'];

export function AttestationModal({
  deskPostId,
  status,
  blockersPresent,
  isStale,
  onAttested,
  onPublished,
}: Props) {
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<Record<ConfirmKey, boolean>>({
    reviewed_source_reports: false,
    edited_for_accuracy: false,
    framing_confirmed: false,
  });
  const [attesting, setAttesting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<PublishGate | null>(null);

  const allChecked = CONFIRMATIONS.every((c) => checks[c.key]);
  const isPublished = status === 'PUBLISHED' || status === 'RETRACTED';
  const canPublish = status === 'READY' && !isStale && !blockersPresent;

  async function attest() {
    setAttesting(true);
    setError(null);
    setGate(null);
    try {
      const res = await fetch(`/api/desk/posts/${deskPostId}/attest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checks),
      });
      const data = (await res.json().catch(() => ({}))) as { attestation?: DeskAttestation; error?: string };
      if (!res.ok || !data.attestation) throw new Error(data.error ?? 'Attestation failed');
      onAttested(data.attestation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attestation failed');
    } finally {
      setAttesting(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    setGate(null);
    try {
      const res = await fetch(`/api/desk/posts/${deskPostId}/publish`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as PublishResult & { error?: string };
      if (res.status === 422) {
        // Blocked by the gate — render the reasons.
        setGate(data.gate ?? null);
        return;
      }
      if (!res.ok || !data.published || !data.post) throw new Error(data.error ?? 'Publish failed');
      onPublished(data.post);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isPublished}
        className="w-full px-4 py-3 rounded-lg bg-emerald-700 text-emerald-50 font-semibold text-sm hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPublished ? `Post ${status.toLowerCase()}` : 'Attest & publish…'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Physician attestation</h2>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 text-sm">
                Close
              </button>
            </div>

            {isStale && (
              <p className="text-xs text-amber-300">
                This post was edited since the last attestation. Re-attest below before publishing.
              </p>
            )}

            <div className="space-y-2">
              {CONFIRMATIONS.map((c) => (
                <label key={c.key} className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checks[c.key]}
                    onChange={(e) => setChecks((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>

            <button
              onClick={attest}
              disabled={!allChecked || attesting}
              className="w-full px-3 py-2 rounded bg-slate-700 text-slate-100 text-sm font-medium hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              {attesting ? 'Recording attestation…' : 'Record attestation'}
            </button>

            <div className="border-t border-slate-800 pt-4">
              {blockersPresent && (
                <p className="text-xs text-red-400 mb-2">
                  Resolve all linter blockers before publishing.
                </p>
              )}
              {status === 'DRAFT' && !isStale && (
                <p className="text-xs text-slate-500 mb-2">Record an attestation above to enable publishing.</p>
              )}
              <button
                onClick={publish}
                disabled={!canPublish || publishing}
                className="w-full px-4 py-3 rounded-lg bg-emerald-700 text-emerald-50 font-bold text-sm hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ring-1 ring-emerald-500/40"
              >
                {publishing ? 'Publishing…' : 'Publish as Dr. Keith P. Johnson, MD'}
              </button>
            </div>

            {gate && (
              <div className="bg-red-950/60 border border-red-800 rounded p-3 text-xs text-red-200 space-y-1">
                <p className="font-semibold text-red-300">Publish blocked by the gate:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {gate.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
