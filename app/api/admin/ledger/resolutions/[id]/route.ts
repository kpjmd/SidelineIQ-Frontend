import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { decideLedgerProposal } from '@/lib/mcp';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The physician's decision on a proposed resolution. "confirmed" locks the
 * field (the database refuses any later edit) and records reviewer + time in
 * the same statement; "rejected" leaves the field open for a later proposal.
 * The reviewer is ALWAYS the session user, never a value from the body.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'proposal id must be a UUID' }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as { decision?: unknown; note?: unknown };
  if (body.decision !== 'confirmed' && body.decision !== 'rejected') {
    return NextResponse.json({ error: 'decision must be confirmed or rejected' }, { status: 400 });
  }
  try {
    const out = await decideLedgerProposal({
      proposal_id: id,
      reviewer_user_id: gate.userId,
      decision: body.decision,
      note: typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 2000) : null,
    });
    return NextResponse.json(out);
  } catch (err) {
    console.error('ledger decide proposal error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Decision failed' }, { status: 400 });
  }
}
