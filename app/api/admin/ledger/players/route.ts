import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { resolvePlayer } from '@/lib/mcp';

/** Roster lookup for the draft form: attaches espn_athlete_id, the only key the nflverse crosswalk accepts. */
export async function GET(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const name = request.nextUrl.searchParams.get('name')?.trim() ?? '';
  if (name.length < 2) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  try {
    return NextResponse.json({ resolution: await resolvePlayer(name, 'NFL') });
  } catch (err) {
    console.error('ledger player resolve error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Lookup failed' }, { status: 500 });
  }
}
