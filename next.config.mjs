/** @type {import('next').NextConfig} */
const nextConfig = {
  // The owner dashboard is a static page in public/admin
  async rewrites() {
    return [
      { source: "/admin", destination: "/admin/index.html" },
      // browsers and apps that ask for the classic icon address get the leaf mark
      { source: "/favicon.ico", destination: "/assets/maskati-mark.png" },
    ];
  },
  images: { unoptimized: true },
};

export default nextConfig;
