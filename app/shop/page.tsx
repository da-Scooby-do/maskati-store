"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProductCard } from "@/components/cards";
import { ContinuousTabs } from "@/components/continuous-tabs";
import { Bundles } from "@/components/home";
import { Loading } from "@/components/loading";
import { EASE, Reveal, WordsReveal } from "@/components/motion";
import { usePageTitle, useShop } from "@/components/shop-provider";

function Shop() {
  const { t, data, loaded } = useShop();
  usePageTitle(t("shop_title"));
  const router = useRouter();
  const need = useSearchParams().get("need") || "all";
  if (!loaded) return <Loading />;
  const list = data.products.filter((p) => need === "all" || (p.hair_needs || []).includes(need));
  return (
    <>
      <section><div className="wrap">
        <div className="section-head">
          <div>
            <Reveal><span className="eyebrow">Maskati</span></Reveal>
            <WordsReveal className="display-lg" text={t("shop_title")} />
            <Reveal delay={0.3}><p className="lede" style={{ marginTop: 12 }}>{t("shop_text")}</p></Reveal>
          </div>
        </div>
        <Reveal className="mb-10">
          <ContinuousTabs
            activeId={need}
            layoutId="shop-filter"
            onChange={(id) => router.replace(id === "all" ? "/shop" : `/shop?need=${id}`, { scroll: false })}
            tabs={["all", "dry", "damaged", "coloured"].map((n) => ({ id: n, label: n === "all" ? t("all") : t("need_" + n) }))}
          />
        </Reveal>
        <motion.div className="product-grid" layout>
          <AnimatePresence mode="popLayout">
            {list.map((p, i) => (
              <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }} initial={{ opacity: 0, scale: 0.94, y: 24 }}
                key={p.id} layout transition={{ duration: 0.5, ease: EASE, delay: i * 0.05 }}
              >
                <ProductCard p={p} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div></section>
      <Bundles />
    </>
  );
}

export default function ShopPage() {
  return <Suspense fallback={<Loading />}><Shop /></Suspense>;
}
