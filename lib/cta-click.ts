// The /go/aequos redirect (app/go/aequos/route.ts): count a click on an AequOs
// link, then send the reader on.
//
// Two rules, and the order matters:
//   1. The redirect ALWAYS happens, to a FIXED target. Nothing in the request
//      chooses the destination, so this route cannot be used as an open
//      redirect, and no count failure can strand a reader who clicked.
//   2. A click is counted only when it looks like a person clicking a real
//      link: GET (not HEAD), a slug-shaped `post`, a known `from`, not a
//      prefetch, and a user agent that is present and not a crawler or link
//      unfurler. Posts are shared to X and Farcaster, whose preview fetchers
//      would otherwise count every share as a click.
//
// Nothing about the visitor is stored. The mcp side keeps an aggregate counter
// (day, post, link) and only for a PUBLISHED post (mcp migration 024).

import { BRAND_SLUG } from './brand';

export const CTA_LINKS = ['cta', 'byline'] as const;
export type CtaLink = (typeof CTA_LINKS)[number];

const AEQUOS_ORIGIN = 'https://aequos.io/';

// Same shape the mcp tool enforces: slugify() output, plus a uniqueness suffix.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 240;

const NON_HUMAN_UA_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|unfurl|whatsapp|telegram|discord|slack|skype|headless|lighthouse|curl|wget|python|axios|node-fetch|go-http-client|okhttp|java\//i;

/** Where the reader lands. `ref` is kept so the attribution the site has always sent survives. */
export function aequosTarget(from: CtaLink | null): string {
  const url = new URL(AEQUOS_ORIGIN);
  url.searchParams.set('ref', BRAND_SLUG);
  url.searchParams.set('utm_source', BRAND_SLUG);
  url.searchParams.set('utm_medium', 'web');
  url.searchParams.set('utm_campaign', 'deep_dive');
  url.searchParams.set('utm_content', from ?? 'unknown');
  return url.toString();
}

/**
 * The link a post page emits. A post with no slug (the column is nullable)
 * links straight to the tagged target: uncounted, but never broken.
 */
export function aequosClickHref(postSlug: string | null, from: CtaLink): string {
  if (!postSlug) return aequosTarget(from);
  return `/go/aequos?${new URLSearchParams({ post: postSlug, from }).toString()}`;
}

export interface ClickRequest {
  method: string;
  searchParams: URLSearchParams;
  headers: Headers;
}

export type ClickDecision =
  | { count: true; postSlug: string; from: CtaLink; target: string }
  | { count: false; reason: string; target: string };

function isCtaLink(value: string | null): value is CtaLink {
  return value !== null && (CTA_LINKS as readonly string[]).includes(value);
}

export function decideClick(req: ClickRequest): ClickDecision {
  const rawFrom = req.searchParams.get('from');
  const from = isCtaLink(rawFrom) ? rawFrom : null;
  const target = aequosTarget(from);

  if (req.method !== 'GET') return { count: false, reason: 'method', target };

  const postSlug = req.searchParams.get('post');
  if (!postSlug || postSlug.length > SLUG_MAX || !SLUG_RE.test(postSlug)) {
    return { count: false, reason: 'slug', target };
  }
  if (!from) return { count: false, reason: 'from', target };

  const purpose = `${req.headers.get('purpose') ?? ''} ${req.headers.get('sec-purpose') ?? ''}`;
  if (/prefetch|prerender/i.test(purpose)) return { count: false, reason: 'prefetch', target };

  const ua = req.headers.get('user-agent') ?? '';
  if (!ua || NON_HUMAN_UA_RE.test(ua)) return { count: false, reason: 'user_agent', target };

  return { count: true, postSlug, from, target };
}
