import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { InjuryPost } from '@/lib/types';
import { SportBadge } from '@/components/shared/SportBadge';
import { OTMSignature } from '@/components/shared/OTMSignature';
import { describePostConflictGap } from '@/lib/conflict-gap-display';
import { BRAND_NAME } from '@/lib/brand';
import { ContentTypeBadge } from '@/components/shared/ContentTypeBadge';
import { BRAND_COLORS } from '@/lib/brand-visual';

export function ConflictFlagCard({ post }: { post: InjuryPost }) {
  const slug = post.slug ?? post.id;

  const otmEstimate =
    post.return_to_play_min_weeks !== null && post.return_to_play_max_weeks !== null
      ? `${post.return_to_play_min_weeks}–${post.return_to_play_max_weeks} weeks`
      : 'See full report';

  // `min - team` subtracted a remaining-weeks figure from a total-from-injury
  // one, so the discrepancy GREW on its own as an injury aged, with no data
  // change — a post correctly under threshold at publication would silently
  // start asserting a clinical conflict weeks later.
  const { label, tone } = describePostConflictGap(post);

  return (
    // Conflict Red is the one saturated red in the system and the kit reserves
    // it for exactly this. A 2px border rather than the other cards' left rule:
    // a contradiction is the loudest thing the platform publishes.
    <article
      className="bg-slate-900 border-2 rounded-lg overflow-hidden transition-colors"
      style={{ borderColor: BRAND_COLORS.conflictRed }}
    >
      <Link href={`/post/${slug}`} className="block p-5">
        <div className="flex items-center gap-2 mb-3">
          <ContentTypeBadge contentType="CONFLICT_FLAG" />
          <SportBadge sport={post.sport} />
          <time className="ml-auto text-xs text-slate-500">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </time>
        </div>

        <h2 className="text-xl font-bold text-bone mb-3 leading-tight">
          {post.athlete_name}
        </h2>

        <div className="bg-inset border border-slate-700 rounded-md p-3 mb-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Team timeline</span>
            <span className="text-bone font-medium">
              {post.team_timeline_weeks !== null
                ? `${post.team_timeline_weeks} weeks remaining`
                : 'Undisclosed'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{BRAND_NAME} estimate</span>
            <span className="font-medium" style={{ color: BRAND_COLORS.conflictRed }}>
              {otmEstimate}
            </span>
          </div>
          {/* Shown for every status, not only above threshold: a card that
              printed nothing when the gap was uncomputable was indistinguishable
              from one where the timelines agreed. */}
          <div className="flex justify-between pt-1 border-t border-slate-700">
            <span className="text-slate-400">Discrepancy</span>
            <span
              className={tone === 'conflict' ? 'font-bold text-right' : 'text-slate-400 text-right'}
              style={tone === 'conflict' ? { color: BRAND_COLORS.conflictRed } : undefined}
            >
              {label}
            </span>
          </div>
        </div>

        {post.conflict_reason && (
          <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">
            {post.conflict_reason}
          </p>
        )}

        <div className="mt-3 text-xs text-slate-500 font-medium">
          {post.team}
        </div>
      </Link>
      <div className="px-5 pb-4">
        {(post.farcaster_hash || post.twitter_id) && (
          <div className="flex gap-3 mb-2 text-xs text-slate-500">
            {post.farcaster_hash && (
              <a
                href={`https://warpcast.com/~/conversations/${post.farcaster_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-signal-cyan transition-colors"
              >
                Farcaster ↗
              </a>
            )}
            {post.twitter_id && (
              <a
                href={`https://x.com/i/web/status/${post.twitter_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-signal-cyan transition-colors"
              >
                X ↗
              </a>
            )}
          </div>
        )}
        <OTMSignature />
      </div>
    </article>
  );
}
