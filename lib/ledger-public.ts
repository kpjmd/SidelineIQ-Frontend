/**
 * The public ledger's one data view (Stage 4; spec "Public site", "Scoring
 * integrity", "Publication"). Pure: every public ledger page and the CSV route
 * build from `publicLedger(await exportLedger(), asOf)` and nothing else.
 *
 * What may reach a reader is decided here, once:
 *  - only rows `isPublishedForecast` accepts (no draft, ever);
 *  - no proposal: the export carries none, and a PublicLedger has no key for one;
 *  - `as_of` (decision S4-1) is the ledger at the end of that New York day,
 *    through the twin's `ledgerAsOf`, so a monthly board stays recomputable.
 *
 * Scoring is the pinned twin `ledger-scoring.ts`; nothing here computes a number
 * of its own.
 */
import { endOfEtDay, isAsOfDate, ledgerAsOf } from './ledger-export-csv';
import { summarizeLedger, type ScoreboardSummary } from './ledger-scoring';
import { isPublishedForecast, type LedgerCorrection, type LedgerExport, type LedgerFieldName, type LedgerResolution, type PublishedLedgerForecast } from './ledger-types';

export interface PublicLedger {
  forecasts: PublishedLedgerForecast[];
  resolutions: LedgerResolution[];
  corrections: LedgerCorrection[];
  exported_at: string;
  /** The New York date the view is as of, or null for live. */
  as_of: string | null;
}

export { isAsOfDate };

const ROW_KEY_RE = /^[a-z0-9_]{1,64}$/;
export const isRowKey = (value: unknown): value is string => typeof value === 'string' && ROW_KEY_RE.test(value);

/** Read `?as_of=` off a search-params record: null when absent, undefined when malformed. */
export function asOfParam(raw: string | string[] | undefined | null): string | null | undefined {
  if (raw === undefined || raw === null || raw === '') return null;
  return typeof raw === 'string' && isAsOfDate(raw) ? raw : undefined;
}

export function publicLedger(exp: LedgerExport, asOf: string | null = null): PublicLedger {
  if (asOf !== null && !isAsOfDate(asOf)) throw new Error(`as_of is not a YYYY-MM-DD date: ${JSON.stringify(asOf)}`);
  const base = {
    forecasts: exp.forecasts.filter(isPublishedForecast),
    resolutions: exp.resolutions,
    corrections: exp.corrections ?? [],
  };
  const view = asOf ? ledgerAsOf(base, endOfEtDay(asOf)) : base;
  const entries = new Set(view.forecasts.map((f) => f.entry_id));
  // Built field by field, so nothing the export might grow later rides along.
  return {
    forecasts: view.forecasts,
    resolutions: view.resolutions.filter((r) => entries.has(r.entry_id)),
    corrections: view.corrections.filter((c) => entries.has(c.entry_id)),
    exported_at: exp.exported_at,
    as_of: asOf,
  };
}

/** Every version of one entry, v1 first. */
export function versionsOf(ledger: PublicLedger, entryId: string): PublishedLedgerForecast[] {
  return ledger.forecasts.filter((f) => f.entry_id === entryId).sort((a, b) => a.version - b.version);
}

/** The latest version of each entry, most recently published entry first. */
export function latestPerEntry(ledger: PublicLedger): PublishedLedgerForecast[] {
  const latest = new Map<string, PublishedLedgerForecast>();
  for (const r of ledger.forecasts) {
    const prev = latest.get(r.entry_id);
    if (!prev || prev.version < r.version) latest.set(r.entry_id, r);
  }
  return [...latest.values()].sort((a, b) => (a.published_at < b.published_at ? 1 : a.published_at > b.published_at ? -1 : 0));
}

/**
 * The injury type an entry belongs to is its v1's base-rate row — the
 * headline board's version — so an entry whose revision changed rows is never
 * counted under two types.
 */
export function rowKeyOf(ledger: PublicLedger, entryId: string): string | null {
  return versionsOf(ledger, entryId).find((v) => v.version === 1)?.base_rate_row ?? null;
}

export function entriesForRow(ledger: PublicLedger, rowKey: string): string[] {
  const ids = new Set(ledger.forecasts.map((f) => f.entry_id));
  return [...ids].filter((id) => rowKeyOf(ledger, id) === rowKey).sort();
}

