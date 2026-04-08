import { NextRequest, NextResponse } from 'next/server';
import { updateMdReview } from '@/lib/mcp';
import { revalidatePath } from 'next/cache';

function checkAuth(request: NextRequest): boolean {
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
