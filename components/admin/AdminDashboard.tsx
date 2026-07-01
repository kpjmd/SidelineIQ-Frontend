'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { CandidateListItem, MdReview, ThreadListItem } from '@/lib/types';
import { ReviewQueue } from '@/components/admin/ReviewQueue';
import { PostBrowser } from '@/components/admin/PostBrowser';
import { CandidatesQueue } from '@/components/admin/CandidatesQueue';
import { ThreadsQueue } from '@/components/admin/ThreadsQueue';

type Tab = 'reviews' | 'promote' | 'candidates' | 'threads';

interface Props {
  initialReviews: MdReview[];
  initialCandidates: CandidateListItem[];
  initialThreads: ThreadListItem[];
  initialDateReviewCount: number;
}

// Interactive shell for the /admin MD dashboard. Auth is handled upstream by the
// server component (app/admin/page.tsx reads the NextAuth session + redirects
// non-MDs); this component just renders and re-fetches data. All /api/admin/*
// calls rely on the session cookie — no Bearer token. A 401 means the session
// expired, so we bounce back to /signin.
export function AdminDashboard({
  initialReviews,
  initialCandidates,
  initialThreads,
  initialDateReviewCount,
}: Props) {
  const router = useRouter();
  const [reviews, setReviews] = useState<MdReview[]>(initialReviews);
  const [candidates, setCandidates] = useState<CandidateListItem[]>(initialCandidates);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('reviews');

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/candidates?status=PROPOSED');
      if (res.status === 401) {
        router.push('/signin');
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { candidates: CandidateListItem[] };
      setCandidates(data.candidates);
    } catch {
      // Candidates are secondary — a failure here shouldn't block the queue.
    }
  }, [router]);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reviews');
      if (res.status === 401) {
        router.push('/signin');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch reviews');
      const data = (await res.json()) as { reviews: MdReview[] };
      setReviews(data.reviews);
      fetchCandidates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [router, fetchCandidates]);

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-black text-white tracking-tight">
              SidelineIQ
            </Link>
            <span className="text-slate-700">·</span>
            <span className="text-sm text-amber-500 font-medium">MD Review</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/signin' })}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

        <nav className="flex items-center gap-1 mb-6 border-b border-slate-800">
          {([
            ['reviews', `Reviews · ${reviews.filter((r) => r.status === 'PENDING').length}`],
            ['promote', 'Promote'],
            ['candidates', `Candidates · ${candidates.length}`],
            ['threads', `Threads${initialDateReviewCount > 0 ? ` · ${initialDateReviewCount}!` : ''}`],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-amber-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
          {tab === 'reviews' && (
            <button
              onClick={fetchReviews}
              disabled={loading}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          )}
          {tab === 'candidates' && (
            <button
              onClick={fetchCandidates}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Refresh
            </button>
          )}
        </nav>

        {tab === 'reviews' && <ReviewQueue initialReviews={reviews} />}
        {tab === 'promote' && <PostBrowser />}
        {tab === 'candidates' && (
          <CandidatesQueue
            key={candidates.map((c) => c.id).join(',')}
            initialCandidates={candidates}
          />
        )}
        {tab === 'threads' && <ThreadsQueue initialActive={initialThreads} />}
      </main>
    </div>
  );
}
