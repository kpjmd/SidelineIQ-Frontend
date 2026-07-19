'use client';

import { useState } from 'react';
import type { DeskFaq, DeskMeta } from '@/lib/types';

interface Props {
  meta: DeskMeta;
  locked: boolean;
  onChange: (meta: DeskMeta) => void;
}

// Keys of TOOL_DESTINATIONS in KPJMD-website/scripts/build-injury-desk.js. An
// unknown key silently drops the "If This Were You" CTA, so this is a select
// rather than a free-text field. Keep in sync by hand — the repos share no package.
const RELEVANT_TOOLS = [
  'acl',
  'achilles',
  'ankle',
  'hamstring',
  'hip',
  'knee',
  'meniscus',
  'regenerative',
  'shoulder',
] as const;

const inputCls =
  'w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500 disabled:opacity-60';

// kpjmd's optional fields. Authored here so the downloaded JSON drops straight
// into content/injury-desk/published/ with no hand-editing — the whole point of
// the end-to-end handoff.
//
// Collapsed by default: on most posts the seven sections are the work and these
// are a quick pass at the end.
export function MetaEditor({ meta, locked, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function set<K extends keyof DeskMeta>(key: K, value: DeskMeta[K]) {
    const next = { ...meta };
    // Drop empty optionals rather than storing '': the handoff omits empty
    // values, and keeping them would churn the content hash for no content change.
    if (value === '' || value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  }

  const faqs = meta.faqs ?? [];
  function setFaq(i: number, patch: Partial<DeskFaq>) {
    const next = faqs.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    set('faqs', next);
  }

  const cf = meta.conflict_flag;
  function setConflict(patch: Partial<NonNullable<DeskMeta['conflict_flag']>>) {
    const next = { team_timeline: '', otm_range: '', rationale: '', ...cf, ...patch };
    // All three blank → drop the whole aside rather than rendering an empty one.
    if (!next.team_timeline && !next.otm_range && !next.rationale) {
      const clone = { ...meta };
      delete clone.conflict_flag;
      onChange(clone);
      return;
    }
    set('conflict_flag', next);
  }

  const filledCount = [
    meta.short_title,
    meta.player,
    meta.meta_description,
    meta.treatment_heading,
    meta.relevant_tool,
    meta.conflict_flag,
    faqs.length > 0 ? 'y' : '',
  ].filter(Boolean).length;

  return (
    <div className="border border-slate-800 rounded">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-900"
      >
        <span className="font-semibold">Page metadata</span>
        <span className="text-slate-500">
          {filledCount > 0 ? `${filledCount} set` : 'none set'} {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            These ship in the downloaded JSON so it needs no hand-editing. They are covered by the
            content hash — changing one after attesting reopens the publish gate.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Short title <span className="text-slate-600">— breadcrumb label</span>
              </label>
              <input
                type="text"
                value={meta.short_title ?? ''}
                onChange={(e) => set('short_title', e.target.value)}
                disabled={locked}
                placeholder="Jayson Tatum · Achilles"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Player <span className="text-slate-600">— defaults to the linked athlete</span>
              </label>
              <input
                type="text"
                value={meta.player ?? ''}
                onChange={(e) => set('player', e.target.value)}
                disabled={locked}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Treatment heading <span className="text-slate-600">— default &quot;The Treatment&quot;</span>
              </label>
              <input
                type="text"
                value={meta.treatment_heading ?? ''}
                onChange={(e) => set('treatment_heading', e.target.value)}
                disabled={locked}
                placeholder="The Repair"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Relevant tool <span className="text-slate-600">— the &quot;If This Were You&quot; CTA</span>
              </label>
              <select
                value={meta.relevant_tool ?? ''}
                onChange={(e) => set('relevant_tool', e.target.value)}
                disabled={locked}
                className={inputCls}
              >
                <option value="">(default — Ask AequOs)</option>
                {RELEVANT_TOOLS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Meta description{' '}
              <span className={meta.meta_description && meta.meta_description.length > 160 ? 'text-amber-500' : 'text-slate-600'}>
                — {meta.meta_description?.length ?? 0}/160, blank auto-derives from The Snapshot
              </span>
            </label>
            <textarea
              value={meta.meta_description ?? ''}
              onChange={(e) => set('meta_description', e.target.value)}
              disabled={locked}
              rows={2}
              className={`${inputCls} resize-y`}
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              OTM Read <span className="font-normal text-slate-600">— the conflict-flag aside</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={cf?.team_timeline ?? ''}
                onChange={(e) => setConflict({ team_timeline: e.target.value })}
                disabled={locked}
                placeholder="Team timeline"
                className={inputCls}
              />
              <input
                type="text"
                value={cf?.otm_range ?? ''}
                onChange={(e) => setConflict({ otm_range: e.target.value })}
                disabled={locked}
                placeholder="OrthoTriage estimate"
                className={inputCls}
              />
            </div>
            <textarea
              value={cf?.rationale ?? ''}
              onChange={(e) => setConflict({ rationale: e.target.value })}
              disabled={locked}
              rows={2}
              placeholder="Why the two differ"
              className={`${inputCls} resize-y`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-300">
                FAQs <span className="font-normal text-slate-600">— renders the FAQPage schema</span>
              </div>
              {!locked && (
                <button
                  type="button"
                  onClick={() => set('faqs', [...faqs, { q: '', a: '' }])}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  + Add
                </button>
              )}
            </div>
            {faqs.map((f, i) => (
              <div key={i} className="space-y-1 border border-slate-800 rounded p-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={f.q}
                    onChange={(e) => setFaq(i, { q: e.target.value })}
                    disabled={locked}
                    placeholder="Question"
                    className={inputCls}
                  />
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => set('faqs', faqs.filter((_, idx) => idx !== i))}
                      className="text-xs text-slate-500 hover:text-red-400 px-2 shrink-0"
                      aria-label={`Remove FAQ ${i + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <textarea
                  value={f.a}
                  onChange={(e) => setFaq(i, { a: e.target.value })}
                  disabled={locked}
                  rows={2}
                  placeholder="Answer"
                  className={`${inputCls} resize-y`}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Related slugs <span className="text-slate-600">— comma-separated, must already be published</span>
            </label>
            <input
              type="text"
              value={(meta.related_slugs ?? []).join(', ')}
              onChange={(e) =>
                set(
                  'related_slugs',
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              disabled={locked}
              className={inputCls}
            />
          </div>
        </div>
      )}
    </div>
  );
}
