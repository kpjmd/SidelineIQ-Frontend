import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/lib/mcp';
import { isPubliclyViewable } from '@/lib/types';
import { ogCardFor, OG_SITE_NAME } from '@/lib/og-card';
import { rebrandPost } from '@/lib/brand';
import { BRAND_COLORS } from '@/lib/brand-visual';
import { brandFonts, OgFooter, OgMark, OgWordmark } from '@/lib/og-render';
import { siteHost } from '@/lib/site-url';

// Every link shared before this rendered as a bare `summary` card with no image.
// Text only, by design — see lib/og-card.ts for why no clinical figures appear.

export const revalidate = 60;
export const alt = `${OG_SITE_NAME} injury analysis`;
// `size` is a literal, not the imported OG_SIZE constant: Next reads route
// segment config STATICALLY, so a value it has to follow through an import is not
// guaranteed to be picked up, and the failure mode is a card with no declared
// dimensions rather than a build error.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  // Same gate as the page, and it has to stay the same one: a card is a second
  // public surface on the same row, and an unapproved post that 404s as a page
  // while rendering as a shareable PNG has not been withheld from anybody.
  if (!post || !isPubliclyViewable(post.status)) {
    return new Response('Not found', { status: 404 });
  }

  const card = ogCardFor(rebrandPost(post));
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
          // The category colour on the top rule as well as the eyebrow, so the
          // post type is legible in a muted timeline thumbnail where the text is
          // too small to read. The kit's rule.
          borderTop: `14px solid ${card.accent}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 32,
              background: BRAND_COLORS.panel,
            }}
          >
            <OgMark size={44} />
          </div>
          <OgWordmark name={card.siteName} fontSize={34} />
          <div
            style={{
              display: 'flex',
              marginLeft: 'auto',
              fontFamily: 'IBM Plex Mono',
              fontSize: 22,
              letterSpacing: 2.6,
              background: card.accent,
              color: card.ink,
              borderRadius: 2,
              padding: '10px 16px',
            }}
          >
            {card.eyebrow}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: card.headlineSize,
            fontWeight: 700,
            letterSpacing: -0.025 * card.headlineSize,
            lineHeight: 1.12,
            color: BRAND_COLORS.bone,
          }}
        >
          {card.headline}
        </div>

        <OgFooter left={`${siteHost()} · ${card.tagline}`} />
      </div>
    ),
    { ...size, fonts },
  );
}
