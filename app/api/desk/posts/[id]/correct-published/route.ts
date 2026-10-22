import { NextRequest, NextResponse } from 'next/server';
import { deskCorrectPublished } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
import { parseCorrectPublishedBody } from '@/lib/desk-correction';

/**
 * POST /api/desk/posts/:id/correct-published — correct a small error in a
 * PUBLISHED post's sections or prose meta (mcp desk_correct_published).
 *
 * The content is inside the hash, so the call re-attests: the three
 * confirmations travel with it, and the reviewer is the session's MD, never a
 * body field. The mcp refuses an over-cap edit or a new lint blocker. Afterwards
 * the kpjmd.com page is stale until the handoff is rebuilt, rsynced and confirmed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const parsed = parseCorrectPublishedBody(raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await deskCorrectPublished({
      desk_post_id: id,
      reviewer_user_id: gate.userId,
      ...parsed.value,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('desk correct-published error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
