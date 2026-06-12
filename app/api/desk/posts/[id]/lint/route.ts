import { NextRequest, NextResponse } from 'next/server';
import { requireMd } from '@/lib/desk-auth';
import { deskLint } from '@/lib/mcp';

// Live linting (debounced ~1s in LinterRail). The deployed mcp may run the 2C
// no-op stub (empty arrays) until the 2D linter PR ships — that's a valid result.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMd();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const result = await deskLint(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('desk lint error:', err);
    const message = err instanceof Error ? err.message : 'Failed to lint desk post';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
