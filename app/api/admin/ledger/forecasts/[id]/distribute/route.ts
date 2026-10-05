import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { triggerLedgerPublish } from '@/lib/ledger-publish';

/**
 * Distribute a PUBLISHED row: the agents commit it to the ledger repository,
 * reply on X, self-reply, mirror to Farcaster and record provenance — or, with
 * dry_run, render all of that and send nothing. Re-running fills only the gaps.
 * No content crosses this route; the agents read the row by id.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { dry_run?: unknown; force_standalone?: unknown };
  const call = await triggerLedgerPublish(id, { dryRun: body.dry_run === true, forceStandalone: body.force_standalone === true });
  if (!call.ok) {
    return NextResponse.json({ error: call.error ?? 'distribution failed', detail: call.body }, { status: call.status >= 400 && call.status < 600 ? call.status : 502 });
  }
  return NextResponse.json({ outcome: call.body });
}
