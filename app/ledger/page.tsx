import type { Metadata } from 'next';
import Link from 'next/link';
import { exportLedger } from '@/lib/mcp';
import { BRAND_NAME } from '@/lib/brand';
import { LEDGER_COPY } from '@/lib/ledger-copy';
import { f4Label, injuryDateLabel, pct } from '@/lib/ledger-card';
import type { PublishedLedgerForecast } from '@/lib/ledger-types';
import { entriesForRow, latestPerEntry, publicLedger, rowKeyOf, rowKeysWithEntries, statusCounts, type PublicLedger } from '@/lib/ledger-public';

export const revalidate = 60;

export const metadata: Metadata = {
  title: `Prognosis Ledger — ${BRAND_NAME}`,
  description: `A public, timestamped record of NFL injury forecasts, each reviewed and signed by a physician and scored against public outcomes. ${LEDGER_COPY.reliance}`,
};

/**
 * The ledger index. Every row here is a published, immutable forecast; the
 * latest version of each entry is listed, with how many of its five fields have
 * resolved. Built from the public view (lib/ledger-public.ts), like every
 * ledger page; the full disclaimer comes from app/ledger/layout.tsx.
 */
export default async function LedgerIndexPage() {
  let ledger: PublicLedger | null = null;
  try {
    ledger = publicLedger(await exportLedger());
  } catch (err) {
    console.error('ledger index load error:', err);
  }
  const loadError = ledger === null;
  const entries: PublishedLedgerForecast[] = ledger ? latestPerEntry(ledger) : [];
  const types = ledger ? rowKeysWithEntries(ledger).map((k) => ({ key: k, n: entriesForRow(ledger!, k).length })) : [];

  return (
    <>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-bone">Prognosis Ledger</h1>
          <p>
            A public, timestamped record of NFL injury forecasts. Every entry carries five scored fields, an entry id, a version and a hash, and is committed to a public repository at publication. Revisions are new versions with a named public trigger; nothing is edited or deleted.
          </p>
          <p className="text-xs">
            <Link href="/ledger/scoreboard" className="text-signal-cyan hover:text-signal-cyan-hover">
              Scoreboard
            </Link>{' '}
            ·{' '}
            <a href="/ledger/export.csv" className="text-signal-cyan hover:text-signal-cyan-hover">
              raw export (CSV)
            </a>
          </p>
        </div>

        <section className="space-y-3">
          {loadError && <p className="text-xs text-red-400">The ledger could not be loaded right now.</p>}
          {!loadError && entries.length === 0 && <p className="text-xs text-slate-500">No entries yet.</p>}
          {entries.map((e) => (
            <Link key={e.entry_id} href={`/ledger/${e.entry_id}`} className="block rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-600 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-bone font-semibold truncate">
                    {e.player} · {e.position} · {e.team}
                  </div>
                  <div className="text-xs text-slate-500">
                    Reported: {e.reported_injury} (tier {e.source_tier}) · injury {injuryDateLabel(e.injury_date)} · {rowKeyOf(ledger!, e.entry_id)}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="font-mono text-xs text-slate-400">
                    {e.entry_id} · v{e.version} · {e.row_hash.slice(0, 8)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {(() => {
                      const c = statusCounts(ledger!, e.entry_id);
                      return `${c.resolved} resolved · ${c.void} void · ${c.open} open · `;
                    })()}
                    IR {pct(e.f1_ir)} · next {pct(e.f2_next)} · 4 wk {pct(e.f3_4wk)} · missed {f4Label(e.f4_point, e.f4_low, e.f4_high)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>

        {types.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-bone">By injury type</h2>
            <ul className="text-xs font-mono flex flex-wrap gap-x-4 gap-y-1">
              {types.map((t) => (
                <li key={t.key}>
                  <Link href={`/ledger/injury/${t.key}`} className="text-signal-cyan hover:text-signal-cyan-hover">
                    {t.key}
                  </Link>{' '}
                  <span className="text-slate-500">({t.n})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
    </>
  );
}
