'use client';

import { useState } from 'react';
import type { MdReview } from '@/lib/types';

interface Props {
  review: MdReview;
  adminSecret: string;
  onUpdate: (updated: MdReview) => void;
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
}

export function MDReviewForm({ review, adminSecret, onUpdate }: Props) {
  const [notes, setNotes] = useState(review.reviewer_notes ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentenceCount = countSentences(notes);
  const sentenceWarning = sentenceCount > 3;

  async function submitReview(status: 'APPROVED' | 'REJECTED') {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/review/${review.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({ status, reviewer_notes: notes }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Request failed');
      }
      const updated = await res.json() as MdReview;
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Physician Review Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Add clinical notes for this post (max 3 sentences)..."
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-600 resize-none"
        />
        {sentenceWarning && (
          <p className="text-xs text-amber-500 mt-1">
            Note: MD reviews should be 3 sentences or fewer ({sentenceCount} detected).
          </p>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => submitReview('APPROVED')}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-md bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving…' : 'Approve & Publish'}
        </button>
        <button
          onClick={() => submitReview('REJECTED')}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
