/** @type {import('next').NextConfig} */
const nextConfig = {
  // The owner dashboard is a static page in public/admin
  async rewrites() {
    return [{ source: "/admin", destination: "/admin/index.html" }];
  },
  images: { unoptimized: true },
};

export default nextConfig;
