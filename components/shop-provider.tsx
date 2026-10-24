"use client";

import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { db } from "@/lib/supabase";
import {
  BASE_I18N, money as fmtMoney, num as fmtNum, pick,
  type Bundle, type CartLine, type DeliveryZone, type Dict, type Faq, type Governorate, type Lang, type Product, type Profile, type Review,
} from "@/lib/shop";

interface ShopData {
  products: Product[]; bundles: Bundle[]; faqs: Faq[]; reviews: Review[];
  zones: Governorate[]; deliveryZones: DeliveryZone[]; settings: Record<string, any>;
}
const EMPTY: ShopData = { products: [], bundles: [], faqs: [], reviews: [], zones: [], deliveryZones: [], settings: {} };

const store = {
  get<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

function useShopState() {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>("ar");
  const [data, setData] = useState<ShopData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; id: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // the browser's saved language and bag
  useEffect(() => {
    setLangState(store.get<Lang>("mk_lang", "ar"));
    setCart(store.get<CartLine[]>("mk_cart", []));
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = lang === "ar" ? "ماسكاتي | عناية بالشعر في كل لحظة" : "Maskati | Hair care, every moment";
  }, [lang]);

  // owner's wording from the dashboard's Site text page; a blank field keeps the built-in text
  const dict: Dict = useMemo(() => {
    const out = { ...BASE_I18N[lang] };
    const overrides = (data.settings.site_text || {}) as Record<string, Partial<Record<Lang, string>>>;
    for (const [key, v] of Object.entries(overrides)) if (v?.[lang]?.trim()) out[key] = v[lang]!;
    return out;
  }, [lang, data.settings.site_text]);
  const t = useCallback((key: string, x?: string | number) => (dict[key] ?? key).replace("{x}", x === undefined ? "" : String(x)), [dict]);
  const L = useCallback((obj: object | null | undefined, field: string) => pick(obj, field, lang), [lang]);
  const money = useCallback((n: number | string | null | undefined) => fmtMoney(n, lang), [lang]);
  const num = useCallback((n: string | number) => fmtNum(n, lang), [lang]);

  const toast = useCallback((text: string) => {
    setToastMsg({ text, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2400);
  }, []);

  const loadData = useCallback(async () => {
    const res = await Promise.all([
      db.from("products").select("*").order("sort_order"),
      db.from("bundles").select("*").order("sort_order"),
      db.from("faqs").select("*").order("sort_order"),
      db.from("reviews").select("*").order("created_at", { ascending: false }).limit(60),
      db.from("shipping_zones").select("*").eq("is_active", true).order("sort_order"),
      db.from("delivery_zones").select("*").order("sort_order"),
      db.from("site_settings").select("key,value"),
    ]);
    const failed = res.find((r) => r.error);
    if (failed) throw failed.error;
    const [p, b, f, r, z, dz, s] = res;
    setData({
      products: p.data as Product[], bundles: b.data as Bundle[], faqs: f.data as Faq[], reviews: r.data as Review[],
      zones: z.data as Governorate[], deliveryZones: dz.data as DeliveryZone[],
      settings: Object.fromEntries((s.data as { key: string; value: unknown }[]).map((row) => [row.key, row.value])),
    });
  }, []);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setIsOwner(false); return; }
    const [{ data: row }, { data: owner }] = await Promise.all([
      db.from("profiles").select("*").eq("id", s.user.id).maybeSingle(),
      db.rpc("is_admin"),
    ]);
    setProfile(row as Profile | null);
    setIsOwner(owner === true);
  }, []);

  // load with a few automatic retries, then a Retry bar
  const boot = useCallback(async (attempt = 0): Promise<void> => {
    try {
      await loadData();
      setLoaded(true); setLoadError(false);
    } catch {
      if (attempt < 3) { setTimeout(() => boot(attempt + 1), 1000 * 2 ** attempt); return; }
      setLoadError(true);
    }
  }, [loadData]);

  useEffect(() => {
    boot();
    db.auth.getSession().then(({ data: s }) => { setSession(s.session); loadProfile(s.session); });
    const { data: sub } = db.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      // defer so Supabase finishes its own auth work before we query
      setTimeout(() => {
        loadProfile(s);
        if (event === "PASSWORD_RECOVERY") { setRecovering(true); router.push("/account"); }
        else if (event === "SIGNED_IN" && /access_token/.test(window.location.hash)) router.push("/account");
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [boot, loadProfile, router]);

  const productById = useCallback((id: string) => data.products.find((p) => p.id === id), [data.products]);
  const bundleById = useCallback((id: string) => data.bundles.find((b) => b.id === id), [data.bundles]);
  // how many of an item can be bought: a routine is limited by its scarcest product
  const stockOf = useCallback((type: CartLine["type"], id: string) => {
    if (type === "bundle") {
      const items = (bundleById(id)?.product_ids || []).map(productById).filter(Boolean) as Product[];
      return items.length ? Math.min(...items.map((p) => p.stock)) : 0;
    }
    return productById(id)?.stock ?? 0;
  }, [bundleById, productById]);

  // drop bag lines for items that no longer exist
  useEffect(() => {
    if (!loaded) return;
    setCart((c) => c.filter((l) => (l.type === "bundle" ? bundleById(l.id) : productById(l.id))));
  }, [loaded, bundleById, productById]);
  useEffect(() => { if (loaded) store.set("mk_cart", cart); }, [cart, loaded]);

  const qtyOf = useCallback((type: CartLine["type"], id: string) => cart.find((l) => l.type === type && l.id === id)?.qty ?? 0, [cart]);
  const setQty = useCallback((type: CartLine["type"], id: string, qty: number) => {
    const max = Math.min(20, stockOf(type, id));
    const next = Math.max(0, Math.min(max, qty));
    setCart((c) => {
      const rest = c.filter((l) => !(l.type === type && l.id === id));
      if (next === 0) return rest;
      const found = c.find((l) => l.type === type && l.id === id);
      return found ? c.map((l) => (l === found ? { ...l, qty: next } : l)) : [...c, { type, id, qty: next }];
    });
    return next;
  }, [stockOf]);
  const addToCart = useCallback((type: CartLine["type"], id: string, qty = 1) => {
    const max = Math.min(20, stockOf(type, id));
    if (max <= 0) { toast(t("out_of_stock")); return; }
    const want = qtyOf(type, id) + qty;
    setQty(type, id, want);
    toast(want > max ? t("only_left", fmtNum(max, lang)) : t("added"));
  }, [stockOf, qtyOf, setQty, toast, t, lang]);

  const cartLines = useMemo(() => cart.map((c) => {
    const item = c.type === "bundle" ? bundleById(c.id) : productById(c.id);
    return item ? { ...c, item, price: Number(item.price), total: Number(item.price) * c.qty } : null;
  }).filter(Boolean) as (CartLine & { item: Product | Bundle; price: number; total: number })[], [cart, bundleById, productById]);
  const subtotal = cartLines.reduce((s, l) => s + l.total, 0);
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  const deliveryFeeFor = useCallback((zoneId: string | number | null | undefined, sub: number) => {
    const gov = data.zones.find((z) => String(z.id) === String(zoneId));
    if (!gov) return null;
    const dz = data.deliveryZones.find((d) => d.id === gov.delivery_zone_id);
    // no free delivery: every order pays its zone's fee (a promo code can still waive it)
    const fee = dz ? Number(dz.fee) : Number(data.settings.flat_shipping_fee || 0);
    return { gov, fee, days: dz?.days || "2-4" };
  }, [data]);

  const waNumber = String(data.settings.contact?.whatsapp || data.settings.social?.whatsapp || "").replace(/[^\d]/g, "");
  const waLink = useCallback((text?: string) => waNumber
    ? `https://wa.me/${waNumber.startsWith("0") ? "2" + waNumber : waNumber}${text ? "?text=" + encodeURIComponent(text) : ""}` : null, [waNumber]);

  const setLang = (l: Lang) => { setLangState(l); store.set("mk_lang", l); };

  return {
    lang, setLang, t, L, money, num, data, loaded, loadError, retry: () => boot(0), reloadData: loadData,
    session, profile, isOwner, refreshProfile: () => loadProfile(session), recovering, setRecovering,
    cart, setCart, cartLines, subtotal, cartCount, qtyOf, setQty, addToCart, stockOf, productById, bundleById,
    drawerOpen, openDrawer: () => setDrawerOpen(true), closeDrawer: () => setDrawerOpen(false),
    toastMsg, toast, deliveryFeeFor, waLink, store,
  };
}

type Shop = ReturnType<typeof useShopState>;
const ShopContext = createContext<Shop | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const value = useShopState();
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside ShopProvider");
  return ctx;
}

/** The browser-tab title for a page, in the shopper's language: "Okra Mask | Maskati". No title = the shop's own. */
export function usePageTitle(title?: string) {
  const { lang, t } = useShop();
  useEffect(() => {
    const brand = lang === "ar" ? "ماسكاتي" : "Maskati";
    document.title = title ? `${title} | ${brand}` : `${brand} | ${t("footer_tag")}`;
  }, [title, lang, t]);
}
