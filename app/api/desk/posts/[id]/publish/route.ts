import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deskPublish } from '@/lib/mcp';

// THE GATE. The MCP returns a STRUCTURED SUCCESS: a blocked publish is
// {published:false, gate:{role_ok, hash_match, blockers, passed, reasons}} at
// HTTP 200 from the MCP — we map published:false to 422 so the modal can render
// gate.reasons. Only true faults (missing post / wrong status) throw → 500.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const result = await deskPublish(id, gate.userId);
    if (!result.published) {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('desk publish error:', err);
    const message = err instanceof Error ? err.message : 'Failed to publish desk post';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
