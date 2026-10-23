"use client";

import { Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { BundleCard, ProductCard, ReviewCard } from "@/components/cards";
import PageFlip from "@/components/kokonutui/page-flip";
import SlideTextButton from "@/components/kokonutui/slide-text-button";
import { Marked } from "@/components/marked";
import { EASE, Parallax, Reveal, Stagger, StaggerItem, WordsReveal } from "@/components/motion";
import { useShop } from "@/components/shop-provider";
import { SOCIAL_ICONS } from "@/components/site-chrome";
import { db } from "@/lib/supabase";

/** Fine line-drawn leaves that draw themselves, like the identity book's illustrations. */
export function LineLeaves({ className, delay = 0.4 }: { className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const paths = [
    "M100 190C60 150 40 100 70 40c40 40 50 100 30 150Z", "M100 190C90 140 80 100 70 40",
    "M104 188c10-50 40-80 86-90-10 50-40 80-86 90Z", "M104 188c30-30 55-60 86-90",
  ];
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 200 200">
      {paths.map((d, i) => (
        <motion.path
          d={d} key={d}
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 2.2, ease: EASE, delay: delay + i * 0.25 }}
          viewport={{ once: true }}
          whileInView={{ pathLength: 1, opacity: 1 }}
        />
      ))}
    </svg>
  );
}

export function Hero() {
  const { t, lang, data, L, money } = useShop();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const artY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 140]);
  const artScale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1, 0.92]);
  const textY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -60]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const h = data.settings.hero || {};
  const title = (lang === "ar" ? h.ar_title : h.en_title) || t("footer_tag");
  const text = (lang === "ar" ? h.ar_text : h.en_text) || "";
  const hero = data.products.find((p) => p.is_bestseller) || data.products[0];
  const freeOver = Number(data.settings.free_shipping_over || 0);
  return (
    <section className="hero relative isolate" ref={ref}>
      {/* slow drifting light behind everything */}
      <motion.div
        animate={reduce ? undefined : { x: ["-10%", "10%", "-10%"], y: ["0%", "8%", "0%"] }}
        aria-hidden className="pointer-events-none absolute -top-1/3 start-1/4 -z-10 size-[70vmax] rounded-full bg-[radial-gradient(circle,rgba(169,189,120,0.35),transparent_60%)] blur-2xl"
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="wrap hero-grid">
        <motion.div style={{ y: textY, opacity: fade }}>
          <motion.span animate={{ opacity: 1, letterSpacing: lang === "ar" ? "0em" : "0.14em" }} className="eyebrow" initial={{ opacity: 0, letterSpacing: lang === "ar" ? "0em" : "0.4em" }} transition={{ duration: 1.2, ease: EASE }}>
            {t("hero_eyebrow")}
          </motion.span>
          <WordsReveal className="display-xl" text={title} />
          <motion.p animate={{ opacity: 1, y: 0 }} className="lede" initial={{ opacity: 0, y: 16 }} transition={{ duration: 0.9, ease: EASE, delay: 0.6 }}>{text}</motion.p>
          <motion.div animate={{ opacity: 1, y: 0 }} className="hero-actions" initial={{ opacity: 0, y: 16 }} transition={{ duration: 0.9, ease: EASE, delay: 0.85 }}>
            <SlideTextButton className="h-12 rounded-full bg-action px-8 text-on-action hover:bg-action-hover" href="/shop" hoverText={t("shop_now_hover")} text={t("shop_now")} />
            <SlideTextButton className="h-12 rounded-full border-line-strong px-8 text-ink hover:bg-tint" href="/#consult" hoverText={t("discover_routine_hover")} text={t("discover_routine")} variant="ghost" />
          </motion.div>
          {freeOver > 0 ? (
            <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }} transition={{ delay: 1.3, duration: 0.8 }}>
              <Marked className="body-sm muted" text={t("hero_info", money(freeOver))} />
            </motion.div>
          ) : null}
        </motion.div>
        <motion.div className="hero-art" style={{ y: artY, scale: artScale }}>
          <motion.div animate={{ clipPath: "inset(0% 0% 0% 0%)" }} className="leaf-frame" initial={reduce ? false : { clipPath: "inset(100% 0% 0% 0%)" }} transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}>
            {hero ? (
              <motion.img alt={L(hero, "name")} animate={{ scale: 1 }} initial={reduce ? false : { scale: 1.25 }} src={hero.image_url || ""} transition={{ duration: 2.2, ease: EASE, delay: 0.2 }} />
            ) : null}
          </motion.div>
          <motion.img
            alt="" animate={reduce ? { opacity: 1 } : { opacity: 1, y: [0, -10, 0], rotate: [0, -3, 0] }} className="mark" height={115}
            initial={{ opacity: 0 }} src="/assets/maskati-mark.png" transition={{ opacity: { delay: 1, duration: 0.8 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 6, repeat: Infinity, ease: "easeInOut" } }} width={120}
          />
          <div className="line-leaves"><LineLeaves delay={1.2} /></div>
        </motion.div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, action, center }: { eyebrow: string; title: string; action?: ReactNode; center?: boolean }) {
  return (
    <Reveal className={center ? "center" : "section-head"}>
      <div style={center ? { marginBottom: 32 } : undefined}>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="display-md">{title}</h2>
      </div>
      {action}
    </Reveal>
  );
}

