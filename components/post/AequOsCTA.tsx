import { aequosClickHref } from '@/lib/cta-click';
import { BRAND_NAME } from '@/lib/brand';

// Links through /go/aequos so the click is counted (aggregate only) before the
// reader lands on aequos.io. A plain <a>, never next/link: a prefetch must not
// reach the counter.
export function AequOsCTA({ slug }: { slug: string | null }) {
  return (
    <div className="my-10 border-t border-slate-700/50 pt-8">
      <div className="text-center space-y-3">
        <p className="text-slate-300 font-medium">
          Have a musculoskeletal injury or question?
        </p>
        <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
          AequOs brings the same clinical intelligence to your situation.
          Consult with AI trained on orthopedic expertise — built by the
          same physician behind {BRAND_NAME}.
        </p>
        <a
          href={aequosClickHref(slug, 'cta')}
          target="_blank"
          rel="nofollow noopener"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium transition-colors mt-2"
        >
          Get Clinical Guidance →
        </a>
      </div>
    </div>
  );
}
