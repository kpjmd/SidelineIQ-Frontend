import type { InjuryPost } from '@/lib/types';

type Props = Pick<
  InjuryPost,
  'conflict_reason' | 'team_timeline_weeks' | 'return_to_play_min_weeks' | 'return_to_play_max_weeks'
>;

export function ConflictGapDisplay({
  conflict_reason,
  team_timeline_weeks,
  return_to_play_min_weeks,
  return_to_play_max_weeks,
}: Props) {
  if (!conflict_reason) return null;

  const otmEstimate =
    return_to_play_min_weeks !== null && return_to_play_max_weeks !== null
      ? `${return_to_play_min_weeks}–${return_to_play_max_weeks} weeks`
      : 'See clinical summary';

  const gap =
    team_timeline_weeks !== null && return_to_play_min_weeks !== null
      ? return_to_play_min_weeks - team_timeline_weeks
      : null;

  return (
    <div className="my-6 border border-rose-700 rounded-lg overflow-hidden">
      <div className="bg-rose-950/50 px-4 py-3 border-b border-rose-800/50">
        <h3 className="text-rose-400 font-bold text-sm tracking-wide">
          🚩 OTM — Off The Mark
        </h3>
      </div>

      <div className="p-4 bg-rose-950/20 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Team timeline</span>
          <span className="text-white font-medium">
            {team_timeline_weeks !== null ? `${team_timeline_weeks} weeks` : 'Undisclosed'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">OTM clinical estimate</span>
          <span className="text-rose-400 font-medium">{otmEstimate}</span>
        </div>
        {gap !== null && (
          <div className="flex justify-between text-sm pt-2 border-t border-rose-800/30">
            <span className="text-slate-400">Gap</span>
            <span className={gap > 2 ? 'text-rose-300 font-bold' : 'text-slate-300'}>
              {gap > 0 ? `+${gap}` : gap} weeks
              {gap > 2 && ' — conflict threshold met'}
            </span>
          </div>
        )}

        {conflict_reason && (
          <p className="text-slate-400 text-sm leading-relaxed pt-2 border-t border-rose-800/30">
            {conflict_reason}
          </p>
        )}
      </div>
    </div>
  );
}
