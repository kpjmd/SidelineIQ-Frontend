import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { InjuryPost } from '@/lib/types';
import { SportBadge } from '@/components/shared/SportBadge';
import { OTMSignature } from '@/components/shared/OTMSignature';

export function ConflictFlagCard({ post }: { post: InjuryPost }) {
  const slug = post.slug ?? post.id;

  const otmEstimate =
    post.return_to_play_min_weeks !== null && post.return_to_play_max_weeks !== null
      ? `${post.return_to_play_min_weeks}–${post.return_to_play_max_weeks} weeks`
      : 'See full report';

  const gap =
    post.team_timeline_weeks !== null && post.return_to_play_min_weeks !== null
      ? post.return_to_play_min_weeks - post.team_timeline_weeks
      : null;

  return (
    <article className="bg-slate-900 border-2 border-rose-800 rounded-lg overflow-hidden hover:border-rose-700 transition-colors">
      <Link href={`/post/${slug}`} className="block p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-rose-400 font-black text-sm tracking-wide">
            🚩 OTM CONFLICT FLAG
          </span>
          <SportBadge sport={post.sport} />
          <time className="ml-auto text-xs text-slate-500">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </time>
        </div>

        <h2 className="text-xl font-bold text-white mb-3 leading-tight">
          {post.athlete_name}
        </h2>

        <div className="bg-rose-950/40 border border-rose-800/50 rounded-md p-3 mb-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Team timeline</span>
            <span className="text-white font-medium">
              {post.team_timeline_weeks !== null ? `${post.team_timeline_weeks} weeks` : 'Undisclosed'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">OTM estimate</span>
            <span className="text-rose-400 font-medium">{otmEstimate}</span>
          </div>
          {gap !== null && gap > 2 && (
            <div className="flex justify-between pt-1 border-t border-rose-800/30">
              <span className="text-slate-400">Discrepancy</span>
              <span className="text-rose-300 font-bold">&gt;2 weeks — conflict threshold met</span>
            </div>
          )}
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
        <OTMSignature />
      </div>
    </article>
  );
}
