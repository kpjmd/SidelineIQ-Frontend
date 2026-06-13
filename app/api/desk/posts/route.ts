import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deskList } from '@/lib/mcp';
import type { DeskPostStatus } from '@/lib/types';

export async function GET(request: NextRequest) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const statusParam = request.nextUrl.searchParams.get('status') as DeskPostStatus | null;
  const limitParam = request.nextUrl.searchParams.get('limit');

  try {
    const posts = await deskList(
      statusParam ?? undefined,
      limitParam ? Number(limitParam) : undefined,
    );
    return NextResponse.json({ posts });
  } catch (err) {
    console.error('desk posts list error:', err);
    return NextResponse.json({ error: 'Failed to list desk posts' }, { status: 500 });
  }
}
