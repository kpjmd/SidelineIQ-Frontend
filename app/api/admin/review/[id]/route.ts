import { NextRequest, NextResponse } from 'next/server';
import { updateMdReview, getPostById } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
import { triggerSocialPublish, type SocialPublishOutcome } from '@/lib/social-publish';
import { revalidatePath } from 'next/cache';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await request.json() as { status: 'APPROVED' | 'REJECTED'; reviewer_notes?: string };

  try {
    const result = await updateMdReview(id, body.status, body.reviewer_notes);

    // Approving here has exactly the same consequence as the review queue's
    // "Quick approve" — the post goes live — so it must trigger the same social
    // publish. This route used to skip it entirely, which meant an approval
    // made from the review form never reached Farcaster or X and nothing said
    // so. See lib/social-publish.ts.
    let social: SocialPublishOutcome | undefined;
    if (result.post_updated && result.post_id) {
      if (body.status === 'APPROVED') {
        const post = await getPostById(result.post_id);
        social = post
          ? await triggerSocialPublish(result.post_id, post)
          : { ok: false, error: `Post ${result.post_id} could not be loaded for social publish` };
        if (!social.ok) {
          console.error(`[Approve] Review ${id} approved but not published socially: ${social.error}`);
        }
      }

      // Trigger ISR revalidation for affected post
      revalidatePath('/post/[slug]', 'page');
      revalidatePath('/');
    }

    return NextResponse.json({ ...result, ...(social && { social }) });
  } catch (err) {
    console.error('review update error:', err);
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
  }
}
