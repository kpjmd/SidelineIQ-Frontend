import type { InjuryPost } from '@/lib/types';

type Props = Pick<
  InjuryPost,
  | 'return_to_play_min_weeks'
  | 'return_to_play_max_weeks'
  | 'rtp_probability_week_2'
  | 'rtp_probability_week_4'
  | 'rtp_probability_week_8'
  | 'rtp_confidence'
  | 'content_type'
>;

function ProbBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-14 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-700 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

export function ReturnToPlayDisplay({
  return_to_play_min_weeks,
  return_to_play_max_weeks,
  rtp_probability_week_2,
  rtp_probability_week_4,
  rtp_probability_week_8,
  rtp_confidence,
  content_type,
}: Props) {
  if (content_type !== 'DEEP_DIVE') return null;
  if (return_to_play_min_weeks === null && return_to_play_max_weeks === null) return null;

  const hasProbs =
    rtp_probability_week_2 !== null ||
    rtp_probability_week_4 !== null ||
    rtp_probability_week_8 !== null;

  return (
    <div className="mt-6 p-4 bg-slate-800/60 rounded-lg border border-slate-700">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Return-to-Play Estimate
      </h3>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-bold text-white">
          {return_to_play_min_weeks}–{return_to_play_max_weeks}
        </span>
        <span className="text-slate-400 text-sm">weeks</span>
        {rtp_confidence !== null && (
          <span className="ml-auto text-xs text-slate-500">
            Confidence: {Math.round(rtp_confidence * 100)}%
          </span>
        )}
      </div>

      {hasProbs && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 mb-2">RTP probability by week</p>
          {rtp_probability_week_2 !== null && (
            <ProbBar value={rtp_probability_week_2} label="Week 2" />
          )}
          {rtp_probability_week_4 !== null && (
            <ProbBar value={rtp_probability_week_4} label="Week 4" />
          )}
          {rtp_probability_week_8 !== null && (
            <ProbBar value={rtp_probability_week_8} label="Week 8" />
          )}
        </div>
      )}
    </div>
  );
}
