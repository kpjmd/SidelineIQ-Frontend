'use client';

import { useEffect, useRef, useState } from 'react';
import { SECTION_KEYS } from '@/lib/types';
import type { DeskMeta, DeskPost, DeskPostStatus, DeskSections, SectionKey } from '@/lib/types';
import { MetaEditor } from './MetaEditor';

interface Props {
  deskPostId: string;
  sections: DeskSections;
  meta: DeskMeta;
  title: string;
  status: DeskPostStatus;
  onSectionsChange: (value: DeskSections) => void;
  onMetaChange: (value: DeskMeta) => void;
  onTitleChange: (value: string) => void;
  onSaved: (post: DeskPost) => void;
}

// Labels and guidance per section. The order is kpjmd's rendered order, so the
// editor reads top-to-bottom the same as the published page.
const SECTION_FIELDS: { key: SectionKey; label: string; hint: string }[] = [
  {
    key: 'snapshot',
    label: 'The Snapshot',
    hint: 'Must stand alone as a quotable, attributable answer — this is the AI-Overview citation chunk and the fallback meta description.',
  },
  { key: 'what_happened', label: 'What Happened', hint: 'Attribute to public reporting.' },
  { key: 'anatomy', label: 'The Anatomy', hint: 'Plain-language structure and mechanism.' },
  { key: 'treatment', label: 'The Treatment', hint: 'Heading is overridable below (e.g. "The Repair").' },
  {
    key: 'timeline',
    label: 'The Timeline',
    hint: 'Prose about the recovery arc. Dated follow-ups belong in Return Watch, not here.',
  },
  { key: 'bridge', label: 'Why It Matters For You', hint: 'The bridge to a non-athlete reader.' },
  {
    key: 'dr_take',
    label: "Dr. Johnson's Take",
    hint: 'Your own voice — never the machine draft verbatim.',
  },
];

function statusBadge(status: DeskPostStatus): string {
  switch (status) {
    case 'READY':
      return 'bg-emerald-900/60 text-emerald-300 border-emerald-700';
    case 'PUBLISHED':
      return 'bg-indigo-900/60 text-indigo-300 border-indigo-600';
    case 'RETRACTED':
      return 'bg-red-900/60 text-red-300 border-red-700';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-600';
  }
}

// Mirrors kpjmd's textToHtmlParagraphs() exactly (split on blank lines, trim,
// drop empties) so the preview shows what the live page will actually render.
// NOT ReactMarkdown: kpjmd HTML-escapes section prose and never parses markdown,
// so a markdown preview here would promise formatting the reader never sees.
function toParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function DraftEditor({
  deskPostId,
  sections,
  meta,
  title,
  status,
  onSectionsChange,
  onMetaChange,
  onTitleChange,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SectionKey | null>(null);
  const firstRun = useRef(true);
  const inFlight = useRef(0);

  const locked = status === 'PUBLISHED' || status === 'RETRACTED';

  useEffect(() => {
    // Don't save on the initial mount — opening a post is not an edit.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (locked) return;

    const handle = setTimeout(async () => {
      const requestId = inFlight.current + 1;
      inFlight.current = requestId;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/desk/posts/${deskPostId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections, meta, title }),
        });
        const data = (await res.json().catch(() => ({}))) as { post?: DeskPost; error?: string };
        if (!res.ok || !data.post) throw new Error(data.error ?? 'Save failed');
        // Ignore a response that a newer save has already superseded.
        if (requestId !== inFlight.current) return;
        onSaved(data.post);
        setSavedAt(new Date());
      } catch (err) {
        if (requestId !== inFlight.current) return;
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        if (requestId === inFlight.current) setSaving(false);
      }
    }, 2000);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, meta, title]);

  function setSection(key: SectionKey, value: string) {
    onSectionsChange({ ...sections, [key]: value });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={locked}
          placeholder="Headline"
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500 disabled:opacity-60"
        />
        <span className={`px-2 py-0.5 rounded text-xs font-semibold border shrink-0 ${statusBadge(status)}`}>
          {status}
        </span>
      </div>

      <p className="text-xs text-slate-500">
        Plain text only — kpjmd.com escapes this prose and does not parse markdown. Separate
        paragraphs with a blank line.
      </p>

      <div className="space-y-4">
        {SECTION_FIELDS.map(({ key, label, hint }) => {
          const value = sections[key] ?? '';
          const heading =
            key === 'treatment' && meta.treatment_heading?.trim()
              ? meta.treatment_heading.trim()
              : label;
          const paragraphs = toParagraphs(value);
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`section-${key}`} className="text-xs font-semibold text-slate-300">
                  {heading}
                  {value.trim() === '' && <span className="ml-2 text-amber-500 font-normal">empty</span>}
                </label>
                <button
                  type="button"
                  onClick={() => setPreview(preview === key ? null : key)}
                  className="text-xs text-slate-500 hover:text-slate-300 shrink-0"
                >
                  {preview === key ? 'Edit' : 'Preview'}
                </button>
              </div>
              {preview === key ? (
                <div className="min-h-[7rem] bg-slate-900 border border-slate-800 rounded p-3 space-y-3">
                  {paragraphs.length > 0 ? (
                    paragraphs.map((p, i) => (
                      <p key={i} className="text-sm text-slate-300 leading-relaxed">
                        {p}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600 italic">Nothing to preview.</p>
                  )}
                </div>
              ) : (
                <textarea
                  id={`section-${key}`}
                  value={value}
                  onChange={(e) => setSection(key, e.target.value)}
                  disabled={locked}
                  spellCheck
                  rows={key === 'snapshot' || key === 'bridge' ? 4 : 7}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-200 leading-relaxed resize-y focus:outline-none focus:border-slate-500 disabled:opacity-60"
                />
              )}
              <p className="text-xs text-slate-600">{hint}</p>
            </div>
          );
        })}
      </div>

      <MetaEditor meta={meta} locked={locked} onChange={onMetaChange} />

      <div className="flex items-center gap-3 text-xs h-4">
        {locked ? (
          <span className="text-slate-500">This post is {status.toLowerCase()} and can no longer be edited.</span>
        ) : saving ? (
          <span className="text-amber-400">Saving…</span>
        ) : error ? (
          <span className="text-red-400">{error}</span>
        ) : savedAt ? (
          <span className="text-slate-500">Saved {savedAt.toLocaleTimeString()}</span>
        ) : (
          <span className="text-slate-600">Edits auto-save after you pause.</span>
        )}
      </div>
    </div>
  );
}

export { SECTION_KEYS };
