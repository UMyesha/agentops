import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prisma + bcryptjs are server-only; keep them external from the bundler.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
