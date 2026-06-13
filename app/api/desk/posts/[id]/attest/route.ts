import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deskAttest } from '@/lib/mcp';

interface AttestBody {
  reviewed_source_reports?: boolean;
  edited_for_accuracy?: boolean;
  framing_confirmed?: boolean;
}

// Physician attestation. reviewer_user_id is the session user; the MCP re-derives
// MD role from the DB. All three confirmations must be true (also enforced MCP-side).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as AttestBody;

  if (!body.reviewed_source_reports || !body.edited_for_accuracy || !body.framing_confirmed) {
    return NextResponse.json(
      { error: 'All three confirmations must be checked to attest.' },
      { status: 400 },
    );
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;

  try {
    const attestation = await deskAttest({
      desk_post_id: id,
      reviewer_user_id: gate.userId,
      reviewed_source_reports: body.reviewed_source_reports,
      edited_for_accuracy: body.edited_for_accuracy,
      framing_confirmed: body.framing_confirmed,
      ip,
    });
    return NextResponse.json({ attestation });
  } catch (err) {
    console.error('desk attest error:', err);
    const message = err instanceof Error ? err.message : 'Failed to attest desk post';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
