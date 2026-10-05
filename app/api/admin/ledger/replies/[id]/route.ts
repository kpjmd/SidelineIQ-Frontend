import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { decideReply } from '@/lib/mcp';
import { triggerReplyPost } from '@/lib/ledger-publish';
import { findForbiddenWords } from '@/lib/ledger-copy';

/**
 * The physician's decision on a drafted reply (027). "approved" is RECORDED
 * first (decided_by = the session user, decided_at, the final wording), and only
 * then do the agents post it — by proposal id, reading the approved text from
 * the row. A post failure leaves the row approved with post_error for a retry;
 * the approval itself is never undone here.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { decision?: unknown; approved_text?: unknown; note?: unknown; retry?: unknown };

  // Retry: the row is already approved; just ask the agents to post again.
  if (body.retry === true) {
    const post = await triggerReplyPost(id);
    return NextResponse.json({ proposal: null, post: post.body, post_error: post.ok ? null : post.error ?? null }, { status: post.ok ? 200 : 502 });
  }

  if (body.decision !== 'approved' && body.decision !== 'discarded') {
    return NextResponse.json({ error: 'decision must be approved or discarded' }, { status: 400 });
  }
  const approvedText = typeof body.approved_text === 'string' && body.approved_text.trim() ? body.approved_text.trim() : null;
  if (body.decision === 'approved' && approvedText) {
    const words = findForbiddenWords(approvedText);
    if (words.length > 0) return NextResponse.json({ error: `the reply contains forbidden words: ${words.join(', ')}` }, { status: 422 });
  }
  let proposal;
  try {
    proposal = await decideReply({
      proposal_id: id,
      reviewer_user_id: gate.userId,
      decision: body.decision,
      approved_text: approvedText,
      note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
    });
  } catch (err) {
    console.error('ledger decide reply error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Decision failed' }, { status: 400 });
  }
  if (body.decision === 'discarded') return NextResponse.json({ proposal, post: null });

  const post = await triggerReplyPost(id);
  return NextResponse.json({ proposal, post: post.body, post_error: post.ok ? null : post.error ?? null }, { status: post.ok ? 200 : 502 });
}
