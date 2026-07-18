'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { DeskPostUpdate } from '@/lib/types';

interface Props {
  deskPostId: string;
  initialUpdates: DeskPostUpdate[];
  // Set when this editor was opened from an ACCEPTED Return Watch candidate
  // (via /desk/[id]?candidate_id=...) — passed through so the append closes
  // that candidate out (flips it to PROMOTED) atomically.
  candidateId?: string;
}

// "Return Watch" — appends a dated follow-up to an already-PUBLISHED desk
// post (e.g. a return-to-play milestone). Renders the existing timeline plus
// a small authoring form. Only meaningful on a PUBLISHED post; the caller
// (DeskEditorView) is responsible for only mounting this when status is
// PUBLISHED.
export function ReturnWatchPanel({ deskPostId, initialUpdates, candidateId }: Props) {
  const [updates, setUpdates] = useState(initialUpdates);
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!headline.trim() || !body.trim() || !occurredAt) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/desk/posts/${deskPostId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline,
          markdown_body: body,
          occurred_at: new Date(`${occurredAt}T00:00:00Z`).toISOString(),
          candidate_id: candidateId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { update?: DeskPostUpdate; error?: string };
      if (!res.ok || !data.update) throw new Error(data.error ?? 'Failed to add update');
      setUpdates((prev) => [data.update!, ...prev]);
      setHeadline('');
      setBody('');
      setOccurredAt(new Date().toISOString().slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add update');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Return Watch</h3>

      <div className="space-y-2">
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Headline (e.g. Day 298: first game back)"
          className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened, and what it means for the recovery timeline."
          rows={3}
          className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 resize-none focus:outline-none focus:border-slate-500"
        />
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500"
          />
          <button
            onClick={submit}
            disabled={submitting || !headline.trim() || !body.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-700 text-emerald-100 hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Adding…' : 'Add update'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {updates.length === 0 ? (
        <p className="text-xs text-slate-600">No follow-ups yet.</p>
      ) : (
        <ol className="space-y-3 pt-2 border-t border-slate-800">
          {updates.map((u) => (
            <li key={u.id} className="border-l-2 border-emerald-800 pl-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-white">{u.headline}</span>
                <time className="text-[11px] text-slate-600 ml-auto">
                  {formatDistanceToNow(new Date(u.occurred_at), { addSuffix: true })}
                </time>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-snug">{u.markdown_body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
