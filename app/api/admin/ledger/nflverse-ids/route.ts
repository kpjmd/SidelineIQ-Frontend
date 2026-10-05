import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { lookupNflverseIds } from '@/lib/ledger-publish';

/** Proxies the agents' cached players.csv lookup (S2-8). "unresolved" is a 200; a failed call is not. */
export async function GET(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const espnId = request.nextUrl.searchParams.get('espn_id')?.trim() ?? '';
  if (!/^\d{1,12}$/.test(espnId)) return NextResponse.json({ error: 'espn_id (numeric) is required' }, { status: 400 });
  const call = await lookupNflverseIds(espnId);
  if (!call.ok || !call.body?.lookup) {
    return NextResponse.json({ error: call.error ?? 'nflverse lookup unavailable' }, { status: call.status === 503 ? 503 : 502 });
  }
  return NextResponse.json({ lookup: call.body.lookup });
}
