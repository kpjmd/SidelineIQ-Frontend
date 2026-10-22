/**
 * Correcting a PUBLISHED desk post's sections or prose meta (mcp
 * desk_correct_published). The server is the authority on every rule here — the
 * size cap, the lint, the allowed keys. This module only shapes the request and
 * previews the cap so the MD sees a refusal coming before submitting.
 */

import { SECTION_KEYS, type DeskFaq, type DeskMeta, type DeskPost, type SectionKey } from './types';

// Mirrors mcp desk-correction.ts. A preview only: the mcp refuses over-cap edits.
export const MAX_FIELD_EDIT_DISTANCE = 150;

const SECTION_LABELS: Record<SectionKey, string> = {
  snapshot: 'The Snapshot',
  what_happened: 'What Happened',
  anatomy: 'The Anatomy',
  treatment: 'The Treatment',
  timeline: 'The Timeline',
  bridge: 'Why It Matters For You',
  dr_take: "Dr. Johnson's Take",
};

// The prose meta mcp accepts. Structural keys (player, related_slugs,
// relevant_tool, conflict_flag, anatomy_diagram) are not correctable.
const META_FIELDS = [
  { key: 'meta_description', label: 'Meta description' },
  { key: 'short_title', label: 'Short title' },
  { key: 'treatment_heading', label: 'Treatment heading' },
  { key: 'anatomy_diagram_alt', label: 'Anatomy diagram alt text' },
] as const;

type MetaProseKey = (typeof META_FIELDS)[number]['key'];

export type CorrectionField =
  | { kind: 'section'; key: SectionKey }
  | { kind: 'meta'; key: MetaProseKey }
  | { kind: 'faq'; index: number; part: 'q' | 'a' };

export interface CorrectionFieldOption {
  id: string;
  label: string;
  field: CorrectionField;
}

/** Every field of this post a correction may touch, in page order. */
export function correctionFields(post: Pick<DeskPost, 'meta'>): CorrectionFieldOption[] {
  const out: CorrectionFieldOption[] = SECTION_KEYS.map((key) => ({
    id: `sections.${key}`,
    label: SECTION_LABELS[key],
    field: { kind: 'section', key },
  }));
  for (const { key, label } of META_FIELDS) {
    out.push({ id: `meta.${key}`, label, field: { kind: 'meta', key } });
  }
  (post.meta?.faqs ?? []).forEach((_, index) => {
    out.push({ id: `meta.faqs[${index}].q`, label: `FAQ ${index + 1} — question`, field: { kind: 'faq', index, part: 'q' } });
    out.push({ id: `meta.faqs[${index}].a`, label: `FAQ ${index + 1} — answer`, field: { kind: 'faq', index, part: 'a' } });
  });
  return out;
}

export function currentValue(post: Pick<DeskPost, 'sections' | 'meta'>, field: CorrectionField): string {
  switch (field.kind) {
    case 'section':
      return post.sections?.[field.key] ?? '';
    case 'meta':
      return post.meta?.[field.key] ?? '';
    case 'faq':
      return post.meta?.faqs?.[field.index]?.[field.part] ?? '';
  }
}

export interface CorrectionEdits {
  sections?: Partial<Record<SectionKey, string>>;
  meta?: Pick<DeskMeta, MetaProseKey | 'faqs'>;
}

/** The sections/meta payload for a one-field correction. FAQs travel as the whole list. */
export function correctionEdits(
  post: Pick<DeskPost, 'meta'>,
  field: CorrectionField,
  value: string,
): CorrectionEdits {
  switch (field.kind) {
    case 'section':
      return { sections: { [field.key]: value } };
    case 'meta':
      return { meta: { [field.key]: value } };
    case 'faq': {
      const faqs: DeskFaq[] = (post.meta?.faqs ?? []).map((f, i) =>
        i === field.index ? { ...f, [field.part]: value } : { q: f.q, a: f.a },
      );
      return { meta: { faqs } };
    }
  }
}

/** Levenshtein over the differing middle — the same measure the mcp caps on. */
export function editDistance(a: string, b: string): number {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const s = a.slice(start, endA);
  const t = b.slice(start, endB);
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;
  let prev = new Uint32Array(t.length + 1);
  let curr = new Uint32Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[t.length];
}

const CONFIRMATION_KEYS = ['reviewed_source_reports', 'edited_for_accuracy', 'framing_confirmed'] as const;
const ALLOWED_KEYS = new Set<string>(['sections', 'meta', 'reason', ...CONFIRMATION_KEYS]);

export interface CorrectPublishedBody extends CorrectionEdits {
  reason: string;
  reviewed_source_reports: boolean;
  edited_for_accuracy: boolean;
  framing_confirmed: boolean;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Parse the correct-published request body. Strict like the mcp tool behind it
 * at the top level; the mcp's own strict schema refuses any undeclared key
 * inside sections/meta. Reviewer identity is never accepted from the body.
 */
export function parseCorrectPublishedBody(
  body: unknown,
): { ok: true; value: CorrectPublishedBody } | { ok: false; error: string } {
  if (!isPlainObject(body)) return { ok: false, error: 'Body must be a JSON object' };
  const extra = Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k));
  if (extra.length > 0) return { ok: false, error: `Unrecognized field(s): ${extra.join(', ')}` };

  if (body.sections !== undefined && !isPlainObject(body.sections)) {
    return { ok: false, error: 'sections must be an object' };
  }
  if (body.meta !== undefined && !isPlainObject(body.meta)) {
    return { ok: false, error: 'meta must be an object' };
  }
  if (body.sections === undefined && body.meta === undefined) {
    return { ok: false, error: 'Nothing to correct: send sections or meta' };
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return { ok: false, error: 'A reason is required to correct a published post' };
  for (const k of CONFIRMATION_KEYS) {
    if (typeof body[k] !== 'boolean') return { ok: false, error: `${k} must be a boolean` };
  }
  return {
    ok: true,
    value: {
      ...(body.sections !== undefined ? { sections: body.sections as CorrectionEdits['sections'] } : {}),
      ...(body.meta !== undefined ? { meta: body.meta as CorrectionEdits['meta'] } : {}),
      reason,
      reviewed_source_reports: body.reviewed_source_reports as boolean,
      edited_for_accuracy: body.edited_for_accuracy as boolean,
      framing_confirmed: body.framing_confirmed as boolean,
    },
  };
}
