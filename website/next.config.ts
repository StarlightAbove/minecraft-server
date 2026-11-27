import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, which the Docker image runs.
  output: "standalone",
  // The page doesn't use next/image, so leave its native library out.
  images: { unoptimized: true },
  outputFileTracingExcludes: { "*": ["node_modules/sharp/**", "node_modules/@img/**"] },
};

export default nextConfig;
