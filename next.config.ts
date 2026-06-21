import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      accounts: "./src/stubs/empty-module.ts",
    },
  },
};

export default nextConfig;
