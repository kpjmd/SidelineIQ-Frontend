'use client';

import { Analytics } from '@vercel/analytics/next';
import { isTrackedPath } from '@/lib/analytics-filter';

// Vercel Web Analytics: cookieless, no consent banner, page views only.
// A client wrapper because beforeSend is a function, and a function prop
// cannot cross from the server root layout.
export function SiteAnalytics() {
  return <Analytics beforeSend={(event) => (isTrackedPath(event.url) ? event : null)} />;
}
