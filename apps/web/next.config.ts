import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ["@contextkeeper/core"],
};

export default nextConfig;
