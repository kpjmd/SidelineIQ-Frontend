'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LedgerBaseRate } from '@/lib/ledger-types';

interface Props {
  baseRates: LedgerBaseRate[];
  onSaved: (row: LedgerBaseRate) => void;
  onClose: () => void;
}

type Form = Record<'row_key' | 'injury_type' | 'strength' | 'source_rank' | 'sources' | 'n' | 'year_range' | 'f1_ir' | 'f2_next' | 'f3_4wk' | 'f5_reinjury' | 'f4_point' | 'f4_low' | 'f4_high' | 'notes', string>;

const EMPTY: Form = { row_key: '', injury_type: '', strength: 'moderate', source_rank: '', sources: '', n: '', year_range: '', f1_ir: '', f2_next: '', f3_4wk: '', f5_reinjury: '', f4_point: '', f4_low: '', f4_high: '', notes: '' };
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function fromRow(r: LedgerBaseRate): Form {
  return { row_key: r.row_key, injury_type: r.injury_type, strength: r.strength, source_rank: s(r.source_rank), sources: s(r.sources), n: s(r.n), year_range: s(r.year_range), f1_ir: s(r.f1_ir), f2_next: s(r.f2_next), f3_4wk: s(r.f3_4wk), f5_reinjury: s(r.f5_reinjury), f4_point: s(r.f4_point), f4_low: s(r.f4_low), f4_high: s(r.f4_high), notes: s(r.notes) };
}

/**
 * The base-rate sheet (spec "Base-rate sheet"): one row per injury type, with
 * its evidence strength, source rank, n and year range, and the priors the
 * draft form pre-fills from. You enter these; a forecast copies the values it
 * used at publish, so editing a row later never changes a published card.
 */
export function BaseRateEditor({ baseRates, onSaved, onClose }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const input = 'w-full rounded bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm text-bone';
  const label = 'block text-[11px] uppercase tracking-wider text-slate-500 mb-1';

  async function save() {
    setSaving(true);
    setErrors([]);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/ledger/base-rates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.status === 401) return router.push('/signin');
      const data = (await res.json().catch(() => ({}))) as { base_rate?: LedgerBaseRate; error?: string; errors?: string[] };
      if (!res.ok || !data.base_rate) {
        setErrors(data.errors ?? [data.error ?? 'Save failed']);
        return;
      }
      onSaved(data.base_rate);
      setMessage(`Saved ${data.base_rate.row_key}.`);
      setForm(EMPTY);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Save failed']);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-bone">Base-rate sheet · {baseRates.length} rows</h2>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300">Back</button>
      </div>
      <p className="text-xs text-slate-500">
        One row per injury type. NFL-specific return-to-play data first; general orthopaedic cohorts never for games missed. A thin row&apos;s F4 interval starts at least twice the width of a strong row&apos;s. Saving an existing key replaces that row; published forecasts keep the values they copied.
      </p>

      {baseRates.length > 0 && (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left p-2">Key</th>
                <th className="text-left p-2">Injury</th>
                <th className="text-left p-2">Strength</th>
                <th className="text-right p-2">F1</th>
                <th className="text-right p-2">F2</th>
                <th className="text-right p-2">F3</th>
                <th className="text-right p-2">F4</th>
                <th className="text-right p-2">F5</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {baseRates.map((r) => (
                <tr key={r.row_key} className="border-t border-slate-800">
                  <td className="p-2 font-mono">{r.row_key}</td>
                  <td className="p-2">{r.injury_type}</td>
                  <td className="p-2">{r.strength}{r.n ? ` · n=${r.n}` : ''}</td>
                  <td className="p-2 text-right">{s(r.f1_ir)}</td>
                  <td className="p-2 text-right">{s(r.f2_next)}</td>
                  <td className="p-2 text-right">{s(r.f3_4wk)}</td>
                  <td className="p-2 text-right">{r.f4_point ?? ''}{r.f4_low !== null && r.f4_high !== null ? ` (${r.f4_low}–${r.f4_high})` : ''}</td>
                  <td className="p-2 text-right">{s(r.f5_reinjury)}</td>
                  <td className="p-2 text-right">
                    <button onClick={() => setForm(fromRow(r))} className="text-signal-cyan hover:text-signal-cyan-hover">edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={label}>Row key (stable, slug)</label>
            <input className={input} value={form.row_key} onChange={(e) => set('row_key', e.target.value)} placeholder="low_ankle_sprain" />
          </div>
          <div>
            <label className={label}>Injury type</label>
            <input className={input} value={form.injury_type} onChange={(e) => set('injury_type', e.target.value)} placeholder="Low ankle sprain" />
          </div>
          <div>
            <label className={label}>Evidence strength</label>
            <select className={input} value={form.strength} onChange={(e) => set('strength', e.target.value)}>
              <option value="strong">strong</option>
              <option value="moderate">moderate</option>
              <option value="thin">thin</option>
            </select>
          </div>
          <div>
            <label className={label}>Source rank (1 empirical NFL … 4 general athletic)</label>
            <input className={input} inputMode="numeric" value={form.source_rank} onChange={(e) => set('source_rank', e.target.value)} />
          </div>
          <div>
            <label className={label}>n</label>
            <input className={input} inputMode="numeric" value={form.n} onChange={(e) => set('n', e.target.value)} />
          </div>
          <div>
            <label className={label}>Year range</label>
            <input className={input} value={form.year_range} onChange={(e) => set('year_range', e.target.value)} placeholder="2021–2025" />
          </div>
          <div className="md:col-span-3">
            <label className={label}>Sources</label>
            <input className={input} value={form.sources} onChange={(e) => set('sources', e.target.value)} placeholder="Papers, registries, or the public injury-log history used" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              ['f1_ir', 'F1 IR within 7 days (0–1)'],
              ['f2_next', 'F2 plays next game (0–1)'],
              ['f3_4wk', 'F3 returns within 4 weeks (0–1)'],
              ['f5_reinjury', 'F5 re-injury (0–1)'],
              ['f4_point', 'F4 games missed — point'],
              ['f4_low', 'F4 80% low'],
              ['f4_high', 'F4 80% high'],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <label className={label}>{l}</label>
              <input className={input} inputMode="decimal" value={form[k]} onChange={(e) => set(k, e.target.value)} />
            </div>
          ))}
        </div>
        <div>
          <label className={label}>Notes (what is thin, handling)</label>
          <input className={input} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
        {errors.length > 0 && (
          <ul className="rounded border border-red-800 bg-red-950/40 p-3 text-xs text-red-200 list-disc list-inside">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-700 text-emerald-50 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save base rate'}
          </button>
          {message && <span className="text-xs text-emerald-300">{message}</span>}
        </div>
      </section>
    </div>
  );
}
