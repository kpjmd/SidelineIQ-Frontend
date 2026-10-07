import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { recordLedgerCorrection } from '@/lib/mcp';
import { validateCorrectionInput } from '@/lib/ledger-resolutions';

/** A clerical correction: its own append-only row with a note, never an edit to a forecast. */
export async function POST(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const v = validateCorrectionInput(await request.json().catch(() => ({})));
  if (!v.ok) return NextResponse.json({ error: v.errors.join('; '), errors: v.errors }, { status: 400 });
  try {
    return NextResponse.json({ correction: await recordLedgerCorrection({ ...v.value, corrected_by: gate.userId }) });
  } catch (err) {
    console.error('ledger correction error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Correction failed' }, { status: 400 });
  }
}
