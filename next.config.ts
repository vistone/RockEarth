import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/earth/PlanetoidMetadata",
        destination: "https://kh.google.com/rt/earth/PlanetoidMetadata",
      },
      {
        source: "/api/earth/BulkMetadata/:path*",
        destination: "https://kh.google.com/rt/earth/BulkMetadata/:path*",
      },
      {
        source: "/api/earth/NodeData/:path*",
        destination: "https://kh.google.com/rt/earth/NodeData/:path*",
      },
    ];
  },
};

export default nextConfig;
