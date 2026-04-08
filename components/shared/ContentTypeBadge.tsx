import type { ContentType } from '@/lib/types';

const TYPE_CONFIG: Record<ContentType, { label: string; className: string }> = {
  BREAKING: { label: 'BREAKING', className: 'bg-red-900/70 text-red-300 border-red-600' },
  TRACKING: { label: 'TRACKING', className: 'bg-amber-900/70 text-amber-300 border-amber-600' },
  DEEP_DIVE: { label: 'DEEP DIVE', className: 'bg-blue-900/70 text-blue-300 border-blue-600' },
  CONFLICT_FLAG: { label: '🚩 CONFLICT FLAG', className: 'bg-rose-900/70 text-rose-300 border-rose-600' },
};

export function ContentTypeBadge({ contentType }: { contentType: ContentType }) {
  const config = TYPE_CONFIG[contentType];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${config.className}`}>
      {config.label}
    </span>
  );
}
