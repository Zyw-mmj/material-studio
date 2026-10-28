import type { NextConfig } from "next";

const apiOrigin = process.env.JAVA_API_ORIGIN ?? "http://127.0.0.1:8080";
const parsedOrigin = new URL(apiOrigin);
if (
  !["http:", "https:"].includes(parsedOrigin.protocol) ||
  parsedOrigin.pathname !== "/"
) {
  throw new Error("JAVA_API_ORIGIN must be an HTTP(S) origin without a path");
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${parsedOrigin.origin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
