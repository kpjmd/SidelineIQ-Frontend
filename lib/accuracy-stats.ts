/**
 * The numbers on the MD dashboard's accuracy tab, in the pre-registration's
 * terms (sidelineiq-agents docs/accuracy-preregistration.md).
 *
 * - Headline: returns inside the published window, X of Y. The denominator is
 *   scored RETURNS — not every closed thread (a RETIRED or record-less thread
 *   read as a miss), and since Amendment 2 not every scored thread either: two
 *   threads closed on one athlete's same return game are one observation
 *   (Brian Burns' ankle was counted twice).
 * - Secondary, with its own n: MEDIAN signed error in days. Not MAE, which this
 *   card used to show — MAE measures distance from the window's midpoint, a
 *   point the model never claimed, so it scores a call inside the window as an
 *   error. The pre-registration settles that, and the admin card should not
 *   train anyone's eye on the number it rejects.
 * - The window-width distribution, published beside the headline.
 * - Exclusions by reason, counted per return.
 *
 * All of it comes from `summarizeAccuracy` (lib/accuracy-observations.ts), the
 * byte-identical twin of the agents helper that `accuracy-report.ts` prints, so
 * the two readings cannot drift.
 *
 * Pure, and imported relatively for the same no-alias-under-vitest reason as
 * lib/reject.ts.
 */
import { summarizeAccuracy, type NumberSummary } from './accuracy-observations';
import type { ThreadListItem } from './types';

export interface AccuracyStats {
  /** Scored returns inside the published window. */
  withinCount: number;
  /** Scored returns. */
  withinDenominator: number;
  /** Median signed error in days over the returns that carry one. */
  medianErrorDays: number | null;
  /** The secondary's own n. */
  errorCount: number;
  /** Width of the scored windows, in weeks. */
  windowWeeks: NumberSummary;
  /** Returns no verdict was computed for, by reason. */
  excludedByReason: Record<string, number>;
  excludedTotal: number;
  /** Groups of threads that were one return (Amendment 2, A2.1). */
  collapsedGroups: number;
  /** Scored returns whose record predates `scoreable` (2026-09-15). */
  legacy: number;
  /** Closed threads outside the NFL/NBA scope. */
  outOfScope: number;
}

export function computeAccuracyStats(threads: ThreadListItem[]): AccuracyStats {
  const s = summarizeAccuracy(threads);
  return {
    withinCount: s.within,
    withinDenominator: s.n,
    medianErrorDays: s.signed_error_days.median,
    errorCount: s.signed_error_days.n,
    windowWeeks: s.window_weeks,
    excludedByReason: s.excluded_by_reason,
    excludedTotal: s.exclusions.length,
    collapsedGroups: s.collapsed.length,
    legacy: s.legacy,
    outOfScope: s.out_of_scope,
  };
}
