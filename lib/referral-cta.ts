/**
 * The CTA adjacency rule, web half (monetization plan, Phase 0.2).
 *
 * "Get Clinical Guidance →" appears ONLY on a DEEP_DIVE about an injury TYPE.
 * Until this, <AequOsCTA /> rendered unconditionally in DeepDivePost — the
 * component every post page uses — so a consult ask sat under every BREAKING,
 * TRACKING and CONFLICT_FLAG post about a named athlete: the adjacency that
 * reads as advertising under a physician byline, on ~480 pages, while social
 * had kept the CTA to DEEP_DIVE all along.
 *
 * Same predicate as the agents' carriesReferralCta (src/utils/content-formatter.ts).
 * Change one, change both. subject_kind NULL (every pre-023 row), ATHLETE,
 * absent (an mcp that predates 023) or unrecognized means no CTA — the
 * fail-closed direction.
 *
 * MDReviewBlock's "Physician Founder · AequOs" link is attribution, not an ask,
 * and is deliberately not governed by this.
 */
import type { InjuryPost } from './types';

export function showsReferralCta(post: Pick<InjuryPost, 'content_type' | 'subject_kind'>): boolean {
  return post.content_type === 'DEEP_DIVE' && post.subject_kind === 'INJURY_TYPE';
}
