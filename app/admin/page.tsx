import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listMdReviews, listCandidates } from '@/lib/mcp';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import type { CandidateListItem, MdReview } from '@/lib/types';

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

  return <AdminDashboard initialReviews={reviews} initialCandidates={candidates} />;
}
