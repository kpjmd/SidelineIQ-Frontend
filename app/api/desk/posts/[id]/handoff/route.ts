import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deskGet } from '@/lib/mcp';

// Download the kpjmd.com handoff JSON for a desk post.
//
// The served object IS kpjmd's content/injury-desk/published/{slug}.json — the
// MD saves it and drops it straight into that directory, no transform, no
// hand-editing. It comes from desk_posts.draft_json, which the MCP server
// refreshes at publish, on every Return Watch append, and at retract, so it can
// never drift stale relative to updates[].
//
// ?variant=retracted serves the same snapshot under the {slug}.retracted.json
// filename, which the kpjmd builder turns into a tombstone page at the same URL.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const retracted = request.nextUrl.searchParams.get('variant') === 'retracted';

  try {
    const { post } = await deskGet(id);

    if (!post.draft_json) {
      return NextResponse.json(
        {
          error:
            'No handoff JSON yet. It is assembled when the post is published — publish it on SidelineIQ first.',
        },
        { status: 409 },
      );
    }

    // Guard the two states against each other so a mis-clicked link cannot put
    // a live post's JSON on disk under a .retracted name, or vice versa.
    if (retracted && post.status !== 'RETRACTED') {
      return NextResponse.json(
        { error: `Post is ${post.status}, not RETRACTED — retract it before downloading a retraction.` },
        { status: 409 },
      );
    }
    if (!retracted && post.status === 'RETRACTED') {
      return NextResponse.json(
        { error: 'Post is RETRACTED — download the .retracted.json variant instead.' },
        { status: 409 },
      );
    }

    const filename = retracted ? `${post.slug}.retracted.json` : `${post.slug}.json`;
    return new NextResponse(JSON.stringify(post.draft_json, null, 2) + '\n', {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        // The handoff must reflect the post as it stands right now, never a
        // cached copy from before the last edit or append.
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('desk handoff error:', err);
    const message = err instanceof Error ? err.message : 'Failed to build handoff JSON';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
