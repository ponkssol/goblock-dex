import path from "path";
import type { NextConfig } from "next";

const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  transpilePackages: ["@goblock/shared"],
  poweredByHeader: false,
  async headers() {
    const assetCache = { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" };
    return [
      { source: "/venues/:path*", headers: [assetCache] },
      { source: "/brands/:path*", headers: [assetCache] },
      { source: "/goblock-logo.png", headers: [assetCache] },
      { source: "/goblock-mark.png", headers: [assetCache] },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/rpc", destination: `${backend}/rpc` },
    ];
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
