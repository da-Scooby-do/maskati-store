"use client";

import { ArrowLeft, ArrowRight, Leaf, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { BundleCard, ProductCard, ReviewCard, TopReviewCard } from "@/components/cards";
import PageFlip from "@/components/kokonutui/page-flip";
import SlideTextButton from "@/components/kokonutui/slide-text-button";
import { Marked } from "@/components/marked";
import { Rail } from "@/components/rail";
import { EASE, Parallax, Reveal, Stagger, StaggerItem, WordsReveal } from "@/components/motion";
import { useShop } from "@/components/shop-provider";
import { SOCIAL_ICONS, SOCIAL_ORDER, socialHref } from "@/components/site-chrome";

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
  const { t, lang, data, L } = useShop();
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
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }} transition={{ delay: 1.3, duration: 0.8 }}>
            <Marked className="body-sm muted" text={t("hero_info")} />
          </motion.div>
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

/** Flair-style section title: a leaf between two hairlines, a big centred title, a small spaced line under it. */
function SectionHead({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <Reveal className="sec-head">
      <div aria-hidden className="sec-orn"><span /><Leaf className="size-4" strokeWidth={1.5} /><span /></div>
      <h2 className="sec-title">{title}</h2>
      {eyebrow ? <p className="sec-eyebrow">{eyebrow}</p> : null}
      {sub ? <Marked className="sec-sub" text={sub} /> : null}
    </Reveal>
  );
}

/** The centred pill under a product row ("Shop more"). */
function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Reveal className="mt-10 flex justify-center">
      <SlideTextButton className="h-12 rounded-full bg-action px-10 text-on-action hover:bg-action-hover" href={href} hoverText={label} text={label} />
    </Reveal>
  );
}

export function Bestsellers() {
  const { t, data } = useShop();
  const list = data.products.filter((p) => p.is_bestseller).slice(0, 8);
  if (!list.length) return null;
  return (
    <section><div className="wrap">
      <SectionHead eyebrow={t("bestsellers_eyebrow")} title={t("bestsellers_title")} />
      <Rail label={t("bestsellers_title")}><Stagger className="product-grid">{list.map((p) => <StaggerItem key={p.id}><ProductCard p={p} /></StaggerItem>)}</Stagger></Rail>
      <MoreLink href="/shop" label={t("shop_more")} />
    </div></section>
  );
}

