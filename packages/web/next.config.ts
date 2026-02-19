import { resolve } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@stranger/db"],
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingRoot: resolve(__dirname, "../../"),
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { isServer }) => {
    // Allow .js imports to resolve to .ts source files (needed for @stranger/db)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    // Ensure better-sqlite3 native module is never bundled
    if (isServer) {
      config.externals = [...(config.externals || []), "better-sqlite3"];
    }
    return config;
  },
};

export default nextConfig;
