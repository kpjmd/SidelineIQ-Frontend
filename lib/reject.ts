// Relative, not '@/lib/...', matching its tested sibling reject-void.ts: there
// is no vitest config in this repo, so the alias does not resolve under test
// and an aliased import here would make this file untestable.
import {
  closeThread,
  getEntityForPost,
  getPostById,
  listInjuryUpdates,
  rejectInjuryPost,
  type RejectPostResult,
} from './mcp';
import { shouldVoidThreadOnReject } from './reject-void';

/**
 * One rejection, whichever button the MD pressed.
 *
 * There were two, and they did different things. ReviewQueue's "Quick reject"
 * hit /api/admin/reject/[postId], which deleted the post and voided its thread.
 * MDReviewForm's "Reject" hit PATCH /api/admin/review/[id], which set
 * md_reviews.status and nothing else — leaving the post PENDING_REVIEW forever,
 * still approvable, with an ACTIVE thread. Same label, two outcomes, and which
 * one you got depended on which screen you were looking at.
 *
 * Ordering is load-bearing and unchanged from the original route. Void the
 * thread FIRST: rejectInjuryPost clears injury_entities.canonical_post_id and
 * injury_updates.post_id — the cleanup ON DELETE SET NULL used to perform — and
 * once those are gone there is no way to reach the entity from the post id. If
 * the rejection then fails, a VOID thread with a still-pending post is harmless
 * and the MD can retry; the reverse leaves an ACTIVE orphan thread absorbing
 * later reports, which is the Greenard bug mcp migration 020 closed.
 *
 * Only a PENDING_REVIEW post may take its thread with it. Rejecting the review
 * of an already-live post is a real flow — the mcp closes the review and
 * deliberately leaves the post PUBLISHED (`post_updated: false`) — and voiding
 * there retracted the thread of content that stays public. Jovaughn Gwyn,
 * 2026-10-01: post bee3797b approved at 18:16, review rejected at 18:23, thread
 * VOIDed "MD rejected the thread's only post" while the post stayed live on
 * the site and both social accounts. VOID cannot be reopened, so the thread's
 * published RTP window was lost to the accuracy record for good. An unreadable
 * post status leaves the thread alone too: a wrongly-voided thread is
 * unrecoverable, an un-voided orphan is one void-thread.ts call away.
 *
 * Dependencies are injected so this is testable without a Next request.
 */
export interface RejectDeps {
  getPostById: typeof getPostById;
  getEntityForPost: typeof getEntityForPost;
  listInjuryUpdates: typeof listInjuryUpdates;
  closeThread: typeof closeThread;
  rejectInjuryPost: typeof rejectInjuryPost;
}

const defaultDeps: RejectDeps = {
  getPostById,
  getEntityForPost,
  listInjuryUpdates,
  closeThread,
  rejectInjuryPost,
};

export interface RejectOutcome extends RejectPostResult {
  voided_thread: string | null;
}

export async function rejectPost(
  input: { postId?: string; reviewId?: string; mdUserId: string; reason?: string },
  deps: RejectDeps = defaultDeps,
): Promise<RejectOutcome> {
  // Only the postId path can void: reaching the entity needs the post id, and
  // the review path does not have one until the tool resolves it. Threads
  // rejected from the review form are voided on the next quick-reject or by
  // hand — noted rather than silently skipped.
  const voided = input.postId
    ? await voidAnchoredThread(deps, input.postId, input.mdUserId, input.reason)
    : null;

  const result = await deps.rejectInjuryPost({
    ...(input.postId ? { post_id: input.postId } : {}),
    ...(input.reviewId ? { review_id: input.reviewId } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    rejected_by: input.mdUserId,
  });

  return { ...result, voided_thread: voided };
}

/**
 * Returns the voided entity id, or null when there was nothing to retract.
 * Never throws: a thread we could not retract must not block the rejection the
 * MD asked for, but it is logged loudly enough to find afterwards.
 */
async function voidAnchoredThread(
  deps: RejectDeps,
  postId: string,
  mdUserId: string,
  reason: string | undefined,
): Promise<string | null> {
  try {
    const post = await deps.getPostById(postId);
    if (post?.status !== 'PENDING_REVIEW') {
      console.warn(
        `[Reject] post ${postId} is ${post?.status ?? 'unreadable'}, not PENDING_REVIEW — ` +
          'its thread is left alone; only a post that never reached an audience can retract one',
      );
      return null;
    }

    const entity = await deps.getEntityForPost(postId);
    if (!entity) return null;

    const updates = await deps.listInjuryUpdates(entity.id);
    if (!shouldVoidThreadOnReject(entity, updates, postId)) return null;

    await deps.closeThread({
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
