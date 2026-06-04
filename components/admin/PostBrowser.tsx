'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { ContentType, FeedResponse, InjuryPost, Sport } from '@/lib/types';
import { SportBadge } from '@/components/shared/SportBadge';

const CONTENT_TYPES: ContentType[] = ['CONFLICT_FLAG', 'BREAKING', 'TRACKING', 'DEEP_DIVE'];
const SPORTS: Sport[] = ['NFL', 'NBA', 'PREMIER_LEAGUE', 'UFC'];
const PAGE_SIZE = 20;

interface Props {
  adminSecret: string;
}

// Post browser for the Promote tab. Conflict-flag posts (the prime promotion
// targets) auto-publish and never hit the review queue, so this lets the MD find
// any published post and propose it to the Injury Desk. Promote is additive.
export function PostBrowser({ adminSecret }: Props) {
  const [posts, setPosts] = useState<InjuryPost[]>([]);
  const [contentType, setContentType] = useState<ContentType | ''>('CONFLICT_FLAG');
  const [sport, setSport] = useState<Sport | ''>('');
  const [athlete, setAthlete] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set());
  const [promoteError, setPromoteError] = useState<Record<string, string>>({});

  const fetchPosts = useCallback(
    async (nextOffset: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (contentType) params.set('content_type', contentType);
        if (sport) params.set('sport', sport);
        if (athlete.trim()) params.set('athlete_name', athlete.trim());
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(nextOffset));

        const res = await fetch(`/api/admin/posts?${params.toString()}`, {
          headers: { Authorization: `Bearer ${adminSecret}` },
        });
        if (!res.ok) throw new Error('Failed to fetch posts');
        const data = (await res.json()) as FeedResponse;
        setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
        setHasMore(data.has_more);
        setOffset(nextOffset);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [adminSecret, contentType, sport, athlete],
  );

  // Re-fetch from the top whenever a filter changes.
  useEffect(() => {
    fetchPosts(0, false);
  }, [fetchPosts]);

  async function handlePromote(post: InjuryPost) {
    setActionInProgress(post.id);
    setPromoteError((prev) => {
      const next = { ...prev };
      delete next[post.id];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/promote/${post.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to promote');
      setPromotedIds((prev) => new Set(prev).add(post.id));
    } catch (err) {
      setPromoteError((prev) => ({
        ...prev,
        [post.id]: err instanceof Error ? err.message : 'Failed to promote',
      }));
    } finally {
      setActionInProgress(null);
    }
  }

  const selectClass =
    'bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-600';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value as ContentType | '')}
          className={selectClass}
        >
          <option value="">All types</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value as Sport | '')}
          className={selectClass}
        >
          <option value="">All sports</option>
          {SPORTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          value={athlete}
          onChange={(e) => setAthlete(e.target.value)}
          placeholder="Athlete name…"
          className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-600"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {posts.length === 0 && !loading && (
        <div className="text-center py-12 text-slate-500"><p>No posts match these filters.</p></div>
      )}

      {posts.map((post) => {
        const gap =
          post.team_timeline_weeks != null && post.return_to_play_max_weeks != null
            ? post.return_to_play_max_weeks - post.team_timeline_weeks
            : null;
        return (
          <div key={post.id} className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <SportBadge sport={post.sport} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{post.athlete_name}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{post.headline}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-600">{post.content_type}</span>
                {gap != null && (
                  <span className="text-xs text-amber-400 tabular-nums" title="team weeks vs OTM max weeks">
                    Δ{gap >= 0 ? '+' : ''}{gap}w
                  </span>
                )}
                {promotedIds.has(post.id) ? (
                  <span className="px-3 py-1 text-xs font-medium rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700">
                    Promoted ✓
                  </span>
                ) : (
                  <button
                    onClick={() => handlePromote(post)}
                    disabled={actionInProgress === post.id}
                    className="px-3 py-1 text-xs font-medium rounded bg-indigo-800 text-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {actionInProgress === post.id ? '...' : 'Promote'}
                  </button>
                )}
                <time className="text-xs text-slate-600">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </time>
              </div>
            </div>
            {promoteError[post.id] && (
              <p className="mt-2 text-xs text-red-400">Promote failed: {promoteError[post.id]}</p>
            )}
            {post.slug && (
              <Link
                href={`/post/${post.slug}`}
                target="_blank"
                className="inline-block text-xs text-blue-400 hover:text-blue-300 mt-2"
              >
                View post →
              </Link>
            )}
          </div>
        );
      })}

      {hasMore && (
        <button
          onClick={() => fetchPosts(offset + PAGE_SIZE, true)}
          disabled={loading}
          className="w-full py-2 rounded-md border border-slate-700 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
