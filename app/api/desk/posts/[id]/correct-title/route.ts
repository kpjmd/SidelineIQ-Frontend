import { NextRequest, NextResponse } from 'next/server';
import { deskCorrectTitle } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
import { parseCorrectTitleBody } from '@/lib/desk-title';

/**
 * POST /api/desk/posts/:id/correct-title — correct a PUBLISHED post's headline.
 *
 * The one post-publish edit (mcp desk_correct_title). The title is inside the
 * content hash, so the call re-attests: the three confirmations travel with it,
 * and the reviewer is the session's MD, never a body field. Afterwards the
 * kpjmd.com page is stale until the handoff is rebuilt, rsynced and confirmed.
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
  const parsed = parseCorrectTitleBody(raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await deskCorrectTitle({
      desk_post_id: id,
      reviewer_user_id: gate.userId,
      ...parsed.value,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('desk correct-title error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
