import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deskAppendUpdate, deskListUpdates } from '@/lib/mcp';

// GET: the Return Watch timeline for a desk post (newest-first).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const updates = await deskListUpdates(id);
    return NextResponse.json({ updates });
  } catch (err) {
    console.error('desk list updates error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load updates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface AppendBody {
  headline?: string;
  markdown_body?: string;
  occurred_at?: string;
  candidate_id?: string;
}

// POST: append a dated Return Watch follow-up. author_id is ALWAYS the
// session user (identity→gate contract) — the MCP re-derives MD role from
// it, never trusting a client-supplied value. Only a PUBLISHED post accepts
// appends (enforced MCP-side).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as AppendBody;

  if (!body.headline?.trim() || !body.markdown_body?.trim() || !body.occurred_at) {
    return NextResponse.json(
      { error: 'Body must include non-empty headline, markdown_body, and occurred_at.' },
      { status: 400 },
    );
  }

  try {
    const update = await deskAppendUpdate({
      desk_post_id: id,
      author_id: gate.userId,
      headline: body.headline,
      markdown_body: body.markdown_body,
      occurred_at: body.occurred_at,
      candidate_id: body.candidate_id,
    });
    return NextResponse.json({ update });
  } catch (err) {
    console.error('desk append update error:', err);
    const message = err instanceof Error ? err.message : 'Failed to append update';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
