import { NextRequest, NextResponse } from 'next/server';
import {
  closeThread,
  deleteInjuryPost,
  getEntityForPost,
  listInjuryUpdates,
} from '@/lib/mcp';
import { shouldVoidThreadOnReject } from '@/lib/reject-void';
import { requireMd } from '@/lib/desk-auth';
import { revalidatePath } from 'next/cache';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { postId } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };

  try {
    // Retract the thread BEFORE deleting the post, in this order for two
    // reasons. (1) Both FKs back to injury_posts are ON DELETE SET NULL, so
    // once the post is gone there is no way to find the thread from its id.
    // (2) If the delete then fails, a VOID thread with a still-pending post is
    // harmless and the MD can retry; the reverse — a deleted post leaving an
    // ACTIVE orphan thread that absorbs later reports — is the bug being fixed.
    const voided = await voidAnchoredThread(postId, gate.userId, body.reason);

    const result = await deleteInjuryPost(postId);
    revalidatePath('/');
    return NextResponse.json({ ...result, voided_thread: voided });
  } catch (err) {
    console.error('reject error:', err);
    return NextResponse.json({ error: 'Failed to reject post' }, { status: 500 });
  }
}

// Returns the voided entity id, or null when there was nothing to retract.
// Never throws: a thread we could not retract must not block the rejection the
// MD asked for, but it is logged loudly enough to find afterwards.
async function voidAnchoredThread(
  postId: string,
  mdUserId: string,
  reason: string | undefined,
): Promise<string | null> {
  try {
    const entity = await getEntityForPost(postId);
    if (!entity) return null;

    const updates = await listInjuryUpdates(entity.id);
    if (!shouldVoidThreadOnReject(entity, updates, postId)) return null;

    await closeThread({
      entity_id: entity.id,
      outcome: 'VOID',
      void_reason: reason?.trim()
        ? `MD rejected post ${postId}: ${reason.trim()}`
        : `MD rejected the thread's only post (${postId})`,
      closed_by: mdUserId,
    });
    console.log(`[Reject] voided thread ${entity.id} anchored to rejected post ${postId}`);
    return entity.id;
  } catch (err) {
    console.error(`[Reject] could not void the thread anchored to post ${postId}:`, err);
    return null;
  }
}
