import { ImageResponse } from 'next/og';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { BRAND_COLORS } from '@/lib/brand-visual';
import { brandFonts, OgFooter, OgMark, OgWordmark } from '@/lib/og-render';
import { siteHost } from '@/lib/site-url';

/**
 * The site card, for every page that is not a post — the homepage, /privacy,
 * /not-found, and any future page.
 *
 * There was none. layout.tsx sets no `openGraph` block and only
 * app/post/[slug]/ had a generator, so the front page of a physician-branded
 * platform shared as a bare text card with no image. File-based metadata means
 * this is picked up automatically and inherited by every route that does not
 * define its own.
 *
 * Static content, so it renders once and is cached rather than revalidated.
 */
export const alt = `${BRAND_NAME} — ${BRAND_TAGLINE}`;
// `size` is a literal, not the imported OG_SIZE constant: Next reads route
// segment config STATICALLY, so a value it has to follow through an import is not
// guaranteed to be picked up, and the failure mode is a card with no declared
// dimensions rather than a build error.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const LEAGUES = 'NFL · NBA · PREMIER LEAGUE · UFC';

export default async function Image() {
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
          padding: '58px 68px',
          borderTop: `14px solid ${BRAND_COLORS.signalCyan}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 76,
              height: 76,
              borderRadius: 38,
              background: BRAND_COLORS.panel,
            }}
          >
            <OgMark size={52} />
          </div>
          <OgWordmark name={BRAND_NAME} fontSize={44} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'IBM Plex Mono',
              fontSize: 24,
              letterSpacing: 4,
              color: BRAND_COLORS.signalCyan,
            }}
          >
            INJURY INTELLIGENCE
          </div>
          {/* The kit's banner line. Two flex rows rather than a <br />: satori
              lays out flex children, and a line break inside one text node is
              not guaranteed to break where the design wants it. */}
          <div style={{ display: 'flex', flexDirection: 'column', fontWeight: 700, fontSize: 68, lineHeight: 1.1, letterSpacing: -1.7 }}>
            <div style={{ display: 'flex' }}>Clinical reads on every</div>
            <div style={{ display: 'flex' }}>injury that moves a line.</div>
          </div>
          <div
            style={{
              display: 'flex',
              fontFamily: 'IBM Plex Mono',
              fontSize: 22,
              letterSpacing: 3,
              color: BRAND_COLORS.monoMeta,
            }}
          >
            {LEAGUES}
          </div>
        </div>

        <OgFooter left={`${siteHost()} · ${BRAND_TAGLINE}`} />
      </div>
    ),
    { ...size, fonts },
  );
}
