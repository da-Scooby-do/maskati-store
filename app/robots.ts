import type { MetadataRoute } from "next";

// search engines may read the shop; the dashboard, checkout and account pages stay out of results
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/checkout", "/account", "/thanks"] },
    sitemap: "https://www.maskaticare.com/sitemap.xml",
  };
}
