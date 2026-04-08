import type { Sport } from '@/lib/types';

const SPORT_CONFIG: Record<Sport, { label: string; className: string }> = {
  NFL: { label: 'NFL', className: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  NBA: { label: 'NBA', className: 'bg-orange-900/60 text-orange-300 border-orange-700' },
  PREMIER_LEAGUE: { label: 'PL', className: 'bg-purple-900/60 text-purple-300 border-purple-700' },
  UFC: { label: 'UFC', className: 'bg-red-900/60 text-red-300 border-red-700' },
  OTHER: { label: 'OTHER', className: 'bg-slate-800 text-slate-400 border-slate-600' },
};

export function SportBadge({ sport }: { sport: Sport }) {
  const config = SPORT_CONFIG[sport] ?? SPORT_CONFIG.OTHER;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${config.className}`}>
      {config.label}
    </span>
  );
}
