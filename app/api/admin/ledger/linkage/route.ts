import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { recordLedgerLinkage } from '@/lib/mcp';
import { lookupNflverseIds } from '@/lib/ledger-publish';
import { validateLinkageInput } from '@/lib/ledger-resolutions';

/**
 * Attach the ids the resolution ingest keys on to a PUBLISHED entry (mcp 028).
 * Set once, never changed; not part of the row hash. The GSIS and PFR ids are
 * looked up HERE from the ESPN id through nflverse players.csv and are never
 * taken from the request: an unresolved lookup refuses, a failed lookup is 503.
 */
export async function POST(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;
  const v = validateLinkageInput(await request.json().catch(() => ({})));
  if (!v.ok) return NextResponse.json({ error: v.errors.join('; '), errors: v.errors }, { status: 400 });
  const call = await lookupNflverseIds(v.value.espn_athlete_id);
  if (!call.ok || !call.body?.lookup) {
    return NextResponse.json({ error: call.error ?? 'nflverse lookup unavailable' }, { status: call.status === 503 ? 503 : 502 });
  }
  const lookup = call.body.lookup;
  if (lookup.status !== 'resolved') {
    return NextResponse.json(
      { error: `nflverse cannot resolve ESPN id ${lookup.espn_id} (${lookup.reason}; missing ${lookup.missing.join(', ')}). Nothing was attached.`, lookup },
      { status: 422 },
    );
  }
  try {
    const out = await recordLedgerLinkage({
      entry_id: v.value.entry_id,
      reviewer_user_id: gate.userId,
      espn_athlete_id: lookup.espn_id,
      gsis_id: lookup.gsis_id,
      pfr_id: lookup.pfr_id,
      nflverse_team: v.value.nflverse_team ?? lookup.nflverse_team ?? null,
      season: v.value.season,
      note: `Linkage attached from ESPN id ${lookup.espn_id} via nflverse players.csv (${lookup.display_name}, fetched ${lookup.source_fetched_at}).`,
    });
    return NextResponse.json({ ...out, lookup });
  } catch (err) {
    console.error('ledger linkage error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Linkage failed', lookup }, { status: 400 });
  }
}
