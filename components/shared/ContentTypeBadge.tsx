/**
 * The content-type badge, in the kit's form: solid fill, mono caps, 2px corners.
 *
 * Colours come from CONTENT_TYPE_STYLES and nowhere else. They used to live here
 * as Tailwind utility strings, in the feed cards' left accents, in
 * ConflictFlagCard's hand-rolled header and in lib/og-card.ts — five copies,
 * already drifted.
 *
 * The kit's assignment is not the one this repo shipped before: BREAKING is
 * amber, not red, and Conflict Red is reserved for CONFLICT_FLAG alone.
 */
import type { ContentType } from '@/lib/types';
import { BADGE_CLASS, CONTENT_TYPE_STYLES } from '@/lib/brand-visual';

export function ContentTypeBadge({ contentType }: { contentType: ContentType }) {
  const style = CONTENT_TYPE_STYLES[contentType];
  if (!style) return null;
  return (
    <span className={BADGE_CLASS} style={{ backgroundColor: style.fill, color: style.ink }}>
      {/* The kit prefixes Conflict Flag with U+2691. It is added in markup, not
          baked into `label`, because the OG card renders the same label through
          next/og, which fetches emoji glyphs from a CDN at render time. */}
      {contentType === 'CONFLICT_FLAG' ? '⚑ ' : ''}
      {style.label}
    </span>
  );
}
