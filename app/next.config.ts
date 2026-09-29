import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.APP_MODE === "demo" ? { output: "export" } : {}),
};

export default nextConfig;
