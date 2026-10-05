import { NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { listLedgerBaseRates } from '@/lib/mcp';

export async function GET() {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  try {
    return NextResponse.json({ base_rates: await listLedgerBaseRates() });
  } catch (err) {
    console.error('ledger base rates error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load base rates' }, { status: 500 });
  }
}
