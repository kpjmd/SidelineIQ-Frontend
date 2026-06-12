import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  CandidateDecision,
  CandidateListItem,
  CandidateStatus,
  DeskUser,
  FeedResponse,
  InjuryPost,
  ListPostsFilters,
  MdReview,
  MdReviewStatus,
} from './types';

const WEB_MCP_URL = process.env.WEB_MCP_URL!;

async function callMCPTool<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
  const transport = new StreamableHTTPClientTransport(new URL(WEB_MCP_URL));
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