export function Bestsellers() {
  const { t, data } = useShop();
  const list = data.products.filter((p) => p.is_bestseller).slice(0, 8);
  if (!list.length) return null;
  return (
    <section><div className="wrap">
      <SectionHead action={<SlideTextButton className="h-10 rounded-full px-6 text-olive-ink" href="/shop" hoverText={t("view_all_hover")} text={t("view_all")} variant="ghost" />} eyebrow={t("bestsellers_eyebrow")} title={t("bestsellers_title")} />
      <Stagger className="product-grid">{list.map((p) => <StaggerItem key={p.id}><ProductCard p={p} /></StaggerItem>)}</Stagger>
    </div></section>
  );
}

export function Consult() {
  const { t, data } = useShop();
  const [need, setNeed] = useState<string | null>(null);
  const bundle = need ? data.bundles.find((b) => b.hair_need === need) : null;
  const prods = need ? data.products.filter((p) => (p.hair_needs || []).includes(need)) : [];
  return (
    <section className="tint" id="consult"><div className="wrap consult">
      <Reveal>
        <span className="eyebrow">{t("consult_eyebrow")}</span>
        <h2 className="display-md">{t("consult_title")}</h2>
        <p className="lede" style={{ margin: "16px auto 0" }}>{t("consult_text")}</p>
      </Reveal>
      <Stagger className="consult-options">
        {["dry", "damaged", "coloured"].map((n) => (
          <StaggerItem key={n}>
            <motion.button aria-pressed={need === n} className="consult-opt w-full" onClick={() => setNeed(n)} type="button" whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
              <strong>{t("need_" + n)}</strong><span>{t("need_" + n + "_hint")}</span>
            </motion.button>
          </StaggerItem>
        ))}
      </Stagger>
      <AnimatePresence mode="wait">
        {need ? (
          <motion.div animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} aria-live="polite" className="consult-result" exit={{ opacity: 0, y: -12, filter: "blur(6px)" }} initial={{ opacity: 0, y: 24, filter: "blur(6px)" }} key={need} transition={{ duration: 0.6, ease: EASE }}>
            <h3 className="title" style={{ marginBottom: 24 }}>{t("consult_for_you")}</h3>
            {bundle ? <div style={{ maxWidth: 420, marginInline: "auto", textAlign: "start" }}><BundleCard b={bundle} /></div>
              : <div className="product-grid">{prods.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div></section>
  );
}

export function Bundles() {
  const { t, data } = useShop();
  if (!data.bundles.length) return null;
  return (
    <section id="routines"><div className="wrap">
      <SectionHead eyebrow={t("routines_eyebrow")} title={t("routines_title")} />
      <Stagger className="bundles">{data.bundles.map((b) => <StaggerItem key={b.id}><BundleCard b={b} /></StaggerItem>)}</Stagger>
    </div></section>
  );
}

/** Our story as a book you turn by the corner (Kokonut page-flip), with marker highlights inside. */
export function Story() {
  const { t, lang, data } = useShop();
  const s = data.settings.story || {};
  const dir = lang === "ar" ? "rtl" : "ltr";
  const font = lang === "ar" ? "font-arabic" : "font-text";
  const page = (children: ReactNode, n?: number) => (
    <div className={`flex size-full flex-col px-[9cqw] pt-[11cqw] pb-[7cqw] ${font}`} dir={dir}>
      {children}
      {n ? <p className="mt-auto text-center text-[3cqw] text-ink-muted tabular-nums">{n}</p> : null}
    </div>
  );
  const heading = (txt: string) => (
    <>
      <p className="text-[3.4cqw] uppercase tracking-[0.2em] text-olive-ink">{txt}</p>
      <div className="mt-[3cqw] h-px w-[10cqw] bg-olive/40" />
    </>
  );
  const pages: ReactNode[] = [
    <div className={`flex size-full flex-col items-center justify-center bg-band px-[10cqw] text-center text-on-band ${font}`} dir={dir} key="cover">
      <img alt="" className="w-[26cqw] rounded-full bg-white p-[3cqw]" src="/assets/maskati-mark.png" />
      <p className={`mt-[8cqw] text-[9cqw] leading-none ${lang === "ar" ? "font-arabic font-bold" : "font-display"}`}>{t("story_eyebrow")}</p>
      <p className="mt-[3cqw] text-[3.6cqw] opacity-80">{t("book_cover_sub")}</p>
      <p className="absolute bottom-[8cqw] text-[3cqw] opacity-60">{t("book_turn")}</p>
    </div>,
    page(<>{heading(t("story_title"))}<Marked className="mt-[6cqw] text-[4cqw] leading-relaxed" text={s[lang] || ""} /></>, 1),
    page(<div className="my-auto"><p className="text-[12cqw] leading-none text-olive">“</p><Marked className={`text-[5.6cqw] leading-snug ${lang === "ar" ? "font-arabic" : "font-display"}`} text={t("story_quote_marked")} /></div>, 2),
    ...[1, 2, 3].map((i) => page(<>
      {heading(t("book_pillar"))}
      <p className="mt-[8cqw] font-display text-[16cqw] leading-none text-olive">{lang === "ar" ? "٠١٢٣".charAt(i) : `0${i}`}</p>
      <p className={`mt-[4cqw] text-[6cqw] ${lang === "ar" ? "font-bold" : "font-display"}`}>{t("pillar" + i + "_t")}</p>
      <Marked className="mt-[3cqw] text-[3.8cqw] leading-relaxed text-ink-muted" text={t("pillar" + i + "_book")} />
      <LineLeaves className="mt-auto w-[22cqw] self-end text-olive opacity-60" delay={0} />
    </>, i + 2)),
    page(<>
      {heading(t("book_ingredients_t"))}
      <ul className="mt-[6cqw] flex flex-col gap-[4cqw]">
        {["okra", "lanolin", "oils", "herbs"].map((k) => (
          <li key={k}><p className="text-[4.6cqw] font-medium">{t("ing_" + k)}</p><p className="mt-[1cqw] text-[3.4cqw] text-ink-muted">{t("ing_" + k + "_note")}</p></li>
        ))}
      </ul>
    </>, 6),
    <div className={`flex size-full flex-col items-center justify-center bg-band px-[10cqw] text-center text-on-band ${font}`} dir={dir} key="back">
      <p className={`text-[6cqw] ${lang === "ar" ? "font-bold" : "font-display"}`}>{t("book_back")}</p>
      <p className="mt-[4cqw] text-[3.4cqw] italic opacity-75">{t("footer_tag")}</p>
    </div>,
  ];
  return (
    <section className="tint overflow-hidden" id="story"><div className="wrap">
      <SectionHead center eyebrow={t("story_eyebrow")} title={t("story_title")} />
      <Reveal className="flex justify-center" y={60}>
        <div className="w-full max-w-3xl" dir="ltr">
          <PageFlip className="mx-auto max-w-3xl" key={lang} labels={{ previous: t("prev_page"), next: t("next_page"), of: t("of") }} pages={pages} />
        </div>
      </Reveal>
      <Reveal className="mt-10 grid gap-6 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div className="pillar" key={i}><h3>{t("pillar" + i + "_t")}</h3><p>{t("pillar" + i + "_p")}</p></div>
        ))}
      </Reveal>
    </div></section>
  );
}

