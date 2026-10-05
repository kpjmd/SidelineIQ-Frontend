import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { publishLedgerForecast } from '@/lib/mcp';
import { triggerLedgerPublish } from '@/lib/ledger-publish';

/**
 * THE CONFIRMATION. web_publish_ledger_forecast re-derives the session user's
 * role, runs the gate, stamps published_at, allocates the entry id, hashes the
 * stored row, opens the five resolutions and audits who confirmed — in the
 * database, as one recorded act. A blocked gate is 422 with its reasons.
 *
 * Then the agents render a DRY RUN of the distribution (texts + commit payload,
 * nothing sent) so the physician sees exactly what will go out before pressing
 * "Post and commit" (→ forecasts/[id]/distribute). The row is already public
 * record by this point in the sense that it is immutable and has an entry id;
 * it is not yet on the web, X, Farcaster or GitHub.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  let result;
  try {
    result = await publishLedgerForecast(id, gate.userId);
  } catch (err) {
    console.error('ledger publish error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Publish failed' }, { status: 500 });
  }
  if (!result.published || !result.forecast) return NextResponse.json(result, { status: 422 });

  const preview = await triggerLedgerPublish(result.forecast.id, { dryRun: true });
  return NextResponse.json({
    publish: result,
    preview: preview.body,
    preview_error: preview.ok ? null : preview.error ?? 'preview unavailable',
  });
}
