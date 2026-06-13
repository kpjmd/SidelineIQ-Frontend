import type { DeskContext } from '@/lib/types';

interface Props {
  context: DeskContext | null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-500 w-32 shrink-0">{label}</span>
      <span className="text-slate-300">{value}</span>
    </div>
  );
}

// Read-only fact-validation context drawn from the source/canonical injury post:
// correction history (legacy fact-sweep), MD-review flagging, OTM window, and
// conflict-flag data. Degrades gracefully when the canonical post is unavailable.
export function FactValidationPanel({ context }: Props) {
  const post = context?.canonicalPost ?? null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Fact validation</h3>

      {!post ? (
        <p className="text-xs text-slate-600">No source post linked to this entity yet.</p>
      ) : (
        <div className="space-y-1.5">
          <Row label="Source post" value={post.headline} />
          <Row label="Team" value={post.team} />
          <Row
            label="Corrections"
            value={
              post.correction_count && post.correction_count > 0 ? (
                <span className="text-amber-300">
                  {post.correction_count} applied
                  {post.corrected_at ? ` (last ${new Date(post.corrected_at).toLocaleDateString()})` : ''}
                </span>
              ) : (
                'none'
              )
            }
          />
          <Row
            label="MD review"
            value={
              post.md_review_required ? (
                <span className="text-amber-300">{post.md_review_reason ?? 'flagged'}</span>
              ) : (
                'not flagged'
              )
            }
          />
          {(post.return_to_play_min_weeks != null || post.return_to_play_max_weeks != null) && (
            <Row
              label="OTM window"
              value={`${post.return_to_play_min_weeks ?? '?'}–${post.return_to_play_max_weeks ?? '?'} weeks`}
            />
          )}
          {post.conflict_reason && (
            <Row
              label="Conflict flag"
              value={
                <span>
                  {post.conflict_reason}
                  {post.team_timeline_weeks != null ? ` (team: ${post.team_timeline_weeks}w)` : ''}
                </span>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
