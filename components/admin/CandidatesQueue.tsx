'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { CandidateDecision, CandidateListItem } from '@/lib/types';
import { SportBadge } from '@/components/shared/SportBadge';

interface Props {
  initialCandidates: CandidateListItem[];
  adminSecret: string;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-indigo-700 text-indigo-100 border-indigo-500';
  if (score >= 55) return 'bg-indigo-900/60 text-indigo-300 border-indigo-700';
  return 'bg-slate-800 text-slate-400 border-slate-600';
}

// Triage queue for the Injury Desk Candidates tab. Lists PROPOSED candidates
// (already score-desc from the backend). Accept parks the candidate for Phase 2
// desk authoring; Dismiss closes it. Both are audited server-side.
export function CandidatesQueue({ initialCandidates, adminSecret }: Props) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});

  async function decide(candidate: CandidateListItem, decision: CandidateDecision) {
    setActionInProgress(candidate.id);
    setError((prev) => {
      const next = { ...prev };
      delete next[candidate.id];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/candidates/${candidate.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSecret}` },
        body: JSON.stringify({ decision }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to record decision');
      setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
    } catch (err) {
      setError((prev) => ({
        ...prev,
        [candidate.id]: err instanceof Error ? err.message : 'Failed to record decision',
      }));
    } finally {
      setActionInProgress(null);
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No proposed candidates.</p>
        <p className="text-xs mt-1">Promote a post from the Reviews or Promote tab to populate this queue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {candidates.map((c) => {
        const isExpanded = expandedId === c.id;
        const score = Math.round(Number(c.promotion_score));
        const injuryDesc = [c.laterality && c.laterality !== 'UNSPECIFIED' ? c.laterality.toLowerCase() : null, c.body_part, c.injury_type]
          .filter(Boolean)
          .join(' ');
        return (
          <div key={c.id} className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : c.id)}
              className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-800/50 transition-colors"
            >
              {c.sport && <SportBadge sport={c.sport} />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{c.athlete_name ?? 'Unknown athlete'}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{injuryDesc || c.headline || '—'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold border tabular-nums ${scoreColor(score)}`}
                  title="promotion score (0–100)"
                >
                  {score}
                </span>
                <button
                  onClick={() => decide(c, 'ACCEPTED')}
                  disabled={actionInProgress === c.id}
                  className="px-3 py-1 text-xs font-medium rounded bg-green-700 text-green-100 hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  {actionInProgress === c.id ? '...' : 'Accept'}
                </button>
                <button
                  onClick={() => decide(c, 'DISMISSED')}
                  disabled={actionInProgress === c.id}
                  className="px-3 py-1 text-xs font-medium rounded bg-red-900 text-red-200 hover:bg-red-800 disabled:opacity-50 transition-colors"
                >
                  Dismiss
                </button>
                <time className="text-xs text-slate-600">
                  {formatDistanceToNow(new Date(c.proposed_at), { addSuffix: true })}
                </time>
              </div>
            </button>

            {error[c.id] && <p className="px-4 pb-3 -mt-1 text-xs text-red-400">{error[c.id]}</p>}

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-slate-800">
                <div className="mt-3 space-y-2">
                  {Array.isArray(c.reasons) && c.reasons.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Score breakdown</p>
                      <ul className="text-sm text-slate-400 space-y-0.5">
                        {c.reasons.map((r, i) => (
                          <li key={i} className="font-mono text-xs">{r}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="text-xs text-slate-600 pt-1">
                    Accept parks this for Injury Desk authoring (Phase 2). Dismiss closes it.
                  </p>
                  {c.slug && (
                    <Link
                      href={`/post/${c.slug}`}
                      target="_blank"
                      className="inline-block text-xs text-blue-400 hover:text-blue-300 mt-1"
                    >
                      View source post →
                    </Link>
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
