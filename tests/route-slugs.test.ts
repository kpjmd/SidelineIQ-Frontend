/**
 * Sibling dynamic route segments under one parent must share a slug name.
 *
 * This is a route-TREE property, so no unit test of a handler can see it and
 * `next build` does not fail on it: the build happily wrote both
 * /api/admin/threads/[id] and /api/admin/threads/[entityId]/reopen into
 * routes-manifest.json, and Vercel routes from those prebuilt regexes, so
 * production served both routes correctly for weeks.
 *
 * What it does break is the runtime route resolver, which is built per request:
 * `next start` and `next dev` answered 500 to EVERY path in the app —
 * `/`, `/privacy`, every API route — with
 *
 *   Error: You cannot use different slug names for the same dynamic path
 *   ('entityId' !== 'id').
 *
 * So the failure mode is "local production verification is impossible", which is
 * exactly the kind of thing that stays unnoticed and then blocks the next piece
 * of work. This test is the cheap standing check.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = join(process.cwd(), 'app');

/** Every directory that holds more than one dynamic child, with those children. */
function dynamicSiblingGroups(dir: string, rel = 'app'): Array<{ parent: string; slugs: string[] }> {
  const groups: Array<{ parent: string; slugs: string[] }> = [];
  const children = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());

  const dynamic = children
    .map((e) => e.name)
    .filter((name) => name.startsWith('[') && name.endsWith(']'));
  if (dynamic.length > 1) groups.push({ parent: rel, slugs: dynamic.sort() });

  for (const child of children) {
    groups.push(...dynamicSiblingGroups(join(dir, child.name), `${rel}/${child.name}`));
  }
  return groups;
}

/** `[id]` -> `id`, `[...slug]` -> `slug`, `[[...slug]]` -> `slug`. */
function slugName(segment: string): string {
  return segment.replace(/^\[+\.{0,3}/, '').replace(/\]+$/, '');
}

describe('app router dynamic segments', () => {
  it('never gives two sibling dynamic segments different slug names', () => {
    const offenders = dynamicSiblingGroups(APP_DIR)
      .map((group) => ({ ...group, names: [...new Set(group.slugs.map(slugName))] }))
      .filter((group) => group.names.length > 1);

    // Reported as the full group so the message names the parent and both slugs,
    // which is the whole diagnosis.
    expect(offenders).toEqual([]);
  });

  it('finds the reopen route under the same slug as the thread route', () => {
    const threads = readdirSync(join(APP_DIR, 'api/admin/threads'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(threads).toEqual(['[id]']);
    expect(readdirSync(join(APP_DIR, 'api/admin/threads/[id]')).sort()).toEqual([
      'reopen',
      'route.ts',
    ]);
  });
});
