import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exportLedger } from '@/lib/mcp';
import { BRAND_NAME } from '@/lib/brand';
import { LEDGER_COPY } from '@/lib/ledger-copy';
import { LEDGER_FIELDS, LEDGER_FIELD_SPECS } from '@/lib/ledger-fields';
import { f4Label, injuryDateLabel, pct, TIER_COLORS } from '@/lib/ledger-card';
import type { PublishedLedgerForecast } from '@/lib/ledger-types';
import { outcomeLabel } from '@/lib/ledger-resolutions';
import { etDate, linkageSummary, publicLedger, resolutionEvidence, scoringByField, versionsOf, type PublicLedger } from '@/lib/ledger-public';
import { siteUrl as resolveSite } from '@/lib/site-url';

export const revalidate = 60;

const ENTRY_ID_RE = /^PT-\d{4}-\d{3,}$/;

interface PageProps {
  params: Promise<{ entryId: string }>;
}

async function load(entryId: string): Promise<{ ledger: PublicLedger; versions: PublishedLedgerForecast[] } | null> {
  if (!ENTRY_ID_RE.test(entryId)) return null;
  // The whole public ledger, not web_get_ledger_entry: that tool also returns
  // the entry's proposals, pending ones included, and nothing public reads them.
  const ledger = publicLedger(await exportLedger());
  const versions = versionsOf(ledger, entryId);
  if (versions.length === 0) return null;
  return { ledger, versions };
}

const etTime = (iso: string) =>
  `${new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} ET`;

