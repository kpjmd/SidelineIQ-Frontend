'use client';

import { useMemo, useState } from 'react';
import type { CorrectContentResult, DeskAttestation, DeskPost } from '@/lib/types';
import {
  MAX_FIELD_EDIT_DISTANCE,
  correctionEdits,
  correctionFields,
  currentValue,
  editDistance,
} from '@/lib/desk-correction';
import { CONFIRMATIONS, type ConfirmKey } from './AttestationModal';

interface Props {
  post: DeskPost;
  onCorrected: (post: DeskPost, attestation: DeskAttestation) => void;
}

const NO_CHECKS: Record<ConfirmKey, boolean> = {
  reviewed_source_reports: false,
  edited_for_accuracy: false,
  framing_confirmed: false,
};

// The section/prose-meta sibling of CorrectTitlePanel: one field per correction,
// a small edit only (the mcp caps it and re-lints), re-attested and audited.
// kpjmd.com reads stale until the handoff is rebuilt, rsynced and confirmed.
// Only mounted for PUBLISHED posts.
export function CorrectContentPanel({ post, onCorrected }: Props) {
  const fields = useMemo(() => correctionFields(post), [post]);
  const [open, setOpen] = useState(false);
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? '');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [checks, setChecks] = useState<Record<ConfirmKey, boolean>>(NO_CHECKS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const option = fields.find((f) => f.id === fieldId) ?? fields[0];
  const stored = option ? currentValue(post, option.field) : '';
  const distance = useMemo(() => editDistance(stored, value), [stored, value]);
  const overCap = distance > MAX_FIELD_EDIT_DISTANCE;

  const allChecked = CONFIRMATIONS.every((c) => checks[c.key]);
  const canSubmit = !!option && distance > 0 && !overCap && reason.trim() !== '' && allChecked && !saving;

  function pick(id: string) {
    const next = fields.find((f) => f.id === id);
    setFieldId(id);
    setValue(next ? currentValue(post, next.field) : '');
    setError(null);
  }

  async function submit() {
    if (!option) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/desk/posts/${post.id}/correct-published`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...correctionEdits(post, option.field, value), reason: reason.trim(), ...checks }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<CorrectContentResult> & { error?: string };
      if (!res.ok || !data.post) throw new Error(data.error ?? 'Correction failed');
      if (data.changed && data.attestation) {
        onCorrected(data.post, data.attestation);
        setNotice(`${option.label} corrected and re-attested. Download the JSON again and rebuild kpjmd.com.`);
        setOpen(false);
        setReason('');
        setChecks(NO_CHECKS);
      } else {
        setNotice('That is already the published text — nothing changed.');
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
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Published text</h3>
        {!open && (
          <button
            type="button"
            onClick={() => {
              pick(fieldId || fields[0]?.id || '');
              setNotice(null);
              setOpen(true);
            }}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Correct an error…
          </button>
        )}
      </div>

      {open && option && (
        <div className="space-y-3">
          <select
            value={option.id}
            onChange={(e) => pick(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
            aria-label="Field to correct"
          >
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={8}
            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 leading-relaxed"
            aria-label="Corrected text"
          />
          <p className={`text-xs tabular-nums ${overCap ? 'text-red-400' : 'text-slate-500'}`}>
            {distance} of {MAX_FIELD_EDIT_DISTANCE} characters changed
            {overCap && ' — too large for a correction; retract and publish a new post instead'}
          </p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (recorded in the audit log)"
            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
            aria-label="Reason for correction"
          />
          <p className="text-xs text-amber-400">
            This re-attests the published post under your name, re-runs the linter and is audited with a
            before/after diff. The URL does not change; the kpjmd.com page will read as stale until you
            rebuild, rsync and confirm it again.
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
      {error && <p className="text-xs text-red-400 break-words">{error}</p>}
    </div>
  );
}