export function Reviews() {
  const { t, data } = useShop();
  const list = data.reviews.slice(0, 6);
  return (
    <section><div className="wrap">
      <SectionHead eyebrow={t("reviews_eyebrow")} title={t("reviews_title")} />
      {list.length ? <Stagger className="reviews">{list.map((r) => <StaggerItem key={r.id}><ReviewCard r={r} /></StaggerItem>)}</Stagger>
        : <Reveal><p className="empty">{t("no_reviews")}</p></Reveal>}
    </div></section>
  );
}

export function FaqList() {
  const { t, data, L, waLink } = useShop();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="faq">
      {data.faqs.map((f) => {
        const isOpen = open === f.id;
        return (
          <Reveal className="border-b border-line" key={f.id} y={16}>
            <button aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 py-5 text-start text-[18px]" onClick={() => setOpen(isOpen ? null : f.id)} type="button">
              <span>{L(f, "question")}</span>
              <motion.span animate={{ rotate: isOpen ? 45 : 0 }} className="grid size-7 flex-none place-items-center rounded-full bg-mint text-olive-ink" transition={{ duration: 0.3, ease: EASE }}><Plus className="size-3.5" /></motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div animate={{ height: "auto", opacity: 1 }} className="overflow-hidden" exit={{ height: 0, opacity: 0 }} initial={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
                  <Marked className="muted" text={L(f, "answer")} />
                  <div className="h-5" />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Reveal>
        );
      })}
      {waLink() ? (
        <p className="center" style={{ marginTop: 24 }}>
          <SlideTextButton className="h-11 rounded-full px-6 text-olive-ink" href={waLink()!} hoverText={t("whatsapp")} rel="noopener" target="_blank" text={t("faq_more")} variant="ghost" />
        </p>
      ) : null}
    </div>
  );
}