function fieldLine(v: PublishedLedgerForecast): string {
  const f5 = v.f5_reinjury == null ? 'n/a' : pct(v.f5_reinjury);
  return `IR ${pct(v.f1_ir)} · next game ${pct(v.f2_next)} · 4 weeks ${pct(v.f3_4wk)} · games missed ${f4Label(v.f4_point, v.f4_low, v.f4_high)} · re-injury ${f5}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { entryId } = await params;
  const loaded = await load(entryId).catch(() => null);
  if (!loaded) return { title: `Not Found | ${BRAND_NAME}` };
  const latest = loaded.versions[loaded.versions.length - 1];
  const title = `${latest.player} — ${latest.entry_id} v${latest.version} | ${BRAND_NAME} Prognosis Ledger`;
  const description = `${latest.reported_injury} (tier ${latest.source_tier}). ${fieldLine(latest)}. ${LEDGER_COPY.credit}.`;
  const site = resolveSite();
  return {
    title,
    description,
    alternates: { canonical: `${site}/ledger/${latest.entry_id}` },
    // og:image / twitter:image come from the colocated opengraph-image.tsx.
    openGraph: { url: `${site}/ledger/${latest.entry_id}`, title, description, type: 'article', publishedTime: latest.published_at, siteName: BRAND_NAME },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * One permanent URL per entry (spec "Public site"): every version, the five
 * resolutions with their evidence, which version each resolved field is scored
 * on, corrections (linkage rows included), the commit and the social posts. The
 * full disclaimer comes from app/ledger/layout.tsx. Built from the public view
 * (lib/ledger-public.ts): no draft and no proposal can reach this page.
 */
export default async function LedgerEntryPage({ params }: PageProps) {
  const { entryId } = await params;
  const loaded = await load(entryId);
  if (!loaded) notFound();
  const { ledger, versions } = loaded;
  const latest = versions[versions.length - 1];
  const resolutions = ledger.resolutions.filter((r) => r.entry_id === latest.entry_id);
  const corrections = ledger.corrections.filter((c) => c.entry_id === latest.entry_id);
  const scoring = scoringByField(ledger, latest.entry_id);
  const rowKey = versions[0].base_rate_row;
  const tier = TIER_COLORS[latest.source_tier];

  return (
    <>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: tier.fill, color: tier.ink }}>
              {tier.label}
            </span>
            <span className="font-mono text-xs text-slate-400">
              {latest.entry_id} · v{latest.version} · {latest.row_hash.slice(0, 8)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-bone">
            {latest.player} · {latest.position} · {latest.team}
          </h1>
          <p>
            Reported: {latest.reported_injury} (tier {latest.source_tier} — {LEDGER_COPY.source_tiers[latest.source_tier]}) · injury {injuryDateLabel(latest.injury_date)}
          </p>
          <p className="text-slate-400">Mechanism: {latest.mechanism}</p>
          <p className="text-xs text-slate-500">
            {LEDGER_COPY.credit} · {LEDGER_COPY.publisher}
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-bone">Forecast{versions.length > 1 ? 's' : ''}</h2>
          {[...versions].reverse().map((v) => (
            <div key={v.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                <span className="font-mono">
                  v{v.version} · {v.row_hash.slice(0, 8)} · published {new Date(v.published_at).toUTCString()}
                </span>
                <span className="flex items-center gap-3">
                  {v.commit_url && (
                    <a href={v.commit_url} className="text-signal-cyan hover:text-signal-cyan-hover" rel="noopener noreferrer" target="_blank">
                      commit
                    </a>
                  )}
                  {v.x_post_id && (
                    <a href={`https://x.com/i/web/status/${v.x_post_id}`} className="text-signal-cyan hover:text-signal-cyan-hover" rel="noopener noreferrer" target="_blank">
                      X
                    </a>
                  )}
                  {v.x_self_reply_id && (
                    <a href={`https://x.com/i/web/status/${v.x_self_reply_id}`} className="text-signal-cyan hover:text-signal-cyan-hover" rel="noopener noreferrer" target="_blank">
                      X self-reply
                    </a>
                  )}
                  {v.farcaster_hash && (
                    <a href={`https://warpcast.com/~/conversations/${v.farcaster_hash}`} className="text-signal-cyan hover:text-signal-cyan-hover" rel="noopener noreferrer" target="_blank">
                      Farcaster
                    </a>
                  )}
                  {v.reply_to_url && (
                    <a href={v.reply_to_url} className="text-signal-cyan hover:text-signal-cyan-hover" rel="noopener noreferrer" target="_blank">
                      report
                    </a>
                  )}
                </span>
              </div>
              {v.version > 1 && v.trigger && <p className="text-xs text-amber-300">Revision trigger: {v.trigger}</p>}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {LEDGER_FIELDS.map((f) => {
                  const spec = LEDGER_FIELD_SPECS[f];
                  const value =
                    f === 'F1' ? pct(v.f1_ir) : f === 'F2' ? pct(v.f2_next) : f === 'F3' ? pct(v.f3_4wk) : f === 'F4' ? f4Label(v.f4_point, v.f4_low, v.f4_high) : v.f5_reinjury == null ? 'n/a' : pct(v.f5_reinjury);
                  return (
                    <div key={f} className={`rounded border p-2 ${f === 'F4' ? 'border-slate-600 bg-slate-800/60' : 'border-slate-800 bg-slate-950'}`}>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">
                        {f} · {spec.label}
                      </div>
                      <div className={`font-mono text-bone ${f === 'F4' ? 'text-xl' : 'text-lg'}`}>{value}</div>
                    </div>
                  );
                })}
              </div>
              {v.season_ending && <p className="text-xs text-amber-300">Season-ending flag set.</p>}
              <p className="text-xs text-slate-400">What would move this: {v.what_moves_this}</p>
              <p className="text-xs text-slate-500">
                Base rate:{' '}
                <Link href={`/ledger/injury/${v.base_rate_row}`} className="text-signal-cyan hover:text-signal-cyan-hover">
                  {v.base_rate_row}
                </Link>{' '}
                ({v.base_rate_strength}) · sources:{' '}
                {v.source_urls.map((u, i) => (
                  <a key={i} href={u} className="text-signal-cyan hover:text-signal-cyan-hover" rel="noopener noreferrer" target="_blank">
                    [{i + 1}]
                  </a>
                ))}
              </p>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-bone">Resolutions</h2>
          <p className="text-xs text-slate-500">
            Each field resolves on its own from public records, is proposed by the ingest, and is locked only once the physician confirms it. A revision counts for a field only if it was published before that field&rsquo;s freeze point. Scored on the{' '}
            <Link href="/ledger/scoreboard" className="text-signal-cyan hover:text-signal-cyan-hover">
              scoreboard
            </Link>
            {rowKey && (
              <>
                {' '}and the{' '}
                <Link href={`/ledger/injury/${rowKey}`} className="text-signal-cyan hover:text-signal-cyan-hover">
                  {rowKey}
                </Link>{' '}
                page
              </>
            )}
            .
          </p>
          <ul className="space-y-2 text-xs">
            {LEDGER_FIELDS.map((f) => {
              const r = resolutions.find((x) => x.field === f);
              const status = r?.status ?? 'open';
              const ev = r && status !== 'open' ? resolutionEvidence(r) : null;
              const sc = scoring[f];
              return (
                <li key={f} className="rounded border border-slate-800 bg-slate-950 p-3 space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-slate-400">
                      {f} · {LEDGER_FIELD_SPECS[f].label}
                    </span>
                    <span className={status === 'resolved' ? 'text-emerald-300' : status === 'void' ? 'text-amber-300' : 'text-slate-400'}>
                      {status === 'resolved' && r ? `${outcomeLabel(f, r.outcome)}${r.outcome_date ? ` · ${r.outcome_date.slice(0, 10)}` : ''}` : status === 'void' ? `void · ${r?.void_reason ?? 'no reason recorded'}` : 'open'}
                    </span>
                  </div>
                  {r && status !== 'open' && (
                    <div className="font-mono text-slate-500">
                      {r.freeze_at && <>froze {etTime(r.freeze_at)} · </>}
                      {r.confirmed_at && <>confirmed {etDate(r.confirmed_at)}</>}
                      {sc?.latest_version !== undefined && <> · scored: initial v1, latest v{sc.latest_version}</>}
                      {sc?.excluded && <> · not scored: {sc.excluded}</>}
                    </div>
                  )}
                  {ev?.sentence && <blockquote className="border-l-2 border-slate-700 pl-2 text-slate-400">&ldquo;{ev.sentence}&rdquo;</blockquote>}
                  {ev?.note && <div className="text-slate-500">{ev.note}</div>}
                  {ev && ev.urls.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {ev.urls.map((u, i) => (
                        <a key={u} href={u} className="text-signal-cyan hover:text-signal-cyan-hover" rel="noopener noreferrer" target="_blank">
                          evidence{ev.urls.length > 1 ? ` [${i + 1}]` : ''}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-bone">Corrections</h2>
          {corrections.length === 0 ? (
            <p className="text-xs text-slate-500">None. Clerical corrections are logged here as separate rows; a forecast row is never edited.</p>
          ) : (
            <ul className="text-xs text-slate-400 space-y-1">
              {corrections.map((c) => {
                const linkage = linkageSummary(c);
                return (
                  <li key={c.id}>
                    <span className="font-mono text-slate-500">{etDate(c.corrected_at)}</span>{' '}
                    {linkage ? (
                      <>Linkage ids attached: {linkage}. Not part of the row hash.</>
                    ) : (
                      <>
                        {c.field}: {c.old_value ?? '—'} → {c.new_value ?? '—'}.
                      </>
                    )}{' '}
                    {c.note}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
    </>
  );
}
