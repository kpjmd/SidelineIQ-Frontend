'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LedgerBaseRate, LedgerDistributeOutcome, LedgerForecast, LedgerPublishGate, LedgerPublishResult, NflverseLookup } from '@/lib/ledger-types';
import type { PlayerResolution } from '@/lib/mcp';
import type { HashPreview } from '@/lib/ledger-draft-form';
import { LEDGER_COPY } from '@/lib/ledger-copy';

type FormState = {
  player: string;
  team: string;
  position: string;
  injury_date: string;
  reported_injury: string;
  source_tier: 'A' | 'B' | 'C';
  source_urls: string;
  mechanism: string;
  base_rate_row: string;
  base_rate_strength: 'strong' | 'moderate' | 'thin';
  f1_ir: string;
  f2_next: string;
  f3_4wk: string;
  f4_point: string;
  f4_low: string;
  f4_high: string;
  f5_reinjury: string;
  season_ending: boolean;
  what_moves_this: string;
  tier: '1' | '2';
  trigger: string;
  reply_to_url: string;
  espn_athlete_id: string;
  gsis_id: string;
  pfr_id: string;
  nflverse_team: string;
  season: string;
  player_id: string;
};

interface Props {
  baseRates: LedgerBaseRate[];
  /** A draft to continue editing, or (with parentEntryId) the latest published version to seed a revision from. */
  initial: LedgerForecast | null;
  parentEntryId: string | null;
  onPublished: (forecast: LedgerForecast, preview: LedgerDistributeOutcome | null, previewError: string | null) => void;
  onCancel: () => void;
}

const num = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));

function seed(initial: LedgerForecast | null, isRevision: boolean): FormState {
  const now = new Date();
  return {
    player: initial?.player ?? '',
    team: initial?.team ?? '',
    position: initial?.position ?? '',
    injury_date: initial?.injury_date?.slice(0, 10) ?? '',
    reported_injury: initial?.reported_injury ?? '',
    source_tier: initial?.source_tier ?? 'B',
    source_urls: (initial?.source_urls ?? []).join('\n'),
    mechanism: initial?.mechanism ?? '',
    base_rate_row: initial?.base_rate_row ?? '',
    base_rate_strength: initial?.base_rate_strength ?? 'moderate',
    f1_ir: num(initial?.f1_ir),
    f2_next: num(initial?.f2_next),
    f3_4wk: num(initial?.f3_4wk),
    f4_point: num(initial?.f4_point),
    f4_low: num(initial?.f4_low),
    f4_high: num(initial?.f4_high),
    f5_reinjury: num(initial?.f5_reinjury),
    season_ending: initial?.season_ending ?? false,
    what_moves_this: initial?.what_moves_this ?? '',
    tier: initial?.tier === 2 ? '2' : '1',
    // A revision never inherits its parent's trigger: it needs its own public event.
    trigger: isRevision ? '' : (initial?.trigger ?? ''),
    reply_to_url: initial?.reply_to_url ?? '',
    espn_athlete_id: initial?.espn_athlete_id ?? '',
    gsis_id: initial?.gsis_id ?? '',
    pfr_id: initial?.pfr_id ?? '',
    nflverse_team: initial?.nflverse_team ?? '',
    season: num(initial?.season ?? (now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1)),
    player_id: initial?.player_id ?? '',
  };
}

/**
 * The draft form. A draft is mutable, has no entry id and is never public; it
 * becomes a forecast only through "Confirm and publish", which is
 * web_publish_ledger_forecast with the session's user id. Pre-filled from a
 * base-rate row ("base rate plus physician adjustment"), the player attached by
 * roster lookup so espn_athlete_id exists, the nflverse ids shown with a
 * visible UNRESOLVED state that never blocks the publish.
 */
