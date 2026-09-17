/**
 * Every brand string a reader sees (Phase 1 rename, SidelineIQ → ParatrOs,
 * decided 2026-09-14). The agents repo has the same constants in
 * src/config/brand.ts; keep the two in step.
 *
 * Internal identifiers — package and MCP client names, Railway hostnames,
 * the kpjmd handoff keys (`_sideline`, `sideline_slug`) — are deliberately not
 * renamed. The handoff keys are a contract with the kpjmd.com builder.
 */
export const BRAND_NAME = 'ParatrOs';
export const BRAND_SLUG = 'paratros';
export const BRAND_TAGLINE = 'Clinical Sports Intelligence';
export const BRAND_SIGNATURE_NAME = BRAND_NAME;
export const BRAND_SIGNATURE_TAIL = 'AI-generated analysis. Physician-founded.';

/**
 * Rewrite the retired "OrthoTriage Master" / "OTM" persona out of STORED
 * model prose at display time. Posts written before the rename carry it (154
 * hits over 498 published posts); new posts are rewritten at emission by the
 * agents' identical function. Rules and order are the agents' — see there.
 */
export function rebrandPersona(text: string): string {
  if (!text) return text;
  return text
    .replace(/\bOrthoTriage Master\s*\(OTM\)/g, BRAND_NAME)
    .replace(/\bOrthoTriage Master\b/g, BRAND_NAME)
    .replace(
      /\bOTM\s+(?=(?:three-axis|inference|classification|framework|taxonomy|protocol|tissue)\b)/gi,
      '',
    )
    .replace(/(^|[.!?]\s+|\n\s*)OTM(?:'|’)s\b/g, (_m, lead: string) => `${lead}Our`)
    .replace(/\bOTM(?:'|’)s\b/g, 'our')
    .replace(/\bOTM\b/g, BRAND_NAME);
}

/** The public copy of a post, with its model-written prose rebranded. */
export function rebrandPost<
  T extends { headline?: string; clinical_summary?: string; conflict_reason?: string | null },
>(post: T): T {
  return {
    ...post,
    ...(typeof post.headline === 'string' && { headline: rebrandPersona(post.headline) }),
    ...(typeof post.clinical_summary === 'string' && {
      clinical_summary: rebrandPersona(post.clinical_summary),
    }),
    ...(typeof post.conflict_reason === 'string' && {
      conflict_reason: rebrandPersona(post.conflict_reason),
    }),
  };
}
