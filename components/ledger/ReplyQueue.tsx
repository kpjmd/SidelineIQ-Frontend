'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReplyProposal } from '@/lib/ledger-types';
import type { ReplyPostOutcome } from '@/lib/ledger-publish';

interface Props {
  initialPending: ReplyProposal[];
  initialStuck: ReplyProposal[];
}

/**
 * Drafted replies the agent filed; nothing here has been posted. "Post" records
 * the approval (who, when, the final wording) and THEN asks the agents to post
 * it; "Discard" records that decision. A row that was approved and claimed but
 * never recorded posted is listed as "verify manually" — it may or may not be
 * live, and no automatic retry is allowed to guess.
 */
export function ReplyQueue({ initialPending, initialStuck }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [stuck, setStuck] = useState(initialStuck);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch('/api/admin/ledger/replies');
    if (res.status === 401) {
      router.push('/signin');
      return;
    }
    if (!res.ok) throw new Error('Failed to reload');
    const data = (await res.json()) as { proposals: ReplyProposal[]; stuck: ReplyProposal[] };
    setPending(data.proposals);
    setStuck(data.stuck);
  }, [router]);

  async function decide(p: ReplyProposal, decision: 'approved' | 'discarded') {
    setBusy(p.id);
    setError(null);
    try {
      const edited = texts[p.id];
      const res = await fetch(`/api/admin/ledger/replies/${p.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, ...(decision === 'approved' && edited !== undefined && edited !== p.proposed_text ? { approved_text: edited } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; post?: ReplyPostOutcome | null; post_error?: string | null };
      if (res.status === 401) {
        router.push('/signin');
        return;
      }
      if (data.error && res.status !== 502) throw new Error(data.error);
      if (decision === 'approved') {
        const posted = data.post?.success ? `Posted (${data.post.platform} ${data.post.posted_id}).` : `Approved, but the post failed: ${data.post?.error ?? data.post_error ?? data.error ?? 'unknown'}. Retry from the list below.`;
        setMessages((m) => ({ ...m, [p.id]: posted }));
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function retry(p: ReplyProposal) {
    setBusy(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ledger/replies/${p.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retry: true }) });
      const data = (await res.json().catch(() => ({}))) as { post?: ReplyPostOutcome | null; post_error?: string | null; error?: string };
      setMessages((m) => ({ ...m, [p.id]: data.post?.success ? `Posted (${data.post.posted_id}).` : `Retry failed: ${data.post?.error ?? data.post_error ?? data.error ?? 'unknown'}` }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <p className="text-xs text-slate-500">
        The reply agent drafts; nothing posts until you approve it here. Edit the text if needed, then Post. Your approval is recorded before the post goes out.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-bone">Pending · {pending.length}</h2>
        {pending.length === 0 && <p className="text-xs text-slate-600">No drafted replies waiting.</p>}
        {pending.map((p) => (
          <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono">{p.platform.toUpperCase()} · @{p.mention_author ?? 'unknown'} · {new Date(p.proposed_at).toLocaleString()}</span>
              {p.mention_url && (
                <a href={p.mention_url} target="_blank" rel="noopener noreferrer" className="text-signal-cyan hover:text-signal-cyan-hover">
                  Open mention
                </a>
              )}
            </div>
            {p.mention_text && <blockquote className="text-sm text-slate-300 border-l-2 border-slate-700 pl-3">{p.mention_text}</blockquote>}
            <textarea
              value={texts[p.id] ?? p.proposed_text}
              onChange={(e) => setTexts((t) => ({ ...t, [p.id]: e.target.value }))}
              rows={4}
              className="w-full rounded bg-slate-950 border border-slate-700 p-2 text-sm text-bone"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => decide(p, 'approved')}
                disabled={busy === p.id}
                className="px-4 py-2 rounded bg-emerald-700 text-emerald-50 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50"
              >
                {busy === p.id ? 'Posting…' : 'Approve and post'}
              </button>
              <button
                onClick={() => decide(p, 'discarded')}
                disabled={busy === p.id}
                className="px-4 py-2 rounded bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 disabled:opacity-50"
              >
                Discard
              </button>
              {messages[p.id] && <span className="text-xs text-slate-400">{messages[p.id]}</span>}
            </div>
          </div>
        ))}
      </section>

      {stuck.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-amber-300">Approved, outcome unknown · {stuck.length}</h2>
          <p className="text-xs text-slate-500">
            These were approved and a post was attempted, but no platform id was recorded. Check the account before retrying: the reply may already be live.
          </p>
          {stuck.map((p) => (
            <div key={p.id} className="rounded-lg border border-amber-900/60 bg-slate-900/60 p-4 space-y-2">
              <div className="text-xs text-slate-500 font-mono">{p.platform.toUpperCase()} · attempted {p.post_attempted_at ? new Date(p.post_attempted_at).toLocaleString() : '—'}{p.post_error ? ` · ${p.post_error}` : ''}</div>
              <p className="text-sm text-slate-300">{p.approved_text ?? p.proposed_text}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => retry(p)} disabled={busy === p.id} className="px-3 py-1.5 rounded bg-slate-800 text-slate-200 text-xs hover:bg-slate-700 disabled:opacity-50">
                  Retry post
                </button>
                {messages[p.id] && <span className="text-xs text-slate-400">{messages[p.id]}</span>}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
