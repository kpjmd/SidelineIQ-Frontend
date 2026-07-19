'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { SECTION_KEYS } from '@/lib/types';
import type {
  CandidateListItem,
  DeskPost,
  DeskPostListItem,
  DeskPostStatus,
  DeskSections,
} from '@/lib/types';

interface Props {
  initialPosts: DeskPostListItem[];
  acceptedCandidates: CandidateListItem[];
}

function statusBadge(status: DeskPostStatus): string {
  switch (status) {
    case 'READY':
      return 'bg-emerald-900/60 text-emerald-300 border-emerald-700';
    case 'PUBLISHED':
      return 'bg-indigo-900/60 text-indigo-300 border-indigo-600';
    case 'RETRACTED':
      return 'bg-red-900/60 text-red-300 border-red-700';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-600';
  }
}

function injuryDesc(c: { laterality: string | null; body_part: string | null; injury_type: string | null }): string {
  return [c.laterality && c.laterality !== 'UNSPECIFIED' ? c.laterality.toLowerCase() : null, c.body_part, c.injury_type]
    .filter(Boolean)
    .join(' ');
}

export function DeskList({ initialPosts, acceptedCandidates }: Props) {
  const router = useRouter();
  const [posts] = useState(initialPosts);
  const [candidates, setCandidates] = useState(
    acceptedCandidates.filter((c) => c.candidate_kind !== 'RETURN_WATCH_UPDATE'),
  );
  const [returnWatchCandidates] = useState(
    acceptedCandidates.filter((c) => c.candidate_kind === 'RETURN_WATCH_UPDATE'),
  );
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});

  async function startDraft(c: CandidateListItem) {
    setStarting(c.id);
    setError((prev) => {
      const next = { ...prev };
      delete next[c.id];
      return next;
    });
    try {
      const title = `${c.athlete_name ?? 'Athlete'} — ${injuryDesc(c) || 'injury update'}`;
      // Start every section empty rather than seeding placeholder prose: the
      // linter blocks publish on an empty section, so an empty one is impossible
      // to miss, while a seeded one could be published as-is by accident.
      const sections = Object.fromEntries(SECTION_KEYS.map((k) => [k, ''])) as DeskSections;
      const res = await fetch('/api/desk/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: c.id,
          title,
          sections,
          // Prefill what the entity already knows; overridable in the metadata panel.
          meta: c.athlete_name ? { player: c.athlete_name } : {},
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { post?: DeskPost; error?: string };
      if (!res.ok || !data.post) throw new Error(data.error ?? 'Failed to create draft');
      setCandidates((prev) => prev.filter((x) => x.id !== c.id));
      router.push(`/desk/${data.post.id}`);
    } catch (err) {
      setError((prev) => ({ ...prev, [c.id]: err instanceof Error ? err.message : 'Failed to create draft' }));
      setStarting(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-lg font-semibold text-white">Injury Desk</h1>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Ready to draft</h2>
        {candidates.length === 0 ? (
          <p className="text-xs text-slate-600">
            No accepted candidates. Accept a candidate in /admin to start a desk draft.
          </p>
        ) : (
          candidates.map((c) => (
            <div key={c.id} className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{c.athlete_name ?? 'Unknown athlete'}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{injuryDesc(c) || c.headline || '—'}</p>
                </div>
                <button
                  onClick={() => startDraft(c)}
                  disabled={starting === c.id}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-700 text-emerald-100 hover:bg-emerald-600 disabled:opacity-50 transition-colors shrink-0"
                >
                  {starting === c.id ? 'Creating…' : 'Start desk draft'}
                </button>
              </div>
              {error[c.id] && <p className="text-xs text-red-400 mt-2">{error[c.id]}</p>}
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Return Watch pending</h2>
        {returnWatchCandidates.length === 0 ? (
          <p className="text-xs text-slate-600">No pending Return Watch follow-ups.</p>
        ) : (
          returnWatchCandidates.map((c) => (
            <Link
              key={c.id}
              href={`/desk/${c.target_desk_post_id}?candidate_id=${c.id}`}
              className="block bg-slate-900 border border-slate-700 rounded-lg p-4 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{c.athlete_name ?? 'Unknown athlete'}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{injuryDesc(c) || c.headline || '—'}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-semibold border shrink-0 bg-emerald-900/60 text-emerald-300 border-emerald-700">
                  Return Watch
                </span>
              </div>
            </Link>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Desk posts</h2>
        {posts.length === 0 ? (
          <p className="text-xs text-slate-600">No desk posts yet.</p>
        ) : (
          posts.map((p) => (
            <Link
              key={p.id}
              href={`/desk/${p.id}`}
              className="block bg-slate-900 border border-slate-700 rounded-lg p-4 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{p.title}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {p.athlete_name ?? 'Unknown'} · {injuryDesc(p) || '—'}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold border shrink-0 ${statusBadge(p.status)}`}>
                  {p.status}
                </span>
                <time className="text-xs text-slate-600 shrink-0">
                  {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                </time>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
