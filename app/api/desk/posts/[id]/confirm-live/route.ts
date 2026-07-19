import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deskConfirmKpjmdLive } from '@/lib/mcp';

// Confirm the post is actually live on kpjmd.com.
//
// Nothing calls back from kpjmd.com — it is a hand-rsync'd static site with no
// CI — so the alternative to this check is a human ticking "yes I deployed it",
// which records intent rather than fact. The MCP tool fetches the live URL and
// requires both a 200 AND an x-sideline-content-hash meta tag matching the
// post's current hash; only then does it stamp kpjmd_published_at.
//
// Mirrors the publish route's contract: a failed check is a structured success
// from the MCP, mapped to 422 here so the panel can render check.reasons. Only
// true faults (missing post / not PUBLISHED / non-MD) throw → 500.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const result = await deskConfirmKpjmdLive(id, gate.userId);
    if (!result.check.ok) {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('desk confirm-live error:', err);
    const message = err instanceof Error ? err.message : 'Failed to check kpjmd.com';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
