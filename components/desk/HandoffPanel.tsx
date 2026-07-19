'use client';

import { useState } from 'react';
import type { DeskPost, KpjmdLiveResult } from '@/lib/types';

interface Props {
  post: DeskPost;
  onConfirmed: (post: DeskPost) => void;
}

// The three states of a Tier 2 publish. They are genuinely distinct: a post can
// be published on SidelineIQ for days before the JSON is dropped into the kpjmd
// content dir and rsync'd, and kpjmd_published_at goes stale the moment a Return
// Watch update lands, because the deployed page no longer matches.
type Stage = 'published' | 'live' | 'stale' | 'retracted';

function stageOf(post: DeskPost): Stage {
  if (post.status === 'RETRACTED') return 'retracted';
  if (!post.kpjmd_published_at) return 'published';
  return post.kpjmd_content_hash === post.content_hash ? 'live' : 'stale';
}

function Step({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 shrink-0 ${done ? 'text-emerald-400' : 'text-slate-600'}`}>
        {done ? '●' : '○'}
      </span>
      <div className="min-w-0">
        <div className={done ? 'text-slate-300' : 'text-slate-500'}>{label}</div>
        {detail && <div className="text-slate-600 break-words">{detail}</div>}
      </div>
    </div>
  );
}

// The kpjmd.com handoff: download the approved JSON, drop it in, deploy, then
// verify. Only mounted for PUBLISHED / RETRACTED posts.
export function HandoffPanel({ post, onConfirmed }: Props) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<KpjmdLiveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const stage = stageOf(post);
  const retracted = stage === 'retracted';
  const filename = retracted ? `${post.slug}.retracted.json` : `${post.slug}.json`;
  const href = `/api/desk/posts/${post.id}/handoff${retracted ? '?variant=retracted' : ''}`;

  const runbook = [
    `mv ~/Downloads/${filename} ~/KPJMD-website/content/injury-desk/published/`,
    `cd ~/KPJMD-website`,
    `node scripts/build-injury-desk.js --slug=${post.slug}`,
    `node scripts/build-links.js`,
    `rsync -avz -e "ssh -i ~/.ssh/id_ed25519" site/public/ root@167.172.157.3:/var/www/kpjmd/`,
    `node scripts/indexnow.js`,
  ].join('\n');

  async function confirm() {
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/desk/posts/${post.id}/confirm-live`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as Partial<KpjmdLiveResult> & {
        error?: string;
      };
      // A failed check comes back 422 WITH a body — that is a real answer
      // ("not live yet"), not a fault. Only a bodyless failure is an error.
      if (!data.check) throw new Error(data.error ?? 'Check failed');
      setResult(data as KpjmdLiveResult);
      if (data.check.ok && data.post) onConfirmed(data.post);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">kpjmd.com</h3>

      <div className="space-y-2 text-xs">
        <Step
          done
          label={retracted ? 'Retracted on SidelineIQ' : 'Published on SidelineIQ'}
          detail={
            retracted
              ? undefined
              : post.published_at
                ? new Date(post.published_at).toLocaleString()
                : undefined
          }
        />
        <Step
          done={stage === 'live'}
          label={stage === 'live' ? 'Live on kpjmd.com' : 'Not confirmed live'}
          detail={
            stage === 'live' && post.kpjmd_published_at
              ? new Date(post.kpjmd_published_at).toLocaleString()
              : stage === 'stale'
                ? 'The deployed page is out of date — rebuild and rsync, then re-confirm.'
                : undefined
          }
        />
      </div>

      {stage === 'stale' && (
        <p className="text-xs text-amber-400">
          This post changed since it was last confirmed live (an edit or a Return Watch update).
          The page on kpjmd.com is stale until you rebuild and deploy.
        </p>
      )}

      <a
        href={href}
        download={filename}
        className="block w-full text-center bg-slate-100 hover:bg-white text-slate-900 text-sm font-semibold py-2 rounded"
      >
        Download {filename}
      </a>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Then, from the KPJMD-website repo:</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(runbook);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="bg-slate-950 border border-slate-800 rounded p-2 text-[11px] leading-relaxed text-slate-400 overflow-x-auto">
          {runbook}
        </pre>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={confirm}
          disabled={checking}
          className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-semibold py-2 rounded"
        >
          {checking ? 'Checking kpjmd.com…' : 'Confirm published'}
        </button>
        <p className="text-xs text-slate-600">
          Fetches the live URL and requires a 200 plus a content hash matching this version —
          nothing is recorded on your word alone.
        </p>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {result && (
          <div className={`text-xs ${result.check.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
            {result.check.ok ? (
              <>
                Verified live at{' '}
                <a
                  href={result.check.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {result.check.url}
                </a>
              </>
            ) : (
              <ul className="space-y-1">
                {result.check.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
