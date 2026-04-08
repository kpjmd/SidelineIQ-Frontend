import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { InjuryPost } from '@/lib/types';
import { SportBadge } from '@/components/shared/SportBadge';
import { ContentTypeBadge } from '@/components/shared/ContentTypeBadge';
import { OTMSignature } from '@/components/shared/OTMSignature';

export function DeepDiveCard({ post }: { post: InjuryPost }) {
  const preview = post.clinical_summary.slice(0, 300).replace(/[#*_`]/g, '').trim();
  const slug = post.slug ?? post.id;

  const isMdReviewed =
    post.status === 'PUBLISHED' && post.md_review_required;

  const rtpLabel =
    post.return_to_play_min_weeks !== null && post.return_to_play_max_weeks !== null
      ? `RTP: ${post.return_to_play_min_weeks}–${post.return_to_play_max_weeks} weeks`
      : null;

  return (
    <article className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors border-l-4 border-l-blue-500">
      <Link href={`/post/${slug}`} className="block p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <ContentTypeBadge contentType="DEEP_DIVE" />
          <SportBadge sport={post.sport} />
          {isMdReviewed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-400 border border-amber-700/50">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              MD Reviewed
            </span>
          )}
          <time className="ml-auto text-xs text-slate-500">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </time>
        </div>

        <h2 className="text-xl font-bold text-white mb-1 leading-tight">
          {post.athlete_name}
        </h2>
        <p className="text-blue-400 font-medium text-sm mb-1">{post.injury_type}</p>

        {rtpLabel && (
          <p className="text-slate-400 text-xs mb-3 font-medium">{rtpLabel}</p>
        )}

        <p className="text-slate-400 text-sm leading-relaxed line-clamp-4">
          {preview}
          {post.clinical_summary.length > 300 ? '…' : ''}
        </p>

        <div className="mt-3 text-xs text-slate-500 font-medium">
          {post.team}
        </div>
      </Link>
      <div className="px-5 pb-4">
        <OTMSignature />
      </div>
    </article>
  );
}
