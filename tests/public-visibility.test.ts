/**
 * What the public may fetch.
 *
 * Three surfaces render the same row — the page, its metadata, and the OG /
 * Twitter card — and all three used to gate on `isRetiredPostStatus`, which
 * blocks REJECTED and SUPERSEDED while letting PENDING_REVIEW and DRAFT
 * through. A post in the physician's review queue was therefore readable, and
 * shareable as a rendered card, by anyone who knew the slug: the one state
 * where we have explicitly NOT decided the content is fit to publish.
 *
 * There was a worse one. `app/api/post/[slug]/route.ts` returned the raw post
 * JSON for ANY status, unauthenticated, with no caller anywhere in the repo —
 * REJECTED clinical content included. It is deleted; the last test here is what
 * stops it coming back.
 *
 * FAILS-ON-OLD: the parameterized case fails for PENDING_REVIEW and DRAFT
 * against `isRetiredPostStatus`.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPubliclyViewable, isRetiredPostStatus, type PostStatus } from '../lib/types';

const ROOT = resolve(__dirname, '..');

describe('isPubliclyViewable', () => {
  it.each<[PostStatus, boolean]>([
    ['PUBLISHED', true],
    ['PENDING_REVIEW', false],
    ['DRAFT', false],
    ['REJECTED', false],
    ['SUPERSEDED', false],
  ])('%s → %s', (status, expected) => {
    expect(isPubliclyViewable(status)).toBe(expected);
  });

  it('is strictly stricter than isRetiredPostStatus', () => {
    const statuses: PostStatus[] = ['PUBLISHED', 'PENDING_REVIEW', 'DRAFT', 'REJECTED', 'SUPERSEDED'];
    for (const s of statuses) {
      // Anything the retired check blocks, this must block too. The reverse does
      // not hold, and that gap is the whole point.
      if (isRetiredPostStatus(s)) expect(isPubliclyViewable(s)).toBe(false);
    }
    expect(statuses.filter((s) => !isRetiredPostStatus(s) && !isPubliclyViewable(s))).toEqual([
      'PENDING_REVIEW',
      'DRAFT',
    ]);
  });
});

describe('the public surfaces all ask the same question', () => {
  const SURFACES = [
    'app/post/[slug]/page.tsx',
    'app/post/[slug]/opengraph-image.tsx',
  ];

  it.each(SURFACES)('%s gates on isPubliclyViewable, not on the retired set', (rel) => {
    const src = readFileSync(resolve(ROOT, rel), 'utf-8');
    expect(src).toContain('isPubliclyViewable');
    // A surface that still consults the looser predicate has drifted back.
    expect(src).not.toContain('isRetiredPostStatus');
  });

  it('twitter-image re-exports the OG card rather than gating separately', () => {
    // Two gates would be two things to forget.
    const src = readFileSync(resolve(ROOT, 'app/post/[slug]/twitter-image.tsx'), 'utf-8');
    expect(src).toMatch(/from '\.\/opengraph-image'/);
  });

  it('the page gates before it renders anything', () => {
    const src = readFileSync(resolve(ROOT, 'app/post/[slug]/page.tsx'), 'utf-8');
    const gate = src.indexOf('isPubliclyViewable(post.status)');
    const render = src.indexOf('<DeepDivePost');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(render);
  });

  it('generateMetadata gates too — a title and canonical for an unapproved post is the post', () => {
    const src = readFileSync(resolve(ROOT, 'app/post/[slug]/page.tsx'), 'utf-8');
    const meta = src.indexOf('export async function generateMetadata');
    const body = src.slice(meta, src.indexOf('export default async function'));
    expect(body).toContain('isPubliclyViewable');
  });
});

describe('the unauthenticated post JSON route stays gone', () => {
  it('app/api/post/ does not exist', () => {
    // It returned the raw row for any status, to anybody, and nothing in the
    // repo called it. If it ever comes back it needs a gate before it ships.
    expect(existsSync(resolve(ROOT, 'app/api/post'))).toBe(false);
  });
});

describe('the MD still has a way to read a queued post', () => {
  it('the review queue links to the session-gated preview', () => {
    const src = readFileSync(resolve(ROOT, 'components/admin/ReviewQueue.tsx'), 'utf-8');
    expect(src).toContain('/admin/preview/${review.slug}');
    expect(src).not.toContain('`/post/${review.slug}`');
  });

  it('the preview requires an md session and is never indexed', () => {
    const src = readFileSync(resolve(ROOT, 'app/admin/preview/[slug]/page.tsx'), 'utf-8');
    expect(src).toContain('await auth()');
    expect(src).toContain("session.user.role !== 'md'");
    expect(src).toContain('index: false');
    // Dynamic on purpose — and kept out of /post/[slug] so that route stays ISR.
    expect(src).toContain("export const dynamic = 'force-dynamic'");
  });
});
