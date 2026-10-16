import { exportLedger } from '@/lib/mcp';
import { ledgerCsv } from '@/lib/ledger-export-csv';
import { asOfParam, asOfLabel, etDate, publicLedger } from '@/lib/ledger-public';

export const revalidate = 60;

/**
 * The raw export (spec "Public site": every resolved entry, so anyone can
 * recompute the scores; "Publication"). Written by the byte-identical twin
 * `ledgerCsv`, which the agents admin export also uses; `ledgerFromCsv` +
 * `summarizeLedger` over this file reproduce the scoreboard exactly (pinned by
 * tests/ledger-export-csv.test.ts). One row per entry and field, open and void
 * included so nothing is silently absent. `?as_of=YYYY-MM-DD` (S4-1) is the
 * file as it stood at the end of that New York day.
 *
 * Drafts and proposals cannot appear: the read is web_export_ledger through
 * publicLedger.
 */
export async function GET(request: Request): Promise<Response> {
  const asOf = asOfParam(new URL(request.url).searchParams.get('as_of'));
  const today = etDate(new Date().toISOString())!;
  if (asOf === undefined || (asOf !== null && asOf > today)) {
    return new Response('as_of must be a YYYY-MM-DD date no later than today (New York)\n', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  try {
    const ledger = publicLedger(await exportLedger(), asOf);
    return new Response(ledgerCsv(ledger), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="paratros-ledger-${asOfLabel(ledger)}.csv"`,
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('ledger export load error:', err);
    return new Response('The ledger export could not be loaded right now.\n', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}
