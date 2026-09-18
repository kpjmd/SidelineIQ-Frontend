import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getPostBySlug, listMdReviews } from '@/lib/mcp';
import { isPubliclyViewable } from '@/lib/types';
import { DeepDivePost } from '@/components/post/DeepDivePost';
import { siteUrl as resolveSite } from '@/lib/site-url';
import { BRAND_NAME, rebrandPost } from '@/lib/brand';
import { Mark } from '@/components/shared/Mark';
import { Wordmark } from '@/components/shared/Wordmark';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const raw = await getPostBySlug(slug);
  const post = raw ? rebrandPost(raw) : null;
  // Metadata leaks as much as the page: a title, a description and a canonical
  // URL for an unapproved post is the post, in every preview that matters.
  if (!post || !isPubliclyViewable(post.status)) return { title: `Not Found | ${BRAND_NAME}` };

  const title = `${post.athlete_name} ${post.injury_type} Injury Update | ${BRAND_NAME}`;
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
      siteName: BRAND_NAME,
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

  const [raw, allReviews] = await Promise.all([
    getPostBySlug(slug),
    listMdReviews('APPROVED'),
  ]);

  if (!raw) notFound();
  // Stored prose from before the rename names the retired persona.
  const post = rebrandPost(raw);

  // PUBLISHED only. This used to block the RETIRED set alone, which let a
  // PENDING_REVIEW post — clinical content sitting in the physician's queue
  // precisely because nobody has approved it yet — render to anyone with the
  // slug. The MD reads queued items at /admin/preview/[slug] now, which is
  // behind the session, so this gate no longer has a workflow leaning on it.
  if (!isPubliclyViewable(post.status)) notFound();

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
      name: BRAND_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND_NAME,
    },
    url: `${siteUrl}/post/${slug}`,
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Mark size={28} />
            <Wordmark className="text-xl" />
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
            {BRAND_NAME} · Clinical intelligence for the sports world · Not medical advice ·{' '}
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">
              Privacy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
