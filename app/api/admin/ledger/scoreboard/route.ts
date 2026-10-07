import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { fetchLedgerScoreboard } from '@/lib/ledger-publish';

/** Both boards plus the resolution-card and scoreboard-card TEXT, for the physician to post by hand. */
export async function GET(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const since = request.nextUrl.searchParams.get('since');
  if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) return NextResponse.json({ error: 'since must be YYYY-MM-DD' }, { status: 400 });
  const call = await fetchLedgerScoreboard(since);
  if (!call.ok || !call.body) return NextResponse.json({ error: call.error ?? 'scoreboard unavailable' }, { status: call.status === 503 ? 503 : 502 });
  return NextResponse.json(call.body);
}
