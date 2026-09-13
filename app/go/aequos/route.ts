import { after, type NextRequest } from 'next/server';
import { incrementCtaClick } from '@/lib/mcp';
import { decideClick } from '@/lib/cta-click';

// GET /go/aequos?post=<slug>&from=cta|byline
//
// Counts a click on an AequOs link from a post page, then 302s to a FIXED
// aequos.io URL (lib/cta-click.ts). The count runs in after(), so the reader is
// never kept waiting on MCP, and a failed count is logged and swallowed — a
// click must always reach AequOs. Public and unauthenticated by design; the mcp
// tool counts only slugs of PUBLISHED posts, and stores nothing about the
// visitor. Disallowed in robots.ts.
export async function GET(request: NextRequest) {
  const decision = decideClick({
    method: request.method,
    searchParams: request.nextUrl.searchParams,
    headers: request.headers,
  });

  if (decision.count) {
    const { postSlug, from } = decision;
    after(async () => {
      try {
        await incrementCtaClick(postSlug, from);
      } catch (err) {
        console.error(
          `[CtaClick] COUNT FAILED post=${postSlug} from=${from}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: decision.target,
      // A cached redirect would hide every click after the first.
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
