import { NextRequest, NextResponse } from 'next/server';
import { listMdReviews } from '@/lib/mcp';
import { requireMd } from '@/lib/desk-auth';
import type { MdReviewStatus } from '@/lib/types';

export async function GET(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const status = request.nextUrl.searchParams.get('status') as MdReviewStatus | null;
  try {
    const reviews = await listMdReviews(status ?? undefined);
    return NextResponse.json({ reviews });
  } catch (err) {
    console.error('reviews route error:', err);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
