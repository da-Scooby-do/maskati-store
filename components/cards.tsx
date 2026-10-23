"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { AddToCartButton } from "@/components/kokonutui/cart-button";
import { EASE } from "@/components/motion";
import { useShop } from "@/components/shop-provider";
import type { Bundle, Product, Review } from "@/lib/shop";

/** Product tile: square-cornered stone ground, name below, and Kokonut's Add + stepper bound to the bag. */
export function ProductCard({ p }: { p: Product }) {
  const { t, L, money, qtyOf, setQty, toast } = useShop();
  const badge = L(p, "badge");
  const soldOut = p.stock <= 0;
  const qty = qtyOf("product", p.id);
  return (
    <motion.div className="card-wrap group" transition={{ duration: 0.4, ease: EASE }} whileHover={{ y: -6 }}>
      <Link className="card" href={`/product/${p.slug}`}>
        {badge ? <span className="disc">{badge}</span> : null}
        <div className="tile">
          <motion.img alt={L(p, "name")} className="transition-transform duration-700 ease-out group-hover:scale-[1.04]" loading="lazy" src={p.image_url || "/assets/maskati-mark.png"} />
        </div>
        <div className="meta">
          <h3 className="title">{L(p, "name")}</h3>
          <div className="sub">{L(p, "kind")}{p.size ? ` · ${p.size}` : ""}</div>
          <div className="price-line">
            {money(p.price)}
            {p.compare_at_price && p.compare_at_price > p.price ? <span className="compare">{money(p.compare_at_price)}</span> : null}
          </div>
        </div>
      </Link>
      <div className="card-add flex justify-center" dir="ltr">
        {soldOut ? (
          <span className="body-sm muted">{t("out_of_stock")}</span>
        ) : (
          <AddToCartButton
            label={t("add_short")}
            limitLabel={t("limit_per_order")}
            max={Math.min(20, p.stock)}
            name={L(p, "name")}
            onQuantityChange={(n) => { setQty("product", p.id, n); if (n > qty) toast(t("added")); }}
            quantity={qty}
          />
        )}
      </div>
    </motion.div>
  );
}

export function BundleCard({ b }: { b: Bundle }) {
  const { t, L, money, productById, addToCart, stockOf } = useShop();
  const items = (b.product_ids || []).map(productById).filter(Boolean) as Product[];
  const save = Number(b.compare_at_price) - Number(b.price);
  const soldOut = stockOf("bundle", b.id) <= 0;
  return (
    <motion.article className="bundle group" transition={{ duration: 0.4, ease: EASE }} whileHover={{ y: -6 }}>
      <div className="tile overflow-hidden"><img alt="" className="transition-transform duration-700 group-hover:scale-[1.04]" loading="lazy" src={b.image_url || "/assets/products/bundle.svg"} /></div>
      <div className="bundle-body">
        <h3 className="title">{L(b, "name")}</h3>
        <p className="muted body-sm" style={{ margin: 0 }}>{L(b, "description")}</p>
        <ol className="list-decimal ps-5">{items.map((p) => <li key={p.id}><Link href={`/product/${p.slug}`}>{L(p, "name")}</Link></li>)}</ol>
        {save > 0 ? <div className="save">{t("you_save")} {money(save)}</div> : null}
        <div className="buy">
          <div>{money(b.price)}{save > 0 ? <span className="compare">{money(b.compare_at_price)}</span> : null}</div>
          <motion.button className="btn btn-primary" disabled={soldOut} onClick={() => addToCart("bundle", b.id)} type="button" whileTap={{ scale: 0.96 }}>
            {soldOut ? t("out_of_stock") : t("add_routine")}
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}

export function ReviewCard({ r }: { r: Review }) {
  const { t, L, productById } = useShop();
  const p = r.product_id ? productById(r.product_id) : undefined;
  return (
    <article className="review">
      <div aria-label={`${r.rating}/5`} className="stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
      {r.title ? <strong>{r.title}</strong> : null}
      <p style={{ margin: 0 }}>{r.body}</p>
      <div className="body-sm"><strong>{r.customer_name}</strong>{r.is_verified ? <> · <span className="verified">{t("verified")}</span></> : null}</div>
      {p ? <div className="body-sm muted">{L(p, "name")}</div> : null}
    </article>
  );
}
