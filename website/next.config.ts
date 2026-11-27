import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, which the Docker image runs.
  output: "standalone",
  // The page doesn't use next/image, so leave its native library out.
  images: { unoptimized: true },
  outputFileTracingExcludes: { "*": ["node_modules/sharp/**", "node_modules/@img/**"] },
  // squaremap's web server runs inside the mc container and isn't published.
  // The site serves it under /map/. MAP_ORIGIN is read at build time.
  async rewrites() {
    return [{ source: "/map/:path*", destination: `${process.env.MAP_ORIGIN || "http://mc:8080"}/:path*` }];
  },
  // squaremap loads its files by relative path, so it has to open from inside /map/.
  async redirects() {
    return [{ source: "/map", destination: "/map/index.html", permanent: false }];
  },
};

export default nextConfig;
