/**
 * Two buttons labelled Reject, two different outcomes.
 *
 * ReviewQueue's "Quick reject" hit /api/admin/reject/[postId]: it voided the
 * anchored thread and DELETED the post. MDReviewForm's "Reject" hit PATCH
 * /api/admin/review/[id], which called updateMdReview — and that touches
 * injury_posts only on APPROVED. So rejecting from the review form left the
 * post at PENDING_REVIEW forever, still approvable, with an ACTIVE thread. Which
 * outcome an MD got depended on which screen they happened to be looking at.
 *
 * lib/reject.ts is the single path both now take. These tests drive it with
 * injected dependencies, so they exercise the orchestration rather than Next's
 * routing.
 *
 * Every test in the first block FAILS against pre-fix code — there was no
 * shared path, and the review-id route neither rejected the post nor voided
 * anything. The second block is fail-closed and passes in both directions.
 */
import { describe, it, expect, vi } from 'vitest';
import { rejectPost, type RejectDeps } from '../lib/reject';
import type { InjuryEntity, InjuryUpdate } from '../lib/types';

const POST = 'post-under-review';
const REVIEW = 'review-1';
const ENTITY = 'entity-1';

const soleAnchorEntity = {
  id: ENTITY,
  status: 'ACTIVE' as const,
  canonical_post_id: POST,
  date_resolution_sources: [{ stage: 'api' as const }],
} as unknown as InjuryEntity;

function deps(over: Partial<RejectDeps> = {}) {
  const calls: string[] = [];
  const base: RejectDeps = {
    getEntityForPost: vi.fn(async () => {
      calls.push('getEntityForPost');
      return soleAnchorEntity;
    }),
    listInjuryUpdates: vi.fn(async () => {
      calls.push('listInjuryUpdates');
      return [{ post_id: POST }] as InjuryUpdate[];
    }),
    closeThread: vi.fn(async () => {
      calls.push('closeThread');
      return {} as never;
    }),
    rejectInjuryPost: vi.fn(async () => {
      calls.push('rejectInjuryPost');
      return {
        post_id: POST,
        review_id: REVIEW,
        post_updated: true,
        post_status: 'REJECTED' as const,
        review_status: 'REJECTED' as const,
        entity_links_cleared: { canonical: 1, updates: 1 },
      };
    }),
    ...over,
  };
  return { deps: base, calls };
}

describe('both Reject buttons now do the same thing', () => {
  it('rejects the post rather than deleting it', async () => {
    const { deps: d } = deps();
    const out = await rejectPost({ postId: POST, mdUserId: 'md-1' }, d);
    expect(d.rejectInjuryPost).toHaveBeenCalledWith(
      expect.objectContaining({ post_id: POST, rejected_by: 'md-1' }),
    );
    expect(out.post_status).toBe('REJECTED');
    expect(out.voided_thread).toBe(ENTITY);
  });

  it('reaches the same rejectInjuryPost from a review id', async () => {
    // Pre-fix this path called updateMdReview, which leaves injury_posts alone.
    const { deps: d } = deps();
    const out = await rejectPost({ reviewId: REVIEW, mdUserId: 'md-1' }, d);
    expect(d.rejectInjuryPost).toHaveBeenCalledWith(
      expect.objectContaining({ review_id: REVIEW, rejected_by: 'md-1' }),
    );
    expect(out.post_status).toBe('REJECTED');
  });

  it('voids the thread BEFORE rejecting, never after', async () => {
    // rejectInjuryPost clears injury_entities.canonical_post_id and
    // injury_updates.post_id — the cleanup ON DELETE SET NULL used to do. After
    // that runs there is no way to reach the entity from the post id, so the
    // order is not stylistic.
    const { deps: d, calls } = deps();
    await rejectPost({ postId: POST, mdUserId: 'md-1' }, d);
    expect(calls.indexOf('closeThread')).toBeLessThan(calls.indexOf('rejectInjuryPost'));
  });

  it('passes the MD reason through to both the void and the rejection', async () => {
    const { deps: d } = deps();
    await rejectPost({ postId: POST, mdUserId: 'md-1', reason: 'wrong athlete' }, d);
    expect(d.closeThread).toHaveBeenCalledWith(
      expect.objectContaining({ void_reason: expect.stringContaining('wrong athlete') }),
    );
    expect(d.rejectInjuryPost).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'wrong athlete' }),
    );
  });
});

describe('what must survive a failure', () => {
  // PASSES IN BOTH DIRECTIONS for the postId path — the original route already
  // swallowed void failures. It FAILS pre-fix for the reviewId path, which
  // never attempted a void at all.
  it('still rejects when the thread cannot be voided', async () => {
    const { deps: d } = deps({
      closeThread: vi.fn(async () => {
        throw new Error('mcp unavailable');
      }),
    });
    const out = await rejectPost({ postId: POST, mdUserId: 'md-1' }, d);
    expect(d.rejectInjuryPost).toHaveBeenCalled();
    expect(out.voided_thread).toBeNull();
  });

  // PASSES IN BOTH DIRECTIONS — fail-closed. Nothing to retract is not an error.
  it('rejects cleanly when the post has no entity', async () => {
    const { deps: d } = deps({ getEntityForPost: vi.fn(async () => null) });
    const out = await rejectPost({ postId: POST, mdUserId: 'md-1' }, d);
    expect(out.voided_thread).toBeNull();
    expect(d.closeThread).not.toHaveBeenCalled();
    expect(d.rejectInjuryPost).toHaveBeenCalled();
  });

  // PASSES IN BOTH DIRECTIONS — fail-closed. shouldVoidThreadOnReject's own
  // rules are covered by reject-void.test.ts, which must pass UNMODIFIED: that
  // is what proves the FK-nulling moved into the mcp tool kept this predicate's
  // inputs byte-identical.
  it('leaves a thread with other coverage alone', async () => {
    const { deps: d } = deps({
      listInjuryUpdates: vi.fn(async () => [{ post_id: 'some-other-post' }] as InjuryUpdate[]),
    });
    const out = await rejectPost({ postId: POST, mdUserId: 'md-1' }, d);
    expect(out.voided_thread).toBeNull();
    expect(d.closeThread).not.toHaveBeenCalled();
  });
});

describe('isRetiredPostStatus', () => {
  it.each([
    ['REJECTED', true],
    ['SUPERSEDED', true],
    ['PUBLISHED', false],
    // Deliberately says nothing about whether PENDING_REVIEW SHOULD render
    // publicly — see the guard in app/post/[slug]/page.tsx. It only asserts
    // that this helper does not claim to answer that.
    ['PENDING_REVIEW', false],
    ['DRAFT', false],
    [undefined, false],
    [null, false],
  ])('%s → %s', async (status, expected) => {
    const { isRetiredPostStatus } = await import('../lib/types');
    expect(isRetiredPostStatus(status as string | null | undefined)).toBe(expected);
  });
});
