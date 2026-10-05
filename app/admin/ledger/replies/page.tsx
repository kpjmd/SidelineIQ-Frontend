import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { listReplyProposals } from '@/lib/mcp';
import { ReplyQueue } from '@/components/ledger/ReplyQueue';
import { Mark } from '@/components/shared/Mark';
import { Wordmark } from '@/components/shared/Wordmark';
import type { ReplyProposal } from '@/lib/ledger-types';

export default async function LedgerRepliesPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (session.user.role !== 'md') redirect('/signin');

  let pending: ReplyProposal[] = [];
  let stuck: ReplyProposal[] = [];
  let loadError: string | null = null;
  try {
    const [p, approved] = await Promise.all([listReplyProposals('pending'), listReplyProposals('approved')]);
    pending = p;
    stuck = approved.filter((a) => a.post_attempted_at && !a.posted_id);
  } catch (err) {
    console.error('ledger replies load error:', err);
    loadError = err instanceof Error ? err.message : 'Failed to load reply proposals';
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2">
              <Mark size={28} />
              <Wordmark className="text-xl" />
            </Link>
            <span className="text-slate-700">·</span>
            <span className="font-mono text-xs tracking-[0.14em] text-slate-400">REPLY PROPOSALS</span>
          </div>
          <nav className="flex items-center gap-4 text-xs text-slate-500">
            <Link href="/admin/ledger" className="hover:text-slate-300">Ledger</Link>
            <Link href="/admin" className="hover:text-slate-300">MD review</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        {loadError && <p className="mb-4 text-xs text-red-400">{loadError}</p>}
        <ReplyQueue initialPending={pending} initialStuck={stuck} />
      </main>
    </div>
  );
}
