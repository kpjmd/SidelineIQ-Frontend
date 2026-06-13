import { NextRequest, NextResponse } from 'next/server';
import { decideCandidate } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
import type { CandidateDecision } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { decision?: string };
  const decision = body.decision;

  if (decision !== 'ACCEPTED' && decision !== 'DISMISSED') {
    return NextResponse.json(
      { error: "Body must include { decision: 'ACCEPTED' | 'DISMISSED' }" },
      { status: 400 },
    );
  }

  try {
    // decided_by is 'md' until NextAuth lands in Phase 2.
    const result = await decideCandidate(id, decision as CandidateDecision, 'md');
    return NextResponse.json(result);
  } catch (err) {
    console.error('decide candidate error:', err);
    const message = err instanceof Error ? err.message : 'Failed to decide candidate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
