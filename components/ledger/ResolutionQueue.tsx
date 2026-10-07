'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LEDGER_FIELDS, type LedgerField } from '@/lib/ledger-fields';
import type {
  LedgerForecast,
  LedgerIngestSummary,
  LedgerProposal,
  LedgerResolution,
  LedgerScoreboardResponse,
  NflverseLookup,
} from '@/lib/ledger-types';
import { entryIdStates, evidenceUrls, forecastLabel, outcomeLabel, proposalHeadline, type EntryIdState } from '@/lib/ledger-resolutions';

interface Props {
  initialProposals: LedgerProposal[];
  initialResolutions: LedgerResolution[];
  initialForecasts: LedgerForecast[];
}

const card = 'rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3';
const btn = 'px-3 py-1.5 rounded text-xs disabled:opacity-50';
const input = 'rounded bg-slate-950 border border-slate-700 px-2 py-1 text-sm text-bone';

/**
 * The Tuesday scoring pass (spec "Weekly workflow"). The ingest PROPOSES; every
 * resolution here waits for Confirm, which locks the field permanently and
 * records who and when. Reject leaves the field open. Nothing on this page
 * posts anything: the card texts are for you to post by hand.
 */
export function ResolutionQueue({ initialProposals, initialResolutions, initialForecasts }: Props) {
  const router = useRouter();
  const [proposals, setProposals] = useState(initialProposals);
  const [resolutions, setResolutions] = useState(initialResolutions);
  const [forecasts, setForecasts] = useState(initialForecasts);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch('/api/admin/ledger/resolutions');
    if (res.status === 401) {
      router.push('/signin');
      return;
    }
    if (!res.ok) throw new Error('Failed to reload');
    const data = (await res.json()) as { proposals: LedgerProposal[]; resolutions: LedgerResolution[]; forecasts: LedgerForecast[] };
    setProposals(data.proposals);
    setResolutions(data.resolutions);
    setForecasts(data.forecasts);
  }, [router]);

  const v1ByEntry = useMemo(() => {
    const m = new Map<string, LedgerForecast>();
    for (const f of forecasts) if (f.status === 'published' && f.entry_id && Number(f.version) === 1) m.set(f.entry_id, f);
    return m;
  }, [forecasts]);
  const idStates = useMemo(() => entryIdStates(forecasts), [forecasts]);

  async function decide(p: LedgerProposal, decision: 'confirmed' | 'rejected') {
    if (decision === 'confirmed' && !window.confirm(`Confirm ${p.entry_id} ${proposalHeadline(p)}?\n\nThis locks the field permanently. It is never revised.`)) return;
    setBusy(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ledger/resolutions/${p.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: notes[p.id] ?? null }),
      });
      if (res.status === 401) {
        router.push('/signin');
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Decision failed (${res.status})`);
      setMessages((m) => ({ ...m, [p.id]: decision === 'confirmed' ? 'Confirmed and locked.' : 'Rejected; the field stays open.' }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  const openByEntry = useMemo(() => {
    const m = new Map<string, LedgerResolution[]>();
    for (const r of resolutions) m.set(r.entry_id, [...(m.get(r.entry_id) ?? []), r]);
    return m;
  }, [resolutions]);

  return (
    <div className="space-y-10">
      <p className="text-xs text-slate-500">
        The ingest reads snap counts, the official injury report and the transaction wire, applies the pre-registered rules, and proposes. Nothing resolves until you confirm it
        here. A confirmed field is locked and never revised. Reject leaves the field open.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* ── Pending proposals ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-bone">Proposed resolutions · {proposals.length}</h2>
        {proposals.length === 0 && <p className="text-xs text-slate-600">No proposals waiting. The ingest runs daily; a shadow pass below shows what it sees today.</p>}
        {proposals.map((p) => {
          const v1 = v1ByEntry.get(p.entry_id);
          return (
            <div key={p.id} className={card}>
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>
                  {p.entry_id} · {v1 ? `${v1.player} (${v1.team})` : 'entry not found'} · proposed {new Date(p.proposed_at).toLocaleString()}
                </span>
                <span>{p.proposer}</span>
              </div>
              <div className="text-sm text-bone">
                <span className="font-semibold">{proposalHeadline(p)}</span>
                {v1 && <span className="text-slate-400"> · v1 forecast {forecastLabel(p.field, v1)}</span>}
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div>Freeze point: {p.freeze_at ? new Date(p.freeze_at).toISOString() : 'none (by rule)'}</div>
                {p.evidence?.note && <div>{p.evidence.note}</div>}
                {p.evidence?.sentence && <blockquote className="border-l-2 border-slate-700 pl-3 text-slate-300">“{p.evidence.sentence}”</blockquote>}
                {p.evidence?.basis && (
                  <div className="font-mono text-slate-500">
                    team {p.evidence.basis.team} ({p.evidence.basis.team_source}) · season {p.evidence.basis.season}
                    {p.evidence.basis.season_assumed ? ' (assumed)' : ''} · pfr {p.evidence.basis.pfr_id ?? '—'} · gsis {p.evidence.basis.gsis_id ?? '—'}
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  {evidenceUrls(p).map((u) => (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-signal-cyan hover:text-signal-cyan-hover">
                      {u.replace(/^https?:\/\//, '').slice(0, 60)}
                    </a>
                  ))}
                </div>
              </div>
              <input
                value={notes[p.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                placeholder="Note (optional; recorded with your decision)"
                className={`${input} w-full`}
              />
              <div className="flex items-center gap-2">
                <button onClick={() => decide(p, 'confirmed')} disabled={busy === p.id} className={`${btn} bg-emerald-700 text-emerald-50 font-semibold hover:bg-emerald-600`}>
                  Confirm and lock
                </button>
                <button onClick={() => decide(p, 'rejected')} disabled={busy === p.id} className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}>
                  Reject
                </button>
                {messages[p.id] && <span className="text-xs text-slate-400">{messages[p.id]}</span>}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Field status per entry ────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-bone">Fields by entry</h2>
        {[...openByEntry.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([entryId, rows]) => {
          const v1 = v1ByEntry.get(entryId);
          return (
            <div key={entryId} className="rounded border border-slate-800 p-3 text-xs">
              <div className="font-mono text-slate-400 mb-2">
                {entryId} · {v1?.player ?? '—'} · injury {v1 ? String(v1.injury_date).slice(0, 10) : '—'}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {LEDGER_FIELDS.map((f) => {
                  const r = rows.find((x) => x.field === f);
                  return (
                    <div key={f} className="rounded bg-slate-950 border border-slate-800 p-2">
                      <div className="text-slate-500">{f}</div>
                      <div className="text-bone">{v1 ? forecastLabel(f, v1) : '—'}</div>
                      <div className={r?.status === 'open' ? 'text-slate-500' : r?.status === 'void' ? 'text-amber-300' : 'text-emerald-300'}>
                        {!r ? '—' : r.status === 'open' ? 'open' : r.status === 'void' ? `void: ${r.void_reason}` : outcomeLabel(f as LedgerField, r.outcome)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <ShadowPass />
      <LinkagePanel states={idStates} onAttached={reload} />
      <CorrectionForm entryIds={idStates.map((s) => s.entry_id)} />
      <CardTexts />
    </div>
  );
}

// ── Shadow pass ──────────────────────────────────────────────────────────

function ShadowPass() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LedgerIngestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ledger/ingest', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as LedgerIngestSummary & { error?: string };
      if (!res.ok && !data.mode) throw new Error(data.error ?? `Shadow pass failed (${res.status})`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-bone">Shadow pass</h2>
        <button onClick={run} disabled={running} className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}>
          {running ? 'Reading sources…' : 'Run a shadow pass (files nothing)'}
        </button>
      </div>
      <p className="text-xs text-slate-500">Reads every source now and shows what the ingest would propose and why the rest is held. It writes nothing.</p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {result && (
        <div className="rounded border border-slate-800 p-3 text-xs space-y-2 font-mono">
          {result.aborted ? (
            <div className="text-red-400">ABORTED: {result.abort_reason} (nothing would be proposed)</div>
          ) : (
            <div className="text-slate-400">
              as of {result.today} · entries {result.entries} · open fields {result.open_fields} · would propose {result.proposed}
            </div>
          )}
          {result.contexts?.map((c) => (
            <div key={c.entry_id} className="text-slate-500">
              {c.entry_id}: team {c.team || '—'} ({c.team_source}) · season {c.season}
              {c.season_assumed ? ' (assumed)' : ''} · pfr {c.pfr_id ?? '—'} · gsis {c.gsis_id ?? '—'}
            </div>
          ))}
          {result.proposals?.map((p) => (
            <div key={`${p.entry_id}${p.field}`} className="text-emerald-300">
              would propose {p.entry_id} {p.field} {p.proposed_status} {p.proposed_status === 'resolved' ? `${outcomeLabel(p.field, p.proposed_outcome)} on ${p.outcome_date}` : p.void_reason}
            </div>
          ))}
          {result.held_fields?.map((h) => (
            <div key={`${h.entry_id}${h.field}`} className={h.status === 'unresolvable' ? 'text-amber-300' : 'text-slate-500'}>
              held {h.entry_id} {h.field} {h.status}: {h.reason}
              {h.freeze_at ? ` (freezes ${h.freeze_at})` : ''}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Linkage ──────────────────────────────────────────────────────────────

function LinkagePanel({ states, onAttached }: { states: EntryIdState[]; onAttached: () => Promise<void> }) {
  const missing = states.filter((s) => s.missing);
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-bone">Entries missing nflverse ids · {missing.length}</h2>
      <p className="text-xs text-slate-500">
        Snap counts are keyed on the PFR id and the injury report on the GSIS id. Without them F2–F5 cannot resolve. Ids are looked up from the ESPN athlete id, never by name,
        and are set once: they cannot be changed after you attach them. They are not part of the row hash.
      </p>
      {missing.length === 0 && <p className="text-xs text-slate-600">Every published entry carries its ids.</p>}
      {missing.map((s) => (
        <LinkageRow key={s.entry_id} state={s} onAttached={onAttached} />
      ))}
    </section>
  );
}

function LinkageRow({ state, onAttached }: { state: EntryIdState; onAttached: () => Promise<void> }) {
  const [espn, setEspn] = useState(state.espn_athlete_id ?? '');
  const [team, setTeam] = useState(state.nflverse_team ?? '');
  const [season, setSeason] = useState(String(state.season ?? state.injury_date.slice(0, 4)));
  const [roster, setRoster] = useState<string | null>(null);
  const [lookup, setLookup] = useState<NflverseLookup | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function findInRoster() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/ledger/players?name=${encodeURIComponent(state.player)}`);
      const data = (await res.json().catch(() => ({}))) as { resolution?: { resolved: boolean; player: { espn_athlete_id?: string | null; name?: string; confidence?: string; current_team_abbreviation?: string | null; position?: string | null } | null }; error?: string };
      const p = data.resolution?.player;
      if (!res.ok || !data.resolution?.resolved || !p?.espn_athlete_id) {
        setRoster(`Not found in our roster${data.error ? `: ${data.error}` : ''}. Enter the ESPN id from the athlete's espn.com URL.`);
        return;
      }
      if (p.confidence === 'ambiguous') {
        setRoster(`Two rostered athletes share "${state.player}". Enter the ESPN id from the athlete's espn.com URL instead.`);
        return;
      }
      setEspn(p.espn_athlete_id);
      setRoster(`Roster: ${p.name} · ${p.position ?? ''} ${p.current_team_abbreviation ?? ''} · ESPN ${p.espn_athlete_id} (${p.confidence}). Check this is the athlete before attaching.`);
    } finally {
      setBusy(false);
    }
  }

  async function lookUp() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/ledger/nflverse-ids?espn_id=${encodeURIComponent(espn)}`);
      const data = (await res.json().catch(() => ({}))) as { lookup?: NflverseLookup; error?: string };
      if (!res.ok || !data.lookup) {
        setMsg(`Lookup unavailable: ${data.error ?? res.status}`);
        setLookup(null);
        return;
      }
      setLookup(data.lookup);
      if (data.lookup.status === 'resolved' && !team) setTeam(data.lookup.nflverse_team ?? '');
    } finally {
      setBusy(false);
    }
  }

  async function attach() {
    if (lookup?.status !== 'resolved') return;
    if (!window.confirm(`Attach to ${state.entry_id}:\nESPN ${lookup.espn_id} · GSIS ${lookup.gsis_id} · PFR ${lookup.pfr_id} · ${team} · ${season}\n(${lookup.display_name})\n\nThese ids are permanent.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/ledger/linkage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: state.entry_id, espn_athlete_id: espn, nflverse_team: team || null, season: season || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; changed?: boolean };
      if (!res.ok) throw new Error(data.error ?? `Linkage failed (${res.status})`);
      setMsg(data.changed ? 'Attached.' : 'Already attached; nothing changed.');
      await onAttached();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <div className="text-xs font-mono text-slate-400">
        {state.entry_id} · {state.player} · {state.team} · injury {state.injury_date} · pfr {state.pfr_id ?? '—'} · gsis {state.gsis_id ?? '—'}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button onClick={findInRoster} disabled={busy} className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}>
          Find ESPN id in roster
        </button>
        <label className="text-slate-500">ESPN id</label>
        <input value={espn} onChange={(e) => setEspn(e.target.value.trim())} className={`${input} w-28`} />
        <button onClick={lookUp} disabled={busy || !/^\d+$/.test(espn)} className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}>
          Look up nflverse ids
        </button>
      </div>
      {roster && <p className="text-xs text-slate-400">{roster}</p>}
      {lookup?.status === 'resolved' && (
        <div className="text-xs space-y-2">
          <div className="font-mono text-emerald-300">
            {lookup.display_name} · GSIS {lookup.gsis_id} · PFR {lookup.pfr_id} · nflverse team now {lookup.nflverse_team ?? '—'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-slate-500">Team at injury (games.csv code)</label>
            <input value={team} onChange={(e) => setTeam(e.target.value.toUpperCase())} className={`${input} w-16`} />
            <label className="text-slate-500">Season</label>
            <input value={season} onChange={(e) => setSeason(e.target.value)} className={`${input} w-20`} />
            <button onClick={attach} disabled={busy} className={`${btn} bg-emerald-700 text-emerald-50 font-semibold hover:bg-emerald-600`}>
              Attach ids (permanent)
            </button>
          </div>
          <p className="text-slate-500">The team is the club at injury time. nflverse reports the athlete&apos;s team today, which differs after a trade.</p>
        </div>
      )}
      {lookup?.status === 'unresolved' && (
        <p className="text-xs text-amber-300">
          nflverse cannot resolve ESPN {lookup.espn_id}: {lookup.reason}, missing {lookup.missing.join(', ')}. Nothing can be attached; the gamebook fields stay unresolvable.
        </p>
      )}
      {msg && <p className="text-xs text-slate-300">{msg}</p>}
    </div>
  );
}

