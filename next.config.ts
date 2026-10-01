import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" só fora da Vercel (self-host com bun/Caddy); na Vercel usa o output padrão
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  reactStrictMode: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
