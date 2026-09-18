/**
 * The sport badge, deliberately colourless.
 *
 * It used to carry its own hue per league (NFL blue / NBA orange / PL purple /
 * UFC red) — a sixth parallel colour system, and the UFC red collided head-on
 * with Conflict Red, which the kit reserves. The kit says nothing about league
 * colours, and the reason is visible once the content-type badge is amber or
 * red: two saturated chips side by side, and the reader cannot tell which one
 * means "urgent".
 *
 * So: one muted mono pill for every sport. The content-type colour is the only
 * colour on a card.
 */
import type { Sport } from '@/lib/types';

const SPORT_LABEL: Record<Sport, string> = {
  NFL: 'NFL',
  NBA: 'NBA',
  PREMIER_LEAGUE: 'PL',
  UFC: 'UFC',
  OTHER: 'OTHER',
};

export function SportBadge({ sport }: { sport: Sport }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-slate-700 bg-inset px-2 py-0.5 font-mono text-xs font-medium tracking-[0.1em] text-slate-400">
      {SPORT_LABEL[sport] ?? SPORT_LABEL.OTHER}
    </span>
  );
}
