"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { haptic } from "@/components/mobile";
import { ReviewCard } from "@/components/cards";
import { ContinuousTabs } from "@/components/continuous-tabs";
import { AddToCartButton } from "@/components/kokonutui/cart-button";
import SlideTextButton from "@/components/kokonutui/slide-text-button";
import { Loading } from "@/components/loading";
import { EASE, Parallax, Reveal, Stagger, StaggerItem, WordsReveal } from "@/components/motion";
import { useShop } from "@/components/shop-provider";
import { db } from "@/lib/supabase";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, L, money, num, data, loaded, qtyOf, setQty, toast, profile, openDrawer } = useShop();
  const [tab, setTab] = useState("description");
  const [msg, setMsg] = useState("");
  if (!loaded) return <Loading />;
  const p = data.products.find((x) => x.slug === decodeURIComponent(slug));
  if (!p) return <div className="wrap thanks"><h1 className="display-lg">404</h1><p className="lede">{t("not_found")}</p><Link className="btn btn-primary" href="/">{t("back_home")}</Link></div>;
  const reviews = data.reviews.filter((r) => r.product_id === p.id);
  const soldOut = p.stock <= 0;
  const save = Number(p.compare_at_price) - Number(p.price);
  const qty = qtyOf("product", p.id);
  const tabs = [["description", "description"], ["how_to_use", "how_to_use"], ["ingredients", "ingredients"]].filter(([f]) => L(p, f));

  const onReview = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value.trim();
    const { error } = await db.from("reviews").insert({ product_id: p.id, customer_name: v("rv-name"), rating: Number(v("rv-rating")), title: v("rv-title") || null, body: v("rv-body") });
    setMsg(error ? t("err_generic") : t("review_sent"));
    if (!error) f.reset();
  };

  return (
    <>
      <div className="wrap">
        <Reveal><nav className="crumbs"><Link href="/shop">{t("nav_shop")}</Link> / {L(p, "name")}</nav></Reveal>
        <div className="pdp">
          <motion.div animate={{ clipPath: "inset(0% 0% 0% 0%)" }} className="pdp-media relative overflow-hidden" initial={{ clipPath: "inset(0% 0% 100% 0%)" }} transition={{ duration: 1.2, ease: EASE }}>
            {L(p, "badge") ? <span className="disc">{L(p, "badge")}</span> : null}
            <Parallax className="size-full" distance={40}>
              <motion.img alt={L(p, "name")} animate={{ scale: 1 }} className="size-full object-cover" initial={{ scale: 1.2 }} src={p.image_url || "/assets/maskati-mark.png"} transition={{ duration: 1.8, ease: EASE }} />
            </Parallax>
          </motion.div>
          <div className="pdp-info">
            <Reveal><span className="eyebrow" style={{ margin: 0 }}>{L(p, "kind")}{p.size ? ` · ${p.size}` : ""}</span></Reveal>
            <WordsReveal className="display-lg" text={L(p, "name")} />
            <Reveal delay={0.2}><p className="lede">{L(p, "short")}</p></Reveal>
            <Reveal delay={0.3}>
              <div className="price-big">{money(p.price)}{save > 0 ? <span className="compare">{money(p.compare_at_price)}</span> : null}</div>
              {save > 0 ? <div className="save" style={{ color: "var(--olive-ink)" }}>{t("you_save")} {money(save)}</div> : null}
              {!soldOut && p.stock <= 5 ? <div className="body-sm" style={{ color: "var(--olive-ink)" }}>{t("only_left", num(p.stock))}</div> : null}
            </Reveal>
            <Reveal className="flex flex-wrap items-center gap-4" delay={0.4}>
              {soldOut ? <span className="btn btn-secondary" aria-disabled>{t("out_of_stock")}</span> : (
                <div dir="ltr">
                  <AddToCartButton
                    className="scale-125 origin-left rtl:origin-right"
                    label={t("add_short")} limitLabel={t("limit_per_order", "{x}")} max={Math.min(20, p.stock)} name={L(p, "name")}
                    onQuantityChange={(n) => { setQty("product", p.id, n); if (n > qty) toast(t("added")); }}
                    quantity={qty}
                  />
                </div>
              )}
              <AnimatePresence>
                {qty > 0 ? (
                  <motion.div animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} initial={{ opacity: 0, x: 12 }} transition={{ duration: 0.4, ease: EASE }}>
                    <SlideTextButton className="h-11 rounded-full bg-action px-6 text-on-action hover:bg-action-hover" href="/checkout" hoverText={t("checkout")} onClick={(e) => { e.preventDefault(); openDrawer(); }} text={t("view_bag")} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </Reveal>
            {tabs.length ? (
              <Reveal className="mt-4 grid gap-4" delay={0.5}>
                <ContinuousTabs activeId={tab} layoutId="product-tabs" onChange={setTab} tabs={tabs.map(([id, key]) => ({ id, label: t(key) }))} />
                <AnimatePresence mode="wait">
                  <motion.p animate={{ opacity: 1, y: 0 }} className="muted" exit={{ opacity: 0, y: -8 }} initial={{ opacity: 0, y: 8 }} key={tab} style={{ margin: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                    {L(p, tab)}
                  </motion.p>
                </AnimatePresence>
              </Reveal>
            ) : null}
          </div>
        </div>
      </div>
      {/* phones: an order bar that stays at the bottom while she scrolls, price on one side, a wide button on the other */}
      <div aria-hidden className="h-[calc(76px+env(safe-area-inset-bottom))] md:hidden" />
      <motion.div
        animate={{ y: 0, opacity: 1 }} className="order-bar fixed inset-x-0 bottom-0 z-[54] border-t border-line bg-surface-raised/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden"
        initial={{ y: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.6 }}
      >
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <AnimatePresence mode="popLayout">
              <motion.div animate={{ y: 0, opacity: 1 }} className="text-lg font-bold leading-6" exit={{ y: -10, opacity: 0 }} initial={{ y: 10, opacity: 0 }} key={qty}>
                {money(Number(p.price) * Math.max(1, qty))}
              </motion.div>
            </AnimatePresence>
            <div className="text-xs text-ink-muted">{t("pay_cod")}</div>
          </div>
          {soldOut ? (
            <button className="btn h-12 flex-1 cursor-not-allowed rounded-full bg-line text-ink-muted" disabled type="button">{t("out_of_stock")}</button>
          ) : (
            <motion.button
              className="btn btn-primary relative h-12 flex-1 overflow-hidden rounded-full"
              onClick={() => { if (qty > 0) { haptic(); openDrawer(); } else { haptic(12); setQty("product", p.id, 1); toast(t("added")); } }}
              type="button" whileTap={{ scale: 0.96 }}
            >
              {/* a slow shine across the button so the eye finds it */}
              <motion.span
                animate={{ x: ["-120%", "220%"] }} aria-hidden className="pointer-events-none absolute inset-y-0 start-0 w-1/3 -skew-x-12 bg-white/25"
                transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.6 }}
              />
              <span className="relative">{qty > 0 ? `${t("view_bag")} · ${num(qty)}` : t("add_to_bag")}</span>
            </motion.button>
          )}
        </div>
      </motion.div>
      <section className="tint"><div className="wrap">
        <Reveal className="section-head"><h2 className="display-md">{t("reviews_title")}</h2></Reveal>
        {reviews.length ? <Stagger className="reviews">{reviews.map((r) => <StaggerItem key={r.id}><ReviewCard r={r} /></StaggerItem>)}</Stagger> : <Reveal><p className="empty">{t("no_reviews")}</p></Reveal>}
        <Reveal>
          <form className="form-grid" onSubmit={onReview} style={{ maxWidth: 640, marginTop: 48 }}>
            <h3 className="title">{t("write_review")}</h3>
            <div className="form-grid two">
              <div className="field"><label htmlFor="rv-name">{t("your_name")}</label><input className="input" defaultValue={profile?.full_name?.split(" ")[0] || ""} id="rv-name" maxLength={60} name="rv-name" required /></div>
              <div className="field"><label htmlFor="rv-rating">{t("rating")}</label><select className="input" id="rv-rating" name="rv-rating">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select></div>
            </div>
            <div className="field"><label htmlFor="rv-title">{t("review_title")}</label><input className="input" id="rv-title" maxLength={120} name="rv-title" /></div>
            <div className="field"><label htmlFor="rv-body">{t("review_body")}</label><textarea className="input" id="rv-body" maxLength={2000} minLength={3} name="rv-body" required /></div>
            <div><button className="btn btn-primary" type="submit">{t("send_review")}</button></div>
            <p aria-live="polite" className="body-sm">{msg}</p>
          </form>
        </Reveal>
      </div></section>
    </>
  );
}
