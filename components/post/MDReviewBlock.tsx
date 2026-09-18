import type { MdReview } from '@/lib/types';
import { aequosClickHref } from '@/lib/cta-click';

// The AequOs byline is attribution, not an ask, so it is not gated by
// showsReferralCta — but it goes through /go/aequos too (from=byline) so the
// two links can be told apart in the click counts.
//
// Signal Cyan, not amber. This block used to be entirely amber, which under the
// brand kit is Alert Amber = BREAKING — so a physician's sign-off wore the
// breaking-news colour on a public page. Cyan is the kit's trust/data accent and
// its "Confirmed · club source" status, which is what an MD review is.
export function MDReviewBlock({ review, slug }: { review: MdReview; slug: string | null }) {
  return (
    <div className="my-8">
      {/* Top rule */}
      <div className="border-t-2 border-signal-cyan/30 mb-6" />

      <div className="border-l-4 border-signal-cyan bg-signal-cyan/5 rounded-r-lg p-5">
        <p className="font-mono text-xs font-semibold tracking-[0.14em] text-signal-cyan uppercase mb-3">
          MD Review
        </p>

        <p className="text-slate-200 leading-relaxed text-sm">
          {review.reviewer_notes}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-signal-cyan/15 border border-signal-cyan/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-signal-cyan" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-signal-cyan">KPJMD</p>
            <p className="text-xs text-slate-500">
              Physician Founder ·{' '}
              <a
                href={aequosClickHref(slug, 'byline')}
                target="_blank"
                rel="nofollow noopener"
                className="text-signal-cyan hover:text-signal-cyan-hover transition-colors"
              >
                AequOs
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Bottom rule */}
      <div className="border-t border-slate-800 mt-6" />
    </div>
  );
}
