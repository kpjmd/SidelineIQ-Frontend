import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exportLedger, listLedgerBaseRates } from '@/lib/mcp';
import { BRAND_NAME } from '@/lib/brand';
import { LEDGER_COPY } from '@/lib/ledger-copy';
import { LEDGER_FIELD_SPECS } from '@/lib/ledger-fields';
import { f4Label, injuryDateLabel, pct } from '@/lib/ledger-card';
import { BRIER_FIELDS } from '@/lib/ledger-scoring';
import { entriesForRow, isRowKey, latestPerEntry, publicLedger, statusCounts, summarizeFor } from '@/lib/ledger-public';
import type { LedgerBaseRate } from '@/lib/ledger-types';
import { siteUrl as resolveSite } from '@/lib/site-url';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ rowKey: string }>;
}

async function load(rowKey: string) {
  if (!isRowKey(rowKey)) return null;
  const [exp, rates] = await Promise.all([exportLedger(), listLedgerBaseRates()]);
  const row = rates.find((r) => r.row_key === rowKey);
  if (!row) return null;
  const ledger = publicLedger(exp);
  const ids = entriesForRow(ledger, rowKey);
  // A type page exists once it has a published entry; an unused sheet row is not public.
  if (ids.length === 0) return null;
  const idSet = new Set(ids);
  const entries = latestPerEntry(ledger).filter((f) => idSet.has(f.entry_id));
  return { row, ledger, ids, entries, summary: summarizeFor(ledger, ids) };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { rowKey } = await params;
  const loaded = await load(rowKey).catch(() => null);
  if (!loaded) return { title: `Not Found | ${BRAND_NAME}` };
  const site = resolveSite();
  return {
    title: `${loaded.row.injury_type} — ${BRAND_NAME} Prognosis Ledger`,
    description: `${loaded.ids.length} ledger forecast${loaded.ids.length === 1 ? '' : 's'} on ${loaded.row.injury_type}, the base-rate row behind them (${loaded.row.strength} evidence), and running accuracy. ${LEDGER_COPY.reliance}`,
    alternates: { canonical: `${site}/ledger/injury/${rowKey}` },
  };
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** A sheet row whose numbers were never filled in (the 2026-10-06 skeletons; zeros as placeholders). */
function numbersEntered(r: LedgerBaseRate): boolean {
  const probs = [r.f1_ir, r.f2_next, r.f3_4wk, r.f5_reinjury].map(num);
  return probs.some((p) => p !== null && p > 0) || r.f4_point !== null;
}

/**
 * One page per injury type (spec "Public site"; "Base-rate sheet → Evidence
 * strength by injury type"): every entry filed under this base-rate row, the
 * row and its evidence strength, and running accuracy for the type.
 *
 * The sheet is edited in place with no history (decision S4-2), so the row is
 * labelled as the CURRENT sheet; each entry carries the strength frozen in its
 * own hashed row. An entry belongs to its v1's row.
 */
export default async function LedgerInjuryTypePage({ params }: PageProps) {
  const { rowKey } = await params;
  const loaded = await load(rowKey);
  if (!loaded) notFound();
  const { row, ledger, entries, summary: s } = loaded;
  const entered = numbersEntered(row);
  const prob = (v: unknown) => {
    const n = num(v);
    return n === null ? '—' : pct(n);
  };

  return (
    <>
      <div className="space-y-2">
        <p className="font-mono text-xs text-slate-500">Injury type · {row.row_key}</p>
        <h1 className="text-2xl font-bold text-bone">{row.injury_type}</h1>
        <p>
          {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} · base-rate evidence: <span className="text-bone">{row.strength}</span>
          {row.strength === 'thin' && <span className="text-slate-400"> (base rate: judgment; the F4 interval starts at least twice as wide as a strong row)</span>}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-bone">Base-rate row</h2>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-2 text-xs">
          <p className="text-slate-500">Current sheet; it may have changed since an entry below was published. Each entry records the strength it was published with.</p>
          {entered ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {(['F1', 'F2', 'F3', 'F4', 'F5'] as const).map((f) => (
                <div key={f} className="rounded border border-slate-800 bg-slate-950 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    {f} · {LEDGER_FIELD_SPECS[f].label}
                  </div>
                  <div className="font-mono text-bone">
                    {f === 'F1'
                      ? prob(row.f1_ir)
                      : f === 'F2'
                        ? prob(row.f2_next)
                        : f === 'F3'
                          ? prob(row.f3_4wk)
                          : f === 'F5'
                            ? prob(row.f5_reinjury)
                            : row.f4_point !== null && row.f4_low !== null && row.f4_high !== null
                              ? f4Label(row.f4_point, row.f4_low, row.f4_high)
                              : '—'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">Numbers not yet entered on the sheet.</p>
          )}
          <p className="text-slate-400">
            {row.n !== null && <>n = {row.n} · </>}
            {row.year_range && <>{row.year_range} · </>}
            {row.sources ? <>Sources: {row.sources}</> : 'Sources not yet listed.'}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-bone">Running accuracy for this type</h2>
        <p className="text-xs text-slate-500">
          {s.entries_scored} entr{s.entries_scored === 1 ? 'y' : 'ies'} scored · {s.open_fields} field{s.open_fields === 1 ? '' : 's'} open. Same rules as the{' '}
          <Link href="/ledger/scoreboard" className="text-signal-cyan hover:text-signal-cyan-hover">
            scoreboard
          </Link>
          ; small n moves a lot.
        </p>
        <table className="w-full text-xs font-mono">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-800">
              <th className="text-left font-normal py-1">Field</th>
              <th className="text-right font-normal py-1 text-bone">Initial</th>
              <th className="text-right font-normal py-1">Latest</th>
            </tr>
          </thead>
          <tbody>
            {BRIER_FIELDS.map((f) => (
              <tr key={f} className="border-b border-slate-900">
                <td className="py-1 text-slate-400">
                  {f} {LEDGER_FIELD_SPECS[f].label} · Brier
                </td>
                <td className="text-right py-1 text-bone">
                  {s.initial.brier[f].brier?.toFixed(3) ?? '—'} <span className="text-slate-500">n={s.initial.brier[f].n}</span>
                </td>
                <td className="text-right py-1">
                  {s.latest.brier[f].brier?.toFixed(3) ?? '—'} <span className="text-slate-500">n={s.latest.brier[f].n}</span>
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-1 text-slate-400">F4 {LEDGER_FIELD_SPECS.F4.label} · MAE / 80% coverage</td>
              <td className="text-right py-1 text-bone">
                {s.initial.f4.mae?.toFixed(2) ?? '—'} / {s.initial.f4.coverage?.toFixed(3) ?? '—'} <span className="text-slate-500">n={s.initial.f4.n}</span>
              </td>
              <td className="text-right py-1">
                {s.latest.f4.mae?.toFixed(2) ?? '—'} / {s.latest.f4.coverage?.toFixed(3) ?? '—'} <span className="text-slate-500">n={s.latest.f4.n}</span>
              </td>
            </tr>
          </tbody>
        </table>
        {s.voids.length > 0 && <p className="text-xs text-amber-300">Void: {s.voids.map((v) => `${v.entry_id} ${v.field} (${v.void_reason})`).join(' · ')}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-bone">Entries</h2>
        {entries.map((e) => {
          const c = statusCounts(ledger, e.entry_id);
          return (
            <Link key={e.entry_id} href={`/ledger/${e.entry_id}`} className="block rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-600 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-bone font-semibold truncate">
                    {e.player} · {e.position} · {e.team}
                  </div>
                  <div className="text-xs text-slate-500">
                    Reported: {e.reported_injury} · injury {injuryDateLabel(e.injury_date)} · published with {e.base_rate_strength} evidence
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="font-mono text-xs text-slate-400">
                    {e.entry_id} · v{e.version} · {e.row_hash.slice(0, 8)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {c.resolved} resolved · {c.void} void · {c.open} open
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </>
  );
}
