import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { listLedgerBaseRates, listLedgerEntries } from '@/lib/mcp';
import { LedgerAdmin } from '@/components/ledger/LedgerAdmin';
import { Mark } from '@/components/shared/Mark';
import { Wordmark } from '@/components/shared/Wordmark';
import type { LedgerBaseRate, LedgerForecast } from '@/lib/ledger-types';

// proxy.ts gates /admin/* on having a session; the md role is enforced here
// too, as app/admin/page.tsx does. Read the session once, preload the two
// lists, hand off to the client shell. No secret reaches the browser.
export default async function LedgerAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (session.user.role !== 'md') redirect('/signin');

  let baseRates: LedgerBaseRate[] = [];
  let forecasts: LedgerForecast[] = [];
  let loadError: string | null = null;
  try {
    [baseRates, forecasts] = await Promise.all([listLedgerBaseRates(), listLedgerEntries({ include_drafts: true, limit: 200 })]);
  } catch (err) {
    console.error('ledger admin load error:', err);
    loadError = err instanceof Error ? err.message : 'Failed to load the ledger';
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
            <span className="font-mono text-xs tracking-[0.14em] text-slate-400">PROGNOSIS LEDGER</span>
          </div>
          <nav className="flex items-center gap-4 text-xs text-slate-500">
            <Link href="/admin" className="hover:text-slate-300">MD review</Link>
            <Link href="/admin/ledger/replies" className="hover:text-slate-300">Replies</Link>
            <Link href="/ledger" className="hover:text-slate-300">Public ledger</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        {loadError && <p className="mb-4 text-xs text-red-400">{loadError}</p>}
        <LedgerAdmin initialBaseRates={baseRates} initialForecasts={forecasts} />
      </main>
    </div>
  );
}
