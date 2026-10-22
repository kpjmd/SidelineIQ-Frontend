import { describe, it, expect } from 'vitest';
import {
  correctionEdits,
  correctionFields,
  currentValue,
  editDistance,
  parseCorrectPublishedBody,
} from '../lib/desk-correction';
import type { DeskPost } from '../lib/types';

const post = {
  sections: {
    snapshot: 's',
    what_happened: 'w',
    anatomy: 'a',
    treatment: 'The team has said surgery has been completed.The surgical technique used is not known.',
    timeline: 't',
    bridge: 'b',
    dr_take: 'd',
  },
  meta: {
    player: 'Ben Simmons',
    meta_description: 'desc',
    related_slugs: ['jayson-tatum-achilles-rupture'],
    faqs: [
      { q: 'Q1', a: 'A1' },
      { q: 'Q2', a: 'A2' },
    ],
  },
} as unknown as DeskPost;

describe('correctionFields', () => {
  it('lists the seven sections, the prose meta and each FAQ part — never structural meta', () => {
    const ids = correctionFields(post).map((f) => f.id);
    expect(ids.slice(0, 7)).toEqual([
      'sections.snapshot',
      'sections.what_happened',
      'sections.anatomy',
      'sections.treatment',
      'sections.timeline',
      'sections.bridge',
      'sections.dr_take',
    ]);
    expect(ids).toContain('meta.meta_description');
    expect(ids).toContain('meta.faqs[1].a');
    expect(ids.some((id) => /player|related_slugs|relevant_tool|conflict_flag|anatomy_diagram$/.test(id))).toBe(false);
  });
});

describe('correctionEdits', () => {
  it('sends one section for a section fix', () => {
    const fixed = post.sections!.treatment.replace('completed.The', 'completed. The');
    expect(correctionEdits(post, { kind: 'section', key: 'treatment' }, fixed)).toEqual({
      sections: { treatment: fixed },
    });
  });
  it('sends the whole FAQ list, same length, for an FAQ fix', () => {
    expect(correctionEdits(post, { kind: 'faq', index: 1, part: 'a' }, 'A2!')).toEqual({
      meta: { faqs: [{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2!' }] },
    });
  });
  it('reads the stored value back for every field kind', () => {
    expect(currentValue(post, { kind: 'meta', key: 'meta_description' })).toBe('desc');
    expect(currentValue(post, { kind: 'meta', key: 'short_title' })).toBe('');
    expect(currentValue(post, { kind: 'faq', index: 0, part: 'q' })).toBe('Q1');
  });
});

describe('editDistance', () => {
  it('counts the Simmons typo as one character', () => {
    expect(editDistance('completed.The', 'completed. The')).toBe(1);
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('parseCorrectPublishedBody', () => {
  const valid = {
    sections: { treatment: 'x' },
    reason: '  missing space ',
    reviewed_source_reports: true,
    edited_for_accuracy: true,
    framing_confirmed: true,
  };
  it('trims and accepts a complete body', () => {
    expect(parseCorrectPublishedBody(valid)).toEqual({ ok: true, value: { ...valid, reason: 'missing space' } });
  });
  it('refuses reviewer identity and any undeclared key', () => {
    expect(parseCorrectPublishedBody({ ...valid, reviewer_user_id: 'x' }).ok).toBe(false);
    expect(parseCorrectPublishedBody({ ...valid, title: 'x' }).ok).toBe(false);
  });
  it('refuses a body with nothing to correct, no reason, or a non-boolean confirmation', () => {
    expect(parseCorrectPublishedBody({ ...valid, sections: undefined }).ok).toBe(false);
    expect(parseCorrectPublishedBody({ ...valid, reason: ' ' }).ok).toBe(false);
    expect(parseCorrectPublishedBody({ ...valid, framing_confirmed: 'yes' }).ok).toBe(false);
    expect(parseCorrectPublishedBody({ ...valid, sections: ['x'] }).ok).toBe(false);
  });
});
