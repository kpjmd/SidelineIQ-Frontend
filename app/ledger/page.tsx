import type { Metadata } from 'next';
import Link from 'next/link';
import { listLedgerEntries } from '@/lib/mcp';
import { BRAND_NAME } from '@/lib/brand';
import { LEDGER_COPY } from '@/lib/ledger-copy';
import { Mark } from '@/components/shared/Mark';
import { Wordmark } from '@/components/shared/Wordmark';
import { f4Label, injuryDateLabel, pct } from '@/lib/ledger-card';
import { isPublishedForecast, type PublishedLedgerForecast } from '@/lib/ledger-types';

export const revalidate = 60;

export const metadata: Metadata = {
  title: `Prognosis Ledger — ${BRAND_NAME}`,
  description: `A public, timestamped record of NFL injury forecasts, each reviewed and signed by a physician and scored against public outcomes. ${LEDGER_COPY.reliance}`,
};

/**
 * The ledger index (S2-3: minimal now, Stage 4 adds the scoreboard, the
 * per-injury-type pages and the CSV export). Every row here is a published,
 * immutable forecast; the latest version of each entry is listed.
 */
export default async function LedgerIndexPage() {
  let rows: PublishedLedgerForecast[] = [];
  let loadError = false;
  try {
    rows = (await listLedgerEntries({ limit: 200 })).filter(isPublishedForecast);
  } catch (err) {
    console.error('ledger index load error:', err);
    loadError = true;
  }
  const latest = new Map<string, PublishedLedgerForecast>();
  for (const r of rows) {
    const prev = latest.get(r.entry_id);
    if (!prev || prev.version < r.version) latest.set(r.entry_id, r);
  }
  const entries = [...latest.values()].sort((a, b) => (a.published_at < b.published_at ? 1 : -1));

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <Mark size={28} />
            <Wordmark className="text-xl" />
          </Link>
          <span className="font-mono text-xs tracking-[0.14em] text-slate-400">PROGNOSIS LEDGER</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm text-slate-300">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-bone">Prognosis Ledger</h1>
          <p>
            A public, timestamped record of NFL injury forecasts. Every entry carries five scored fields, an entry id, a version and a hash, and is committed to a public repository at publication. Revisions are new versions with a named public trigger; nothing is edited or deleted.
          </p>
          <p className="text-xs text-slate-500">{LEDGER_COPY.ai_disclosure}</p>
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
                    Reported: {e.reported_injury} (tier {e.source_tier}) · injury {injuryDateLabel(e.injury_date)}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="font-mono text-xs text-slate-400">
                    {e.entry_id} · v{e.version} · {e.row_hash.slice(0, 8)}
                  </div>
                  <div className="text-xs text-slate-500">
                    IR {pct(e.f1_ir)} · next {pct(e.f2_next)} · 4 wk {pct(e.f3_4wk)} · missed {f4Label(e.f4_point, e.f4_low, e.f4_high)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>

        <footer className="border-t border-slate-800 pt-6 space-y-2 text-xs text-slate-500">
          <p>{LEDGER_COPY.full_disclaimer}</p>
          <p>{LEDGER_COPY.reliance}</p>
        </footer>
      </main>
    </div>
  );
}
