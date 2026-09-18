import type { InjuryPost } from '@/lib/types';
import { describePostConflictGap } from '@/lib/conflict-gap-display';
import { BRAND_NAME } from '@/lib/brand';
import { BRAND_COLORS } from '@/lib/brand-visual';

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
    <div
      className="my-6 border rounded-lg overflow-hidden"
      style={{ borderColor: BRAND_COLORS.conflictRed }}
    >
      <div
        className="px-4 py-3 border-b"
        style={{ backgroundColor: BRAND_COLORS.conflictRed, borderColor: BRAND_COLORS.conflictRed }}
      >
        <h3
          className="font-mono text-sm font-semibold tracking-[0.12em]"
          style={{ color: BRAND_COLORS.inkOnRed }}
        >
          ⚑ Off The Mark
        </h3>
      </div>

      <div className="p-4 bg-inset space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Team timeline</span>
          <span className="text-bone font-medium">
            {team_timeline_weeks !== null
              ? `${team_timeline_weeks} weeks remaining, as reported`
              : 'Undisclosed'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">{BRAND_NAME} clinical estimate</span>
          <span className="font-medium" style={{ color: BRAND_COLORS.conflictRed }}>
            {otmEstimate} from injury
          </span>
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
        <div className="flex justify-between text-sm pt-2 border-t border-slate-700">
          <span className="text-slate-400">Gap</span>
          <span
            className={tone === 'conflict' ? 'font-bold text-right' : 'text-slate-300 text-right'}
            style={tone === 'conflict' ? { color: BRAND_COLORS.conflictRed } : undefined}
          >
            {label}
          </span>
        </div>

        {conflict_reason && (
          <p className="text-slate-400 text-sm leading-relaxed pt-2 border-t border-slate-700">
            {conflict_reason}
          </p>
        )}
      </div>
    </div>
  );
}
