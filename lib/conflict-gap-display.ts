/**
 * The words that go beside a conflict gap.
 *
 * Split out of the components so it can be tested: this repo has no DOM test
 * environment, and every existing test is a pure-logic test over `lib/`. Three
 * components rendered this concept with three different formulas and no shared
 * vocabulary, so a post could read "+0 weeks" on the admin browser and
 * "conflict threshold met" in the feed.
 */
import { computeConflictGap, isConflict, type ConflictGap } from './conflict-gap';
import { BRAND_NAME } from './brand';

export type ConflictGapTone = 'conflict' | 'info' | 'muted';

export interface ConflictGapDescription {
  /** Sentence for the gap row. */
  label: string;
  /** Compact form for a badge — "Δ+14w", "n/a". */
  badge: string;
  tone: ConflictGapTone;
  /** Why there is no number, when there is none. Null when the gap is real. */
  unavailableReason: string | null;
}

export function describeConflictGap(gap: ConflictGap): ConflictGapDescription {
  if (gap.status === 'no_timeline') {
    return {
      label: 'No team timeline disclosed',
      badge: 'n/a',
      tone: 'muted',
      unavailableReason: 'The team has not disclosed a return timeline.',
    };
  }
  if (gap.status === 'no_anchor') {
    // The old components printed a confident number here, computed against a
    // date nobody had. Saying so is the honest answer.
    return {
      label: 'Gap not computable — injury date unresolved',
      badge: 'n/a',
      tone: 'muted',
      unavailableReason:
        'The gap is measured from the injury date, which has not been resolved for this post.',
    };
  }
  if (gap.status === 'inside') {
    return {
      label: `Team timeline sits inside the ${BRAND_NAME} window`,
      badge: 'Δ0w',
      tone: 'info',
      unavailableReason: null,
    };
  }

  const magnitude = Math.abs(gap.gap_weeks);
  const direction = gap.status === 'shorter' ? 'short of' : 'beyond';
  const conflict = isConflict(gap);
  return {
    label: `${magnitude} ${magnitude === 1 ? 'week' : 'weeks'} ${direction} the ${BRAND_NAME} window${
      conflict ? ' — conflict threshold met' : ''
    }`,
    badge: `Δ${gap.gap_weeks > 0 ? '+' : ''}${gap.gap_weeks}w`,
    tone: conflict ? 'conflict' : 'info',
    unavailableReason: null,
  };
}

/**
 * Convenience for the components: a post row carries the pieces under their DB
 * column names, and the disclosure was remaining-weeks as of `created_at` —
 * never as of today, or the gap would drift on its own every week the page is
 * viewed.
 */
export function describePostConflictGap(post: {
  team_timeline_weeks: number | null;
  return_to_play_min_weeks: number | null;
  return_to_play_max_weeks: number | null;
  injury_date?: string | null;
  created_at: string;
}): ConflictGapDescription & { gap: ConflictGap } {
  const gap = computeConflictGap({
    team_timeline_weeks: post.team_timeline_weeks,
    min_weeks: post.return_to_play_min_weeks,
    max_weeks: post.return_to_play_max_weeks,
    injury_date: post.injury_date,
    as_of: post.created_at,
  });
  return { ...describeConflictGap(gap), gap };
}
