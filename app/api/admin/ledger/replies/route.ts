import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { listReplyProposals } from '@/lib/mcp';
import type { ReplyProposal } from '@/lib/ledger-types';

/** Pending proposals plus any APPROVED row that was claimed and never recorded posted — those need a human look. */
export async function GET(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const decision = (request.nextUrl.searchParams.get('decision') ?? 'pending') as ReplyProposal['decision'] | 'all';
  try {
    if (decision === 'all') return NextResponse.json({ proposals: await listReplyProposals(null) });
    const [proposals, approved] = await Promise.all([listReplyProposals(decision), decision === 'pending' ? listReplyProposals('approved') : Promise.resolve([])]);
    return NextResponse.json({ proposals, stuck: approved.filter((p) => p.post_attempted_at && !p.posted_id) });
  } catch (err) {
    console.error('ledger replies error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to list replies' }, { status: 500 });
  }
}
