import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { FeedResponse, InjuryPost, ListPostsFilters, MdReview, MdReviewStatus } from './types';

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
  if (filters.limit !== undefined) args.limit = filters.limit;
  if (filters.offset !== undefined) args.offset = filters.offset;
  return callMCPTool<FeedResponse>('web_list_posts', args);
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

export async function updateMdReview(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  reviewerNotes?: string,
): Promise<MdReview & { post_updated: boolean }> {
  const args: Record<string, unknown> = { id, status };
  if (reviewerNotes) args.reviewer_notes = reviewerNotes;
  return callMCPTool<MdReview & { post_updated: boolean }>('web_update_md_review', args);
}
