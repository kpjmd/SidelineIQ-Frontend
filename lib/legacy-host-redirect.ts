import type { NextConfig } from 'next';
import { DEFAULT_SITE_URL, LEGACY_SITE_HOST } from './site-url';

/**
 * Every request to the pre-cutover host goes to the same path on the canonical
 * one, query string included (Next carries it over). `permanent: true` is a
 * 308, which keeps the method — a POST is not silently turned into a GET.
 *
 * The destination is the CONSTANT, never NEXT_PUBLIC_SITE_URL: an env var still
 * set to the old host would make this redirect to itself forever.
 *
 * Matched on the exact host, so preview deployments (`*-git-*.vercel.app`) and
 * localhost are untouched.
 */
type Redirects = Awaited<ReturnType<NonNullable<NextConfig['redirects']>>>;

export const legacyHostRedirects: Redirects = [
  {
    source: '/:path*',
    has: [{ type: 'host', value: LEGACY_SITE_HOST }],
    destination: `${DEFAULT_SITE_URL}/:path*`,
    permanent: true,
  },
];
