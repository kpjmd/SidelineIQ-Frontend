'use client';

import { useState } from 'react';
import type { CorrectTitleResult, DeskAttestation, DeskPost } from '@/lib/types';
import { CONFIRMATIONS, type ConfirmKey } from './AttestationModal';

interface Props {
  post: DeskPost;
  onCorrected: (post: DeskPost, attestation: DeskAttestation) => void;
}

// The one post-publish edit. The title is the kpjmd headline and it is inside
// the content hash, so a correction re-attests (the same three confirmations as
// publishing), is audited, and leaves kpjmd.com stale until the handoff is
// rebuilt, rsynced and confirmed again. Only mounted for PUBLISHED posts.
export function CorrectTitlePanel({ post, onCorrected }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [reason, setReason] = useState('');
  const [checks, setChecks] = useState<Record<ConfirmKey, boolean>>({
    reviewed_source_reports: false,
    edited_for_accuracy: false,
    framing_confirmed: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const allChecked = CONFIRMATIONS.every((c) => checks[c.key]);
  const changed = title.trim() !== '' && title.trim() !== post.title;
  const canSubmit = changed && reason.trim() !== '' && allChecked && !saving;

  async function submit() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/desk/posts/${post.id}/correct-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), reason: reason.trim(), ...checks }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<CorrectTitleResult> & { error?: string };
      if (!res.ok || !data.post) throw new Error(data.error ?? 'Correction failed');
      if (data.changed && data.attestation) {
        onCorrected(data.post, data.attestation);
        setNotice('Title corrected and re-attested. Download the JSON again and rebuild kpjmd.com.');
        setOpen(false);
        setReason('');
        setChecks({ reviewed_source_reports: false, edited_for_accuracy: false, framing_confirmed: false });
      } else {
        setNotice('That is already the title — nothing changed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Correction failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Headline</h3>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setTitle(post.title);
              setOpen(true);
            }}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Correct title…
          </button>
        )}
      </div>
      <p className="text-sm text-slate-300 break-words">{post.title}</p>

      {open && (
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={512}
            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100"
            aria-label="Corrected title"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (recorded in the audit log)"
            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
            aria-label="Reason for correction"
          />
          <p className="text-xs text-amber-400">
            This re-attests the published post under your name and is audited. The URL does not change;
            the kpjmd.com page will read as stale until you rebuild, rsync and confirm it again.
          </p>
          <div className="space-y-2">
            {CONFIRMATIONS.map((c) => (
              <label key={c.key} className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checks[c.key]}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                  className="mt-0.5 accent-emerald-600"
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-emerald-50 text-sm font-semibold py-2 rounded"
            >
              {saving ? 'Correcting…' : 'Correct & re-attest'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {notice && <p className="text-xs text-emerald-400">{notice}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
