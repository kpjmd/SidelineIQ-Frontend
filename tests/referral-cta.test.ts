/**
 * <AequOsCTA /> rendered on every post page regardless of type. The first test
 * FAILS against that (an unconditional `true`), and against the obvious
 * half-fix of gating on content_type alone.
 */
import { describe, it, expect } from 'vitest';
import { showsReferralCta } from '../lib/referral-cta';
import type { ContentType, SubjectKind } from '../lib/types';

const TYPES: ContentType[] = ['BREAKING', 'TRACKING', 'DEEP_DIVE', 'CONFLICT_FLAG'];
const KINDS: Array<SubjectKind | null | undefined> = ['INJURY_TYPE', 'ATHLETE', null, undefined];

describe('showsReferralCta', () => {
  it('is exactly DEEP_DIVE + INJURY_TYPE', () => {
    for (const content_type of TYPES) {
      for (const subject_kind of KINDS) {
        expect(showsReferralCta({ content_type, subject_kind })).toBe(
          content_type === 'DEEP_DIVE' && subject_kind === 'INJURY_TYPE',
        );
      }
    }
  });

  it('an athlete-led DEEP_DIVE shows no CTA', () => {
    expect(showsReferralCta({ content_type: 'DEEP_DIVE', subject_kind: 'ATHLETE' })).toBe(false);
  });

  it('a legacy row, or an mcp that predates the column, shows no CTA', () => {
    expect(showsReferralCta({ content_type: 'DEEP_DIVE', subject_kind: null })).toBe(false);
    expect(showsReferralCta({ content_type: 'DEEP_DIVE' })).toBe(false);
  });

  it('an unrecognized value shows no CTA', () => {
    expect(
      showsReferralCta({ content_type: 'DEEP_DIVE', subject_kind: 'injury_type' as SubjectKind }),
    ).toBe(false);
  });
});
