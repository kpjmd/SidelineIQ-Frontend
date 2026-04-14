import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDistanceToNow, format } from 'date-fns';
import type { InjuryPost, MdReview } from '@/lib/types';
import { SportBadge } from '@/components/shared/SportBadge';
import { ContentTypeBadge } from '@/components/shared/ContentTypeBadge';
import { ReturnToPlayDisplay } from '@/components/shared/ReturnToPlayDisplay';
import { ConflictGapDisplay } from './ConflictGapDisplay';
import { MDReviewBlock } from './MDReviewBlock';
import { OrthoIQCTA } from './OrthoIQCTA';
import { markdownComponents } from '@/lib/markdown-components';
import { stripOTMAnnotations } from '@/lib/strip-otm';

interface Props {
  post: InjuryPost;
  approvedReview: MdReview | null;
}

export function DeepDivePost({ post, approvedReview }: Props) {
  const farcasterUrl = post.farcaster_hash
    ? `https://warpcast.com/~/conversations/${post.farcaster_hash}`
    : null;
  const twitterUrl = post.twitter_id
    ? `https://x.com/i/web/status/${post.twitter_id}`
    : null;

  return (
    <article className="max-w-3xl mx-auto">
      {/* Meta badges */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <ContentTypeBadge contentType={post.content_type} />
        <SportBadge sport={post.sport} />
        {approvedReview && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-400 border border-amber-700/50">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            MD Reviewed
          </span>
        )}
      </div>

      {/* Headline */}
      <h1 className="text-3xl font-black text-white mb-2 leading-tight">
        {post.headline}
      </h1>

      {/* Sub-meta */}
      <div className="flex items-center gap-3 text-sm text-slate-500 mb-6 flex-wrap">
        <span className="font-medium text-slate-400">{post.athlete_name}</span>
        <span>·</span>
        <span>{post.team}</span>
        <span>·</span>
        <span>{post.injury_type}</span>
        <span>·</span>
        <time dateTime={post.created_at} title={format(new Date(post.created_at), 'PPpp')}>
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
        </time>
        {farcasterUrl && (
          <>
            <span>·</span>
            <a href={farcasterUrl} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
              Farcaster ↗
            </a>
          </>
        )}
        {twitterUrl && (
          <>
            <span>·</span>
            <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
              X/Twitter ↗
            </a>
          </>
        )}
      </div>

      {/* ConflictGapDisplay for CONFLICT_FLAG posts or DEEP_DIVEs with conflict data */}
      {post.conflict_reason && (
        <ConflictGapDisplay
          conflict_reason={post.conflict_reason}
          team_timeline_weeks={post.team_timeline_weeks}
          return_to_play_min_weeks={post.return_to_play_min_weeks}
          return_to_play_max_weeks={post.return_to_play_max_weeks}
        />
      )}

      {/* Clinical summary markdown */}
      <div className="prose-custom">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {stripOTMAnnotations(post.clinical_summary)}
        </ReactMarkdown>
      </div>

      {/* RTP display */}
      <ReturnToPlayDisplay
        return_to_play_min_weeks={post.return_to_play_min_weeks}
        return_to_play_max_weeks={post.return_to_play_max_weeks}
        rtp_probability_week_2={post.rtp_probability_week_2}
        rtp_probability_week_4={post.rtp_probability_week_4}
        rtp_probability_week_8={post.rtp_probability_week_8}
        rtp_confidence={post.rtp_confidence}
        content_type={post.content_type}
      />

      {/* MD Review block */}
      {approvedReview && <MDReviewBlock review={approvedReview} />}

      {/* OrthoIQ CTA */}
      <OrthoIQCTA />
    </article>
  );
}
