/**
 * Read EVERY thread matching a filter, or fail — never a silent short list.
 *
 * web_list_threads caps each call at `limit` (server default 100). Until mcp
 * #31 it returned `{ threads }` with no total and no offset, and no caller here
 * passed a limit, so the ACTIVE list, the date-review badge and the
 * RESOLVED/RETIRED lists the accuracy view computes over would each have
 * stopped at 100 rows while looking complete.
 *
 * Safe against either mcp:
 * - The first call sends NO `offset`. mcp inputs are `.strict()`, so an
 *   undeclared key fails the whole call; an mcp that predates paging accepts
 *   this call unchanged.
 * - A later page is requested only on `has_more === true`, which a pre-paging
 *   mcp never sends.
 * - A pre-paging response (no `has_more`) that fills the page is treated as
 *   truncated and throws: it cannot say whether more rows exist.
 *
 * Pure: the page fetch is injected, so this runs under vitest without an MCP
 * connection (see lib/reject.ts for the same pattern and why there is no alias).
 */
import type { ThreadListItem } from './types';

export interface ThreadPage {
  threads: ThreadListItem[];
  total?: number;
  has_more?: boolean;
  next_offset?: number | null;
}

export type FetchThreadPage = (args: Record<string, unknown>) => Promise<ThreadPage>;

export interface ThreadFilters {
  status?: ThreadListItem['status'];
  needs_date_review?: boolean;
}

/** The server's own maximum. Fewer round trips, same answer. */
export const THREAD_PAGE_SIZE = 500;
export const THREAD_MAX_PAGES = 20;

export class ThreadListTruncatedError extends Error {
  constructor(detail: string) {
    super(`web_list_threads read is incomplete: ${detail}`);
    this.name = 'ThreadListTruncatedError';
  }
}

export async function listAllThreadPages(
  fetchPage: FetchThreadPage,
  filters: ThreadFilters = {},
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<ThreadListItem[]> {
  const pageSize = opts.pageSize ?? THREAD_PAGE_SIZE;
  const maxPages = opts.maxPages ?? THREAD_MAX_PAGES;

  const base: Record<string, unknown> = { limit: pageSize };
  if (filters.status) base.status = filters.status;
  if (filters.needs_date_review !== undefined) base.needs_date_review = filters.needs_date_review;

  const out: ThreadListItem[] = [];
  const seen = new Set<string>();
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const args = offset === 0 ? base : { ...base, offset };
    const res = await fetchPage(args);
    if (!res || !Array.isArray(res.threads)) {
      throw new ThreadListTruncatedError('response carried no threads array');
    }
    // A thread updated mid-read moves to the front of last_updated_at order and
    // shifts every later offset by one, so the same row can arrive twice.
    for (const t of res.threads) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
    }

    if (res.has_more === undefined) {
      // Pre-paging server: one page is all it can give, and a full page cannot
      // say whether it was everything.
      if (res.threads.length >= pageSize) {
        throw new ThreadListTruncatedError(
          `server does not page and returned a full page of ${res.threads.length}`,
        );
      }
      return out;
    }

    if (res.has_more !== true) return out;

    const next = res.next_offset;
    if (typeof next !== 'number' || !Number.isInteger(next) || next <= offset) {
      throw new ThreadListTruncatedError(
        `has_more with an unusable next_offset (${String(next)}) after offset ${offset}`,
      );
    }
    offset = next;
  }

  throw new ThreadListTruncatedError(`stopped at ${maxPages} pages (${out.length} rows read)`);
}