export function rowKeysWithEntries(ledger: PublicLedger): string[] {
  const keys = new Set<string>();
  for (const id of new Set(ledger.forecasts.map((f) => f.entry_id))) {
    const k = rowKeyOf(ledger, id);
    if (k) keys.add(k);
  }
  return [...keys].sort();
}

/** Both boards over the whole ledger, or over a subset of entries (an injury type, one entry). */
export function summarizeFor(ledger: PublicLedger, entryIds?: Iterable<string>): ScoreboardSummary {
  const only = entryIds ? new Set(entryIds) : null;
  const keep = (id: string) => !only || only.has(id);
  return summarizeLedger(
    ledger.forecasts.filter((f) => keep(f.entry_id)),
    ledger.resolutions.filter((r) => keep(r.entry_id)),
  );
}

export interface FieldScoring {
  /** The version the Latest board scores for this field (v1 on the Initial board). */
  latest_version?: number;
  /** Why a resolved field is not on either board. */
  excluded?: string;
}

/** For each resolved field of one entry: which version counts, or why none does. */
export function scoringByField(ledger: PublicLedger, entryId: string): Partial<Record<LedgerFieldName, FieldScoring>> {
  const s = summarizeFor(ledger, [entryId]);
  const out: Partial<Record<LedgerFieldName, FieldScoring>> = {};
  for (const o of s.observations) out[o.field] = { latest_version: o.latest_version };
  for (const e of s.exclusions) out[e.field] = { excluded: e.reason };
  return out;
}

export function statusCounts(ledger: PublicLedger, entryId: string): { resolved: number; void: number; open: number } {
  const c = { resolved: 0, void: 0, open: 0 };
  for (const r of ledger.resolutions) if (r.entry_id === entryId) c[r.status] += 1;
  return c;
}

/** A linkage correction (mcp 028) in words; null for any other correction or an unreadable value. */
export function linkageSummary(c: LedgerCorrection): string | null {
  if (c.field !== 'linkage' || !c.new_value) return null;
  try {
    const v = JSON.parse(c.new_value) as Record<string, unknown>;
    const parts = [
      v.espn_athlete_id ? `ESPN ${v.espn_athlete_id}` : null,
      v.gsis_id ? `GSIS ${v.gsis_id}` : null,
      v.pfr_id ? `PFR ${v.pfr_id}` : null,
      v.nflverse_team ? `team ${v.nflverse_team}` : null,
      v.season ? `season ${v.season}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : null;
  } catch {
    return null;
  }
}

export interface ResolutionEvidence {
  urls: string[];
  note: string | null;
  /** The quoted transaction sentence, when the field was decided by one. */
  sentence: string | null;
}

/** What a reader may see of a resolution's evidence: links, the note, the quoted sentence. Never the ingest's basis. */
export function resolutionEvidence(r: LedgerResolution): ResolutionEvidence {
  const ev = (r.evidence ?? {}) as { urls?: unknown; note?: unknown; sentence?: unknown };
  const listed = Array.isArray(ev.urls) ? ev.urls : [];
  const urls = [r.evidence_url, ...listed].filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u));
  return {
    urls: [...new Set(urls)],
    note: typeof ev.note === 'string' && ev.note ? ev.note : null,
    sentence: typeof ev.sentence === 'string' && ev.sentence ? ev.sentence : null,
  };
}

/** The UTC instant as a New York calendar date, the ledger's own calendar. */
export function etDate(instant: string | null | undefined): string | null {
  if (!instant) return null;
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/** The New York date the live ledger is "as of": the export instant's ET day. */
export function asOfLabel(ledger: PublicLedger): string {
  return ledger.as_of ?? etDate(ledger.exported_at) ?? ledger.exported_at.slice(0, 10);
}

/**
 * The monthly scoreboard dates (spec "Publication": the first Tuesday of each
 * month) from the first one, 2026-11-03, through `today` (a New York date),
 * newest first. Each is a permanent `?as_of=` view.
 */
export const FIRST_MONTHLY_BOARD = '2026-11-03';
export function monthlyBoardDates(today: string): string[] {
  const out: string[] = [];
  let [y, m] = [Number(FIRST_MONTHLY_BOARD.slice(0, 4)), Number(FIRST_MONTHLY_BOARD.slice(5, 7))];
  for (;;) {
    const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const day = 1 + ((2 - firstDow + 7) % 7);
    const d = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (d > today) break;
    out.push(d);
    if (++m > 12) [y, m] = [y + 1, 1];
  }
  return out.reverse();
}