// ── Corrections ──────────────────────────────────────────────────────────

function CorrectionForm({ entryIds }: { entryIds: string[] }) {
  const [form, setForm] = useState({ entry_id: entryIds[0] ?? '', field: '', old_value: '', new_value: '', note: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!window.confirm('Record this correction? It is an append-only public row; it cannot be edited or removed.')) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/ledger/corrections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Correction failed (${res.status})`);
      setMsg('Recorded.');
      setForm((f) => ({ ...f, field: '', old_value: '', new_value: '', note: '' }));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-bone">Clerical correction</h2>
      <p className="text-xs text-slate-500">For a clerical error (wrong player, wrong date). It is logged beside the entry with your note. It never edits a forecast and never changes a resolution.</p>
      <div className={`${card} text-xs`}>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={form.entry_id} onChange={set('entry_id')} className={input}>
            {entryIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <input value={form.field} onChange={set('field')} placeholder="field (e.g. injury_date)" className={`${input} w-44`} />
          <input value={form.old_value} onChange={set('old_value')} placeholder="old value" className={`${input} w-44`} />
          <input value={form.new_value} onChange={set('new_value')} placeholder="new value" className={`${input} w-44`} />
        </div>
        <textarea value={form.note} onChange={set('note')} rows={2} placeholder="Note: what was wrong, and the source for the right value" className={`${input} w-full`} />
        <div className="flex items-center gap-2">
          <button onClick={submit} disabled={busy || !form.entry_id} className={`${btn} bg-slate-700 text-slate-100 hover:bg-slate-600`}>
            Record correction
          </button>
          {msg && <span className="text-slate-300">{msg}</span>}
        </div>
      </div>
    </section>
  );
}

// ── Card texts ───────────────────────────────────────────────────────────

function CardTexts() {
  const [since, setSince] = useState('');
  const [data, setData] = useState<LedgerScoreboardResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/ledger/scoreboard${since ? `?since=${since}` : ''}`);
      const body = (await res.json().catch(() => ({}))) as LedgerScoreboardResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Scoreboard failed (${res.status})`);
      setData(body);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const copy = (t: string) => void navigator.clipboard?.writeText(t).then(() => setMsg('Copied.'));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-bone">Resolution card and scoreboard card</h2>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-slate-500">Resolved since</label>
          <input type="date" value={since} onChange={(e) => setSince(e.target.value)} className={input} />
          <button onClick={load} disabled={busy} className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}>
            {busy ? 'Computing…' : 'Build text'}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Text built from confirmed resolutions and the scoring helper. Nothing is posted from here: copy it, read it, and post it yourself. Default window is the last 7 days.
      </p>
      {msg && <p className="text-xs text-slate-300">{msg}</p>}
      {data && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-slate-400">
            as of {data.as_of} · entries scored {data.summary.entries_scored} · card line {data.scoreboard_line ?? 'withheld until 20 entries are scored'}
          </div>
          {[
            ['Resolution card', data.resolution_card_text],
            ['Scoreboard card', data.scoreboard_card_text],
          ].map(([label, text]) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{label}</span>
                <button onClick={() => copy(text)} className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}>
                  Copy
                </button>
              </div>
              <textarea readOnly value={text} rows={12} className={`${input} w-full font-mono text-xs`} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
