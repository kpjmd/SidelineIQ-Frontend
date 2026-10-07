import { NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { listLedgerEntries, listLedgerProposals, listLedgerResolutions } from '@/lib/mcp';

/** Pending proposals, every resolution row, and the published forecasts they belong to. */
export async function GET() {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  try {
    const [proposals, resolutions, forecasts] = await Promise.all([
      listLedgerProposals({ decision: 'pending' }),
      listLedgerResolutions({}),
      listLedgerEntries({ limit: 200 }),
    ]);
    return NextResponse.json({ proposals, resolutions, forecasts });
  } catch (err) {
    console.error('ledger resolutions load error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load resolutions' }, { status: 500 });
  }
}
