import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deskGet, getEntity, getPostById, listInjuryUpdates } from '@/lib/mcp';
import type { DeskContext } from '@/lib/types';

// Aggregates the read-only context behind FactValidationPanel + EntityTimelinePanel:
//   desk post → entity (web_get_entity) → canonical source post (web_get_post)
//             → injury_updates timeline (web_list_injury_updates).
// The read wrappers degrade to null/[] so this still returns if PR A is mid-deploy.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const { post } = await deskGet(id);
    const [entity, updates] = await Promise.all([
      getEntity(post.entity_id),
      listInjuryUpdates(post.entity_id),
    ]);
    const canonicalPost = entity?.canonical_post_id
      ? await getPostById(entity.canonical_post_id)
      : null;

    const context: DeskContext = { entity, canonicalPost, updates };
    return NextResponse.json(context);
  } catch (err) {
    console.error('desk context error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load desk context';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
