/**
 * Pure validation for the ledger draft form (server side, before the MCP call,
 * so the physician sees every problem at once instead of one strict-input
 * rejection at a time) and the pre-confirm checks the form shows: the
 * vocabulary rule over the prose fields and the hash INPUT preview.
 *
 * `isTweetUrl` mirrors agents src/ledger/post-text.ts tweetIdFromUrl: the same
 * hosts and paths, because reply_to_url is FROZEN once the row publishes and an
 * unparseable one can only be worked around with force_standalone.
 */
import { findForbiddenWords } from './ledger-copy';
import { ledgerHashInput, type LedgerHashInput } from './ledger-row-hash';
import type { LedgerDraftInput, LedgerForecast } from './ledger-types';

export function tweetIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (!['x.com', 'twitter.com', 'mobile.twitter.com'].includes(host)) return null;
  const m = /^\/(?:i\/web|[A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,20})(?:\/|$)/.exec(u.pathname);
  return m ? m[1] : null;
}

export type DraftValidation = { ok: true; value: LedgerDraftInput } | { ok: false; errors: string[] };

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null);
// An EMPTY string is "not entered", never 0: Number('') is 0, and the first
// live draft (PT-2026-001) published F1, F2, F3 and F5 as 0.0000 because four
// untouched inputs coerced that way and passed the range check. A number the
// physician did not type is not a forecast.
const prob = (v: unknown): number | null => {
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
};
const games = (v: unknown): number | null => {
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : null;
};

/** Validate a draft body. `isRevision` makes `trigger` required (spec "Revision chain"). */
export function validateDraftInput(body: unknown, isRevision: boolean): DraftValidation {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const need = (field: string, value: unknown) => {
    if (value === null) errors.push(`${field} is required`);
    return value;
  };
  const player = need('player', str(b.player));
  const team = need('team', str(b.team));
  const position = need('position', str(b.position));
  const injury_date = str(b.injury_date);
  if (!injury_date || !/^\d{4}-\d{2}-\d{2}$/.test(injury_date)) errors.push('injury_date must be YYYY-MM-DD (the day the injury occurred, not the report date)');
  const reported_injury = need('reported_injury', str(b.reported_injury));
  const source_tier = ['A', 'B', 'C'].includes(String(b.source_tier)) ? (b.source_tier as 'A' | 'B' | 'C') : null;
  if (!source_tier) errors.push('source_tier must be A, B or C');
  const source_urls = Array.isArray(b.source_urls) ? b.source_urls.filter((u) => typeof u === 'string' && u.trim()).map((u) => (u as string).trim()) : [];
  if (source_urls.length === 0) errors.push('at least one source URL is required (every entry names its inputs)');
  for (const u of source_urls) {
    try {
      new URL(u);
    } catch {
      errors.push(`source URL is not a URL: ${u}`);
    }
  }
  const mechanism = need('mechanism', str(b.mechanism));
  const base_rate_row = need('base_rate_row', str(b.base_rate_row));
  const base_rate_strength = ['strong', 'moderate', 'thin'].includes(String(b.base_rate_strength)) ? (b.base_rate_strength as 'strong' | 'moderate' | 'thin') : null;
  if (!base_rate_strength) errors.push('base_rate_strength must be strong, moderate or thin');
  const f1_ir = prob(b.f1_ir);
  const f2_next = prob(b.f2_next);
  const f3_4wk = prob(b.f3_4wk);
  for (const [k, v] of [['f1_ir', f1_ir], ['f2_next', f2_next], ['f3_4wk', f3_4wk]] as const) if (v === null) errors.push(`${k} must be a probability from 0 to 1`);
  const f5_reinjury = b.f5_reinjury === null || b.f5_reinjury === '' || b.f5_reinjury === undefined ? null : prob(b.f5_reinjury);
  if (f5_reinjury === null && !(b.f5_reinjury === null || b.f5_reinjury === '' || b.f5_reinjury === undefined)) errors.push('f5_reinjury must be a probability from 0 to 1, or empty for a concussion entry');
  const f4_point = games(b.f4_point);
  const f4_low = games(b.f4_low);
  const f4_high = games(b.f4_high);
  if (f4_point === null || f4_low === null || f4_high === null) errors.push('f4_point, f4_low and f4_high must be whole games (0 or more)');
  else if (!(f4_low <= f4_point && f4_point <= f4_high)) errors.push('F4 interval must satisfy low ≤ point ≤ high');
  const what_moves_this = need('what_moves_this', str(b.what_moves_this));
  const tier = b.tier === 1 || b.tier === '1' ? 1 : b.tier === 2 || b.tier === '2' ? 2 : null;
  if (tier === null) errors.push('tier must be 1 (card) or 2 (ledger only)');
  const trigger = str(b.trigger);
  if (isRevision && !trigger) errors.push('a revision needs a public trigger ("changed my mind" is not a trigger)');
  const reply_to_url = str(b.reply_to_url);
  if (reply_to_url && tweetIdFromUrl(reply_to_url) === null) errors.push('reply_to_url is not a tweet URL (x.com/<handle>/status/<id>); it is frozen at publish, so fix it now or leave it empty');
  const season_ending = b.season_ending === true || b.season_ending === 'true';

  if (errors.length > 0) return { ok: false, errors };
  const value: LedgerDraftInput = {
    player: player as string,
    team: team as string,
    position: position as string,
    injury_date: injury_date as string,
    reported_injury: reported_injury as string,
    source_tier: source_tier as 'A' | 'B' | 'C',
    source_urls,
    mechanism: mechanism as string,
    base_rate_row: base_rate_row as string,
    base_rate_strength: base_rate_strength as 'strong' | 'moderate' | 'thin',
    f1_ir: f1_ir as number,
    f2_next: f2_next as number,
    f3_4wk: f3_4wk as number,
    f4_point: f4_point as number,
    f4_low: f4_low as number,
    f4_high: f4_high as number,
    f5_reinjury,
    season_ending,
    what_moves_this: what_moves_this as string,
    tier: tier as 1 | 2,
    trigger: trigger ?? null,
    reply_to_url: reply_to_url ?? null,
    espn_athlete_id: str(b.espn_athlete_id),
    gsis_id: str(b.gsis_id),
    pfr_id: str(b.pfr_id),
    nflverse_team: str(b.nflverse_team),
    season: games(b.season),
    player_id: str(b.player_id),
    entity_id: str(b.entity_id),
  };
  return { ok: true, value };
}

