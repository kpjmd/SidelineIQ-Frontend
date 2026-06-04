'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { CandidateListItem, MdReview } from '@/lib/types';
import { ReviewQueue } from '@/components/admin/ReviewQueue';
import { PostBrowser } from '@/components/admin/PostBrowser';
import { CandidatesQueue } from '@/components/admin/CandidatesQueue';

type Tab = 'reviews' | 'promote' | 'candidates';

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [inputSecret, setInputSecret] = useState('');
  const [reviews, setReviews] = useState<MdReview[]>([]);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>('reviews');

  const fetchCandidates = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/admin/candidates?status=PROPOSED', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { candidates: CandidateListItem[] };
      setCandidates(data.candidates);
    } catch {
      // Candidates are secondary — a failure here shouldn't block the queue.
    }
  }, []);

  const fetchReviews = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reviews', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setAuthed(false);
        setError('Invalid secret. Try again.');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch reviews');
      const data = await res.json() as { reviews: MdReview[] };
      setReviews(data.reviews);
      setAuthed(true);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('admin_secret', token);
      }
      fetchCandidates(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fetchCandidates]);

  // Restore session secret on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('admin_secret');
    if (stored) {
      setSecret(stored);
      fetchReviews(stored);
    }
  }, [fetchReviews]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSecret(inputSecret);
    fetchReviews(inputSecret);
  }

  function handleRefresh() {
    fetchReviews(secret);
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-full max-w-sm p-8 bg-slate-900 border border-slate-700 rounded-xl">
          <h1 className="text-xl font-bold text-white mb-1">MD Review Queue</h1>
          <p className="text-sm text-slate-500 mb-6">Enter your admin secret to continue.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={inputSecret}
              onChange={(e) => setInputSecret(e.target.value)}
              placeholder="Admin secret"
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-600"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !inputSecret}
              className="w-full py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-40 transition-colors"
            >
              {loading ? 'Verifying…' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
            onClick={() => {
              sessionStorage.removeItem('admin_secret');
              setAuthed(false);
              setSecret('');
            }}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <nav className="flex items-center gap-1 mb-6 border-b border-slate-800">
          {([
            ['reviews', `Reviews · ${reviews.filter((r) => r.status === 'PENDING').length}`],
            ['promote', 'Promote'],
            ['candidates', `Candidates · ${candidates.length}`],
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
              onClick={handleRefresh}
              disabled={loading}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          )}
          {tab === 'candidates' && (
            <button
              onClick={() => fetchCandidates(secret)}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Refresh
            </button>
          )}
        </nav>

        {tab === 'reviews' && <ReviewQueue initialReviews={reviews} adminSecret={secret} />}
        {tab === 'promote' && <PostBrowser adminSecret={secret} />}
        {tab === 'candidates' && (
          <CandidatesQueue
            key={candidates.map((c) => c.id).join(',')}
            initialCandidates={candidates}
            adminSecret={secret}
          />
        )}
      </main>
    </div>
  );
}
