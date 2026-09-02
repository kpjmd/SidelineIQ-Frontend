import type { InjuryPost } from '@/lib/types';
import { describePostConflictGap } from '@/lib/conflict-gap-display';

type Props = Pick<
  InjuryPost,
  | 'conflict_reason'
  | 'team_timeline_weeks'
  | 'return_to_play_min_weeks'
  | 'return_to_play_max_weeks'
  | 'injury_date'
  | 'created_at'
>;

export function ConflictGapDisplay({
  conflict_reason,
  team_timeline_weeks,
  return_to_play_min_weeks,
  return_to_play_max_weeks,
  injury_date,
  created_at,
}: Props) {
  if (!conflict_reason) return null;

  const otmEstimate =
    return_to_play_min_weeks !== null && return_to_play_max_weeks !== null
      ? `${return_to_play_min_weeks}–${return_to_play_max_weeks} weeks`
      : 'See clinical summary';

  // The team's number is weeks REMAINING from the report; the OTM window is
  // TOTAL from the injury date. This used to render `min - team`, which is off
  // by the elapsed time since the injury — Nick Bosa, 49 weeks post-ACL with
  // one week to go, showed "+38 weeks" for a return inside the window.
  const { label, tone, gap } = describePostConflictGap({
    team_timeline_weeks,
    return_to_play_min_weeks,
    return_to_play_max_weeks,
    injury_date,
    created_at,
  });
  const anchored = gap.elapsed_weeks !== null && gap.team_total_weeks !== null;

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
            {team_timeline_weeks !== null
              ? `${team_timeline_weeks} weeks remaining, as reported`
              : 'Undisclosed'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">OTM clinical estimate</span>
          <span className="text-rose-400 font-medium">{otmEstimate} from injury</span>
        </div>
        {anchored && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Elapsed at report</span>
              <span className="text-slate-300">{gap.elapsed_weeks} weeks</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Team-implied total</span>
              <span className="text-slate-300">{gap.team_total_weeks} weeks from injury</span>
            </div>
          </>
        )}
        <div className="flex justify-between text-sm pt-2 border-t border-rose-800/30">
          <span className="text-slate-400">Gap</span>
          <span
            className={
              tone === 'conflict'
                ? 'text-rose-300 font-bold text-right'
                : 'text-slate-300 text-right'
            }
          >
            {label}
          </span>
        </div>

        {conflict_reason && (
          <p className="text-slate-400 text-sm leading-relaxed pt-2 border-t border-rose-800/30">
            {conflict_reason}
          </p>
        )}
      </div>
    </div>
  );
}
