// Which page views reach Vercel Web Analytics (components/SiteAnalytics.tsx).
//
// The baseline is audience traffic. /admin and /desk are the MD's own working
// surfaces and would inflate "monthly uniques" with one person's review
// sessions; /signin is part of the same flow; /go is a redirect and never
// renders a page, but is listed so a future client navigation to it can't
// count as a view.
export const ANALYTICS_EXCLUDED_PREFIXES = ['/admin', '/desk', '/signin', '/go'] as const;

export function isTrackedPath(url: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(url, 'https://placeholder.invalid').pathname;
  } catch {
    // An unparseable URL is not evidence of an audience page view.
    return false;
  }
  return !ANALYTICS_EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
