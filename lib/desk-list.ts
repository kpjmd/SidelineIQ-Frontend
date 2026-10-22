/**
 * Which desk posts the /desk list shows up front.
 *
 * A RETRACTED post is kept, not deleted: its attestation and audit history are
 * the record of what was published under the physician credential. But it is
 * not work in progress, so it sits in a collapsed section instead of beside the
 * live posts. The Phase 2E smoke-test post (OG Anunoby, retracted 2026-10-22)
 * is why: it read as a real desk post nobody remembered writing.
 */
export function partitionDeskPosts<T extends { status: string }>(
  posts: T[],
): { active: T[]; retracted: T[] } {
  const active: T[] = [];
  const retracted: T[] = [];
  for (const p of posts) (p.status === 'RETRACTED' ? retracted : active).push(p);
  return { active, retracted };
}
