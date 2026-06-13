'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents } from '@/lib/markdown-components';
import { stripOTMAnnotations } from '@/lib/strip-otm';
import type { DeskPost, DeskPostStatus } from '@/lib/types';

interface Props {
  deskPostId: string;
  markdown: string;
  title: string;
  status: DeskPostStatus;
  onMarkdownChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onSaved: (post: DeskPost) => void;
}

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

// Markdown editor with a live remark preview. Debounced auto-save (2s) to
// PATCH /api/desk/posts/[id]. Editing a READY post reverts it to DRAFT
// server-side; the returned post carries the authoritative status.
export function DraftEditor({
  deskPostId,
  markdown,
  title,
  status,
  onMarkdownChange,
  onTitleChange,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
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
          body: JSON.stringify({ markdown_body: markdown, title }),
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
  }, [markdown, title]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={locked}
          placeholder="Post title"
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500 disabled:opacity-60"
        />
        <span className={`px-2 py-0.5 rounded text-xs font-semibold border shrink-0 ${statusBadge(status)}`}>
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <textarea
          value={markdown}
          onChange={(e) => onMarkdownChange(e.target.value)}
          disabled={locked}
          spellCheck
          className="h-[28rem] bg-slate-950 border border-slate-700 rounded p-3 text-sm text-slate-200 font-mono leading-relaxed resize-none focus:outline-none focus:border-slate-500 disabled:opacity-60"
        />
        <div className="h-[28rem] overflow-y-auto bg-slate-900 border border-slate-800 rounded p-4 prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {stripOTMAnnotations(markdown)}
          </ReactMarkdown>
        </div>
      </div>

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
