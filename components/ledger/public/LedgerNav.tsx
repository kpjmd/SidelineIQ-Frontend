import Link from 'next/link';
import { Mark } from '@/components/shared/Mark';
import { Wordmark } from '@/components/shared/Wordmark';

const LINKS = [
  { href: '/ledger', label: 'Entries' },
  { href: '/ledger/scoreboard', label: 'Scoreboard' },
  { href: '/ledger/export.csv', label: 'Export CSV' },
] as const;

/** The public ledger header: brand, the ledger label, and the three public surfaces. */
export function LedgerNav() {
  return (
    <header className="border-b border-slate-800">
      <div className="max-w-3xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2">
          <Mark size={28} />
          <Wordmark className="text-xl" />
        </Link>
        <nav className="flex items-center gap-4 font-mono text-xs tracking-[0.08em]">
          <Link href="/ledger" className="tracking-[0.14em] text-slate-400 hover:text-slate-200">
            PROGNOSIS LEDGER
          </Link>
          {LINKS.slice(1).map((l) =>
            l.href.endsWith('.csv') ? (
              // A file, not a page: a plain anchor so the router does not try to render it.
              <a key={l.href} href={l.href} className="text-signal-cyan hover:text-signal-cyan-hover">
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href} className="text-signal-cyan hover:text-signal-cyan-hover">
                {l.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
