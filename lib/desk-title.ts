/**
 * Desk post titles. The title is the kpjmd headline (h1, <title>, og:title, the
 * listing card) and it is inside the content hash.
 */

/**
 * The title a new draft starts with: the athlete's name and nothing else.
 *
 * It used to append the entity's injury descriptor, which is stored lowercase,
 * and "Ben Simmons — achilles rupture" shipped to kpjmd.com that way
 * (2026-10-21). The name alone reads as unfinished, and mcp's title_incomplete
 * lint blocker refuses to publish a title that is only the athlete's name — the
 * same rule that keeps every section empty until the MD writes it.
 */
export function seedDraftTitle(c: { athlete_name: string | null }): string {
  return c.athlete_name?.trim() || 'Athlete';
}

const CONFIRMATION_KEYS = ['reviewed_source_reports', 'edited_for_accuracy', 'framing_confirmed'] as const;
const ALLOWED_KEYS = new Set<string>(['title', 'reason', ...CONFIRMATION_KEYS]);

export interface CorrectTitleBody {
  title: string;
  reason: string;
  reviewed_source_reports: boolean;
  edited_for_accuracy: boolean;
  framing_confirmed: boolean;
}

/**
 * Parse the correct-title request body. Strict like the mcp tool behind it: an
 * undeclared key is refused here rather than failing the whole mcp call, and
 * reviewer identity is never accepted from the body (the route takes it from the
 * session).
 */
export function parseCorrectTitleBody(
  body: unknown,
): { ok: true; value: CorrectTitleBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  const extra = Object.keys(b).filter((k) => !ALLOWED_KEYS.has(k));
  if (extra.length > 0) return { ok: false, error: `Unrecognized field(s): ${extra.join(', ')}` };

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title) return { ok: false, error: 'A title is required' };
  if (title.length > 512) return { ok: false, error: 'The title must be 512 characters or fewer' };
  const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
  if (!reason) return { ok: false, error: 'A reason is required to correct a published title' };
  for (const k of CONFIRMATION_KEYS) {
    if (typeof b[k] !== 'boolean') return { ok: false, error: `${k} must be a boolean` };
  }
  return {
    ok: true,
    value: {
      title,
      reason,
      reviewed_source_reports: b.reviewed_source_reports as boolean,
      edited_for_accuracy: b.edited_for_accuracy as boolean,
      framing_confirmed: b.framing_confirmed as boolean,
    },
  };
}
