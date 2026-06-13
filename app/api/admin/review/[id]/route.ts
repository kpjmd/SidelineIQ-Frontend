import { NextRequest, NextResponse } from 'next/server';
import { updateMdReview } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
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
    if (result.post_updated && result.post_id) {
      // Trigger ISR revalidation for affected post
      revalidatePath('/post/[slug]', 'page');
      revalidatePath('/');
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('review update error:', err);
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
  }
}
