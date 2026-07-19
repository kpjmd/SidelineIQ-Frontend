import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deskGet, deskUpdateDraft } from '@/lib/mcp';
import type { DeskMeta, DeskSections } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const detail = await deskGet(id);
    return NextResponse.json(detail);
  } catch (err) {
    console.error('desk get error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load desk post';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

interface UpdateBody {
  sections?: Partial<DeskSections>;
  meta?: DeskMeta;
  title?: string;
  draft_json?: unknown;
  source_attribution?: unknown;
  disclaimer_present?: boolean;
  edit_diff?: unknown;
}

// Debounced auto-save from the DraftEditor. edited_by is the session user.
// Editing a READY post reverts it to DRAFT server-side — the returned post
// reflects the authoritative status.
//
// markdown_body is deliberately NOT accepted: it is derived from sections by the
// MCP server, so a client cannot make the stored body disagree with the sections
// the MD authored and attested to.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as UpdateBody;
  if (!body.sections && !body.meta && body.title === undefined) {
    return NextResponse.json(
      { error: 'at least one of sections, meta, or title is required' },
      { status: 400 },
    );
  }

  try {
    const post = await deskUpdateDraft({
      desk_post_id: id,
      edited_by: gate.userId,
      sections: body.sections,
      meta: body.meta,
      title: body.title,
      draft_json: body.draft_json,
      source_attribution: body.source_attribution,
      disclaimer_present: body.disclaimer_present,
      edit_diff: body.edit_diff,
    });
    return NextResponse.json({ post });
  } catch (err) {
    console.error('desk update error:', err);
    const message = err instanceof Error ? err.message : 'Failed to save draft';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
