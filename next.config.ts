import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // E2E runs its own server next to `npm run dev`; a separate build directory keeps them apart.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
