'use client';

import type { DeskSource } from '@/lib/types';
import { countValidSources, isHttpUrl } from '@/lib/desk-sources';

interface Props {
  sources: DeskSource[];
  locked: boolean;
  onChange: (sources: DeskSource[]) => void;
}

const inputCls =
  'w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500 disabled:opacity-60';

// The public reporting the commentary rests on. The content linter blocks publish
// without it (missing_source_attribution), and section prose cannot carry links
// because kpjmd escapes it — so this is the one place attribution is entered.
// It ships in the handoff JSON's _sideline block as provenance; the kpjmd page
// does not render it today.
export function SourcesEditor({ sources, locked, onChange }: Props) {
  const valid = countValidSources(sources);

  function setRow(i: number, patch: Partial<DeskSource>) {
    onChange(sources.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  return (
    <div className="border border-slate-800 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-300">
          Sources{' '}
          <span className={valid === 0 ? 'font-normal text-amber-500' : 'font-normal text-slate-600'}>
            — {valid === 0 ? 'none yet; publish is blocked without one' : `${valid} cited`}
          </span>
        </div>
        {!locked && (
          <button
            type="button"
            onClick={() => onChange([...sources, { label: '', url: '' }])}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            + Add
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        The public reports this analysis is based on (outlet, link). Not shown in the section prose.
      </p>
      {sources.map((s, i) => {
        const bad = s.url.trim() !== '' && !isHttpUrl(s.url);
        return (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={s.label}
              onChange={(e) => setRow(i, { label: e.target.value })}
              disabled={locked}
              placeholder="Outlet or reporter"
              aria-label={`Source ${i + 1} label`}
              className={`${inputCls} sm:w-1/3`}
            />
            <input
              type="url"
              value={s.url}
              onChange={(e) => setRow(i, { url: e.target.value })}
              disabled={locked}
              placeholder="https://…"
              aria-label={`Source ${i + 1} URL`}
              aria-invalid={bad}
              className={`${inputCls} ${bad ? 'border-red-700' : ''}`}
            />
            {!locked && (
              <button
                type="button"
                onClick={() => onChange(sources.filter((_, idx) => idx !== i))}
                className="text-xs text-slate-500 hover:text-red-400 px-2 shrink-0"
                aria-label={`Remove source ${i + 1}`}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
      {sources.some((s) => s.url.trim() !== '' && !isHttpUrl(s.url)) && (
        <p className="text-xs text-red-400">A source URL must start with http:// or https://.</p>
      )}
    </div>
  );
}
