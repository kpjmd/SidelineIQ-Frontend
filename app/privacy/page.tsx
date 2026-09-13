import type { Metadata } from 'next';
import Link from 'next/link';

// Static. Every sentence here must stay true of the code: if what the site
// collects changes (analytics, the /go/aequos click counter, sign-in), change
// this page in the same PR. Physician-branded and medical-adjacent, so it says
// what is NOT collected as plainly as what is.
export const metadata: Metadata = {
  title: 'Privacy — SidelineIQ',
  description: 'What SidelineIQ collects about visitors, and what it does not.',
};

const LAST_UPDATED = 'September 13, 2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link href="/" className="text-xl font-black text-white tracking-tight">
            SidelineIQ
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm leading-relaxed text-slate-300">
        <div>
          <h1 className="text-2xl font-bold text-white">Privacy</h1>
          <p className="text-xs text-slate-500 mt-1">Last updated {LAST_UPDATED}</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">The short version</h2>
          <p>
            Reading SidelineIQ does not require an account. We do not use advertising or tracking
            cookies, we do not sell or share data about visitors, and we never ask for or store
            anything about your own health.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Page views</h2>
          <p>
            We use Vercel Web Analytics to count page views and approximate visitor numbers in
            aggregate. It does not use cookies and does not follow you across other websites. See{' '}
            <a
              href="https://vercel.com/docs/analytics/privacy-policy"
              className="text-blue-400 hover:text-blue-300"
              rel="noopener"
            >
              Vercel&apos;s analytics privacy documentation
            </a>{' '}
            for how it works.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Links to AequOs</h2>
          <p>
            Some articles link to AequOs, a clinical guidance service from the same physician. When
            you click one of those links, we add one to a daily count for that article and link.
            We do not record your IP address, browser, or anything else about who clicked. The link
            then takes you to aequos.io, which has its own privacy practices.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Signing in</h2>
          <p>
            Sign-in exists only for the physician editor who reviews content. It sets a session
            cookie for that purpose. Readers never need to sign in.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Hosting</h2>
          <p>
            The site is hosted on Vercel, which processes the requests needed to deliver pages to
            your browser.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-white">Not medical advice</h2>
          <p>
            SidelineIQ analyzes publicly reported sports injuries for general education. It is not
            medical advice and does not create a doctor–patient relationship. If you have an injury
            or health concern, see a qualified clinician.
          </p>
        </section>
      </main>
    </div>
  );
}
