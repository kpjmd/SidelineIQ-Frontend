import type { MdReview } from '@/lib/types';

export function MDReviewBlock({ review }: { review: MdReview }) {
  return (
    <div className="my-8">
      {/* Top rule */}
      <div className="border-t-2 border-amber-700/40 mb-6" />

      <div className="border-l-4 border-amber-600 bg-amber-950/20 rounded-r-lg p-5">
        <p className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-3">
          MD Review
        </p>

        <p className="text-slate-200 leading-relaxed text-sm">
          {review.reviewer_notes}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-900/50 border border-amber-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-400">Keith Kenter, MD</p>
            <p className="text-xs text-slate-500">
              Physician Founder ·{' '}
              <a
                href="https://orthoiq.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 hover:text-amber-500 transition-colors"
              >
                OrthoIQ
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Bottom rule */}
      <div className="border-t border-amber-800/20 mt-6" />
    </div>
  );
}
