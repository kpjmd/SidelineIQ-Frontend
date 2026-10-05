/**
 * Prognosis Ledger rows as the web MCP returns them (mcp migrations 026/027,
 * sidelineiq-mcp-servers src/servers/web/ledger-service.ts). NUMERIC columns
 * arrive as strings; dates arrive as ISO strings after the JSON round-trip.
 */
export type LedgerForecastStatus = 'draft' | 'published';
export type LedgerSourceTier = 'A' | 'B' | 'C';
export type LedgerBaseRateStrength = 'strong' | 'moderate' | 'thin';
export type LedgerFieldName = 'F1' | 'F2' | 'F3' | 'F4' | 'F5';

export interface LedgerForecast {
  id: string;
  status: LedgerForecastStatus;
  entry_id: string | null;
  version: number;
  published_at: string | null;
  trigger: string | null;
  player: string;
  team: string;
  position: string;
  injury_date: string;
  reported_injury: string;
  source_tier: LedgerSourceTier;
  source_urls: string[];
  mechanism: string;
  base_rate_row: string;
  base_rate_strength: LedgerBaseRateStrength;
  f1_ir: string | number;
  f2_next: string | number;
  f3_4wk: string | number;
  f4_point: number;
  f4_low: number;
  f4_high: number;
  f5_reinjury: string | number | null;
  season_ending: boolean;
  what_moves_this: string;
  tier: number;
  row_hash: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  commit_sha: string | null;
  commit_url: string | null;
  x_post_id: string | null;
  x_self_reply_id: string | null;
  farcaster_hash: string | null;
  reply_to_url: string | null;
  espn_athlete_id: string | null;
  gsis_id: string | null;
  pfr_id: string | null;
  nflverse_team: string | null;
  season: number | null;
  player_id: string | null;
  entity_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A published row: the fields the card and the public page rely on are non-null. Structurally assignable to the twin's HashableForecastRow, so the card can re-verify it. */
export interface PublishedLedgerForecast extends LedgerForecast {
  status: 'published';
  entry_id: string;
  published_at: string;
  row_hash: string;
  confirmed_by: string;
}

export function isPublishedForecast(row: LedgerForecast): row is PublishedLedgerForecast {
  return row.status === 'published' && !!row.entry_id && !!row.published_at && !!row.row_hash && !!row.confirmed_by;
}

export interface LedgerResolution {
  id: string;
  entry_id: string;
  field: LedgerFieldName;
  status: 'open' | 'resolved' | 'void';
  outcome: string | number | null;
  outcome_date: string | null;
  resolved_at: string | null;
  freeze_at: string | null;
  void_reason: string | null;
  evidence_url: string | null;
  evidence: Record<string, unknown> | null;
  proposal_id: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface LedgerCorrection {
  id: string;
  entry_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  note: string;
  corrected_by: string;
  corrected_at: string;
}

export interface LedgerBaseRate {
  row_key: string;
  injury_type: string;
  strength: LedgerBaseRateStrength;
  source_rank: number | null;
  sources: string | null;
  n: number | null;
  year_range: string | null;
  f1_ir: string | number | null;
  f2_next: string | number | null;
  f3_4wk: string | number | null;
  f5_reinjury: string | number | null;
  f4_point: number | null;
  f4_low: number | null;
  f4_high: number | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface LedgerEntryDetail {
  entry_id: string;
  versions: LedgerForecast[];
  resolutions: LedgerResolution[];
  corrections: LedgerCorrection[];
  proposals: unknown[];
}

export interface LedgerPublishGate {
  role_ok: boolean;
  passed: boolean;
  reasons: string[];
}

/** web_publish_ledger_forecast: a blocked publish is a SUCCESSFUL call with published:false (→ 422). */
export interface LedgerPublishResult {
  published: boolean;
  gate: LedgerPublishGate;
  forecast: LedgerForecast | null;
  resolutions: LedgerResolution[];
}

/** The draft fields the MD fills in; the MCP's web_create_ledger_draft input minus created_by. */
export interface LedgerDraftInput {
  player: string;
  team: string;
  position: string;
  injury_date: string;
  reported_injury: string;
  source_tier: LedgerSourceTier;
  source_urls: string[];
  mechanism: string;
  base_rate_row: string;
  base_rate_strength: LedgerBaseRateStrength;
  f1_ir: number;
  f2_next: number;
  f3_4wk: number;
  f4_point: number;
  f4_low: number;
  f4_high: number;
  f5_reinjury: number | null;
  season_ending: boolean;
  what_moves_this: string;
  tier: 1 | 2;
  trigger?: string | null;
  reply_to_url?: string | null;
  espn_athlete_id?: string | null;
  gsis_id?: string | null;
  pfr_id?: string | null;
  nflverse_team?: string | null;
  season?: number | null;
  player_id?: string | null;
  entity_id?: string | null;
}

/** reply_proposals (027): the physician approves or discards; the system moves approved → posted. */
export interface ReplyProposal {
  id: string;
  platform: 'x' | 'farcaster';
  mention_id: string;
  mention_url: string | null;
  mention_author: string | null;
  mention_text: string | null;
  proposed_text: string;
  proposed_at: string;
  decision: 'pending' | 'approved' | 'posted' | 'discarded';
  decided_by: string | null;
  decided_at: string | null;
  approved_text: string | null;
  post_attempted_at: string | null;
  post_error: string | null;
  posted_text: string | null;
  posted_id: string | null;
  note: string | null;
}

/** POST agents /admin/ledger/publish/:id — src/ledger/publish.ts LedgerPublishOutcome. */
export interface LedgerDistributeOutcome {
  success: boolean;
  dry_run: boolean;
  mirrored: boolean;
  forecast: { id: string; entry_id: string; version: number; row_hash: string };
  commit: { path: string; message: string; status: string; sha?: string; url?: string; body?: string; error?: string };
  x: { text: string; reply_to_id: string | null; status: string; post_id?: string; error?: string };
  x_self_reply: { text: string; status: string; id?: string; error?: string };
  farcaster: { text: string; embeds: Array<{ url: string }>; channel_id: string | null; byte_length: number; status: string; hash?: string; error?: string };
  provenance: { recorded: boolean; error?: string };
  warnings: string[];
}

/** GET agents /admin/ledger/nflverse-ids — src/ledger/nflverse-players.ts NflverseLookup. */
export type NflverseLookup =
  | { status: 'resolved'; espn_id: string; gsis_id: string; pfr_id: string; nflverse_team: string | null; display_name: string; position: string | null; source_fetched_at: string }
  | { status: 'unresolved'; espn_id: string; reason: 'no_row' | 'missing_ids'; missing: Array<'gsis_id' | 'pfr_id'>; partial: Record<string, string | null> | null; source_fetched_at: string };
