'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { MdReview } from '@/lib/types';
import { ReviewQueue } from '@/components/admin/ReviewQueue';

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [inputSecret, setInputSecret] = useState('');
  const [reviews, setReviews] = useState<MdReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Review Queue</h1>
            <p className="text-sm text-slate-500 mt-1">
              {reviews.filter((r) => r.status === 'PENDING').length} pending · {reviews.length} total
            </p>
          </div>
          <button
            onClick={() => fetchReviews(secret)}
            disabled={loading}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <ReviewQueue initialReviews={reviews} adminSecret={secret} />
      </main>
    </div>
  );
}
