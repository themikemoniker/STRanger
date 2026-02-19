import { resolve } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ranger/db"],
  outputFileTracingRoot: resolve(__dirname, "../../"),
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
