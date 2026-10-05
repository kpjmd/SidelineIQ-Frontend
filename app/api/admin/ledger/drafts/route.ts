import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { createLedgerDraft, listLedgerEntries } from '@/lib/mcp';
import { validateDraftInput, forbiddenWordsIn, hashPreviewFor } from '@/lib/ledger-draft-form';

/** Every forecast row, drafts included, newest first. */
export async function GET() {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  try {
    return NextResponse.json({ forecasts: await listLedgerEntries({ include_drafts: true, limit: 200 }) });
  } catch (err) {
    console.error('ledger list error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to list' }, { status: 500 });
  }
}

/**
 * Create a DRAFT (never public, no entry id). `parent_entry_id` makes it the
 * next version of a published entry and requires a trigger. The identity
 * written is the session's user id, never a body field.
 */
export async function POST(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parentEntryId = typeof body.parent_entry_id === 'string' && body.parent_entry_id ? body.parent_entry_id : null;
  const v = validateDraftInput(body, parentEntryId !== null);
  if (!v.ok) return NextResponse.json({ error: 'Draft is incomplete', errors: v.errors }, { status: 400 });
  try {
    const draft = await createLedgerDraft({ ...v.value, created_by: gate.userId, parent_entry_id: parentEntryId });
    return NextResponse.json({ draft, forbidden_words: forbiddenWordsIn(draft), hash_preview: hashPreviewFor(draft) }, { status: 201 });
  } catch (err) {
    console.error('ledger create draft error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create draft' }, { status: 400 });
  }
}
