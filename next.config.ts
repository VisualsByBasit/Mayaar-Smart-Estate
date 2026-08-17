import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        // Listing thumbnails carried over from the scraped Zameen dataset.
        protocol: "https",
        hostname: "media.zameen.com",
      },
    ],
  },
};

export default nextConfig;
