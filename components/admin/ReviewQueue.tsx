'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { MdReview } from '@/lib/types';
import { SportBadge } from '@/components/shared/SportBadge';
import { MDReviewForm } from './MDReviewForm';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-900/50 text-amber-400 border-amber-700',
  APPROVED: 'bg-green-900/50 text-green-400 border-green-700',
  REJECTED: 'bg-red-900/50 text-red-400 border-red-700',
};

interface Props {
  initialReviews: MdReview[];
}

export function ReviewQueue({ initialReviews }: Props) {
  const [reviews, setReviews] = useState(initialReviews);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  // Promote is additive — the review stays open. Track promoted post_ids locally
  // to swap the button for a "Promoted ✓" badge, and surface per-row errors.
  const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set());
  const [promoteError, setPromoteError] = useState<Record<string, string>>({});
  // An approved post that never reached Farcaster or X used to look identical
  // to a successful one. Keyed by review id so it survives the row leaving the
  // pending list.
  const [socialError, setSocialError] = useState<Record<string, string>>({});

  function handleUpdate(updated: MdReview) {
    setReviews((prev) =>
      prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
    );
  }

  async function handlePromote(review: MdReview) {
    setActionInProgress(review.id);
    setPromoteError((prev) => {
      const next = { ...prev };
      delete next[review.id];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/promote/${review.post_id}`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; score?: number };
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to promote');
      }
      setPromotedIds((prev) => new Set(prev).add(review.id));
    } catch (err) {
      setPromoteError((prev) => ({
        ...prev,
        [review.id]: err instanceof Error ? err.message : 'Failed to promote',
      }));
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleQuickApprove(review: MdReview) {
    setActionInProgress(review.id);
    try {
      const res = await fetch(`/api/admin/approve/${review.post_id}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to approve');

      // Approval and social publish succeed independently — the post can be
      // live on the site while the cast and tweet never happened.
      const data = (await res.json().catch(() => null)) as
        | { social?: { ok: boolean; error?: string } }
        | null;
      if (data?.social && !data.social.ok) {
        setSocialError((prev) => ({
          ...prev,
          [review.id]: data.social?.error ?? 'reached no social platform',
        }));
      }

      setReviews((prev) => prev.filter((r) => r.id !== review.id));
    } catch (err) {
      console.error('Quick approve failed:', err);
      setSocialError((prev) => ({
        ...prev,
        [review.id]: err instanceof Error ? err.message : 'Failed to approve',
      }));
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleQuickReject(review: MdReview) {
    setActionInProgress(review.id);
    try {
      const res = await fetch(`/api/admin/reject/${review.post_id}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to reject');
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
    } catch (err) {
      console.error('Quick reject failed:', err);
    } finally {
      setActionInProgress(null);
    }
  }

  const pending = reviews.filter((r) => r.status === 'PENDING');
  const rest = reviews.filter((r) => r.status !== 'PENDING');
  const sorted = [...pending, ...rest];

  const socialFailures = Object.entries(socialError);

  return (
    <div className="space-y-3">
      {socialFailures.length > 0 && (
        <div className="bg-red-950/40 border border-red-800 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-red-300">
            Approved, but did not reach Farcaster or X
          </p>
          <p className="text-xs text-red-400/80">
            The post is live on the site. Nothing was cast or tweeted.
          </p>
          <ul className="space-y-1">
            {socialFailures.map(([id, message]) => (
              <li key={id} className="text-xs text-red-400 font-mono break-all">
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sorted.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No reviews in queue.</p>
        </div>
      )}

      {sorted.map((review) => {
        const isExpanded = expandedId === review.id;
        return (
          <div
            key={review.id}
            className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpandedId(isExpanded ? null : review.id)}
              className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-800/50 transition-colors"
            >
              {review.sport && <SportBadge sport={review.sport} />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {review.athlete_name}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {review.headline}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {review.reason && /confidence\s+([\d.]+)/.test(review.reason) && (
                  <span className="text-xs text-slate-500 tabular-nums">
                    {(parseFloat(review.reason.match(/confidence\s+([\d.]+)/)?.[1] ?? '0') * 100).toFixed(0)}%
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_BADGE[review.status] ?? STATUS_BADGE.PENDING}`}
                >
                  {review.status}
                </span>
                {review.status === 'PENDING' && (
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleQuickApprove(review)}
                      disabled={actionInProgress === review.id}
                      className="px-3 py-1 text-xs font-medium rounded bg-green-700 text-green-100 hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      {actionInProgress === review.id ? '...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleQuickReject(review)}
                      disabled={actionInProgress === review.id}
                      className="px-3 py-1 text-xs font-medium rounded bg-red-900 text-red-200 hover:bg-red-800 disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                    {promotedIds.has(review.id) ? (
                      <span className="px-3 py-1 text-xs font-medium rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700">
                        Promoted ✓
                      </span>
                    ) : (
                      <button
                        onClick={() => handlePromote(review)}
                        disabled={actionInProgress === review.id}
                        title="Propose this post to the Injury Desk (does not affect the review)"
                        className="px-3 py-1 text-xs font-medium rounded bg-indigo-800 text-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {actionInProgress === review.id ? '...' : 'Promote'}
                      </button>
                    )}
                  </div>
                )}
                <time className="text-xs text-slate-600">
                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                </time>
                <svg
                  className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {promoteError[review.id] && (
              <p className="px-4 pb-3 -mt-1 text-xs text-red-400">
                Promote failed: {promoteError[review.id]}
              </p>
            )}

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-slate-800">
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Flagged reason</p>
                  <p className="text-sm text-slate-400">{review.reason}</p>

                  {review.slug && (
                    <Link
                      href={`/post/${review.slug}`}
                      target="_blank"
                      className="inline-block text-xs text-blue-400 hover:text-blue-300 mt-1"
                    >
                      View post →
                    </Link>
                  )}

                  {review.status === 'PENDING' && (
                    <MDReviewForm
                      review={review}
                      onUpdate={handleUpdate}
                    />
                  )}

                  {review.status !== 'PENDING' && review.reviewer_notes && (
                    <div className="mt-3 p-3 bg-slate-800 rounded-md">
                      <p className="text-xs text-slate-500 mb-1">Physician notes</p>
                      <p className="text-sm text-slate-300">{review.reviewer_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