export function LedgerDraftForm({ baseRates, initial, parentEntryId, onPublished, onCancel }: Props) {
  const router = useRouter();
  const isRevision = parentEntryId !== null;
  const [form, setForm] = useState<FormState>(() => seed(initial, isRevision));
  const [draftId, setDraftId] = useState<string | null>(initial && initial.status === 'draft' ? initial.id : null);
  const [draftVersion, setDraftVersion] = useState<number | null>(initial && initial.status === 'draft' ? initial.version : null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ hash: HashPreview; forbidden: Array<{ field: string; words: string[] }> } | null>(null);
  const [resolution, setResolution] = useState<PlayerResolution | null>(null);
  const [resolving, setResolving] = useState(false);
  const [lookup, setLookup] = useState<NflverseLookup | { status: 'unavailable'; error: string } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [gate, setGate] = useState<LedgerPublishGate | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(null);
  };

  function applyBaseRate(rowKey: string) {
    const br = baseRates.find((b) => b.row_key === rowKey);
    setForm((f) => ({
      ...f,
      base_rate_row: rowKey,
      ...(br
        ? {
            base_rate_strength: br.strength,
            f1_ir: num(br.f1_ir),
            f2_next: num(br.f2_next),
            f3_4wk: num(br.f3_4wk),
            f4_point: num(br.f4_point),
            f4_low: num(br.f4_low),
            f4_high: num(br.f4_high),
            f5_reinjury: num(br.f5_reinjury),
          }
        : {}),
    }));
    setSaved(null);
  }

  async function resolvePlayer() {
    if (form.player.trim().length < 2) return;
    setResolving(true);
    setResolution(null);
    setLookup(null);
    try {
      const res = await fetch(`/api/admin/ledger/players?name=${encodeURIComponent(form.player.trim())}`);
      if (res.status === 401) return router.push('/signin');
      const data = (await res.json()) as { resolution?: PlayerResolution; error?: string };
      if (!res.ok || !data.resolution) throw new Error(data.error ?? 'lookup failed');
      setResolution(data.resolution);
      const p = data.resolution.player;
      if (p && p.confidence !== 'ambiguous' && p.espn_athlete_id) {
        setForm((f) => ({
          ...f,
          espn_athlete_id: p.espn_athlete_id ?? '',
          player_id: typeof p.id === 'string' ? p.id : f.player_id,
          team: f.team || (p.current_team_abbreviation ?? p.current_team_name ?? ''),
          position: f.position || (p.position ?? ''),
          player: typeof p.name === 'string' ? p.name : f.player,
        }));
        await lookupIds(p.espn_athlete_id);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Player lookup failed']);
    } finally {
      setResolving(false);
    }
  }

  async function lookupIds(espnId: string) {
    if (!/^\d+$/.test(espnId)) return;
    setLookingUp(true);
    try {
      const res = await fetch(`/api/admin/ledger/nflverse-ids?espn_id=${encodeURIComponent(espnId)}`);
      const data = (await res.json().catch(() => ({}))) as { lookup?: NflverseLookup; error?: string };
      if (!res.ok || !data.lookup) {
        setLookup({ status: 'unavailable', error: data.error ?? `nflverse lookup returned ${res.status}` });
        return;
      }
      setLookup(data.lookup);
      if (data.lookup.status === 'resolved') {
        const l = data.lookup;
        setForm((f) => ({ ...f, gsis_id: l.gsis_id, pfr_id: l.pfr_id, nflverse_team: f.nflverse_team || (l.nflverse_team ?? '') }));
      } else {
        const partial = data.lookup.partial ?? {};
        setForm((f) => ({ ...f, gsis_id: partial.gsis_id ?? '', pfr_id: partial.pfr_id ?? '' }));
      }
    } finally {
      setLookingUp(false);
    }
  }

  function payload() {
    return {
      ...form,
      source_urls: form.source_urls.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      f5_reinjury: form.f5_reinjury.trim() === '' ? null : form.f5_reinjury,
      tier: Number(form.tier),
      season: form.season.trim() === '' ? null : Number(form.season),
      ...(isRevision ? { parent_entry_id: parentEntryId, entry_id: parentEntryId } : {}),
    };
  }

  async function save(): Promise<string | null> {
    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch(draftId ? `/api/admin/ledger/drafts/${draftId}` : '/api/admin/ledger/drafts', {
        method: draftId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      if (res.status === 401) {
        router.push('/signin');
        return null;
      }
      const data = (await res.json().catch(() => ({}))) as { draft?: LedgerForecast; hash_preview?: HashPreview; forbidden_words?: Array<{ field: string; words: string[] }>; error?: string; errors?: string[] };
      if (!res.ok || !data.draft) {
        setErrors(data.errors ?? [data.error ?? 'Save failed']);
        return null;
      }
      setDraftId(data.draft.id);
      setDraftVersion(data.draft.version);
      setSaved({ hash: data.hash_preview!, forbidden: data.forbidden_words ?? [] });
      return data.draft.id;
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Save failed']);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function confirmAndPublish() {
    setPublishing(true);
    setGate(null);
    setErrors([]);
    try {
      const id = await save();
      if (!id) return;
      const res = await fetch(`/api/admin/ledger/drafts/${id}/publish`, { method: 'POST' });
      if (res.status === 401) return router.push('/signin');
      const data = (await res.json().catch(() => ({}))) as (LedgerPublishResult & { error?: string }) | { publish: LedgerPublishResult; preview: LedgerDistributeOutcome | null; preview_error: string | null; error?: string };
      if (res.status === 422) {
        setGate((data as LedgerPublishResult).gate ?? { role_ok: false, passed: false, reasons: ['blocked'] });
        return;
      }
      if (!res.ok || !('publish' in data) || !data.publish.forecast) throw new Error((data as { error?: string }).error ?? 'Publish failed');
      setConfirmOpen(false);
      onPublished(data.publish.forecast, data.preview, data.preview_error);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Publish failed']);
    } finally {
      setPublishing(false);
    }
  }

  async function deleteDraft() {
    if (!draftId || !window.confirm('Delete this draft? A draft has no entry id and nothing public refers to it.')) return;
    const res = await fetch(`/api/admin/ledger/drafts/${draftId}`, { method: 'DELETE' });
    if (res.ok) onCancel();
    else setErrors([((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Delete failed']);
  }

  const input = 'w-full rounded bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm text-bone';
  const label = 'block text-[11px] uppercase tracking-wider text-slate-500 mb-1';
  const forbiddenCount = saved?.forbidden.reduce((n, f) => n + f.words.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-bone">
          {isRevision ? `Revision of ${parentEntryId}${draftVersion ? ` · v${draftVersion}` : ''}` : draftId ? 'Draft' : 'New entry'}
        </h2>
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
      </div>

      {isRevision && (
        <div>
          <label className={label}>Trigger (required: the public event prompting this revision)</label>
          <input className={input} value={form.trigger} onChange={(e) => set('trigger', e.target.value)} placeholder="e.g. Placed on IR, 2026-10-07 (team transaction wire)" />
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={label}>Player</label>
          <div className="flex gap-2">
            <input className={input} value={form.player} onChange={(e) => set('player', e.target.value)} placeholder="As the roster spells it" />
            <button type="button" onClick={resolvePlayer} disabled={resolving} className="px-3 rounded bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap">
              {resolving ? 'Looking up…' : 'Resolve on roster'}
            </button>
          </div>
          {resolution && (
            <p className={`mt-1 text-xs ${resolution.player && resolution.player.confidence !== 'ambiguous' ? 'text-emerald-300' : 'text-amber-300'}`}>
              {resolution.player
                ? resolution.player.confidence === 'ambiguous'
                  ? 'Ambiguous: two rostered athletes share this name. Unresolved — enter the ESPN athlete id by hand.'
                  : `Resolved (${resolution.player.confidence}): ${resolution.player.name} · ${resolution.player.current_team_name ?? '—'} · ESPN ${resolution.player.espn_athlete_id}`
                : 'No rostered player matches. Unresolved — enter the ESPN athlete id by hand if known.'}
            </p>
          )}
        </div>
        <div>
          <label className={label}>Team (as printed on the card)</label>
          <input className={input} value={form.team} onChange={(e) => set('team', e.target.value)} />
        </div>
        <div>
          <label className={label}>Position</label>
          <input className={input} value={form.position} onChange={(e) => set('position', e.target.value)} />
        </div>
        <div>
          <label className={label}>Injury date (the day it occurred, not the report)</label>
          <input type="date" className={input} value={form.injury_date} onChange={(e) => set('injury_date', e.target.value)} />
        </div>
        <div>
          <label className={label}>Season</label>
          <input className={input} value={form.season} onChange={(e) => set('season', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Reported injury, as worded by the source (never a diagnosis)</label>
          <input className={input} value={form.reported_injury} onChange={(e) => set('reported_injury', e.target.value)} placeholder="e.g. Grade 2 hamstring strain" />
        </div>
        <div>
          <label className={label}>Source tier</label>
          <select className={input} value={form.source_tier} onChange={(e) => set('source_tier', e.target.value as 'A' | 'B' | 'C')}>
            {(['A', 'B', 'C'] as const).map((t) => (
              <option key={t} value={t}>
                {t} — {LEDGER_COPY.source_tiers[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Card tier</label>
          <select className={input} value={form.tier} onChange={(e) => set('tier', e.target.value as '1' | '2')}>
            <option value="1">1 — full card</option>
            <option value="2">2 — ledger only</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={label}>Source URLs (one per line; every input the entry names)</label>
          <textarea rows={3} className={input} value={form.source_urls} onChange={(e) => set('source_urls', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Report post to reply to on X (frozen at publish; leave empty for a ledger-only entry)</label>
          <input className={input} value={form.reply_to_url} onChange={(e) => set('reply_to_url', e.target.value)} placeholder="https://x.com/<handle>/status/<id>" />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Mechanism (one or two lines, film-based)</label>
          <textarea rows={2} className={input} value={form.mechanism} onChange={(e) => set('mechanism', e.target.value)} placeholder="Non-contact. Planted left foot, knee valgus. Q3 2:14." />
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Base-rate row (pre-fills the five fields)</label>
            <select className={input} value={form.base_rate_row} onChange={(e) => applyBaseRate(e.target.value)}>
              <option value="">— choose —</option>
              {baseRates.map((b) => (
                <option key={b.row_key} value={b.row_key}>
                  {b.injury_type} ({b.strength}{b.n ? `, n=${b.n}` : ''})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Base-rate strength</label>
            <select className={input} value={form.base_rate_strength} onChange={(e) => set('base_rate_strength', e.target.value as 'strong' | 'moderate' | 'thin')}>
              <option value="strong">strong</option>
              <option value="moderate">moderate</option>
              <option value="thin">thin (F4 interval at least twice a strong row's)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              ['f1_ir', 'F1 IR within 7 days (0–1)'],
              ['f2_next', 'F2 plays next game (0–1)'],
              ['f3_4wk', 'F3 returns within 4 weeks (0–1)'],
              ['f5_reinjury', 'F5 re-injury (0–1; empty = concussion rule)'],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <label className={label}>{l}</label>
              <input className={input} inputMode="decimal" value={form[k]} onChange={(e) => set(k, e.target.value)} />
            </div>
          ))}
          <div>
            <label className={label}>F4 games missed — point</label>
            <input className={input} inputMode="numeric" value={form.f4_point} onChange={(e) => set('f4_point', e.target.value)} />
          </div>
          <div>
            <label className={label}>F4 80% low</label>
            <input className={input} inputMode="numeric" value={form.f4_low} onChange={(e) => set('f4_low', e.target.value)} />
          </div>
          <div>
            <label className={label}>F4 80% high</label>
            <input className={input} inputMode="numeric" value={form.f4_high} onChange={(e) => set('f4_high', e.target.value)} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-xs text-slate-300">
            <input type="checkbox" checked={form.season_ending} onChange={(e) => set('season_ending', e.target.checked)} className="accent-amber-500" />
            Season-ending flag
          </label>
        </div>
        <div>
          <label className={label}>What would move this (one line)</label>
          <input className={input} value={form.what_moves_this} onChange={(e) => set('what_moves_this', e.target.value)} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider text-slate-500">Resolution ids (nflverse crosswalk, by ESPN id only)</h3>
          <button type="button" onClick={() => lookupIds(form.espn_athlete_id)} disabled={lookingUp || !/^\d+$/.test(form.espn_athlete_id)} className="text-xs text-signal-cyan hover:text-signal-cyan-hover disabled:opacity-40">
            {lookingUp ? 'Looking up…' : 'Look up nflverse ids'}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={label}>ESPN athlete id</label>
            <input className={input} value={form.espn_athlete_id} onChange={(e) => set('espn_athlete_id', e.target.value)} />
          </div>
          <div>
            <label className={label}>GSIS id</label>
            <input className={input} value={form.gsis_id} onChange={(e) => set('gsis_id', e.target.value)} />
          </div>
          <div>
            <label className={label}>PFR id</label>
            <input className={input} value={form.pfr_id} onChange={(e) => set('pfr_id', e.target.value)} />
          </div>
          <div>
            <label className={label}>nflverse team (e.g. BUF)</label>
            <input className={input} value={form.nflverse_team} onChange={(e) => set('nflverse_team', e.target.value.toUpperCase())} maxLength={4} />
          </div>
        </div>
        {lookup && (
          <p className={`text-xs ${lookup.status === 'resolved' ? 'text-emerald-300' : lookup.status === 'unavailable' ? 'text-red-300' : 'text-amber-300'}`}>
            {lookup.status === 'resolved' && `Resolved: ${lookup.display_name} · ${lookup.nflverse_team ?? '—'} · gsis ${lookup.gsis_id} · pfr ${lookup.pfr_id} (players.csv ${lookup.source_fetched_at.slice(0, 10)})`}
            {lookup.status === 'unresolved' && `UNRESOLVED (${lookup.reason === 'no_row' ? 'not in players.csv' : `missing ${lookup.missing.join(', ')}`}). The row publishes without these; the resolution ingest will surface the gap rather than guess.`}
            {lookup.status === 'unavailable' && `nflverse lookup unavailable: ${lookup.error}. This is not "unresolved" — try again later.`}
          </p>
        )}
        {!lookup && !form.gsis_id && !form.pfr_id && <p className="text-xs text-amber-300">UNRESOLVED — no nflverse ids yet.</p>}
      </section>

      {errors.length > 0 && (
        <ul className="rounded border border-red-800 bg-red-950/40 p-3 text-xs text-red-200 list-disc list-inside space-y-0.5">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {saved && (
        <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-slate-500">Hash preview</h3>
          {saved.hash.error ? (
            <p className="text-xs text-red-300">The row cannot be hashed as it stands: {saved.hash.error}</p>
          ) : (
            <>
              <p className="text-xs text-slate-500">The canonical input the row will hash. <span className="text-slate-300">entry_id</span> and <span className="text-slate-300">published_at</span> are stamped at confirm, so the hash itself appears the moment the row is published.</p>
              <pre className="max-h-40 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-slate-400">{JSON.stringify(saved.hash.input, null, 2)}</pre>
            </>
          )}
          {forbiddenCount > 0 ? (
            <p className="text-xs text-amber-300">
              Vocabulary rule: {saved.forbidden.map((f) => `${f.field}: ${f.words.join(', ')}`).join(' · ')}. The publish will be refused at distribution; rephrase before confirming.
            </p>
          ) : (
            <p className="text-xs text-emerald-300">Vocabulary rule: clean.</p>
          )}
        </section>
      )}

      <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
        <button type="button" onClick={() => save()} disabled={saving || publishing} className="px-4 py-2 rounded bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 disabled:opacity-50">
          {saving ? 'Saving…' : draftId ? 'Save draft' : 'Save as draft'}
        </button>
        <button type="button" onClick={() => setConfirmOpen(true)} disabled={saving || publishing} className="px-4 py-2 rounded-lg bg-emerald-700 text-emerald-50 font-semibold text-sm hover:bg-emerald-600 disabled:opacity-50">
          Confirm and publish…
        </button>
        {draftId && (
          <button type="button" onClick={deleteDraft} className="ml-auto text-xs text-red-400 hover:text-red-300">
            Delete draft
          </button>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-bone">Physician confirmation</h2>
              <button onClick={() => setConfirmOpen(false)} className="text-slate-500 hover:text-slate-300 text-sm">Close</button>
            </div>
            <p className="text-xs text-slate-400">
              Confirming stamps the time, allocates the entry id, hashes the row and makes it immutable. The five numbers, the F4 interval, the mechanism line and “what would move this” go out under your name. Nothing is posted yet: the next screen shows exactly what will be sent.
            </p>
            <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-emerald-600" />
              <span>I have reviewed the public sources, the mechanism line and the five forecast numbers, and I sign this forecast as {LEDGER_COPY.credit.replace('Forecast reviewed by ', '')}.</span>
            </label>
            <button onClick={confirmAndPublish} disabled={!confirmed || publishing} className="w-full px-4 py-3 rounded-lg bg-emerald-700 text-emerald-50 font-bold text-sm hover:bg-emerald-600 disabled:opacity-40 ring-1 ring-emerald-500/40">
              {publishing ? 'Confirming…' : 'Confirm and publish'}
            </button>
            {gate && (
              <div className="bg-red-950/60 border border-red-800 rounded p-3 text-xs text-red-200 space-y-1">
                <p className="font-semibold text-red-300">Publish blocked by the gate:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {gate.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {errors.length > 0 && <p className="text-xs text-red-400">{errors.join('; ')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
