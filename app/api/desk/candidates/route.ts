import { NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { listCandidates } from '@/lib/mcp';

// ACCEPTED candidates are the ones ready to become desk drafts (an ACCEPTED
// candidate is the required precondition for desk_create_draft).
export async function GET() {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  try {
    const candidates = await listCandidates('ACCEPTED');
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('desk candidates list error:', err);
    return NextResponse.json({ error: 'Failed to list accepted candidates' }, { status: 500 });
  }
}
