import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deskRetract } from '@/lib/mcp';

// Retract a PUBLISHED desk post (status → RETRACTED). MD-only.
// (Phase 3 adds the .retracted.json emission for the kpjmd builder.)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const result = await deskRetract(id, gate.userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('desk retract error:', err);
    const message = err instanceof Error ? err.message : 'Failed to retract desk post';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
