"use client";

import { motion } from "motion/react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import SlideTextButton from "@/components/kokonutui/slide-text-button";
import { LineLeaves } from "@/components/home";
import { EASE, Reveal, WordsReveal } from "@/components/motion";
import { useShop } from "@/components/shop-provider";

export default function ThanksPage() {
  const { n } = useParams<{ n: string }>();
  const { t, lang, num, money, data, store, waLink } = useShop();
  const last = store.get<{ order_number?: number; total?: number; payment_method?: string }>("mk_last_order", {});
  const mine = String(last.order_number) === String(n);
  const prepaid = mine && last.payment_method === "instapay";
  const text = lang === "ar"
    ? `أهلًا ماسكاتي، عملت طلب رقم ${n} بإجمالي ${money(last.total)}${prepaid ? " وهحوّل على إنستاباي" : ""}.`
    : `Hello Maskati, I placed order ${n} for ${money(last.total)}${prepaid ? " and will pay by InstaPay" : ""}.`;
  const wa = waLink(text);
  const instapay = data.settings.contact?.instapay;

  // InstaPay: open WhatsApp with the order number and total typed in, once
  useEffect(() => {
    if (!prepaid || !wa) return;
    try { if (sessionStorage.getItem("mk_wa_" + n)) return; sessionStorage.setItem("mk_wa_" + n, "1"); } catch {}
    const id = setTimeout(() => window.open(wa, "_blank", "noopener"), 900);
    return () => clearTimeout(id);
  }, [prepaid, wa, n]);

  return (
    <div className="wrap thanks relative">
      <motion.div animate={{ scale: 1, rotate: 0, opacity: 1 }} initial={{ scale: 0.4, rotate: -30, opacity: 0 }} transition={{ type: "spring", stiffness: 180, damping: 14 }}>
        <img alt="" height={69} src="/assets/maskati-mark.png" width={72} />
      </motion.div>
      <LineLeaves className="pointer-events-none absolute -z-10 w-64 text-olive opacity-30" delay={0.3} />
      <WordsReveal className="display-lg" delay={0.2} text={t("thanks_title")} />
      <Reveal delay={0.5}><p className="lede">{t("thanks_text", "#" + num(n))}</p></Reveal>
      {mine ? (
        <Reveal delay={0.7}>
          {prepaid ? (
            <div className="ship-note">{t("instapay_next", money(last.total))}{instapay ? <><br /><strong dir="ltr">{instapay}</strong></> : null}</div>
          ) : <p className="title">{t("pay_on_delivery", money(last.total))}</p>}
        </Reveal>
      ) : null}
      <motion.div animate={{ opacity: 1, y: 0 }} className="hero-actions" initial={{ opacity: 0, y: 16 }} style={{ justifyContent: "center" }} transition={{ delay: 0.9, duration: 0.7, ease: EASE }}>
        {wa ? <SlideTextButton className="h-12 rounded-full bg-action px-8 text-on-action hover:bg-action-hover" href={wa} hoverText={t("whatsapp")} rel="noopener" target="_blank" text={prepaid ? t("send_on_whatsapp") : t("thanks_wa")} /> : null}
        <SlideTextButton className="h-12 rounded-full border-line-strong px-8 text-ink hover:bg-tint" href="/account" hoverText={t("follow_order")} text={t("my_orders")} variant="ghost" />
      </motion.div>
    </div>
  );
}
