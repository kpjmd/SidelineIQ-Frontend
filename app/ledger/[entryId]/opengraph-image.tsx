import { ImageResponse } from 'next/og';
import { getLedgerEntry } from '@/lib/mcp';
import { isPublishedForecast } from '@/lib/ledger-types';
import { ledgerRowHash } from '@/lib/ledger-row-hash';
import { cardModelFor } from '@/lib/ledger-card';
import { BRAND_COLORS } from '@/lib/brand-visual';
import { brandFonts, OgMark, OgWordmark } from '@/lib/og-render';

/**
 * The ledger card (spec "Card content spec", "X layout"): the five numbers are
 * the image, F4 dominant, the same positions on every card, the disclaimer
 * strip full-width at the bottom, id · version · hash8, the physician credit on
 * the image itself. This is what X and Farcaster unfurl from the entry URL.
 *
 * This card MAY carry numbers, unlike app/post/[slug]/opengraph-image.tsx: a
 * ledger row is immutable and hash-stamped, so a cached card is the record, not
 * a stale copy. The hash is re-derived with the twin before anything is drawn;
 * a row whose stored hash does not match renders nothing.
 */
export const revalidate = 60;
export const alt = 'ParatrOs Prognosis Ledger forecast card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  if (!/^PT-\d{4}-\d{3,}$/.test(entryId)) return new Response('Not found', { status: 404 });
  const detail = await getLedgerEntry(entryId).catch(() => null);
  const versions = detail?.versions.filter(isPublishedForecast).sort((a, b) => a.version - b.version) ?? [];
  const row = versions[versions.length - 1];
  if (!row) return new Response('Not found', { status: 404 });
  let derived: string | null = null;
  try {
    derived = ledgerRowHash(row);
  } catch {
    derived = null;
  }
  if (derived !== row.row_hash) {
    console.error(`[Ledger] card refused for ${row.entry_id} v${row.version}: stored row_hash does not re-derive`);
    return new Response('Not found', { status: 404 });
  }

  const card = cardModelFor(row);
  const fonts = await brandFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BRAND_COLORS.navy,
          color: BRAND_COLORS.bone,
          fontFamily: 'Archivo',
          padding: '40px 56px 32px',
          borderTop: `14px solid ${card.tier.fill}`,
        }}
      >
        {/* Header: mark, wordmark, tier chip right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 26, background: BRAND_COLORS.panel }}>
            <OgMark size={36} />
          </div>
          <OgWordmark name="ParatrOs" fontSize={28} />
          <div style={{ display: 'flex', fontFamily: 'IBM Plex Mono', fontSize: 18, letterSpacing: 2.4, color: BRAND_COLORS.mutedLabel, marginLeft: 12 }}>PROGNOSIS LEDGER</div>
          <div style={{ display: 'flex', marginLeft: 'auto', fontFamily: 'IBM Plex Mono', fontSize: 20, letterSpacing: 2.4, background: card.tier.fill, color: card.tier.ink, borderRadius: 2, padding: '8px 14px' }}>
            {card.tier.label}
          </div>
        </div>

        {/* Per-injury header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: -1, lineHeight: 1.1 }}>{card.header}</div>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 500, color: BRAND_COLORS.bodySecondary }}>{card.reported}</div>
          {card.revision ? <div style={{ display: 'flex', fontSize: 20, color: BRAND_COLORS.alertAmber }}>{card.revision}</div> : null}
        </div>

        {/* Forecast block: five tiles, fixed order, F4 dominant */}
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          {card.tiles.map((t) => (
            <div
              key={t.field}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                flexGrow: t.dominant ? 1.6 : 1,
                flexBasis: 0,
                background: t.dominant ? BRAND_COLORS.panel : BRAND_COLORS.inset,
                border: `1px solid ${t.dominant ? card.tier.fill : BRAND_COLORS.cardBorder}`,
                borderRadius: 4,
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', fontFamily: 'IBM Plex Mono', fontSize: 15, letterSpacing: 1.8, color: BRAND_COLORS.mutedLabel }}>
                {t.field} · {t.label.toUpperCase()}
              </div>
              <div style={{ display: 'flex', fontSize: t.dominant ? 64 : 44, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.05, marginTop: 4 }}>{t.value}</div>
              {t.dominant ? <div style={{ display: 'flex', fontSize: 14, color: BRAND_COLORS.mutedLabel, fontFamily: 'IBM Plex Mono' }}>point (80% interval), games</div> : null}
            </div>
          ))}
        </div>

        {/* Mechanism + what moves this */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
          <div style={{ display: 'flex', fontSize: 19, color: BRAND_COLORS.bodyInk }}>{card.mechanism}</div>
          <div style={{ display: 'flex', fontSize: 19, color: BRAND_COLORS.bodySecondary }}>{card.whatMovesThis}</div>
        </div>

        {/* Credit row + provenance */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 700 }}>{card.credit}</div>
            <div style={{ display: 'flex', fontSize: 15, color: BRAND_COLORS.mutedLabel }}>
              {card.publisher} · {card.aiDisclosure}
            </div>
          </div>
          <div style={{ display: 'flex', fontFamily: 'IBM Plex Mono', fontSize: 20, letterSpacing: 1.6, color: BRAND_COLORS.monoMeta }}>{card.provenance}</div>
        </div>

        {/* Disclaimer strip, full width, part of the frame */}
        <div style={{ display: 'flex', borderTop: `1px solid ${BRAND_COLORS.cardBorder}`, paddingTop: 10, fontSize: 13, lineHeight: 1.3, color: BRAND_COLORS.mutedLabel }}>
          {card.disclaimer}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
