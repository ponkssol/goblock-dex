import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  transpilePackages: ["@goblock/shared"],
  serverExternalPackages: [
    "@pump-fun/pump-swap-sdk",
    "@coral-xyz/anchor",
    "@meteora-ag/dlmm",
    "@meteora-ag/cp-amm-sdk",
    "@meteora-ag/dynamic-amm-sdk",
    "@meteora-ag/dynamic-bonding-curve-sdk",
    "@raydium-io/raydium-sdk-v2",
    "@orca-so/whirlpools-sdk",
    "@orca-so/common-sdk",
    "@electric-sql/pglite",
    "pg",
  ],
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
