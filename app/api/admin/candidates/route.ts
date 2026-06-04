import { NextRequest, NextResponse } from 'next/server';
import { listCandidates } from '@/lib/mcp';
import type { CandidateStatus } from '@/lib/types';

function checkAuth(request: NextRequest): boolean {
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = (request.nextUrl.searchParams.get('status') as CandidateStatus | null) ?? 'PROPOSED';
  try {
    const candidates = await listCandidates(status);
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('candidates route error:', err);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}
