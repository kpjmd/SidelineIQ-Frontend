import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { getPostBySlug, listMdReviews } from '@/lib/mcp';
import { DeepDivePost } from '@/components/post/DeepDivePost';
import { BRAND_NAME } from '@/lib/brand';

/**
 * The MD's read of a post that is not public.
 *
 * /post/[slug] serves PUBLISHED only now. The review queue still has to show a
 * physician what they are being asked to approve, and a PENDING_REVIEW post is
 * exactly the content that must not be reachable by a stranger with the slug —
 * so the preview lives here, behind the session, instead of loosening the
 * public gate.
 *
 * A separate route rather than an `auth()` call inside /post/[slug] on purpose:
 * reading the session makes a route dynamic, and /post/[slug] is ISR
 * (`revalidate = 60`). Gating the public page on a cookie would drop that cache
 * for every anonymous reader in order to serve one physician.
 *
 * Renders the same DeepDivePost component the public page does, so what the MD
 * approves is what ships — including the AequOs CTA, which appears here under
 * exactly the same `showsReferralCta` rule.
 */

export const dynamic = 'force-dynamic';

// Belt and braces: the route is already under /admin (proxy.ts matches
// /admin/:path*) and gated below, but a preview URL that leaks into a referrer
// header should still never be indexed.
export const metadata: Metadata = {
  title: `Post preview | ${BRAND_NAME} admin`,
  robots: { index: false, follow: false, nocache: true },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PostPreviewPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (session.user.role !== 'md') redirect('/signin');

  const { slug } = await params;
  const [post, approved] = await Promise.all([getPostBySlug(slug), listMdReviews('APPROVED')]);
  if (!post) notFound();

  const approvedReview = approved.find((r) => r.post_id === post.id) ?? null;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-amber-900/60 bg-amber-950/30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
              Preview · {post.status}
            </p>
            <p className="text-xs text-slate-400">
              Not public. {post.status === 'PUBLISHED' ? 'This post is live at /post/' + slug + '.' : 'This page is the only way to read it.'}
            </p>
          </div>
          <Link href="/admin" className="text-xs text-slate-400 hover:text-bone whitespace-nowrap">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <DeepDivePost post={post} approvedReview={approvedReview} />
      </main>
    </div>
  );
}
