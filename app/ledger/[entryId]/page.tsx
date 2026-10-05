import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLedgerEntry } from '@/lib/mcp';
import { BRAND_NAME } from '@/lib/brand';
import { LEDGER_COPY } from '@/lib/ledger-copy';
import { LEDGER_FIELDS, LEDGER_FIELD_SPECS } from '@/lib/ledger-fields';
import { f4Label, injuryDateLabel, pct, TIER_COLORS } from '@/lib/ledger-card';
import { isPublishedForecast, type LedgerEntryDetail, type PublishedLedgerForecast } from '@/lib/ledger-types';
import { siteUrl as resolveSite } from '@/lib/site-url';
import { Mark } from '@/components/shared/Mark';
import { Wordmark } from '@/components/shared/Wordmark';

export const revalidate = 60;

const ENTRY_ID_RE = /^PT-\d{4}-\d{3,}$/;

interface PageProps {
  params: Promise<{ entryId: string }>;
}

async function load(entryId: string): Promise<{ detail: LedgerEntryDetail; versions: PublishedLedgerForecast[] } | null> {
  if (!ENTRY_ID_RE.test(entryId)) return null;
  const detail = await getLedgerEntry(entryId);
  if (!detail) return null;
  const versions = detail.versions.filter(isPublishedForecast).sort((a, b) => a.version - b.version);
  if (versions.length === 0) return null;
  return { detail, versions };
}

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
 * resolutions, corrections, the commit and the social posts, and the full
 * disclaimer. Minimal in Stage 2 (S2-3); Stage 4 adds evidence links per
 * resolution and the per-injury-type and scoreboard pages.
 */
export default async function LedgerEntryPage({ params }: PageProps) {
  const { entryId } = await params;
  const loaded = await load(entryId);
  if (!loaded) notFound();
  const { detail, versions } = loaded;
  const latest = versions[versions.length - 1];
  const tier = TIER_COLORS[latest.source_tier];

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <Mark size={28} />
            <Wordmark className="text-xl" />
          </Link>
          <Link href="/ledger" className="font-mono text-xs tracking-[0.14em] text-slate-400 hover:text-slate-200">
            PROGNOSIS LEDGER
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm text-slate-300">
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
                  {v.farcaster_hash && (
                    <a href={`https://warpcast.com/~/conversations/${v.farcaster_hash}`} className="text-signal-cyan hover:text-signal-cyan-hover" rel="noopener noreferrer" target="_blank">
                      Farcaster
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
                Base rate: {v.base_rate_row} ({v.base_rate_strength}) · sources:{' '}
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
            {LEDGER_FIELDS.map((f) => {
              const r = detail.resolutions.find((x) => x.field === f);
              const status = r?.status ?? 'open';
              return (
                <div key={f} className="rounded border border-slate-800 bg-slate-950 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{f}</div>
                  <div className={status === 'resolved' ? 'text-emerald-300' : status === 'void' ? 'text-amber-300' : 'text-slate-400'}>
                    {status}
                    {status === 'resolved' && r?.outcome != null ? ` · ${String(r.outcome)}` : ''}
                    {status === 'void' && r?.void_reason ? ` · ${r.void_reason}` : ''}
                  </div>
                  {r?.evidence_url && (
                    <a href={r.evidence_url} className="text-signal-cyan hover:text-signal-cyan-hover" rel="noopener noreferrer" target="_blank">
                      evidence
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          {detail.corrections.length > 0 && (
            <ul className="text-xs text-slate-400 list-disc list-inside">
              {detail.corrections.map((c) => (
                <li key={c.id}>
                  Correction ({new Date(c.corrected_at).toUTCString()}): {c.field} {c.old_value ?? '—'} → {c.new_value ?? '—'}. {c.note}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="border-t border-slate-800 pt-6 space-y-2 text-xs text-slate-500">
          <p>{LEDGER_COPY.ai_disclosure}</p>
          <p>{LEDGER_COPY.full_disclaimer}</p>
          <p>{LEDGER_COPY.reliance}</p>
        </footer>
      </main>
    </div>
  );
}
