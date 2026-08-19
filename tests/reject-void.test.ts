/**
 * Which threads a post rejection may retract.
 *
 * Two failures bracket this predicate, and they pull in opposite directions.
 *
 * Retract too little and you get the Greenard case: entity eac3cc8a held a
 * "back / surgery" thread for a pectoral injury, its only post was rejected and
 * deleted, and because both FKs are ON DELETE SET NULL the thread stayed ACTIVE
 * and post-less inside the 21-day matching window — absorbing six days of his
 * real reports as duplicates instead of publishing them.
 *
 * Retract too much and you get the Mykel Williams case: the pipeline dated his
 * ACL reconstruction to the day it read a Kyle Shanahan quote about it
 * (2026-08-19; the surgery was 2025-11-02), the MD corrected the date on the
 * thread, and then had to reject the post because its RTP window was built on
 * the wrong anchor. Voiding there would have deleted the correction.
 *
 * The difference is whether a human has touched the thread.
 */
import { describe, it, expect } from 'vitest';
import { shouldVoidThreadOnReject, isMdCurated } from '../lib/reject-void';
import type { InjuryEntity, InjuryUpdate } from '../lib/types';

const POST = 'post-under-review';

function entity(overrides: Partial<InjuryEntity> = {}) {
  return {
    status: 'ACTIVE' as const,
    canonical_post_id: POST,
    date_resolution_sources: [{ stage: 'api' as const }],
    ...overrides,
  } as InjuryEntity;
}

function update(post_id: string | null) {
  return { post_id } as InjuryUpdate;
}

describe('shouldVoidThreadOnReject', () => {
  it('retracts a thread whose only link to published content is this post', () => {
    expect(shouldVoidThreadOnReject(entity(), [update(POST)], POST)).toBe(true);
  });

  it('retracts a thread with no post at all — the Greenard orphan', () => {
    expect(
      shouldVoidThreadOnReject(entity({ canonical_post_id: null }), [update(null)], POST),
    ).toBe(true);
  });

  it('does NOT count post-less timeline rows as coverage', () => {
    // These are the deduplicator's repeat-source appends. An orphaned thread
    // fills up with them, so treating them as coverage would make the thread
    // permanently unretractable.
    const rows = [update(POST), update(null), update(null)];
    expect(shouldVoidThreadOnReject(entity(), rows, POST)).toBe(true);
  });

  it('spares a thread an MD has corrected by hand', () => {
    const curated = entity({ date_resolution_sources: [{ stage: 'md_manual' }] });
    expect(shouldVoidThreadOnReject(curated, [update(POST)], POST)).toBe(false);
  });

  it('spares it even when the correction sits alongside automated provenance', () => {
    const curated = entity({
      date_resolution_sources: [
        { stage: 'api' },
        { stage: 'web_search', url: 'https://example.test' },
        { stage: 'md_manual' },
      ],
    });
    expect(shouldVoidThreadOnReject(curated, [update(POST)], POST)).toBe(false);
  });

  it('spares a thread carrying other published coverage', () => {
    const rows = [update(POST), update('some-other-post')];
    expect(shouldVoidThreadOnReject(entity(), rows, POST)).toBe(false);
  });

  it('spares a thread anchored to a different post', () => {
    expect(
      shouldVoidThreadOnReject(entity({ canonical_post_id: 'another-post' }), [], POST),
    ).toBe(false);
  });

  it('leaves an already-closed thread on its existing outcome', () => {
    // Re-voiding a RESOLVED thread would overwrite a real accuracy record.
    for (const status of ['RESOLVED', 'RETIRED', 'VOID'] as const) {
      expect(shouldVoidThreadOnReject(entity({ status }), [update(POST)], POST)).toBe(false);
    }
  });

  it('tolerates a thread with no provenance recorded at all', () => {
    for (const sources of [null, undefined, []]) {
      expect(
        shouldVoidThreadOnReject(
          entity({ date_resolution_sources: sources as never }),
          [update(POST)],
          POST,
        ),
      ).toBe(true);
    }
  });
});

describe('isMdCurated', () => {
  it('keys on the md_manual stamp the dashboard writes', () => {
    expect(isMdCurated({ date_resolution_sources: [{ stage: 'md_manual' }] })).toBe(true);
    expect(isMdCurated({ date_resolution_sources: [{ stage: 'api' }] })).toBe(false);
    expect(isMdCurated({ date_resolution_sources: null })).toBe(false);
  });
});
