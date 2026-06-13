/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // rss-parser pulls in some Node-only deps; keep it server-side only.
  experimental: {
    serverComponentsExternalPackages: ["rss-parser"],
  },
};

export default nextConfig;
