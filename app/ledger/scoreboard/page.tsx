import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exportLedger } from '@/lib/mcp';
import { BRAND_NAME } from '@/lib/brand';
import { LEDGER_COPY } from '@/lib/ledger-copy';
import { LEDGER_FIELD_SPECS } from '@/lib/ledger-fields';
import { BRIER_FIELDS, CALIBRATION_MIN_N, SCOREBOARD_LINE_MIN_N, scoreboardLine, type CalibrationBucket, type ScoreboardSummary } from '@/lib/ledger-scoring';
import { asOfLabel, asOfParam, etDate, monthlyBoardDates, publicLedger, summarizeFor, type PublicLedger } from '@/lib/ledger-public';
import { siteUrl as resolveSite } from '@/lib/site-url';

export const revalidate = 60;

interface PageProps {
  searchParams: Promise<{ as_of?: string | string[] }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const asOf = asOfParam((await searchParams).as_of);
  const site = resolveSite();
  const title = `Scoreboard${asOf ? ` as of ${asOf}` : ''} — ${BRAND_NAME} Prognosis Ledger`;
  return {
    title,
    description: `Initial and latest boards over the same n, calibration, revision delta and voids for every scored ledger forecast. ${LEDGER_COPY.reliance}`,
    alternates: { canonical: `${site}/ledger/scoreboard${asOf ? `?as_of=${asOf}` : ''}` },
  };
}

