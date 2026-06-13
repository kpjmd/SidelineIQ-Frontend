import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deskCreateDraft } from '@/lib/mcp';

interface CreateDraftBody {
  candidate_id?: string;
  title?: string;
  markdown_body?: string;
  draft_json?: unknown;
  source_attribution?: unknown;
  disclaimer_present?: boolean;
}

// Create a DRAFT desk post from an ACCEPTED candidate. author_id is sourced from
// the session, never the request body (identity→gate contract).
export async function POST(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => ({}))) as CreateDraftBody;
  if (!body.candidate_id || !body.title || !body.markdown_body) {
    return NextResponse.json(
      { error: 'candidate_id, title, and markdown_body are required' },
      { status: 400 },
    );
  }

  try {
    const post = await deskCreateDraft({
      candidate_id: body.candidate_id,
      author_id: gate.userId,
      title: body.title,
      markdown_body: body.markdown_body,
      draft_json: body.draft_json,
      source_attribution: body.source_attribution,
      disclaimer_present: body.disclaimer_present,
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    console.error('desk create draft error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create draft';
    // The MCP throws when the candidate is not ACCEPTED / not found.
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
