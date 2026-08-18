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
// the thread's sole link to published content. A thread with other posts has
// coverage that outlives this rejection and must stay ACTIVE — the MD rejected
// one write-up, not the injury.
export function shouldVoidThreadOnReject(
  entity: Pick<InjuryEntity, 'canonical_post_id' | 'status'>,
  updates: Array<Pick<InjuryUpdate, 'post_id'>>,
  postId: string,
): boolean {
  // Already closed/retracted — leave the existing outcome alone rather than
  // overwriting a RESOLVED thread's accuracy record with a VOID.
  if (entity.status !== 'ACTIVE') return false;

  // Anchored to a different post: that post is the thread's real subject.
  if (entity.canonical_post_id && entity.canonical_post_id !== postId) return false;

  // Any timeline row pointing at another post means other coverage exists.
  // post_id === null rows are the deduplicator's repeat-source appends; they
  // are not coverage and must not keep a false thread alive — those NULL rows
  // are precisely what the Greenard thread accumulated while it was orphaned.
  return !updates.some((u) => u.post_id !== null && u.post_id !== postId);
}
