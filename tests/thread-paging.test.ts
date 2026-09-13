/**
 * web_list_threads stopped at its default limit of 100 and said nothing; every
 * admin thread list, the date-review badge and the accuracy view took that
 * default. listAllThreadPages reads everything or throws.
 *
 * The first block FAILS against pre-fix code: there was one call, no paging,
 * and a full page came back as if complete. The second block is the
 * mixed-deploy contract with an mcp that predates paging (mcp #31).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  listAllThreadPages,
  ThreadListTruncatedError,
  type FetchThreadPage,
  type ThreadPage,
} from '../lib/thread-paging';
import type { ThreadListItem } from '../lib/types';

const t = (id: string) => ({ id }) as ThreadListItem;
const ids = (n: number, from = 0) => Array.from({ length: n }, (_, i) => t(`t${from + i}`));

/** A paging server over `rows`, honouring limit/offset like mcp #31. */
function pagingServer(rows: ThreadListItem[]): FetchThreadPage {
  return vi.fn(async (args: Record<string, unknown>): Promise<ThreadPage> => {
    const limit = args.limit as number;
    const offset = (args.offset as number | undefined) ?? 0;
    const threads = rows.slice(offset, offset + limit);
    const hasMore = threads.length > 0 && offset + threads.length < rows.length;
    return {
      threads,
      total: rows.length,
      has_more: hasMore,
      next_offset: hasMore ? offset + threads.length : null,
    };
  });
}

describe('reads every page', () => {
  it('follows next_offset until has_more is false', async () => {
    const rows = ids(250);
    const fetch = pagingServer(rows);
    const out = await listAllThreadPages(fetch, { status: 'RESOLVED' }, { pageSize: 100 });
    expect(out.map((r) => r.id)).toEqual(rows.map((r) => r.id));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('passes the filters on every page', async () => {
    const fetch = pagingServer(ids(150));
    await listAllThreadPages(fetch, { status: 'ACTIVE', needs_date_review: true }, { pageSize: 100 });
    for (const [args] of (fetch as ReturnType<typeof vi.fn>).mock.calls) {
      expect(args).toMatchObject({ status: 'ACTIVE', needs_date_review: true, limit: 100 });
    }
  });

  it('drops a row that arrives twice when the order shifts mid-read', async () => {
    const pages: ThreadPage[] = [
      { threads: [t('a'), t('b')], total: 4, has_more: true, next_offset: 2 },
      { threads: [t('b'), t('c')], total: 4, has_more: false, next_offset: null },
    ];
    const fetch = vi.fn(async () => pages.shift()!);
    const out = await listAllThreadPages(fetch, {}, { pageSize: 2 });
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('throws at the page cap instead of returning what it has', async () => {
    const fetch = pagingServer(ids(50));
    await expect(listAllThreadPages(fetch, {}, { pageSize: 10, maxPages: 3 })).rejects.toBeInstanceOf(
      ThreadListTruncatedError,
    );
  });

  it('throws on a next_offset that does not advance', async () => {
    const fetch = vi.fn(async () => ({ threads: [t('a')], total: 9, has_more: true, next_offset: 0 }));
    await expect(listAllThreadPages(fetch, {}, { pageSize: 1 })).rejects.toBeInstanceOf(
      ThreadListTruncatedError,
    );
  });

  it('throws on a response with no threads array', async () => {
    const fetch = vi.fn(async () => ({}) as ThreadPage);
    await expect(listAllThreadPages(fetch)).rejects.toBeInstanceOf(ThreadListTruncatedError);
  });
});

describe('mixed deploy with a pre-paging mcp', () => {
  it('never sends offset on the first call — strict inputs would reject the whole call', async () => {
    const fetch = pagingServer(ids(5));
    await listAllThreadPages(fetch, { status: 'ACTIVE' });
    const [first] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect('offset' in first).toBe(false);
  });

  it('accepts a short page from a server with no has_more', async () => {
    const fetch = vi.fn(async () => ({ threads: ids(87) }));
    const out = await listAllThreadPages(fetch, { status: 'ACTIVE' }, { pageSize: 100 });
    expect(out).toHaveLength(87);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws on a full page from a server with no has_more', async () => {
    const fetch = vi.fn(async () => ({ threads: ids(100) }));
    await expect(listAllThreadPages(fetch, {}, { pageSize: 100 })).rejects.toBeInstanceOf(
      ThreadListTruncatedError,
    );
  });
});
