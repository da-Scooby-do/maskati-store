"use client";

import { ArrowLeft, ArrowRight, Mail, Menu, MessageCircle, Send, ShoppingBag, User, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import CartButton from "@/components/kokonutui/cart-button";
import ProfileDropdown from "@/components/kokonutui/profile-dropdown";
import { haptic, MobileMenu, useIsPhone } from "@/components/mobile";
import { EASE } from "@/components/motion";
import { useShop } from "@/components/shop-provider";
import { db } from "@/lib/supabase";

// lucide has no brand marks, so the three platforms are drawn here in the same line style
type IconProps = { className?: string; strokeWidth?: number };
const line = (strokeWidth = 1.5) => ({ fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24", "aria-hidden": true });
const InstagramIcon = ({ className, strokeWidth }: IconProps) => (
  <svg className={className} {...line(strokeWidth)}><rect height="20" rx="5" width="20" x="2" y="2" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" fill="currentColor" r=".6" /></svg>
);
const FacebookIcon = ({ className, strokeWidth }: IconProps) => (
  <svg className={className} {...line(strokeWidth)}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
);
const TiktokIcon = ({ className, strokeWidth }: IconProps) => (
  <svg className={className} {...line(strokeWidth)}><path d="M9 12a4 4 0 1 0 4 4V2a5 5 0 0 0 5 5" /></svg>
);
export const SOCIAL_ICONS = { instagram: InstagramIcon, facebook: FacebookIcon, tiktok: TiktokIcon, whatsapp: MessageCircle, telegram: Send, email: Mail } as const;
export const SOCIAL_ORDER = ["instagram", "facebook", "tiktok", "whatsapp", "telegram", "email"] as const;

/** A social link's address: emails become mailto:, a WhatsApp entry without a link falls back to the shop's chat. */
export function socialHref(k: string, v: string, waLink: () => string | null) {
  if (k === "email" && !v.startsWith("mailto:")) return `mailto:${v}`;
  if (k === "whatsapp" && !/^https?:/.test(v)) return waLink() || "#";
  return v;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useShop();
  const pathname = usePathname();
  const links = [["/shop", "nav_shop"], ["/#routines", "nav_routines"], ["/#consult", "nav_consult"], ["/#ingredients", "nav_ingredients"], ["/#story", "nav_story"], ["/#faq", "nav_faq"]] as const;
  return (
    <>
      {links.map(([href, key]) => (
        <Link aria-current={pathname === href ? "page" : undefined} href={href} key={href} onClick={onNavigate}>
          {t(key)}
        </Link>
      ))}
    </>
  );
}

export function SiteHeader() {
  const shop = useShop();
  const { t, lang, setLang, session, profile, isOwner, cartCount, num, openDrawer, data } = shop;
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 12));
  const a = data.settings.announcement;
  const name = profile?.full_name || session?.user.email?.split("@")[0] || "";
  const banner = !!(a?.visible && a?.[lang]);
  const langBtn = <button className="lang-btn" onClick={() => setLang(lang === "ar" ? "en" : "ar")} type="button">{t("lang_switch")}</button>;

  return (
    <>
      <AnimatePresence>
        {banner ? (
          <motion.div animate={{ height: "auto", opacity: 1 }} className="announce overflow-hidden" initial={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            {/* a strip that scrolls on a loop; two identical halves so the seam never shows */}
            <div className="announce-in">
              <div className="marquee-track">
                <div aria-label={a[lang]} className="marquee" role="marquee">
                  {[0, 1].map((half) => (
                    <div aria-hidden className="marquee-half" key={half}>
                      {Array.from({ length: 4 }, (_, i) => <span key={i}>{a[lang]}</span>)}
                    </div>
                  ))}
                </div>
              </div>
              {/* the language switch rides in the banner, still while the text moves past */}
              {langBtn}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <header className={`header ${scrolled ? "scrolled" : ""}`}>
        <div className="wrap header-in">
          <motion.button aria-expanded={menuOpen} aria-label={t("menu")} className="icon-btn menu-btn" onClick={() => { haptic(); setMenuOpen(true); }} type="button" whileTap={{ scale: 0.85 }}>
            <Menu className="size-[22px]" strokeWidth={1.5} />
          </motion.button>
          <nav aria-label="main" className="nav"><NavLinks /></nav>
          <Link aria-label="Maskati" className="logo" href="/">
            <motion.img alt="Maskati" animate={{ height: scrolled ? 30 : 38 }} height={38} src="/assets/maskati-lockup-light.png" transition={{ duration: 0.4, ease: EASE }} width={141} />
          </Link>
          <div className="header-actions">
            {banner ? null : langBtn}
            {session ? (
              <div dir="ltr">
                <ProfileDropdown
                  accounts={[{
                    id: session.user.id, name, email: session.user.email || "",
                    plan: isOwner ? t("owner_badge") : undefined,
                    // a plain person icon: no avatars on the site
                    avatar: <span className="grid size-full place-items-center bg-white/10"><User className="size-[18px]" strokeWidth={1.5} /></span>,
                  }]}
                  items={[
                    { label: t("my_orders"), icon: <ShoppingBag className="size-4" />, onSelect: () => router.push("/account") },
                    ...(isOwner ? [{ label: t("dashboard"), icon: <ArrowRight className="size-4" />, href: "/admin" }] : []),
                  ]}
                  labels={{ signOut: t("sign_out"), hold: t("hold"), keepHolding: t("keep_holding") }}
                  onSignOut={() => { db.auth.signOut(); router.push("/"); }}
                  align={lang === "ar" ? "left" : "right"}
                  compact
                  showStatus={false}
                  showTheme={false}
                />
              </div>
            ) : (
              <Link aria-label={t("account")} className="icon-btn" href="/account"><User className="size-[22px]" strokeWidth={1.5} /></Link>
            )}
            <button aria-label={t("bag")} className="icon-btn" onClick={openDrawer} type="button">
              <ShoppingBag className="size-[22px]" strokeWidth={1.5} />
              <AnimatePresence>
                {cartCount > 0 ? (
                  <motion.span animate={{ scale: 1 }} className="count" exit={{ scale: 0 }} initial={{ scale: 0 }} key={cartCount} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
                    {num(cartCount)}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>
      <MobileMenu onClose={() => setMenuOpen(false)} open={menuOpen} />
    </>
  );
}

export function SiteFooter() {
  const { t, lang, data, L, num, waLink } = useShop();
  const social = data.settings.social || {};
  const [msg, setMsg] = useState("");
  const onSubscribe = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const contact = (form.elements.namedItem("contact") as HTMLInputElement).value.trim();
    const { error } = await db.from("subscribers").insert({ contact });
    setMsg(!error || error.code === "23505" ? t("subscribed") : t("err_generic"));
    if (!error) form.reset();
  };
  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;
  const links = SOCIAL_ORDER.filter((k) => social[k]);
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <Link aria-label="Maskati" className="footer-logo" href="/"><img alt="Maskati" height={52} src="/assets/maskati-lockup-light.png" width={193} /></Link>
            <p className="caption" style={{ marginTop: 16 }}>{t("footer_tag")}</p>
          </div>
          <div><h4>{t("footer_shop")}</h4><ul>
            <li><Link href="/shop">{t("nav_shop")}</Link></li>
            {data.products.slice(0, 4).map((p) => <li key={p.id}><Link href={`/product/${p.slug}`}>{L(p, "name")}</Link></li>)}
            <li><Link href="/#routines">{t("nav_routines")}</Link></li></ul></div>
          <div><h4>{t("footer_help")}</h4><ul>
            <li><Link href="/#story">{t("nav_story")}</Link></li>
            <li><Link href="/#faq">{t("nav_faq")}</Link></li>
            <li><Link href="/account">{t("my_orders")}</Link></li>
            {waLink() ? <li><a href={waLink()!} rel="noopener" target="_blank">{t("footer_contact")}</a></li> : null}
          </ul></div>
          <div>
            <h4>{t("newsletter_title")}</h4>
            <p className="footer-note">{t("newsletter_text")}</p>
            <form className="footer-sub" onSubmit={onSubscribe}>
              <label className="sr-only" htmlFor="foot-contact">{t("subscribe_ph")}</label>
              <input id="foot-contact" maxLength={120} minLength={5} name="contact" placeholder={t("subscribe_ph")} required />
              <button aria-label={t("subscribe_btn")} type="submit"><Arrow className="size-5" strokeWidth={1.5} /></button>
            </form>
            <p aria-live="polite" className="footer-note">{msg}</p>
          </div>
        </div>
        {links.length ? (
          <div className="footer-socials">
            {links.map((k) => {
              const Icon = SOCIAL_ICONS[k];
              return <a aria-label={t(k)} href={socialHref(k, social[k], waLink)} key={k} rel="noopener" target="_blank"><Icon className="size-5" strokeWidth={1.6} /></a>;
            })}
          </div>
        ) : null}
        <div className="legal"><span>© {num(new Date().getFullYear())} Maskati · ماسكاتي. {t("rights")}.</span><span>{t("country")}</span></div>
      </div>
      {/* the developer's signature, kept in English on every site */}
      <div className="credit" dir="ltr">
        Developed by <a href="https://my-portfolio-ecru-three-47.vercel.app/" rel="noopener" target="_blank">Scooby</a>
      </div>
    </footer>
  );
}

/** The bag: Kokonut's cart button, fed by the real cart. */
export function CartDrawer() {
  const { t, L, money, num, lang, cartLines, subtotal, data, setQty, stockOf, drawerOpen, closeDrawer } = useShop();
  const router = useRouter();
  const phone = useIsPhone();
  // phones: a sheet that slides up and can be swiped down; wider screens: a panel at the end edge
  const off = phone ? { y: "100%", x: 0 } : { x: lang === "ar" ? "-100%" : "100%", y: 0 };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDrawer]);
  const key = (type: string, id: string) => `${type}|${id}`;
  return (
    <AnimatePresence>
      {drawerOpen ? (
        <>
          <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-[2px]" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={closeDrawer} />
          <motion.aside
            animate={{ x: 0, y: 0 }} aria-label={t("bag_title")}
            className={phone
              ? "fixed inset-x-0 bottom-0 z-[61] flex max-h-[88dvh] flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[var(--shadow-menu)]"
              : "fixed inset-y-0 end-0 z-[61] flex w-[min(440px,100%)] flex-col gap-4 bg-surface p-5 shadow-[var(--shadow-menu)]"}
            drag={phone ? "y" : false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            exit={off} initial={off}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) closeDrawer(); }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
          >
            {phone ? <div aria-hidden className="mx-auto -mt-2 h-1.5 w-12 shrink-0 rounded-full bg-line-strong/60" /> : null}
            <div className="flex items-center justify-between">
              <h2 className="title">{t("bag_title")}</h2>
              <button aria-label={t("close")} className="icon-btn" onClick={closeDrawer} type="button"><X className="size-5" strokeWidth={1.5} /></button>
            </div>
            {cartLines.length ? (
              <div dir="ltr">
                <CartButton
                  className="max-w-none"
                  formatMoney={money}
                  items={cartLines.map((l) => ({
                    id: key(l.type, l.id), name: L(l.item, "name"), detail: "size" in l.item && l.item.size ? l.item.size : t("routine"),
                    price: l.price, image: l.item.image_url || "/assets/maskati-mark.png", max: Math.min(20, stockOf(l.type, l.id)),
                  }))}
                  labels={{ empty: t("bag_empty"), subtotal: t("subtotal_items", "{x}"), checkout: t("checkout"), add: t("add_short"), limit: t("limit_per_order", "{x}") }}
                  onCheckout={() => { closeDrawer(); router.push("/checkout"); }}
                  onQuantityChange={(id, q) => { const [type, rid] = id.split("|"); setQty(type as "product" | "bundle", rid, q); }}
                  quantities={Object.fromEntries(cartLines.map((l) => [key(l.type, l.id), l.qty]))}
                />
              </div>
            ) : (
              <p className="muted">{t("bag_empty")}</p>
            )}
            <p className="body-sm muted" style={{ margin: 0 }}>{t("shipping")}: {t("set_at_checkout")} · {num(cartLines.length)} {t("lines")}</p>
            <button className="btn btn-secondary btn-block mt-auto" onClick={closeDrawer} type="button">{t("continue_shopping")}</button>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function Toast() {
  const { toastMsg } = useShop();
  return (
    <AnimatePresence>
      {toastMsg ? (
        <motion.div animate={{ opacity: 1, y: 0, scale: 1 }} className="toast show" exit={{ opacity: 0, y: 12, scale: 0.96 }} initial={{ opacity: 0, y: 12, scale: 0.96 }} key={toastMsg.id} role="status">
          {toastMsg.text}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function LoadErrorBar() {
  const { t, loadError, retry } = useShop();
  if (!loadError) return null;
  return (
    <div className="load-error" role="alert">
      <span>{t("load_failed")}</span>
      <button className="btn btn-secondary" onClick={retry} type="button">{t("retry")}</button>
    </div>
  );
}

export function WhatsAppFloat() {
  const { waLink, t } = useShop();
  const link = waLink();
  if (!link) return null;
  return (
    <motion.a animate={{ scale: 1, opacity: 1 }} aria-label={t("whatsapp")} className="wa-float" href={link} initial={{ scale: 0, opacity: 0 }} rel="noopener" target="_blank" transition={{ delay: 1.2, type: "spring", stiffness: 300, damping: 20 }} whileHover={{ scale: 1.08 }}>
      <MessageCircle strokeWidth={1.5} />
    </motion.a>
  );
}
