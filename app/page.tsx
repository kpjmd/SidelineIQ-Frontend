import { Suspense } from 'react';
import Link from 'next/link';
import { listPosts } from '@/lib/mcp';
import type { ContentType, Sport } from '@/lib/types';
import { FilterBar } from '@/components/feed/FilterBar';
import { PostFeed } from '@/components/feed/PostFeed';

export const revalidate = 60;

interface PageProps {
  searchParams: Promise<{ sport?: string; type?: string; limit?: string }>;
}

export default async function FeedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sport = params.sport as Sport | undefined;
  const contentType = params.type as ContentType | undefined;
  const limit = Math.min(Math.max(parseInt(params.limit ?? '20', 10) || 20, 20), 100);

  const result = await listPosts({
    status: 'PUBLISHED',
    ...(sport ? { sport } : {}),
    ...(contentType ? { content_type: contentType } : {}),
    limit,
    offset: 0,
  });

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-black text-white tracking-tight">SidelineIQ</span>
            <span className="hidden sm:inline text-xs text-slate-500 font-medium mt-0.5">
              Clinical Sports Intelligence
            </span>
          </Link>
          <Link
            href="/admin"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            MD Review
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Injury Intelligence Feed</h1>
          <p className="text-sm text-slate-500">
            Clinical breakdowns, return-to-play timelines, and conflict detection — powered by OrthoTriage Master.
          </p>
        </div>

        <div className="mb-6">
          <Suspense fallback={<div className="h-16 bg-slate-800/30 rounded animate-pulse" />}>
            <FilterBar />
          </Suspense>
        </div>

        <PostFeed
          posts={result.posts}
          hasMore={result.has_more}
          total={result.total}
          limit={limit}
          searchParams={params as Record<string, string>}
        />
      </main>

      <footer className="border-t border-slate-800 mt-16">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-slate-600">
            SidelineIQ · Clinical intelligence for the sports world · Not medical advice
          </p>
        </div>
      </footer>
    </div>
  );
}
