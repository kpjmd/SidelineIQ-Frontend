import type { ThreadReturnHold } from './types';

/** Why the return detector declined to close on this game, in one sentence. */
export function describeReturnHold(hold: ThreadReturnHold): string {
  if (hold.action === 'return_before_credible_window') {
    const by = hold.earliest_credible_return?.slice(0, 10);
    return by
      ? `Held: this is before ${by}, the earliest credible return from the stored injury date.`
      : 'Held: this is too soon after the stored injury date to be credible.';
  }
  const report = hold.first_report_date?.slice(0, 10);
  return report
    ? `Held: this game predates the first report on ${report}, so the stored date may be an older injury.`
    : 'Held: this game predates the first report, so the stored date may be an older injury.';
}
