import type { ReactNode } from 'react';
import { LEDGER_COPY } from '@/lib/ledger-copy';
import { LedgerNav } from '@/components/ledger/public/LedgerNav';

/**
 * Every public ledger page, structurally (spec "Disclaimer language": the full
 * version on the ledger page; "Public site": the ledger disclaimer on every
 * page). The disclaimer lives HERE and nowhere else under app/ledger, so a new
 * page cannot ship without it — tests/ledger-public-pages.test.ts pins both.
 * The CSV route is a file, not a page; layouts do not wrap it.
 */
export default function LedgerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <LedgerNav />
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm text-slate-300">
        {children}
        <footer className="border-t border-slate-800 pt-6 space-y-2 text-xs text-slate-500">
          <p>{LEDGER_COPY.ai_disclosure}</p>
          <p>{LEDGER_COPY.full_disclaimer}</p>
          <p>{LEDGER_COPY.reliance}</p>
        </footer>
      </main>
    </div>
  );
}
