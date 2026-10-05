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
const prob = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
};
const games = (v: unknown): number | null => {
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
