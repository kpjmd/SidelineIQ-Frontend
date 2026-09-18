import { NextRequest, NextResponse } from 'next/server';
import { reopenThread } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';

/**
 * POST /api/admin/threads/:id/reopen — undo a wrong close.
 *
 * The slug is `id`, not `entityId`, because it MUST match the sibling
 * [id]/route.ts: Next rejects two differently-named dynamic segments under one
 * parent, and the route tree is built at request time, so a mismatch 500s every
 * path in the app under `next start` / `next dev` — not just this one. Vercel
 * routes from the prebuilt manifest instead and so never showed it. The value is
 * an injury_entities id either way.
 *
 * The return detector closes threads on a timer, and until mcp grew
 * web_thread_reopen there was no way back from RESOLVED through any tool in
 * any repo: a false positive was repairable only by hand-written SQL against
 * production, with no audit row. This is that path, behind the same requireMd
 * gate as every other /api/admin/* handler (proxy.ts does not match /api/*).
 *
 * The reason is required and is NOT taken on trust from the client alone — the
 * identity written to the audit row comes from the session, never the body,
 * the same rule the metrics POST follows.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  let body: { reason?: unknown };
  try {
    body = (await request.json()) as { reason?: unknown };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    // mcp would reject this too, but a 400 naming the field is a better answer
    // than a tool error, and the reason is the only durable record of a reversal.
    return NextResponse.json({ error: 'A reason is required to reopen a thread' }, { status: 400 });
  }

  try {
    const result = await reopenThread({
      entity_id: id,
      reopened_by: gate.userId,
      reason,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('thread reopen error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