/** "Shop by hair": an olive band of big rounded cards, one per hair need (Flair's shop-by-collection). */
export function Needs() {
  const { t, lang, data } = useShop();
  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;
  // a different product on each card: the preferred one for that need, else the first matching product not shown yet
  const PREFER: Record<string, string> = { dry: "dew-touch", damaged: "deep-care-oil", coloured: "lanolin-cream" };
  const used = new Set<string>();
  const cards = ["dry", "damaged", "coloured"].map((n) => {
    const fits = data.products.filter((p) => (p.hair_needs || []).includes(n) && p.image_url);
    const p = fits.find((x) => x.slug === PREFER[n] && !used.has(x.id)) || fits.find((x) => !used.has(x.id)) || fits[0];
    if (p) used.add(p.id);
    return { n, p };
  });
  return (
    <section className="needs" id="needs"><div className="wrap">
      <Reveal className="sec-head on-band">
        <div aria-hidden className="sec-orn"><span /><Leaf className="size-4" strokeWidth={1.5} /><span /></div>
        <h2 className="sec-title">{t("by_need_title")}</h2>
        <p className="sec-eyebrow">{t("by_need_sub")}</p>
      </Reveal>
      <Rail label={t("by_need_title")}><Stagger className="needs-grid">
        {cards.map(({ n, p }) => (
          <StaggerItem key={n}>
            <Link className="need-card group" href={`/shop?need=${n}`}>
              <div className="need-img"><img alt="" className="transition-transform duration-700 group-hover:scale-[1.06]" loading="lazy" src={p?.image_url || "/assets/maskati-mark.png"} /></div>
              <div className="need-label">
                <span><strong>{t("need_" + n)}</strong><small>{t("need_" + n + "_hint")}</small></span>
                <span className="need-arrow"><Arrow className="size-4" /></span>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger></Rail>
    </div></section>
  );
}

/** "The secret of our ingredients": the brand text beside four ingredient tiles. */
export function Ingredients() {
  const { t, lang, num } = useShop();
  return (
    <section className="ingredients" id="ingredients"><div className="wrap ingr-grid">
      <Reveal className="ingr-art" y={50}>
        <img alt={`${t("ing_shea")} · ${t("ing_oils")}`} loading="lazy" src="/assets/products/ingredients-scene.webp" />
        <LineLeaves className="pointer-events-none absolute -bottom-6 end-[-12px] w-40 text-olive opacity-60" delay={0.4} />
      </Reveal>
      <div>
        <Reveal>
          <span className="eyebrow">{t("ingr_eyebrow")}</span>
          <h2 className="display-md">{t("ingr_title")}</h2>
          <p className="lede" style={{ marginTop: 16 }}>{t("ingr_text")}</p>
        </Reveal>
        <Stagger className="ingr-list">
          {["okra", "oils", "shea", "herbs"].map((k, i) => (
            <StaggerItem key={k}>
              <div className="ingr-item">
                <span className="ingr-num">{lang === "ar" ? num(i + 1) : `0${i + 1}`}</span>
                <div><strong>{t("ing_" + k)}</strong><p>{t("ing_" + k + "_note")}</p></div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal><Marked className="ingr-close" text={`[[${t("ingr_close")}]]`} /></Reveal>
      </div>
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
      <SectionHead eyebrow={t("consult_eyebrow")} sub={t("consult_text")} title={t("consult_title")} />
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
              : <Rail><div className="product-grid">{prods.map((p) => <ProductCard key={p.id} p={p} />)}</div></Rail>}
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
      <Rail label={t("routines_title")}><Stagger className="bundles">{data.bundles.map((b) => <StaggerItem key={b.id}><BundleCard b={b} /></StaggerItem>)}</Stagger></Rail>
    </div></section>
  );
}

type Two = { ar?: string; en?: string };
export interface StoryBook {
  eyebrow?: Two; title?: Two; cover?: { title?: Two; sub?: Two; image?: string }; back?: { title?: Two; sub?: Two };
  pages?: { type: "text" | "quote" | "numbered"; heading?: Two; title?: Two; body?: Two }[];
  points?: { title?: Two; text?: Two }[];
}

/** Our story as a book you turn by the corner (Kokonut page-flip). Every word, and every page, comes from the dashboard. */
export function Story() {
  const { t, lang, num, data } = useShop();
  const book = (data.settings.story_book || {}) as StoryBook;
  // a book written only in Arabic reads in Arabic (right to left, Arabic type) on the English site too
  const bl: "ar" | "en" = lang === "en" && (book.pages || []).some((p) => p.body?.en?.trim()) ? "en" : "ar";
  const tx = (v?: Two) => (v?.[bl] || v?.ar || v?.en || "").trim();
  const dir = bl === "ar" ? "rtl" : "ltr";
  const font = bl === "ar" ? "font-arabic" : "font-text";
  const display = bl === "ar" ? "font-arabic font-bold" : "font-display";
  const page = (children: ReactNode, n: number, key: string) => (
    <div className={`flex size-full flex-col px-[9cqw] pt-[11cqw] pb-[7cqw] ${font}`} dir={dir} key={key}>
      {children}
      <p className="mt-auto text-center text-[3cqw] text-ink-muted tabular-nums">{num(n)}</p>
    </div>
  );
  const heading = (txt: string) => txt ? (
    <>
      <p className="text-[3.4cqw] uppercase tracking-[0.2em] text-olive-ink">{txt}</p>
      <div className="mt-[3cqw] h-px w-[10cqw] bg-olive/40" />
    </>
  ) : null;
  let numbered = 0;
  const inner = (book.pages || []).map((pg, i) => {
    const title = tx(pg.title), body = tx(pg.body);
    if (pg.type === "quote") return page(
      <div className="my-auto">{heading(tx(pg.heading))}<p className="mt-[2cqw] text-[12cqw] leading-none text-olive">“</p>
        <Marked className={`whitespace-pre-line text-[5.6cqw] leading-snug ${bl === "ar" ? "font-arabic" : "font-display"}`} text={body} /></div>, i + 1, `p${i}`);
    if (pg.type === "numbered") {
      numbered += 1;
      return page(<>
        {heading(tx(pg.heading))}
        <p className="mt-[8cqw] font-display text-[16cqw] leading-none text-olive">{bl === "ar" ? num(numbered).padStart(2, "٠") : String(numbered).padStart(2, "0")}</p>
        {title ? <p className={`mt-[4cqw] text-[6cqw] ${display === "font-display" ? "font-display" : "font-bold"}`}>{title}</p> : null}
        <Marked className="mt-[3cqw] whitespace-pre-line text-[3.8cqw] leading-relaxed text-ink-muted" text={body} />
        <LineLeaves className="mt-auto w-[22cqw] self-end text-olive opacity-60" delay={0} />
      </>, i + 1, `p${i}`);
    }
    return page(<>
      {heading(tx(pg.heading))}
      {title ? <p className={`mt-[5cqw] text-[6cqw] leading-tight ${display}`}>{title}</p> : null}
      <Marked className="mt-[5cqw] whitespace-pre-line text-[3.7cqw] leading-relaxed" text={body} />
    </>, i + 1, `p${i}`);
  });
  const pages: ReactNode[] = [
    book.cover?.image ? (
      // a cover photo carries its own title, so it fills the cover alone
      <div className="relative size-full bg-band" key="cover">
        <img alt={tx(book.cover?.title) || t("story_eyebrow")} className="size-full object-cover" src={book.cover.image} />
        <p className="absolute inset-x-0 bottom-[4cqw] mx-auto w-fit rounded-full bg-black/45 px-[3cqw] py-[1cqw] text-[3cqw] text-white">{t("book_turn")}</p>
      </div>
    ) :
    <div className={`flex size-full flex-col items-center justify-center bg-band px-[10cqw] text-center text-on-band ${font}`} dir={dir} key="cover">
      <img alt="" className="w-[24cqw]" src="/assets/maskati-mark-light.png" />
      <p className={`mt-[8cqw] text-[9cqw] leading-none ${display}`}>{tx(book.cover?.title) || t("story_eyebrow")}</p>
      {tx(book.cover?.sub) ? <p className="mt-[3cqw] text-[3.6cqw] opacity-80">{tx(book.cover?.sub)}</p> : null}
      <p className="absolute bottom-[8cqw] text-[3cqw] opacity-60">{t("book_turn")}</p>
    </div>,
    ...inner,
    <div className={`flex size-full flex-col items-center justify-center bg-band px-[10cqw] text-center text-on-band ${font}`} dir={dir} key="back">
      <p className={`text-[6cqw] ${display}`}>{tx(book.back?.title)}</p>
      {tx(book.back?.sub) ? <p className="mt-[4cqw] text-[3.4cqw] italic opacity-75">{tx(book.back?.sub)}</p> : null}
    </div>,
  ];
  const points = (book.points || []).filter((p) => tx(p.title) || tx(p.text));
  return (
    <section className="tint overflow-hidden" id="story"><div className="wrap">
      <div dir={dir}><SectionHead eyebrow={tx(book.eyebrow) || t("story_eyebrow")} title={tx(book.title) || t("story_title")} /></div>
      <Reveal className="flex justify-center" y={60}>
        <div className="w-full max-w-3xl" dir="ltr">
          <PageFlip className="mx-auto max-w-3xl" key={`${lang}-${pages.length}`} labels={{ previous: t("prev_page"), next: t("next_page"), of: t("of") }} pages={pages} />
        </div>
      </Reveal>
      {points.length ? (
        <Reveal className={`mt-10 grid gap-6 ${bl === "ar" ? "font-arabic" : ""} ${points.length >= 3 ? "sm:grid-cols-3" : points.length === 2 ? "sm:grid-cols-2" : ""}`}>
          {points.map((p, i) => <div className="pillar" dir={dir} key={i}><h3>{tx(p.title)}</h3><p>{tx(p.text)}</p></div>)}
        </Reveal>
      ) : null}
    </div></section>
  );
}

/** "Customer love": a soft rounded panel, the best review on top, the rest as a wall of small cards. */
export function Reviews() {
  const { t, data } = useShop();
  const list = data.reviews.slice(0, 7);
  const top = [...list].sort((a, b) => b.rating - a.rating || (b.body?.length || 0) - (a.body?.length || 0))[0];
  const rest = list.filter((r) => r !== top);
  return (
    <section id="reviews"><div className="wrap">
      <div className="love">
        <Reveal className="love-head">
          <span className="love-chip">💚 {t("love_chip")}</span>
          <h2 className="sec-title">{t("love_title")}</h2>
          <p className="love-sub">{t("love_sub")}</p>
          <div aria-hidden className="love-stars">★★★★★</div>
        </Reveal>
        {top ? (
          <>
            <Reveal className="mx-auto max-w-2xl"><TopReviewCard r={top} /></Reveal>
            {rest.length ? <Stagger className="reviews mt-6">{rest.map((r) => <StaggerItem key={r.id}><ReviewCard r={r} /></StaggerItem>)}</Stagger> : null}
            <MoreLink href="/shop" label={t("shop_the_love")} />
          </>
        ) : <Reveal><p className="empty">{t("no_reviews")}</p></Reveal>}
      </div>
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
      <SectionHead eyebrow={t("faq_eyebrow")} title={t("faq_title")} />
      <FaqList />
    </div></section>
  );
}

/** Social accounts as big pills (the newsletter sign-up lives in the footer now, as on Flair). */
export function Community() {
  const { t, data, waLink } = useShop();
  const s = data.settings.social || {};
  const links = SOCIAL_ORDER.filter((k) => s[k]);
  if (!links.length) return null;
  return (
    <section className="community"><div className="wrap">
      <SectionHead eyebrow={t("community_eyebrow")} sub={t("community_text_marked")} title={t("community_title")} />
      <Stagger className="socials">
        {links.map((k) => {
          const Icon = SOCIAL_ICONS[k];
          return <StaggerItem key={k}><a className="social" href={socialHref(k, s[k], waLink)} rel="noopener" target="_blank"><Icon className="size-[18px]" strokeWidth={1.5} /><span>{t(k)}</span></a></StaggerItem>;
        })}
      </Stagger>
    </div></section>
  );
}

export const HOME_SECTIONS: Record<string, () => ReactNode> = {
  hero: () => <Hero />, bestsellers: () => <Bestsellers />, needs: () => <Needs />, consult: () => <Consult />, bundles: () => <Bundles />,
  ingredients: () => <Ingredients />, story: () => <Story />, reviews: () => <Reviews />, faq: () => <FaqSection />, community: () => <Community />,
};

export { Parallax };
