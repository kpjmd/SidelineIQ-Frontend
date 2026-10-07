/**
 * Pure helpers for /admin/ledger/resolutions (Stage 3): how a proposal reads to
 * the physician, which entries still lack the ids the ingest keys on, and the
 * validators for the correction and linkage forms. No I/O.
 *
 * The automation boundary this page serves (spec "Implementation handoff →
 * Automation boundary"): the ingest proposes; the physician confirms; the
 * system records who confirmed and when. A confirmed resolution is locked and
 * never revised.
 */
import { LEDGER_FIELD_SPECS, type LedgerField } from './ledger-fields';
import { pct, f4Label } from './ledger-card';
import type { LedgerForecast, LedgerProposal } from './ledger-types';

export const ENTRY_ID_RE = /^PT-\d{4}-\d{3,}$/;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The forecast a field carries on one version, as the card prints it. */
export function forecastLabel(field: LedgerField, row: Pick<LedgerForecast, 'f1_ir' | 'f2_next' | 'f3_4wk' | 'f5_reinjury' | 'f4_point' | 'f4_low' | 'f4_high'>): string {
  if (field === 'F4') {
    const [p, lo, hi] = [num(row.f4_point), num(row.f4_low), num(row.f4_high)];
    return p === null || lo === null || hi === null ? '—' : f4Label(p, lo, hi);
  }
  const v = num(field === 'F1' ? row.f1_ir : field === 'F2' ? row.f2_next : field === 'F3' ? row.f3_4wk : row.f5_reinjury);
  return v === null ? '—' : pct(v);
}

/** The proposed actual, in words. */
export function outcomeLabel(field: LedgerField, outcome: unknown): string {
  const o = num(outcome);
  if (o === null) return '—';
  switch (field) {
    case 'F1':
      return o === 1 ? 'placed on IR' : 'not placed on IR';
    case 'F2':
    case 'F3':
      return o === 1 ? 'played' : 'did not play';
    case 'F4':
      return `${o} game${o === 1 ? '' : 's'} missed`;
    case 'F5':
      return o === 1 ? 'same-site re-injury with a game missed' : 'no qualifying re-injury';
  }
}

export function proposalHeadline(p: LedgerProposal): string {
  const label = `${p.field} ${LEDGER_FIELD_SPECS[p.field].label}`;
  if (p.proposed_status === 'void') return `${label}: void (${p.void_reason ?? 'no reason'})`;
  return `${label}: ${outcomeLabel(p.field, p.proposed_outcome)}${p.outcome_date ? ` on ${p.outcome_date.slice(0, 10)}` : ''}`;
}

/** Every URL the proposal cites, deduplicated, evidence_url first. */
export function evidenceUrls(p: LedgerProposal): string[] {
  const urls = [p.evidence_url, ...(p.evidence?.urls ?? [])].filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u));
  return [...new Set(urls)];
}

export interface EntryIdState {
  entry_id: string;
  player: string;
  team: string;
  season: number | null;
  injury_date: string;
  espn_athlete_id: string | null;
  gsis_id: string | null;
  pfr_id: string | null;
  nflverse_team: string | null;
  /** True when the ingest cannot resolve F2–F5 for this entry. */
  missing: boolean;
}

/** One row per published entry: the ids its versions carry (linkage sets all versions alike). */
export function entryIdStates(forecasts: LedgerForecast[]): EntryIdState[] {
  const byEntry = new Map<string, LedgerForecast[]>();
  for (const f of forecasts) {
    if (f.status !== 'published' || !f.entry_id) continue;
    byEntry.set(f.entry_id, [...(byEntry.get(f.entry_id) ?? []), f]);
  }
  const first = <K extends keyof LedgerForecast>(rows: LedgerForecast[], k: K) => (rows.map((r) => r[k]).find((v) => v !== null && v !== undefined && v !== '') ?? null) as LedgerForecast[K] | null;
  return [...byEntry.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([entry_id, rows]) => {
      const v1 = rows.find((r) => Number(r.version) === 1) ?? rows[0];
      const gsis = first(rows, 'gsis_id') as string | null;
      const pfr = first(rows, 'pfr_id') as string | null;
      const season = first(rows, 'season');
      return {
        entry_id,
        player: v1.player,
        team: v1.team,
        season: season === null ? null : Number(season),
        injury_date: String(v1.injury_date).slice(0, 10),
        espn_athlete_id: first(rows, 'espn_athlete_id') as string | null,
        gsis_id: gsis,
        pfr_id: pfr,
        nflverse_team: first(rows, 'nflverse_team') as string | null,
        missing: !gsis || !pfr,
      };
    });
}

// ── Validators ─────────────────────────────────────────────────────────

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export type CorrectionValidation =
  | { ok: true; value: { entry_id: string; field: string; old_value: string | null; new_value: string | null; note: string } }
  | { ok: false; errors: string[] };

/** A clerical correction (spec "Publication": wrong player, wrong date). A note is required: it is the public record. */
export function validateCorrectionInput(body: unknown): CorrectionValidation {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const entry_id = str(b.entry_id);
  if (!entry_id || !ENTRY_ID_RE.test(entry_id)) errors.push('entry_id must be PT-YYYY-NNN');
  const field = str(b.field);
  if (!field || field.length > 64) errors.push('field is required (up to 64 characters)');
  const note = str(b.note);
  if (!note || note.length < 5) errors.push('note is required: say what was wrong and what it should be');
  const old_value = str(b.old_value);
  const new_value = str(b.new_value);
  for (const [k, v] of [['old_value', old_value], ['new_value', new_value]] as const) if (v && v.length > 2000) errors.push(`${k} is too long`);
  if (!old_value && !new_value) errors.push('give the old value, the new value, or both');
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { entry_id: entry_id!, field: field!, old_value, new_value, note: note! } };
}

export type LinkageValidation =
  | { ok: true; value: { entry_id: string; espn_athlete_id: string; nflverse_team: string | null; season: number | null } }
  | { ok: false; errors: string[] };

/**
 * The linkage form carries ONLY the ESPN id plus team and season. The GSIS and
 * PFR ids are looked up server-side from the ESPN id and are never accepted
 * from the browser, so a typed id cannot be attached.
 */
export function validateLinkageInput(body: unknown): LinkageValidation {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const entry_id = str(b.entry_id);
  if (!entry_id || !ENTRY_ID_RE.test(entry_id)) errors.push('entry_id must be PT-YYYY-NNN');
  const espn = str(b.espn_athlete_id);
  if (!espn || !/^\d{1,12}$/.test(espn)) errors.push('espn_athlete_id must be numeric');
  const teamRaw = str(b.nflverse_team);
  const team = teamRaw ? teamRaw.toUpperCase() : null;
  if (team && !/^[A-Z]{2,3}$/.test(team)) errors.push('nflverse_team is the 2–3 letter code games.csv uses (e.g. BAL, LA, WAS)');
  const seasonRaw = b.season === undefined || b.season === null || b.season === '' ? null : Number(b.season);
  if (seasonRaw !== null && !(Number.isInteger(seasonRaw) && seasonRaw >= 2000 && seasonRaw <= 2100)) errors.push('season must be a year');
  for (const k of ['gsis_id', 'pfr_id']) if (b[k] !== undefined) errors.push(`${k} is looked up from the ESPN id and cannot be supplied`);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { entry_id: entry_id!, espn_athlete_id: espn!, nflverse_team: team, season: seasonRaw } };
}
