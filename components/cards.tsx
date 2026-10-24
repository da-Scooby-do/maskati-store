"use client";

import { Heart, Quote, Star } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { AddToCartButton } from "@/components/kokonutui/cart-button";
import { EASE } from "@/components/motion";
import { useShop } from "@/components/shop-provider";
import type { Bundle, Product, Review } from "@/lib/shop";

/** Percent off when a compare-at price is set, else 0. */
const percentOff = (price: number, compare: number | null) => (compare && compare > price ? Math.round((1 - price / compare) * 100) : 0);

/**
 * Product tile, Flair-style: a rounded photo with sale and badge chips in the corner,
 * Kokonut's Add + stepper floating over the bottom of the photo, then name and price below.
 */
export function ProductCard({ p }: { p: Product }) {
  const { t, L, money, num, qtyOf, setQty, toast } = useShop();
  const badge = L(p, "badge");
  const soldOut = p.stock <= 0;
  const qty = qtyOf("product", p.id);
  const off = percentOff(Number(p.price), p.compare_at_price ? Number(p.compare_at_price) : null);
  return (
    <motion.div className="card-wrap group" transition={{ duration: 0.4, ease: EASE }} whileHover={{ y: -6 }}>
      <div className="relative">
        <Link className="card-media" href={`/product/${p.slug}`} tabIndex={-1}>
          <img alt={L(p, "name")} className="transition-transform duration-700 ease-out group-hover:scale-[1.05]" loading="lazy" src={p.image_url || "/assets/maskati-mark.png"} />
        </Link>
        <div className="card-badges">
          {off > 0 ? <span className="chip-sale">-{num(off)}%</span> : null}
          {badge ? <span className="chip-tag">{badge}</span> : null}
        </div>
        <div className={`card-cta ${qty > 0 || soldOut ? "is-on" : ""}`} dir="ltr">
          {soldOut ? (
            <span className="chip-sold">{t("out_of_stock")}</span>
          ) : (
            <AddToCartButton
              label={t("add_short")}
              limitLabel={t("limit_per_order", "{x}")}
              max={Math.min(20, p.stock)}
              name={L(p, "name")}
              onQuantityChange={(n) => { setQty("product", p.id, n); if (n > qty) toast(t("added")); }}
              quantity={qty}
            />
          )}
        </div>
      </div>
      <Link className="card-meta" href={`/product/${p.slug}`}>
        <h3 className="card-name">{L(p, "name")}</h3>
        <div className="card-sub">{L(p, "kind")}{p.size ? ` · ${p.size}` : ""}</div>
        <div className={`card-price ${off > 0 ? "on-sale" : ""}`}>
          <span>{money(p.price)}</span>
          {off > 0 ? <s>{money(p.compare_at_price!)}</s> : null}
        </div>
      </Link>
    </motion.div>
  );
}

export function BundleCard({ b }: { b: Bundle }) {
  const { t, L, money, num, productById, addToCart, stockOf } = useShop();
  const items = (b.product_ids || []).map(productById).filter(Boolean) as Product[];
  const save = Number(b.compare_at_price) - Number(b.price);
  const off = percentOff(Number(b.price), b.compare_at_price ? Number(b.compare_at_price) : null);
  const soldOut = stockOf("bundle", b.id) <= 0;
  return (
    <motion.article className="bundle group" transition={{ duration: 0.4, ease: EASE }} whileHover={{ y: -6 }}>
      <div className="tile relative overflow-hidden">
        <img alt="" className="transition-transform duration-700 group-hover:scale-[1.04]" loading="lazy" src={b.image_url || "/assets/products/bundle.svg"} />
        {off > 0 ? <div className="card-badges"><span className="chip-sale">-{num(off)}%</span></div> : null}
      </div>
      <div className="bundle-body">
        <h3 className="title">{L(b, "name")}</h3>
        <p className="muted body-sm" style={{ margin: 0 }}>{L(b, "description")}</p>
        <ol className="list-decimal ps-5">{items.map((p) => <li key={p.id}><Link href={`/product/${p.slug}`}>{L(p, "name")}</Link></li>)}</ol>
        {save > 0 ? <div className="save">{t("you_save")} {money(save)}</div> : null}
        <div className="buy">
          <div className={`card-price ${off > 0 ? "on-sale" : ""}`}><span>{money(b.price)}</span>{off > 0 ? <s>{money(b.compare_at_price!)}</s> : null}</div>
          <motion.button className="btn btn-primary" disabled={soldOut} onClick={() => addToCart("bundle", b.id)} type="button" whileTap={{ scale: 0.96 }}>
            {soldOut ? t("out_of_stock") : t("add_routine")}
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <div aria-label={`${n}/5`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => <Star className={`size-4 ${i <= n ? "fill-[#e0b44c] text-[#e0b44c]" : "text-line-strong"}`} key={i} strokeWidth={1.5} />)}
    </div>
  );
}

/** A small review card with a heart, like Flair's "customer love" wall. */
export function ReviewCard({ r }: { r: Review }) {
  const { t, L, productById } = useShop();
  const p = r.product_id ? productById(r.product_id) : undefined;
  return (
    <article className="review">
      <div className="flex items-center justify-between gap-3">
        <Stars n={r.rating} />
        <Heart className="size-4 fill-mint text-olive" strokeWidth={1.5} />
      </div>
      {r.title ? <strong className="review-title">{r.title}</strong> : null}
      <p style={{ margin: 0 }}>{r.body}</p>
      <div className="body-sm"><strong>{r.customer_name}</strong>{r.is_verified ? <> · <span className="verified">{t("verified")}</span></> : null}</div>
      {p ? <div className="body-sm muted">{L(p, "name")}</div> : null}
    </article>
  );
}

/** The highlighted review at the top of the wall. */
export function TopReviewCard({ r }: { r: Review }) {
  const { t, L, productById } = useShop();
  const p = r.product_id ? productById(r.product_id) : undefined;
  return (
    <article className="review review-top">
      <span className="review-top-chip"><Star className="size-3.5 fill-current" />{t("top_review")}</span>
      <Quote className="size-8 text-olive/30" strokeWidth={1.5} />
      <Stars n={r.rating} />
      {r.title ? <strong className="review-title text-lg">{r.title}</strong> : null}
      <p style={{ margin: 0 }}>{r.body}</p>
      <div className="body-sm"><strong>{r.customer_name}</strong>{p ? <span className="muted"> · {L(p, "name")}</span> : null}</div>
    </article>
  );
}
