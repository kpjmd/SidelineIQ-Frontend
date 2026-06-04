import { NextRequest, NextResponse } from 'next/server';
import { decideCandidate } from '@/lib/mcp';
import type { CandidateDecision } from '@/lib/types';

function checkAuth(request: NextRequest): boolean {
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
