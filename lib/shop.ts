import base from "./i18n.json";

export type Lang = "ar" | "en";
export type Dict = Record<string, string>;
export const BASE_I18N = base as Record<Lang, Dict>;

export interface Product {
  id: string; slug: string; name_en: string; name_ar: string; kind_en: string | null; kind_ar: string | null;
  short_en: string | null; short_ar: string | null; description_en: string | null; description_ar: string | null;
  how_to_use_en: string | null; how_to_use_ar: string | null; ingredients_en: string | null; ingredients_ar: string | null;
  hair_needs: string[]; size: string | null; price: number; compare_at_price: number | null; image_url: string | null;
  badge_en: string | null; badge_ar: string | null; stock: number; is_bestseller: boolean;
}
export interface Bundle {
  id: string; slug: string; name_en: string; name_ar: string; description_en: string | null; description_ar: string | null;
  hair_need: string | null; product_ids: string[]; price: number; compare_at_price: number | null; image_url: string | null;
}
export interface Review { id: string; product_id: string | null; customer_name: string; rating: number; title: string | null; body: string; is_verified: boolean }
export interface Faq { id: string; question_en: string; question_ar: string; answer_en: string; answer_ar: string }
export interface Governorate { id: number; name_en: string; name_ar: string; delivery_zone_id: number | null; bosta_city_id: string | null }
export interface DeliveryZone { id: number; name_en: string; name_ar: string; fee: number; days: string }
export interface Profile {
  id: string; email: string | null; full_name: string | null; phone: string | null; shipping_zone_id: number | null;
  city: string | null; address: string | null; avatar_seed: string | null; avatar_name: string | null; avatar_variant: number | null;
}
export interface CartLine { type: "product" | "bundle"; id: string; qty: number }

/** Reads `<field>_<lang>` with Arabic as the fallback. */
export const pick = (obj: object | null | undefined, field: string, lang: Lang): string => {
  const o = (obj ?? {}) as Record<string, unknown>;
  return String(o[`${field}_${lang}`] || o[`${field}_ar`] || "");
};

export const arDigits = (s: string | number) => String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
export const num = (n: string | number, lang: Lang) => (lang === "ar" ? arDigits(n) : String(n));
export const money = (n: number | string | null | undefined, lang: Lang) => {
  const v = Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return lang === "ar" ? `${arDigits(v.replace(/,/g, "٬"))} ج.م` : `EGP ${v}`;
};
export const trackUrl = (n: string) => `https://bosta.co/tracking-shipments?shipment-number=${encodeURIComponent(n)}`;
export const STATUS_STEPS = ["confirmed", "with_courier", "delivered"] as const;
