import type { InjuryEntity, InjuryUpdate } from './types';

// Should rejecting `postId` also retract the thread it anchors?
//
// Background. An injury_entity is minted BEFORE any post exists — the agents
// poller creates it pre-OTM so the date resolver has somewhere to write — and
// it survives its post's deletion, because injury_entities.canonical_post_id
// and injury_updates.post_id are both ON DELETE SET NULL (mcp migration 009).
// So rejecting a post used to leave the thread ACTIVE and post-less, still
// inside the 21-day window of web_find_matching_entity. Every later report
// about that athlete matched into it and was suppressed as a duplicate instead
// of publishing. That is how entity eac3cc8a kept a Jonathan Greenard "back
// surgery" thread alive for six days after its only post was rejected.
//
// The predicate is deliberately conservative: retract ONLY when this post is
// the thread's sole link to published content, and only when nobody has
// curated the thread by hand.
export function shouldVoidThreadOnReject(
  entity: Pick<InjuryEntity, 'canonical_post_id' | 'status' | 'date_resolution_sources'>,
  updates: Array<Pick<InjuryUpdate, 'post_id'>>,
  postId: string,
): boolean {
  // Already closed/retracted — leave the existing outcome alone rather than
  // overwriting a RESOLVED thread's accuracy record with a VOID.
  if (entity.status !== 'ACTIVE') return false;

  // An MD has corrected this thread by hand, so the thread is not the thing
  // they are rejecting — the post is.
  //
  // These two acts look identical to the reject route but mean opposite things:
  // "this injury never happened" (retract everything) versus "the injury is
  // real, your write-up of it is wrong" (bin the post, keep the corrected
  // record). Mykel Williams is the case that proved it. The pipeline dated his
  // ACL reconstruction to the day it read a Kyle Shanahan quote about it,
  // 2026-08-19, when the surgery was 2025-11-02; the MD fixed the date on the
  // thread and then had to reject the post, whose OTM window was built on the
  // wrong anchor. Auto-voiding there would have deleted the correction and let
  // the next report re-derive the same wrong date from scratch.
  //
  // A curated thread can still be retracted — deliberately, via the Threads
  // tab's own Retract control, which is a different button and a different
  // decision.
  if (isMdCurated(entity)) return false;

  // Anchored to a different post: that post is the thread's real subject.
  if (entity.canonical_post_id && entity.canonical_post_id !== postId) return false;

  // Any timeline row pointing at another post means other coverage exists.
  // post_id === null rows are the deduplicator's repeat-source appends; they
  // are not coverage and must not keep a false thread alive — those NULL rows
  // are precisely what the Greenard thread accumulated while it was orphaned.
  return !updates.some((u) => u.post_id !== null && u.post_id !== postId);
}

// The MD dashboard stamps stage 'md_manual' on every hand-entered date
// (app/api/admin/threads/[id] update_dates). It is the only durable marker on
// the entity that a human has touched it.
export function isMdCurated(
  entity: Pick<InjuryEntity, 'date_resolution_sources'>,
): boolean {
  return (entity.date_resolution_sources ?? []).some((s) => s?.stage === 'md_manual');
}
