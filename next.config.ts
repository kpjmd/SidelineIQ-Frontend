import type { NextConfig } from "next";
import { legacyHostRedirects } from "./lib/legacy-host-redirect";

const nextConfig: NextConfig = {
  async redirects() {
    return legacyHostRedirects;
  },
};

export default nextConfig;
