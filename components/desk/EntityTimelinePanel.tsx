import { formatDistanceToNow } from 'date-fns';
import type { InjuryUpdate, UpdateKind } from '@/lib/types';

interface Props {
  updates: InjuryUpdate[];
}

function kindColor(kind: UpdateKind): string {
  switch (kind) {
    case 'CONFLICT':
      return 'bg-amber-900/60 text-amber-300 border-amber-700';
    case 'CORRECTION':
      return 'bg-red-900/50 text-red-300 border-red-800';
    case 'RESOLUTION':
      return 'bg-emerald-900/60 text-emerald-300 border-emerald-700';
    case 'DEEP_DIVE':
      return 'bg-indigo-900/60 text-indigo-300 border-indigo-700';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-600';
  }
}

// Read-only entity timeline (newest-first), backed by web_list_injury_updates.
export function EntityTimelinePanel({ updates }: Props) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Entity timeline</h3>

      {updates.length === 0 ? (
        <p className="text-xs text-slate-600">No timeline updates for this entity yet.</p>
      ) : (
        <ol className="space-y-3">
          {updates.map((u) => (
            <li key={u.id} className="border-l-2 border-slate-700 pl-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${kindColor(u.update_kind)}`}>
                  {u.update_kind}
                </span>
                {u.severity_at_time && (
                  <span className="text-[11px] text-slate-400">{u.severity_at_time}</span>
                )}
                <time className="text-[11px] text-slate-600 ml-auto">
                  {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                </time>
              </div>
              {u.description && <p className="text-xs text-slate-300 mt-1 leading-snug">{u.description}</p>}
              <div className="flex gap-3 mt-1 text-[11px] text-slate-500">
                {u.team_timeline_weeks != null && <span>team: {u.team_timeline_weeks}w</span>}
                {u.otm_min_weeks != null && <span>OTM≥ {u.otm_min_weeks}w</span>}
                {u.source_url && (
                  <a
                    href={u.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    source →
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
