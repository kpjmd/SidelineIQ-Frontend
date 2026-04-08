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
  adminSecret: string;
}

export function ReviewQueue({ initialReviews, adminSecret }: Props) {
  const [reviews, setReviews] = useState(initialReviews);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleUpdate(updated: MdReview) {
    setReviews((prev) =>
      prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
    );
  }

  const pending = reviews.filter((r) => r.status === 'PENDING');
  const rest = reviews.filter((r) => r.status !== 'PENDING');
  const sorted = [...pending, ...rest];

  return (
    <div className="space-y-3">
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
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_BADGE[review.status] ?? STATUS_BADGE.PENDING}`}
                >
                  {review.status}
                </span>
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
                      adminSecret={adminSecret}
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
