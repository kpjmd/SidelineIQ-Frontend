import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getPostBySlug, listMdReviews } from '@/lib/mcp';
import { isRetiredPostStatus } from '@/lib/types';
import { DeepDivePost } from '@/components/post/DeepDivePost';
import { siteUrl as resolveSite } from '@/lib/site-url';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || isRetiredPostStatus(post.status)) return { title: 'Not Found | SidelineIQ' };

  const title = `${post.athlete_name} ${post.injury_type} Injury Update | SidelineIQ`;
  const description = post.clinical_summary
    .replace(/\[([A-Z][A-Z\s/]+):[^\]]*\]/g, '')
    .replace(/[#*_`]/g, '')
    .slice(0, 160);
  const siteUrl = resolveSite();

  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/post/${slug}` },
    // og:image and twitter:image come from the colocated opengraph-image.tsx /
    // twitter-image.tsx; file-based metadata outranks anything set here.
    openGraph: {
      url: `${siteUrl}/post/${slug}`,
      title: post.headline,
      description,
      type: 'article',
      publishedTime: post.created_at,
      modifiedTime: post.updated_at,
      siteName: 'SidelineIQ',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.headline,
      description,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;

  const [post, allReviews] = await Promise.all([
    getPostBySlug(slug),
    listMdReviews('APPROVED'),
  ]);

  if (!post) notFound();

  // Before mcp migration 021 a rejected post 404'd here only because the row no
  // longer existed. Keeping the row is what gives the review queue a memory —
  // and it also makes clinical content the MD binned publicly fetchable by
  // slug. This is the guard that stops it.
  //
  // Deliberately NOT a blanket non-PUBLISHED 404: the review queue links the MD
  // to /post/[slug] for a PENDING_REVIEW item, so that status must keep
  // rendering. Whether it should is a separate question nobody has answered,
  // and naming the check for the RETIRED set leaves it visibly open rather than
  // pinning it as deliberate.
  if (isRetiredPostStatus(post.status)) notFound();

  const approvedReview = allReviews.find((r) => r.post_id === post.id) ?? null;

  const siteUrl = resolveSite();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.headline,
    datePublished: post.created_at,
    dateModified: approvedReview?.reviewed_at ?? post.updated_at,
    author: {
      '@type': 'Organization',
      name: 'OrthoTriage Master / SidelineIQ',
    },
    publisher: {
      '@type': 'Organization',
      name: 'SidelineIQ',
    },
    url: `${siteUrl}/post/${slug}`,
  };

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
            href="/"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Feed
          </Link>
        </div>
      </header>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <DeepDivePost post={post} approvedReview={approvedReview} />
      </main>

      <footer className="border-t border-slate-800 mt-8">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-slate-600">
            SidelineIQ · Clinical intelligence for the sports world · Not medical advice
          </p>
        </div>
      </footer>
    </div>
  );
}
