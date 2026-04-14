import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { InjuryPost } from '@/lib/types';
import { SportBadge } from '@/components/shared/SportBadge';
import { ContentTypeBadge } from '@/components/shared/ContentTypeBadge';
import { OTMSignature } from '@/components/shared/OTMSignature';
import { stripForPreview } from '@/lib/strip-otm';

export function TrackingCard({ post }: { post: InjuryPost }) {
  const preview = stripForPreview(post.clinical_summary).slice(0, 200);
  const slug = post.slug ?? post.id;

  return (
    <article className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors border-l-4 border-l-amber-500">
      <Link href={`/post/${slug}`} className="block p-5">
        <div className="flex items-center gap-2 mb-3">
          <ContentTypeBadge contentType="TRACKING" />
          <SportBadge sport={post.sport} />
          <time className="ml-auto text-xs text-slate-500">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </time>
        </div>

        <h2 className="text-xl font-bold text-white mb-1 leading-tight">
          {post.athlete_name}
        </h2>
        <p className="text-amber-400 font-medium text-sm mb-3">
          {post.headline}
        </p>

        <p className="text-slate-400 text-sm leading-relaxed line-clamp-3">
          {preview}
          {post.clinical_summary.length > 200 ? '…' : ''}
        </p>

        <div className="mt-3 text-xs text-slate-500 font-medium">
          {post.team}
        </div>
      </Link>

      {post.parent_post_id && (
        <div className="px-5 pb-2">
          <Link
            href={`/post/${post.parent_post_id}`}
            className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
          >
            See original report →
          </Link>
        </div>
      )}

      <div className="px-5 pb-4">
        {(post.farcaster_hash || post.twitter_id) && (
          <div className="flex gap-3 mb-2 text-xs text-slate-500">
            {post.farcaster_hash && (
              <a
                href={`https://warpcast.com/~/conversations/${post.farcaster_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-purple-400 transition-colors"
              >
                Farcaster ↗
              </a>
            )}
            {post.twitter_id && (
              <a
                href={`https://x.com/i/web/status/${post.twitter_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sky-400 transition-colors"
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
