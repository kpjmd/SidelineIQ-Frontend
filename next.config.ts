import type { NextConfig } from "next";
import { legacyHostRedirects } from "./lib/legacy-host-redirect";

const nextConfig: NextConfig = {
  async redirects() {
    return legacyHostRedirects;
  },
  /**
   * The vendored brand fonts (app/fonts/*.ttf) are read at runtime by the
   * next/og card routes. lib/og-render.tsx reads them through an
   * import.meta.url-relative literal, which Next's tracing should follow on its
   * own — this is the belt to that braces, because the failure mode is
   * asymmetric: a missing font file works locally and 500s only on the deployed
   * image route, where nothing watches it.
   */
  outputFileTracingIncludes: {
    '/opengraph-image': ['./app/fonts/*.ttf'],
    '/twitter-image': ['./app/fonts/*.ttf'],
    '/post/[slug]/opengraph-image': ['./app/fonts/*.ttf'],
    '/post/[slug]/twitter-image': ['./app/fonts/*.ttf'],
  },
};

export default nextConfig;
