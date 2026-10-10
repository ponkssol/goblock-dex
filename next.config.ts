import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  serverExternalPackages: [
    "@pump-fun/pump-swap-sdk",
    "@coral-xyz/anchor",
    "@meteora-ag/dlmm",
    "@orca-so/whirlpools-sdk",
    "@orca-so/common-sdk",
  ],
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
