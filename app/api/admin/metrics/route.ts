import { NextRequest, NextResponse } from 'next/server';
import { listCtaClicks, listMetricSnapshots, recordManualMetric } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
import { validateManualEntry } from '@/lib/metrics-summary';

// GET /api/admin/metrics → { snapshots, clicks } for the MD dashboard "Metrics"
// tab. Session-gated (requireMd) like every other /api/admin/* handler —
// proxy.ts does not match /api/*.
//
// The two reads are independent: a failure in one returns null for that half
// with its error, so a missing click table does not hide the follower series.
// null means "could not read", which the tab shows as unavailable — never 0.
export async function GET() {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [snapshots, clicks] = await Promise.allSettled([listMetricSnapshots(), listCtaClicks(since)]);

  if (snapshots.status === 'rejected') console.error('metrics route snapshots error:', snapshots.reason);
  if (clicks.status === 'rejected') console.error('metrics route clicks error:', clicks.reason);

  return NextResponse.json({
    snapshots: snapshots.status === 'fulfilled' ? snapshots.value : null,
    snapshots_error: snapshots.status === 'rejected' ? 'Failed to read metric snapshots' : null,
    clicks: clicks.status === 'fulfilled' ? clicks.value : null,
    clicks_error: clicks.status === 'rejected' ? 'Failed to read CTA clicks' : null,
    clicks_since: since,
  });
}

// POST /api/admin/metrics with { metric, value, day? } — a monthly web number
// typed in from the Vercel Analytics dashboard, which has no API on this plan.
// Only the manual metrics are accepted; follower counts belong to the agents'
// snapshot loop. recorded_by comes from the session, never the body.
export async function POST(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const entry = validateManualEntry(body);
  if (!entry.ok) {
    return NextResponse.json({ error: `Invalid ${entry.error}` }, { status: 400 });
  }

  try {
    const snapshot = await recordManualMetric({
      metric: entry.metric,
      value: entry.value,
      day: entry.day,
      recorded_by: gate.userId,
    });
    return NextResponse.json({ snapshot });
  } catch (err) {
    console.error('metrics route record error:', err);
    return NextResponse.json({ error: 'Failed to record metric' }, { status: 500 });
  }
}