export function FaqSection() {
  const { t, data } = useShop();
  if (!data.faqs.length) return null;
  return (
    <section className="tint" id="faq"><div className="wrap">
      <SectionHead center eyebrow={t("faq_eyebrow")} title={t("faq_title")} />
      <FaqList />
    </div></section>
  );
}

export function Community() {
  const { t, data, waLink } = useShop();
  const [msg, setMsg] = useState("");
  const s = data.settings.social || {};
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const contact = (form.elements.namedItem("contact") as HTMLInputElement).value.trim();
    const { error } = await db.from("subscribers").insert({ contact });
    setMsg(!error || error.code === "23505" ? t("subscribed") : t("err_generic"));
    if (!error) form.reset();
  };
  return (
    <section className="community"><div className="wrap">
      <Reveal>
        <span className="eyebrow">{t("community_eyebrow")}</span>
        <h2 className="display-md">{t("community_title")}</h2>
        <Marked className="lede" text={t("community_text_marked")} />
      </Reveal>
      <Stagger className="socials">
        {(["instagram", "tiktok", "whatsapp", "telegram", "email"] as const).filter((k) => s[k]).map((k) => {
          const Icon = SOCIAL_ICONS[k];
          let href: string = s[k];
          if (k === "email" && !href.startsWith("mailto:")) href = `mailto:${href}`;
          if (k === "whatsapp" && !/^https?:/.test(href)) href = waLink() || "#";
          return <StaggerItem key={k}><a className="social" href={href} rel="noopener" target="_blank"><Icon className="size-[18px]" strokeWidth={1.5} /><span>{t(k)}</span></a></StaggerItem>;
        })}
      </Stagger>
      <Reveal>
        <form className="subscribe" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="sub-contact">{t("subscribe_ph")}</label>
          <input className="input" id="sub-contact" maxLength={120} minLength={5} name="contact" placeholder={t("subscribe_ph")} required />
          <button className="btn btn-primary" type="submit">{t("subscribe_btn")}</button>
        </form>
        <p aria-live="polite" className="body-sm muted">{msg}</p>
      </Reveal>
    </div></section>
  );
}

export const HOME_SECTIONS: Record<string, () => ReactNode> = {
  hero: () => <Hero />, bestsellers: () => <Bestsellers />, consult: () => <Consult />, bundles: () => <Bundles />,
  story: () => <Story />, reviews: () => <Reviews />, faq: () => <FaqSection />, community: () => <Community />,
};

export { Parallax };
