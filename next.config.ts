import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native Node module — it can't be bundled by webpack.
  // Tell Next.js to leave it as a Node require() instead of trying to bundle it.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
