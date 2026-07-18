export type Sport = 'NFL' | 'NBA' | 'PREMIER_LEAGUE' | 'UFC' | 'OTHER';
export type InjurySeverity = 'MINOR' | 'MODERATE' | 'SEVERE' | 'UNKNOWN';
export type ContentType = 'BREAKING' | 'TRACKING' | 'DEEP_DIVE' | 'CONFLICT_FLAG';
export type PostStatus = 'PUBLISHED' | 'PENDING_REVIEW' | 'DRAFT';
export type MdReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// ── Auth / identity (Phase 2 foundation) ─────────────────────────────────────
export type UserRole = 'md' | 'editor';

// Shape returned by the web_get_user / web_get_user_by_email MCP tools.
export interface DeskUser {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  created_at: string;
}

export interface InjuryPost {
  id: string;
  athlete_name: string;
  sport: Sport;
  team: string;
  injury_type: string;
  injury_severity: InjurySeverity;
  content_type: ContentType;
  headline: string;
  clinical_summary: string;
  return_to_play_min_weeks: number | null;
  return_to_play_max_weeks: number | null;
  rtp_probability_week_2: number | null;
  rtp_probability_week_4: number | null;
  rtp_probability_week_8: number | null;
  rtp_confidence: number | null;
  farcaster_hash: string | null;
  twitter_id: string | null;
  source_url: string | null;
  status: PostStatus;
  md_review_required: boolean;
  md_review_reason: string | null;
  md_review_confidence: number | null;
  conflict_reason: string | null;
  team_timeline_weeks: number | null;
  // Legacy fact-sweep tracking (web_get_post returns these; FactValidationPanel reads them).
  corrected_at?: string | null;
  correction_count?: number | null;
  version: number;
  parent_post_id: string | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface MdReview {
  id: string;
  post_id: string;
  reason: string;
  status: MdReviewStatus;
  reviewer_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  // Joined from injury_posts
  athlete_name?: string;
  sport?: Sport;
  headline?: string;
  slug?: string | null;
}

export interface FeedResponse {
  posts: InjuryPost[];
  total: number;
  has_more: boolean;
  next_offset: number | null;
}

export interface ListPostsFilters {
  sport?: Sport;
  content_type?: ContentType;
  status?: PostStatus;
  athlete_name?: string;
  limit?: number;
  offset?: number;
}

// ── Injury Desk promotion candidates (Phase 1) ───────────────────────────────

export type Laterality = 'LEFT' | 'RIGHT' | 'BILATERAL' | 'UNSPECIFIED';
export type CandidateStatus = 'PROPOSED' | 'ACCEPTED' | 'DISMISSED' | 'PROMOTED';
export type CandidateDecision = 'ACCEPTED' | 'DISMISSED';
// NEW_POST: accepting drafts a brand-new desk post (the original Phase 1
// flow). RETURN_WATCH_UPDATE: accepting routes to target_desk_post_id's
// editor to append a dated follow-up instead (see migration 015).
export type CandidateKind = 'NEW_POST' | 'RETURN_WATCH_UPDATE';

// Row returned by web_list_candidates — the desk_candidates row joined to
// athlete / entity / source-post display fields.
export interface CandidateListItem {
  id: string;
  entity_id: string;
  source_post_id: string | null;
  promotion_score: number;
  reasons: string[] | null;
  status: CandidateStatus;
  candidate_kind: CandidateKind;
  target_desk_post_id: string | null;
  proposed_at: string;
  decided_at: string | null;
  decided_by: string | null;
  // Joined display fields
  athlete_name: string | null;
  sport: Sport | null;
  body_part: string | null;
  laterality: Laterality | null;
  injury_type: string | null;
  headline: string | null;
  slug: string | null;
}

// ── Injury entities + timeline (Phase 0 / read tools added in 2E) ────────────

export type EntityStatus = 'ACTIVE' | 'RESOLVED' | 'RETIRED';
export type UpdateKind =
  | 'INITIAL'
  | 'TRACKING'
  | 'CONFLICT'
  | 'DEEP_DIVE'
  | 'CORRECTION'
  | 'RESOLUTION';

// ── Injury threads (Managed Session layer, mcp migration 014) ────────────────
export type DateConfidence = 'unknown' | 'possible' | 'probable' | 'confirmed';

export interface DateResolutionSource {
  url?: string;
  title?: string;
  stage: 'api' | 'web_search' | 'md_manual';
}

export interface OtmProjection {
  min_weeks: number;
  max_weeks: number;
  probability_week_2?: number;
  probability_week_4?: number;
  probability_week_8?: number;
  projected_return_date?: string | null;
  created_at?: string;
}

export interface AccuracyRecord {
  projected_return_date: string | null;
  actual_return_date: string | null;
  error_days: number | null;
  within_range: boolean | null;
  otm_min_weeks: number | null;
  otm_max_weeks: number | null;
}

// Shape returned by web_get_entity / web_thread_get.
export interface InjuryEntity {
  id: string;
  player_id: string;
  body_part: string | null;
  laterality: Laterality;
  injury_type: string | null;
  status: EntityStatus;
  canonical_post_id: string | null;
  first_reported_at: string;
  last_updated_at: string;
  actual_return_date: string | null;
  // migration 014 — present after the migration is applied.
  injury_date?: string | null;
  injury_date_confidence?: DateConfidence;
  surgery_date?: string | null;
  surgery_confirmed?: boolean;
  date_resolution_sources?: DateResolutionSource[] | null;
  otm_projection?: OtmProjection | null;
  accuracy_record?: AccuracyRecord | null;
  returned_at?: string | null;
  closed_at?: string | null;
  needs_date_review?: boolean;
}

// Shape returned by web_list_threads (entity joined with athlete/team display).
export interface ThreadListItem {
  id: string;
  player_id: string;
  athlete_name: string | null;
  sport: Sport | null;
  team_name: string | null;
  body_part: string | null;
  laterality: Laterality;
  injury_type: string | null;
  status: EntityStatus;
  injury_date: string | null;
  injury_date_confidence: DateConfidence;
  surgery_date: string | null;
  surgery_confirmed: boolean;
  needs_date_review: boolean;
  otm_projection: OtmProjection | null;
  accuracy_record: AccuracyRecord | null;
  actual_return_date: string | null;
  returned_at: string | null;
  closed_at: string | null;
  first_reported_at: string;
  last_updated_at: string;
}

export interface ThreadDetail {
  entity: InjuryEntity;
  updates: InjuryUpdate[];
}

// Shape returned (newest-first) by web_list_injury_updates.
export interface InjuryUpdate {
  id: string;
  entity_id: string;
  post_id: string | null;
  update_kind: UpdateKind;
  severity_at_time: string | null;
  team_timeline_weeks: number | null;
  otm_min_weeks: number | null;
  source_url: string | null;
  description: string | null;
  created_at: string;
}

// ── Injury Desk (Tier 2) — desk posts, attestations, lint, publish gate ──────
// Mirror the mcp client.ts shapes field-for-field so JSON parses cleanly.

export type DeskPostStatus = 'DRAFT' | 'READY' | 'PUBLISHED' | 'RETRACTED';

export interface DeskPost {
  id: string;
  candidate_id: string | null;
  entity_id: string;
  slug: string;
  title: string;
  markdown_body: string;
  draft_json: unknown;
  status: DeskPostStatus;
  version: number;
  author_id: string | null;
  reviewed_by: string | null;
  attestation_id: string | null;
  content_hash: string;
  source_attribution: unknown;
  disclaimer_present: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

// desk_list rows — DeskPost joined to athlete/injury display fields.
export interface DeskPostListItem extends DeskPost {
  athlete_name: string | null;
  sport: string | null;
  body_part: string | null;
  laterality: Laterality | null;
  injury_type: string | null;
}

export interface DeskAttestation {
  id: string;
  desk_post_id: string;
  reviewer_user_id: string;
  reviewed_source_reports: boolean;
  edited_for_accuracy: boolean;
  framing_confirmed: boolean;
  content_hash: string;
  timestamp: string;
  ip: string | null;
}

// desk_get payload — post + its attestations (newest-first).
export interface DeskPostDetail {
  post: DeskPost;
  attestations: DeskAttestation[];
}

// A dated "Return Watch" follow-up appended to a PUBLISHED desk post (mcp
// migration 015). Backs the updates[] array of the kpjmd handoff and the
// timeline rendered in the /desk editor. desk_list_updates returns these
// newest-first.
export interface DeskPostUpdate {
  id: string;
  desk_post_id: string;
  headline: string;
  markdown_body: string;
  occurred_at: string;
  author_id: string | null;
  content_hash: string;
  created_at: string;
}

export type LintSeverity = 'warning' | 'blocker';

export interface LintSpan {
  start: number;
  end: number;
}

export interface LintFinding {
  code: string;
  message: string;
  severity: LintSeverity;
  span?: LintSpan;
}

// desk_lint payload. Only `blockers` gate publish; `classifier_unavailable`
// always arrives as a warning (the linter fails open).
export interface LintResult {
  warnings: LintFinding[];
  blockers: LintFinding[];
}

// The structured outcome of the publish gate. A blocked publish is a SUCCESSFUL
// MCP call with published:false — the route handler maps it to HTTP 422.
export interface PublishGate {
  role_ok: boolean;
  hash_match: boolean;
  blockers: LintFinding[];
  passed: boolean;
  reasons: string[];
}

export interface PublishResult {
  published: boolean;
  gate: PublishGate;
  post: DeskPost | null;
}

// Frontend-only aggregate for the read-only Injury Desk context panels.
export interface DeskContext {
  entity: InjuryEntity | null;
  canonicalPost: InjuryPost | null;
  updates: InjuryUpdate[];
}
