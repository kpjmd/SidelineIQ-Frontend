import { NextRequest, NextResponse } from 'next/server';
import { getThread, updateThreadDates, closeThread } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
import type { DateConfidence } from '@/lib/types';

// GET /api/admin/threads/[id] → { entity, updates } for the detail view.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const thread = await getThread(id);
    return NextResponse.json(thread);
  } catch (err) {
    console.error('thread detail error:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch thread';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface ThreadActionBody {
  action?: 'update_dates' | 'close';
  injury_date?: string;
  injury_date_confidence?: DateConfidence;
  surgery_date?: string;
  surgery_confirmed?: boolean;
  actual_return_date?: string;
  outcome?: 'RESOLVED' | 'RETIRED';
}

// POST /api/admin/threads/[id] with { action: 'update_dates' | 'close', ... }.
// closed_by is sourced from the session (gate.userId) — never the request body.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as ThreadActionBody;

  try {
    if (body.action === 'update_dates') {
      const confidence = body.injury_date_confidence ?? 'unknown';
      const result = await updateThreadDates({
        entity_id: id,
        injury_date: body.injury_date || undefined,
        injury_date_confidence: confidence,
        surgery_date: body.surgery_date || undefined,
        surgery_confirmed: body.surgery_confirmed,
        // MD manual entry is its own provenance stage.
        date_resolution_sources: body.injury_date ? [{ stage: 'md_manual' }] : undefined,
        needs_date_review: confidence === 'unknown',
      });
      return NextResponse.json(result);
    }
    if (body.action === 'close') {
      const result = await closeThread({
        entity_id: id,
        actual_return_date: body.actual_return_date || undefined,
        outcome: body.outcome === 'RETIRED' ? 'RETIRED' : 'RESOLVED',
        closed_by: gate.userId,
      });
      return NextResponse.json(result);
    }
    return NextResponse.json(
      { error: "Body must include { action: 'update_dates' | 'close' }" },
      { status: 400 },
    );
  } catch (err) {
    console.error('thread action error:', err);
    const message = err instanceof Error ? err.message : 'Thread action failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
