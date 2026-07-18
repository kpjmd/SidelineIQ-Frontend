import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { deskGet, deskListUpdates, getEntity, getPostById, listInjuryUpdates } from '@/lib/mcp';
import { DeskEditorView } from '@/components/desk/DeskEditorView';
import type { DeskContext, DeskPostUpdate } from '@/lib/types';

export default async function DeskPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ deskPostId: string }>;
  searchParams: Promise<{ candidate_id?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (session.user.role !== 'md') redirect('/signin');

  const { deskPostId } = await params;
  const { candidate_id: candidateId } = await searchParams;

  let detail;
  try {
    detail = await deskGet(deskPostId);
  } catch (err) {
    console.error('desk post load error:', err);
    notFound();
  }

  // Read-only context for the fact-validation + timeline panels. Degrades to
  // nulls/[] if the read tools (mcp PR A) aren't deployed yet.
  let context: DeskContext | null = null;
  try {
    const entity = await getEntity(detail.post.entity_id);
    const [updates, canonicalPost] = await Promise.all([
      listInjuryUpdates(detail.post.entity_id),
      entity?.canonical_post_id ? getPostById(entity.canonical_post_id) : Promise.resolve(null),
    ]);
    context = { entity, canonicalPost, updates };
  } catch (err) {
    console.error('desk context load error:', err);
  }

  // Return Watch timeline — only meaningful once the post is live.
  let returnWatchUpdates: DeskPostUpdate[] = [];
  if (detail.post.status === 'PUBLISHED') {
    try {
      returnWatchUpdates = await deskListUpdates(deskPostId);
    } catch (err) {
      console.error('desk list updates error:', err);
    }
  }

  return (
    <DeskEditorView
      initialPost={detail.post}
      initialAttestations={detail.attestations}
      context={context}
      initialUpdates={returnWatchUpdates}
      returnWatchCandidateId={candidateId}
    />
  );
}
