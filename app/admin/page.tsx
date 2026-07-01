import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listMdReviews, listCandidates, listThreads } from '@/lib/mcp';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import type { CandidateListItem, MdReview, ThreadListItem } from '@/lib/types';

// proxy.ts gates /admin/* on having a session; enforce the md role here too.
// Mirrors app/desk/page.tsx — read the session once server-side, fetch the
// initial queues, and hand off to the AdminDashboard client shell. No secret.
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (session.user.role !== 'md') redirect('/signin');

  let reviews: MdReview[] = [];
  let candidates: CandidateListItem[] = [];
  try {
    [reviews, candidates] = await Promise.all([
      listMdReviews(),
      listCandidates('PROPOSED'),
    ]);
  } catch (err) {
    console.error('admin index load error:', err);
  }

  // Threads (migration 014) load independently so a mid-deploy MCP without the
  // web_list_threads tool doesn't blank the whole dashboard.
  let threads: ThreadListItem[] = [];
  let dateReviewCount = 0;
  try {
    const [active, dateReview] = await Promise.all([
      listThreads({ status: 'ACTIVE' }),
      listThreads({ status: 'ACTIVE', needs_date_review: true }),
    ]);
    threads = active;
    dateReviewCount = dateReview.length;
  } catch (err) {
    console.error('admin threads load error:', err);
  }

  return (
    <AdminDashboard
      initialReviews={reviews}
      initialCandidates={candidates}
      initialThreads={threads}
      initialDateReviewCount={dateReviewCount}
    />
  );
}
