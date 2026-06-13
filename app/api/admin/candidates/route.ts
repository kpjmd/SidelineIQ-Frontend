import { NextRequest, NextResponse } from 'next/server';
import { listCandidates } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
import type { CandidateStatus } from '@/lib/types';

export async function GET(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const status = (request.nextUrl.searchParams.get('status') as CandidateStatus | null) ?? 'PROPOSED';
  try {
    const candidates = await listCandidates(status);
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('candidates route error:', err);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}
