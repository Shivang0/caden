import path from "node:path";
import type { NextConfig } from "next";

// Pin the workspace root to this app so Next.js stops inferring it from stray
// lockfiles outside the project (silences the workspace-root warning on
// build/start).
const projectRoot = path.join(__dirname);

const nextConfig: NextConfig = {
  // Served from cadenhq.vercel.app/portal through a rewrite, so the whole app
  // lives under /portal and cookies stay first party on the caden domain.
  basePath: "/portal",
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
