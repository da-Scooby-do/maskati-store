import type { MetadataRoute } from "next";
import { db } from "@/lib/supabase";

const SITE = "https://www.maskaticare.com";

// rebuilt at most once an hour, so new products appear without a deploy
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await db.from("products").select("slug").eq("is_visible", true);
  return [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/shop`, changeFrequency: "weekly", priority: 0.9 },
    ...(data || []).map((p) => ({ url: `${SITE}/product/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
