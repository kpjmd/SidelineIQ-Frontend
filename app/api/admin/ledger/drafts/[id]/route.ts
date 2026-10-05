import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deleteLedgerDraft, getLedgerForecast, updateLedgerDraft } from '@/lib/mcp';
import { validateDraftInput, forbiddenWordsIn, hashPreviewFor } from '@/lib/ledger-draft-form';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  try {
    const forecast = await getLedgerForecast(id);
    return NextResponse.json({ forecast, forbidden_words: forbiddenWordsIn(forecast), hash_preview: hashPreviewFor(forecast) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load';
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 500 });
  }
}

/** Edit a draft in full. A published row is immutable; the mcp refuses and this returns its reason. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const isRevision = typeof body.entry_id === 'string' && body.entry_id.length > 0;
  const v = validateDraftInput(body, isRevision);
  if (!v.ok) return NextResponse.json({ error: 'Draft is incomplete', errors: v.errors }, { status: 400 });
  try {
    const draft = await updateLedgerDraft({ ...v.value, draft_id: id, edited_by: gate.userId });
    return NextResponse.json({ draft, forbidden_words: forbiddenWordsIn(draft), hash_preview: hashPreviewFor(draft) });
  } catch (err) {
    console.error('ledger update draft error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update draft' }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  try {
    return NextResponse.json(await deleteLedgerDraft(id, gate.userId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete draft' }, { status: 400 });
  }
}
