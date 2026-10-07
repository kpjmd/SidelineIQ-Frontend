import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { listLedgerEntries, listLedgerProposals, listLedgerResolutions } from '@/lib/mcp';
import { ResolutionQueue } from '@/components/ledger/ResolutionQueue';
import { Mark } from '@/components/shared/Mark';
import { Wordmark } from '@/components/shared/Wordmark';
import type { LedgerForecast, LedgerProposal, LedgerResolution } from '@/lib/ledger-types';

export default async function LedgerResolutionsPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (session.user.role !== 'md') redirect('/signin');

  let proposals: LedgerProposal[] = [];
  let resolutions: LedgerResolution[] = [];
  let forecasts: LedgerForecast[] = [];
  let loadError: string | null = null;
  try {
    [proposals, resolutions, forecasts] = await Promise.all([
      listLedgerProposals({ decision: 'pending' }),
      listLedgerResolutions({}),
      listLedgerEntries({ limit: 200 }),
    ]);
  } catch (err) {
    console.error('ledger resolutions load error:', err);
    loadError = err instanceof Error ? err.message : 'Failed to load resolutions';
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
            <span className="font-mono text-xs tracking-[0.14em] text-slate-400">RESOLUTIONS</span>
          </div>
          <nav className="flex items-center gap-4 text-xs text-slate-500">
            <Link href="/admin/ledger" className="hover:text-slate-300">Ledger</Link>
            <Link href="/admin/ledger/replies" className="hover:text-slate-300">Replies</Link>
            <Link href="/admin" className="hover:text-slate-300">MD review</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        {loadError && <p className="mb-4 text-xs text-red-400">{loadError}</p>}
        <ResolutionQueue initialProposals={proposals} initialResolutions={resolutions} initialForecasts={forecasts} />
      </main>
    </div>
  );
}
