import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  CandidateDecision,
  CandidateListItem,
  CandidateStatus,
  DateConfidence,
  DateResolutionSource,
  DeskAttestation,
  DeskPost,
  DeskPostDetail,
  DeskPostListItem,
  DeskPostStatus,
  DeskUser,
  EntityStatus,
  FeedResponse,
  InjuryEntity,
  InjuryPost,
  InjuryUpdate,
  LintResult,
  ListPostsFilters,
  MdReview,
  MdReviewStatus,
  PublishResult,
  ThreadDetail,
  ThreadListItem,
} from './types';

const WEB_MCP_URL = process.env.WEB_MCP_URL!;
const MCP_AUTH_SECRET = process.env.MCP_AUTH_SECRET;

async function callMCPTool<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
  const transport = new StreamableHTTPClientTransport(new URL(WEB_MCP_URL), {
    requestInit: MCP_AUTH_SECRET
      ? { headers: { Authorization: `Bearer ${MCP_AUTH_SECRET}` } }
      : undefined,
  });
  const client = new Client({ name: 'sidelineiq-frontend', version: '1.0.0' });
  try {
    await client.connect(transport);
    const result = await client.callTool({ name: toolName, arguments: args });
    if (result.isError) {
      const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? 'Unknown MCP error';
      throw new Error(text);
    }
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text;
    return JSON.parse(text) as T;
  } finally {
    await client.close().catch(() => {});
  }
}

export async function listPosts(filters: ListPostsFilters = {}): Promise<FeedResponse> {
  const args: Record<string, unknown> = {};
  if (filters.sport) args.sport = filters.sport;
  if (filters.content_type) args.content_type = filters.content_type;
  if (filters.status) args.status = filters.status;
  if (filters.athlete_name) args.athlete_name = filters.athlete_name;
  if (filters.limit !== undefined) args.limit = filters.limit;
  if (filters.offset !== undefined) args.offset = filters.offset;
  return callMCPTool<FeedResponse>('web_list_posts', args);
}

// ── Injury Desk promotion candidates (Phase 1) ───────────────────────────────

export async function listCandidates(status?: CandidateStatus): Promise<CandidateListItem[]> {
  const args: Record<string, unknown> = {};
  if (status) args.status = status;
  const result = await callMCPTool<{ candidates: CandidateListItem[] }>('web_list_candidates', args);
  return result.candidates;
}

export async function decideCandidate(
  candidateId: string,
  decision: CandidateDecision,
  decidedBy = 'md',
): Promise<{ candidate: CandidateListItem }> {
  return callMCPTool<{ candidate: CandidateListItem }>('web_decide_candidate', {
    candidate_id: candidateId,
    decision,
    decided_by: decidedBy,
  });
}

export async function getPostBySlug(slug: string): Promise<InjuryPost | null> {
  try {
    return await callMCPTool<InjuryPost>('web_get_post_by_slug', { slug });
  } catch {
    return null;
  }
}

export async function listMdReviews(status?: MdReviewStatus): Promise<MdReview[]> {
  const args: Record<string, unknown> = {};
  if (status) args.status = status;
  const result = await callMCPTool<{ reviews: MdReview[] }>('web_list_md_reviews', args);
  return result.reviews;
}

export async function approveInjuryPost(postId: string) {
  return callMCPTool<{ approved: boolean; post: InjuryPost }>(
    'web_approve_injury_post',
    { post_id: postId },
  );
}

export async function deleteInjuryPost(postId: string) {
  return callMCPTool<{ deleted: boolean; post_id: string }>(
    'web_delete_injury_post',
    { post_id: postId },
  );
}

export async function updateMdReview(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  reviewerNotes?: string,
): Promise<MdReview & { post_updated: boolean }> {
  const args: Record<string, unknown> = { id, status };
  if (reviewerNotes) args.reviewer_notes = reviewerNotes;
  return callMCPTool<MdReview & { post_updated: boolean }>('web_update_md_review', args);
}

// ── Auth / identity (Phase 2 foundation) ─────────────────────────────────────
// These back the NextAuth MCP-proxied adapter (lib/auth-adapter.ts) so the
// frontend never touches Neon directly. The users + verification_token tables
// are owned by the mcp repo (migration 012_auth.sql).

export interface VerificationTokenRecord {
  identifier: string;
  token: string;
  expires: string; // ISO 8601
}

export async function getUser(id: string): Promise<DeskUser | null> {
  const result = await callMCPTool<{ user: DeskUser | null }>('web_get_user', {
    user_id: id,
  });
  return result.user;
}

export async function getUserByEmail(email: string): Promise<DeskUser | null> {
  const result = await callMCPTool<{ user: DeskUser | null }>('web_get_user_by_email', {
    email,
  });
  return result.user;
}

export async function createVerificationToken(
  input: VerificationTokenRecord,
): Promise<VerificationTokenRecord> {
  const result = await callMCPTool<{ verification_token: VerificationTokenRecord }>(
    'web_create_verification_token',
    { identifier: input.identifier, token: input.token, expires: input.expires },
  );
  return result.verification_token;
}

export async function useVerificationToken(
  identifier: string,
  token: string,
): Promise<VerificationTokenRecord | null> {
  const result = await callMCPTool<{ verification_token: VerificationTokenRecord | null }>(
    'web_use_verification_token',
    { identifier, token },
  );
  return result.verification_token;
}

// ── Injury Desk (Phase 2E) ───────────────────────────────────────────────────
// Tier 2 physician editorial tools. Every desk_* call MUST originate in a
// server-side route handler that sources reviewer_user_id / author_id /
// edited_by from the NextAuth session (session.user.id) — never the request
// body. The browser never holds WEB_MCP_URL.

