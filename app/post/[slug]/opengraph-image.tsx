import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/lib/mcp';
import { isPubliclyViewable } from '@/lib/types';
import { ogCardFor, OG_SITE_NAME } from '@/lib/og-card';
import { rebrandPost } from '@/lib/brand';

// Every link shared before this rendered as a bare `summary` card with no image.
// Text only, by design — see lib/og-card.ts for why no clinical figures appear.

export const revalidate = 60;
export const alt = `${OG_SITE_NAME} injury analysis`;
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

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#020617',
          color: '#ffffff',
          padding: '64px 72px',
          borderTop: `12px solid ${card.accent}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            letterSpacing: 2,
            color: card.accent,
          }}
        >
          {card.eyebrow}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: card.headlineSize,
            lineHeight: 1.15,
            color: '#f8fafc',
          }}
        >
          {card.headline}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderTop: '1px solid #334155',
            paddingTop: 28,
          }}
        >
          <div style={{ display: 'flex', fontSize: 40, color: '#ffffff' }}>{card.siteName}</div>
          <div style={{ display: 'flex', fontSize: 26, color: '#94a3b8' }}>{card.tagline}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
