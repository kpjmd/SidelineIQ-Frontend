import { NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { triggerLedgerIngestShadow } from '@/lib/ledger-publish';

/** One SHADOW ingest pass: what the agents would propose today, and why the rest is held. Files nothing. */
export async function POST() {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const call = await triggerLedgerIngestShadow();
  if (!call.body) return NextResponse.json({ error: call.error ?? 'ingest unavailable' }, { status: call.status === 503 ? 503 : 502 });
  return NextResponse.json(call.body, { status: call.ok ? 200 : call.status });
}
