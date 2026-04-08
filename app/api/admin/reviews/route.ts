import { NextRequest, NextResponse } from 'next/server';
import { listMdReviews } from '@/lib/mcp';
import type { MdReviewStatus } from '@/lib/types';

function checkAuth(request: NextRequest): boolean {
  const auth = request.headers.get('Authorization');
  return auth === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get('status') as MdReviewStatus | null;
  try {
    const reviews = await listMdReviews(status ?? undefined);
    return NextResponse.json({ reviews });
  } catch (err) {
    console.error('reviews route error:', err);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
