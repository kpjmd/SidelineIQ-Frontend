import type { LedgerDistributeOutcome } from './ledger-types';

/**
 * The X card section heading. The agents try the reply first and fall back to a
 * standalone post when X refuses it (the report author never mentioned us), so
 * a dry run can only say "replying to …, standalone if X refuses".
 */
export function xCardHeading(outcome: Pick<LedgerDistributeOutcome, 'x' | 'standalone' | 'dry_run'>): string {
  if (outcome.standalone?.reason === 'reply_refused') return 'X CARD · standalone (X refused the reply; report cited in the self-reply)';
  if (outcome.standalone?.reason === 'force_standalone') return 'X CARD · standalone (by request; report cited in the self-reply)';
  if (outcome.x.reply_to_id) {
    return outcome.dry_run
      ? `X CARD REPLY · replying to ${outcome.x.reply_to_id} · standalone if X refuses`
      : `X CARD REPLY · replying to ${outcome.x.reply_to_id}`;
  }
  return 'X CARD · standalone';
}
