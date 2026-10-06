import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { listLedgerBaseRates, upsertLedgerBaseRate } from '@/lib/mcp';
import { validateBaseRateInput } from '@/lib/ledger-draft-form';

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

/**
 * Create or replace one base-rate row (spec "Base-rate sheet": the physician
 * enters these; a forecast copies the values it used at publish, so editing a
 * row later never rewrites a published card). The editor's identity is the
 * session user, never a body field.
 */
export async function POST(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as unknown;
  const v = validateBaseRateInput(body);
  if (!v.ok) return NextResponse.json({ error: 'Base rate is incomplete', errors: v.errors }, { status: 400 });
  try {
    const base_rate = await upsertLedgerBaseRate({ ...v.value, updated_by: gate.userId });
    return NextResponse.json({ base_rate }, { status: 201 });
  } catch (err) {
    console.error('ledger upsert base rate error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save base rate' }, { status: 400 });
  }
}