export async function deskList(
  status?: DeskPostStatus,
  limit?: number,
): Promise<DeskPostListItem[]> {
  const args: Record<string, unknown> = {};
  if (status) args.status = status;
  if (limit !== undefined) args.limit = limit;
  const result = await callMCPTool<{ posts: DeskPostListItem[] }>('desk_list', args);
  return result.posts;
}

export async function deskGet(deskPostId: string): Promise<DeskPostDetail> {
  return callMCPTool<DeskPostDetail>('desk_get', { desk_post_id: deskPostId });
}

export interface CreateDraftInput {
  candidate_id: string;
  author_id: string;
  title: string;
  markdown_body: string;
  draft_json?: unknown;
  source_attribution?: unknown;
  disclaimer_present?: boolean;
}

export async function deskCreateDraft(input: CreateDraftInput): Promise<DeskPost> {
  const result = await callMCPTool<{ post: DeskPost }>('desk_create_draft', { ...input });
  return result.post;
}

export interface UpdateDraftInput {
  desk_post_id: string;
  edited_by: string;
  markdown_body: string;
  title?: string;
  draft_json?: unknown;
  source_attribution?: unknown;
  disclaimer_present?: boolean;
  edit_diff?: unknown;
}

export async function deskUpdateDraft(input: UpdateDraftInput): Promise<DeskPost> {
  const result = await callMCPTool<{ post: DeskPost }>('desk_update_draft', { ...input });
  return result.post;
}

export async function deskLint(deskPostId: string): Promise<LintResult> {
  return callMCPTool<LintResult>('desk_lint', { desk_post_id: deskPostId });
}

export interface AttestInput {
  desk_post_id: string;
  reviewer_user_id: string;
  reviewed_source_reports: boolean;
  edited_for_accuracy: boolean;
  framing_confirmed: boolean;
  ip?: string;
}

export async function deskAttest(input: AttestInput): Promise<DeskAttestation> {
  const result = await callMCPTool<{ attestation: DeskAttestation }>('desk_attest', { ...input });
  return result.attestation;
}

// A blocked publish is a SUCCESSFUL call ({published:false, gate}) — do NOT
// treat it as an error; the route handler maps published:false to HTTP 422.
export async function deskPublish(
  deskPostId: string,
  reviewerUserId: string,
): Promise<PublishResult> {
  return callMCPTool<PublishResult>('desk_publish', {
    desk_post_id: deskPostId,
    reviewer_user_id: reviewerUserId,
  });
}

export async function deskRetract(
  deskPostId: string,
  reviewerUserId: string,
): Promise<{ post: DeskPost }> {
  return callMCPTool<{ post: DeskPost }>('desk_retract', {
    desk_post_id: deskPostId,
    reviewer_user_id: reviewerUserId,
  });
}

// ── Read tools backing the Injury Desk context panels (mcp PR A) ─────────────
// These degrade gracefully (null / empty) so the context route still returns if
// PR A is mid-deploy.

export async function getEntity(entityId: string): Promise<InjuryEntity | null> {
  try {
    const result = await callMCPTool<{ entity: InjuryEntity }>('web_get_entity', {
      entity_id: entityId,
    });
    return result.entity;
  } catch {
    return null;
  }
}

export async function getPostById(postId: string): Promise<InjuryPost | null> {
  try {
    return await callMCPTool<InjuryPost>('web_get_post', { post_id: postId });
  } catch {
    return null;
  }
}

export async function listInjuryUpdates(entityId: string): Promise<InjuryUpdate[]> {
  try {
    const result = await callMCPTool<{ updates: InjuryUpdate[] }>('web_list_injury_updates', {
      entity_id: entityId,
    });
    return result.updates;
  } catch {
    return [];
  }
}

// ── Injury threads (Managed Session layer, mcp migration 014) ────────────────
// Read tools power the MD dashboard "Threads" tab; write tools (update_dates,
// close) are invoked only from server-side /api/admin/threads/* handlers.

export async function listThreads(filters: {
  status?: EntityStatus;
  needs_date_review?: boolean;
  limit?: number;
} = {}): Promise<ThreadListItem[]> {
  const args: Record<string, unknown> = {};
  if (filters.status) args.status = filters.status;
  if (filters.needs_date_review !== undefined) args.needs_date_review = filters.needs_date_review;
  if (filters.limit !== undefined) args.limit = filters.limit;
  const result = await callMCPTool<{ threads: ThreadListItem[] }>('web_list_threads', args);
  return result.threads;
}

export async function getThread(entityId: string): Promise<ThreadDetail> {
  return callMCPTool<ThreadDetail>('web_thread_get', { entity_id: entityId });
}

export interface UpdateThreadDatesInput {
  entity_id: string;
  injury_date?: string;
  injury_date_confidence?: DateConfidence;
  surgery_date?: string;
  surgery_confirmed?: boolean;
  date_resolution_sources?: DateResolutionSource[];
  needs_date_review?: boolean;
}

export async function updateThreadDates(
  input: UpdateThreadDatesInput,
): Promise<{ entity: InjuryEntity }> {
  return callMCPTool<{ entity: InjuryEntity }>('web_thread_update_dates', { ...input });
}

export async function closeThread(input: {
  entity_id: string;
  actual_return_date?: string;
  outcome?: 'RESOLVED' | 'RETIRED';
  closed_by?: string;
}): Promise<{ entity: InjuryEntity }> {
  return callMCPTool<{ entity: InjuryEntity }>('web_thread_close', { ...input });
}