const fmt = (v: number | null, dp: number) => (v === null ? '—' : v.toFixed(dp));
const signed = (v: number | null, dp: number) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(dp)}`);
const pctOf = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

function Boards({ s }: { s: ScoreboardSummary }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead className="text-slate-500">
          <tr className="border-b border-slate-800">
            <th className="text-left font-normal py-2 pr-3">Field</th>
            <th className="text-right font-normal py-2 px-3 text-bone">{LEDGER_COPY.initial_board_label}</th>
            <th className="text-right font-normal py-2 px-3">{LEDGER_COPY.latest_board_label}</th>
            <th className="text-right font-normal py-2 pl-3">Delta</th>
          </tr>
        </thead>
        <tbody>
          {BRIER_FIELDS.map((f) => (
            <tr key={f} className="border-b border-slate-900">
              <td className="py-2 pr-3 text-slate-400">
                {f} {LEDGER_FIELD_SPECS[f].label} <span className="text-slate-600">· Brier</span>
              </td>
              <td className="text-right py-2 px-3 text-bone">
                {fmt(s.initial.brier[f].brier, 3)} <span className="text-slate-500">n={s.initial.brier[f].n}</span>
              </td>
              <td className="text-right py-2 px-3">
                {fmt(s.latest.brier[f].brier, 3)} <span className="text-slate-500">n={s.latest.brier[f].n}</span>
              </td>
              <td className="text-right py-2 pl-3">{signed(s.revision_delta.brier[f], 3)}</td>
            </tr>
          ))}
          <tr className="border-b border-slate-900">
            <td className="py-2 pr-3 text-slate-400">
              F4 {LEDGER_FIELD_SPECS.F4.label} <span className="text-slate-600">· MAE (games)</span>
            </td>
            <td className="text-right py-2 px-3 text-bone">
              {fmt(s.initial.f4.mae, 2)} <span className="text-slate-500">n={s.initial.f4.n}</span>
            </td>
            <td className="text-right py-2 px-3">
              {fmt(s.latest.f4.mae, 2)} <span className="text-slate-500">n={s.latest.f4.n}</span>
            </td>
            <td className="text-right py-2 pl-3">{signed(s.revision_delta.f4_mae, 2)}</td>
          </tr>
          <tr>
            <td className="py-2 pr-3 text-slate-400">
              F4 <span className="text-slate-600">· 80% interval coverage</span>
            </td>
            <td className="text-right py-2 px-3 text-bone">{fmt(s.initial.f4.coverage, 3)}</td>
            <td className="text-right py-2 px-3">{fmt(s.latest.f4.coverage, 3)}</td>
            <td className="text-right py-2 pl-3 text-slate-600">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Calibration({ s }: { s: ScoreboardSummary }) {
  const tables = (['initial', 'latest'] as const).flatMap((kind) =>
    BRIER_FIELDS.map((f) => ({ kind, f, buckets: s.calibration[kind][f].filter((b: CalibrationBucket) => b.published) })).filter((t) => t.buckets.length > 0),
  );
  if (tables.length === 0) {
    return <p className="text-xs text-slate-500">No probability bucket has reached n ≥ {CALIBRATION_MIN_N} yet. Calibration tables appear bucket by bucket as they do.</p>;
  }
  return (
    <div className="space-y-4">
      {tables.map(({ kind, f, buckets }) => (
        <div key={`${kind}-${f}`} className="space-y-1">
          <h3 className="text-xs text-slate-400">
            {f} {LEDGER_FIELD_SPECS[f].label} · {kind === 'initial' ? 'initial' : 'latest'} board
          </h3>
          <table className="w-full text-xs font-mono">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-800">
                <th className="text-left font-normal py-1">Forecast bucket</th>
                <th className="text-right font-normal py-1">n</th>
                <th className="text-right font-normal py-1">Mean forecast</th>
                <th className="text-right font-normal py-1">Observed</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.lo} className="border-b border-slate-900">
                  <td className="py-1">
                    {Math.round(b.lo * 100)}–{Math.round(b.hi * 100)}%
                  </td>
                  <td className="text-right py-1">{b.n}</td>
                  <td className="text-right py-1">{pctOf(b.forecast_mean)}</td>
                  <td className="text-right py-1">{pctOf(b.observed_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-xs text-slate-500">A bucket is published once it holds n ≥ {CALIBRATION_MIN_N} entries; smaller buckets are counted on the boards but not shown here.</p>
    </div>
  );
}

/**
 * The scoreboard (spec "Scoring integrity → Computation", "Publication";
 * docs/ledger-preregistration.md). Both boards always together over the same
 * n, Initial first as the headline; calibration buckets only at n ≥ 5; voids
 * and exclusions named; the card line only at ≥ 20 entries scored. Every
 * number is the pinned twin's (`summarizeLedger`). `?as_of=` (S4-1) is the
 * ledger at the end of that New York day, so a monthly board stays exactly
 * reproducible after later resolutions land.
 */
export default async function LedgerScoreboardPage({ searchParams }: PageProps) {
  const asOf = asOfParam((await searchParams).as_of);
  if (asOf === undefined) notFound();
  const today = etDate(new Date().toISOString())!;
  if (asOf !== null && asOf > today) notFound();

  let ledger: PublicLedger | null = null;
  try {
    ledger = publicLedger(await exportLedger(), asOf);
  } catch (err) {
    console.error('ledger scoreboard load error:', err);
  }
  if (!ledger) {
    return <p className="text-xs text-red-400">The scoreboard could not be loaded right now.</p>;
  }
  const s = summarizeFor(ledger);
  const line = scoreboardLine(s);
  const label = asOfLabel(ledger);
  const csvHref = `/ledger/export.csv${asOf ? `?as_of=${asOf}` : ''}`;
  const monthly = monthlyBoardDates(today);

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-bone">Scoreboard</h1>
        <p className="font-mono text-xs text-slate-400">
          {asOf ? `As of the end of ${label} (New York)` : `Live · as of ${label} (New York)`} · {s.entries_scored} entr{s.entries_scored === 1 ? 'y' : 'ies'} scored · {s.open_fields} field
          {s.open_fields === 1 ? '' : 's'} open · {s.voids.length} void · scoring v{s.scoring_version}
        </p>
        <p>
          Each injury contributes one observation per field. The initial-forecast board is the headline; the latest board scores the last revision published before each field&rsquo;s freeze point, over the same n. Brier: lower is better, 0 is perfect.
        </p>
        <p className="text-xs text-slate-400">{line ?? LEDGER_COPY.scoreboard_floor_note}</p>
        {!line && s.entries_scored < SCOREBOARD_LINE_MIN_N && (
          <p className="text-xs text-slate-500">
            {s.entries_scored} of {SCOREBOARD_LINE_MIN_N} so far. Small-n numbers below are shown in full and move a lot.
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-bone">Boards</h2>
        <Boards s={s} />
        <p className="text-xs text-slate-500">{LEDGER_COPY.revision_delta_label}.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-bone">Calibration</h2>
        <Calibration s={s} />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-bone">{LEDGER_COPY.void_label}</h2>
        {s.voids.length === 0 ? (
          <p className="text-xs text-slate-500">No void fields.</p>
        ) : (
          <ul className="text-xs font-mono space-y-1">
            {s.voids.map((v) => (
              <li key={`${v.entry_id}-${v.field}`}>
                <Link href={`/ledger/${v.entry_id}`} className="text-signal-cyan hover:text-signal-cyan-hover">
                  {v.entry_id}
                </Link>{' '}
                {v.field} · {v.void_reason}
              </li>
            ))}
          </ul>
        )}
        <h3 className="text-xs text-slate-400 pt-2">Resolved but not scored</h3>
        {s.exclusions.length === 0 ? (
          <p className="text-xs text-slate-500">None.</p>
        ) : (
          <ul className="text-xs font-mono space-y-1">
            {s.exclusions.map((e) => (
              <li key={`${e.entry_id}-${e.field}`}>
                <Link href={`/ledger/${e.entry_id}`} className="text-signal-cyan hover:text-signal-cyan-hover">
                  {e.entry_id}
                </Link>{' '}
                {e.field} · {e.reason}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-bone">Raw export</h2>
        <p className="text-xs">
          <a href={csvHref} className="text-signal-cyan hover:text-signal-cyan-hover">
            Download the CSV{asOf ? ` as of ${asOf}` : ''}
          </a>{' '}
          — one row per entry and field, with the v1 forecast and the version each field scores. {LEDGER_COPY.export_note}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-bone">Monthly boards</h2>
        {monthly.length === 0 ? (
          <p className="text-xs text-slate-500">The first monthly scoreboard is published on the first Tuesday of November 2026.</p>
        ) : (
          <ul className="text-xs font-mono space-y-1">
            {monthly.map((d) => (
              <li key={d}>
                <Link href={`/ledger/scoreboard?as_of=${d}`} className="text-signal-cyan hover:text-signal-cyan-hover">
                  {d}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <form method="get" action="/ledger/scoreboard" className="flex items-center gap-2 text-xs pt-1">
          <label htmlFor="as_of" className="text-slate-500">
            Board as of
          </label>
          <input id="as_of" name="as_of" type="date" max={today} defaultValue={asOf ?? ''} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200" />
          <button type="submit" className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:border-slate-500">
            Show
          </button>
          {asOf && (
            <Link href="/ledger/scoreboard" className="text-signal-cyan hover:text-signal-cyan-hover">
              live
            </Link>
          )}
        </form>
      </section>
    </>
  );
}