/**
 * Soft warnings the confirm step shows beside the gate: a probability of exactly
 * 0 or 1 is a certainty, which a reference-class forecast almost never is, and
 * an F4 interval of zero width is not an 80% interval. None of these block the
 * publish; they make the physician look twice before signing.
 */
export function forecastWarnings(row: Pick<LedgerForecast, 'f1_ir' | 'f2_next' | 'f3_4wk' | 'f5_reinjury' | 'f4_low' | 'f4_high' | 'base_rate_strength'>): string[] {
  const warnings: string[] = [];
  for (const [k, v] of [['F1', row.f1_ir], ['F2', row.f2_next], ['F3', row.f3_4wk], ['F5', row.f5_reinjury]] as const) {
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (n === 0 || n === 1) warnings.push(`${k} is ${n === 0 ? '0%' : '100%'} — a certainty, not a reference-class estimate; confirm this is intended`);
  }
  if (Number(row.f4_low) === Number(row.f4_high)) warnings.push('F4 interval has zero width; an 80% interval should admit uncertainty');
  if (row.base_rate_strength === 'thin' && Number(row.f4_high) - Number(row.f4_low) < 2) warnings.push('a thin base-rate row calls for a widened F4 interval (spec: at least twice a strong row\'s)');
  return warnings;
}

/** The prose fields the vocabulary rule governs (never the fixed strip). */
export const PROSE_FIELDS = ['player', 'team', 'reported_injury', 'mechanism', 'what_moves_this', 'trigger'] as const;

export function forbiddenWordsIn(row: Partial<Pick<LedgerForecast, (typeof PROSE_FIELDS)[number]>>): Array<{ field: string; words: string[] }> {
  const hits: Array<{ field: string; words: string[] }> = [];
  for (const f of PROSE_FIELDS) {
    const v = row[f];
    if (typeof v !== 'string' || !v) continue;
    const words = findForbiddenWords(v);
    if (words.length > 0) hits.push({ field: f, words });
  }
  return hits;
}

