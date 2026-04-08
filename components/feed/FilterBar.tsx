'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { Sport, ContentType } from '@/lib/types';

const SPORTS: { value: Sport | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'NFL', label: 'NFL' },
  { value: 'NBA', label: 'NBA' },
  { value: 'PREMIER_LEAGUE', label: 'PL' },
  { value: 'UFC', label: 'UFC' },
];

const CONTENT_TYPES: { value: ContentType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'BREAKING', label: 'Breaking' },
  { value: 'TRACKING', label: 'Tracking' },
  { value: 'DEEP_DIVE', label: 'Deep Dive' },
  { value: 'CONFLICT_FLAG', label: '🚩 Conflict Flag' },
];

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSport = (searchParams.get('sport') as Sport | null) ?? 'ALL';
  const currentType = (searchParams.get('type') as ContentType | null) ?? 'ALL';

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'ALL') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-3">
      {/* Sport tabs */}
      <div className="flex gap-1 flex-wrap">
        {SPORTS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => updateFilter('sport', value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              currentSport === value
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content type pills */}
      <div className="flex gap-1 flex-wrap">
        {CONTENT_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => updateFilter('type', value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              currentType === value
                ? 'bg-slate-700 text-white border-slate-600'
                : 'text-slate-500 hover:text-slate-400 border-slate-700 hover:border-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
