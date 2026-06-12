import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { deskList, listCandidates } from '@/lib/mcp';
import { DeskList } from '@/components/desk/DeskList';
import type { CandidateListItem, DeskPostListItem } from '@/lib/types';

// proxy.ts gates /desk/* on having a session; enforce the md role here too.
export default async function DeskPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (session.user.role !== 'md') redirect('/signin');

  let posts: DeskPostListItem[] = [];
  let candidates: CandidateListItem[] = [];
  try {
    [posts, candidates] = await Promise.all([deskList(), listCandidates('ACCEPTED')]);
  } catch (err) {
    console.error('desk index load error:', err);
  }

  return <DeskList initialPosts={posts} acceptedCandidates={candidates} />;
}