export interface HashPreview {
  /** The hash input as it WILL be computed, minus the two fields stamped at confirm. */
  input: Omit<LedgerHashInput, 'entry_id' | 'published_at'>;
  stamped_at_confirm: ['entry_id', 'published_at'];
  error: string | null;
}

/**
 * What the row will hash. entry_id and published_at are allocated inside the
 * publish statement (D7), so a draft cannot show its final hash — it shows the
 * canonical INPUT, and the real hash8 appears the moment the row is published.
 * A normalisation failure here is the same failure the publish would hit.
 */
export function hashPreviewFor(draft: LedgerForecast): HashPreview {
  try {
    const input = ledgerHashInput({
      ...draft,
      entry_id: draft.entry_id ?? 'PT-0000-000',
      published_at: draft.published_at ?? '1970-01-01T00:00:00.000Z',
    });
    const { entry_id: _e, published_at: _p, ...rest } = input;
    void _e;
    void _p;
    return { input: rest, stamped_at_confirm: ['entry_id', 'published_at'], error: null };
  } catch (err) {
    return {
      input: {} as HashPreview['input'],
      stamped_at_confirm: ['entry_id', 'published_at'],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type BaseRateValidation = { ok: true; value: Omit<import('./mcp').BaseRateInput, 'updated_by'> } | { ok: false; errors: string[] };

/**
 * Validate a base-rate row. Every forecast prior is optional (a thin row may
 * carry only F4), but what is present must be a probability or whole games,
 * and the F4 interval must be ordered. row_key is the stable key a forecast
 * copies, so it is slug-shaped and never renamed.
 */
export function validateBaseRateInput(body: unknown): BaseRateValidation {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const row_key = str(b.row_key)?.toLowerCase() ?? null;
  if (!row_key || !/^[a-z0-9_]{2,64}$/.test(row_key)) errors.push('row_key must be 2–64 characters of a–z, 0–9 and _ (e.g. hamstring_strain)');
  const injury_type = str(b.injury_type);
  if (!injury_type) errors.push('injury_type is required');
  const strength = ['strong', 'moderate', 'thin'].includes(String(b.strength)) ? (b.strength as 'strong' | 'moderate' | 'thin') : null;
  if (!strength) errors.push('strength must be strong, moderate or thin');
  const optProb = (k: string): number | null | undefined => {
    const v = b[k];
    if (v === undefined || v === null || v === '') return null;
    const p = prob(v);
    if (p === null) errors.push(`${k} must be a probability from 0 to 1`);
    return p;
  };
  const optGames = (k: string): number | null => {
    const v = b[k];
    if (v === undefined || v === null || v === '') return null;
    const g = games(v);
    if (g === null) errors.push(`${k} must be whole games (0 or more)`);
    return g;
  };
  const f1_ir = optProb('f1_ir');
  const f2_next = optProb('f2_next');
  const f3_4wk = optProb('f3_4wk');
  const f5_reinjury = optProb('f5_reinjury');
  const f4_point = optGames('f4_point');
  const f4_low = optGames('f4_low');
  const f4_high = optGames('f4_high');
  if (f4_point !== null && f4_low !== null && f4_high !== null && !(f4_low <= f4_point && f4_point <= f4_high)) errors.push('F4 interval must satisfy low ≤ point ≤ high');
  const source_rank = b.source_rank === undefined || b.source_rank === null || b.source_rank === '' ? null : games(b.source_rank);
  if (source_rank !== null && (source_rank < 1 || source_rank > 4)) errors.push('source_rank is 1 (empirical NFL history) to 4 (general athletic populations)');
  const n = optGames('n');
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      row_key: row_key as string,
      injury_type: injury_type as string,
      strength: strength as 'strong' | 'moderate' | 'thin',
      source_rank,
      sources: str(b.sources),
      n,
      year_range: str(b.year_range),
      f1_ir: f1_ir ?? null,
      f2_next: f2_next ?? null,
      f3_4wk: f3_4wk ?? null,
      f5_reinjury: f5_reinjury ?? null,
      f4_point,
      f4_low,
      f4_high,
      notes: str(b.notes),
    },
  };
}
