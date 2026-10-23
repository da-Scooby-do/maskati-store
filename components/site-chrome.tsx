"use client";

import { ArrowRight, Image as Insta, Mail, Menu, MessageCircle, PlayCircle, Send, ShoppingBag, User, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AvatarFace, avatarSeed } from "@/components/kokonutui/avatar-picker";
import CartButton from "@/components/kokonutui/cart-button";
import ProfileDropdown from "@/components/kokonutui/profile-dropdown";
import { EASE } from "@/components/motion";
import { useShop } from "@/components/shop-provider";
import { db } from "@/lib/supabase";

export const SOCIAL_ICONS = { instagram: Insta, tiktok: PlayCircle, whatsapp: MessageCircle, telegram: Send, email: Mail } as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useShop();
  const pathname = usePathname();
  const links = [["/shop", "nav_shop"], ["/#routines", "nav_routines"], ["/#consult", "nav_consult"], ["/#story", "nav_story"], ["/#faq", "nav_faq"]] as const;
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

  return (
    <>
      <AnimatePresence>
        {a?.visible && a?.[lang] ? (
          <motion.div animate={{ height: "auto", opacity: 1 }} className="announce overflow-hidden" initial={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            {a[lang]}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <header className={`header transition-[background-color,backdrop-filter,box-shadow] duration-500 ${scrolled ? "scrolled bg-surface-raised/80 backdrop-blur-xl" : ""}`}>
        <div className="wrap header-in">
          <Link aria-label="Maskati" className="logo" href="/">
            <motion.img alt="Maskati" animate={{ height: scrolled ? 28 : 34 }} height={34} src="/assets/maskati-lockup.png" transition={{ duration: 0.4, ease: EASE }} width={127} />
          </Link>
          <nav aria-label="main" className="nav"><NavLinks /></nav>
          <div className="header-actions">
            <button className="lang-btn" onClick={() => setLang(lang === "ar" ? "en" : "ar")} type="button">{t("lang_switch")}</button>
            {session ? (
              <div className="hidden md:block" dir="ltr">
                <ProfileDropdown
                  accounts={[{
                    id: session.user.id, name, email: session.user.email || "",
                    plan: isOwner ? t("owner_badge") : undefined,
                    // her chosen face, or a face made from her name until she picks one
                    avatar: <AvatarFace className="size-full" seed={profile?.avatar_seed || avatarSeed(name, 0)} />,
                  }]}
                  items={[
                    { label: t("my_orders"), icon: <ShoppingBag className="size-4" />, onSelect: () => router.push("/account") },
                    { label: t("my_avatar"), icon: <User className="size-4" />, onSelect: () => router.push("/account?tab=avatar") },
                    ...(isOwner ? [{ label: t("dashboard"), icon: <ArrowRight className="size-4" />, href: "/admin" }] : []),
                  ]}
                  labels={{ signOut: t("sign_out"), hold: t("hold"), keepHolding: t("keep_holding") }}
                  onSignOut={() => { db.auth.signOut(); router.push("/"); }}
                  compact
                  showStatus={false}
                  showTheme={false}
                />
              </div>
            ) : null}
            <Link aria-label={t("account")} className={`icon-btn ${session ? "md:hidden" : ""}`} href="/account">
              {session ? <AvatarFace className="size-8 rounded-full" seed={profile?.avatar_seed || avatarSeed(name, 0)} /> : <User className="size-[22px]" strokeWidth={1.5} />}
            </Link>
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
            <button aria-expanded={menuOpen} aria-label={t("menu")} className="icon-btn menu-btn" onClick={() => setMenuOpen((o) => !o)} type="button">
              {menuOpen ? <X className="size-[22px]" strokeWidth={1.5} /> : <Menu className="size-[22px]" strokeWidth={1.5} />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen ? (
            <motion.nav animate={{ height: "auto", opacity: 1 }} aria-label="mobile" className="wrap mobile-nav open overflow-hidden" exit={{ height: 0, opacity: 0 }} initial={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
              <NavLinks onNavigate={() => setMenuOpen(false)} />
              <Link href="/account" onClick={() => setMenuOpen(false)}>{t("account")}</Link>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>
    </>
  );
}

export function SiteFooter() {
  const { t, data, L, num, waLink } = useShop();
  const social = data.settings.social || {};
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <span className="footer-logo"><img alt="Maskati" height={30} src="/assets/maskati-lockup.png" width={112} /></span>
            <p className="caption" style={{ marginTop: 16 }}>{t("footer_tag")}</p>
          </div>
          <div><h4>{t("footer_shop")}</h4><ul>
            {data.products.slice(0, 4).map((p) => <li key={p.id}><Link href={`/product/${p.slug}`}>{L(p, "name")}</Link></li>)}
            <li><Link href="/#routines">{t("nav_routines")}</Link></li></ul></div>
          <div><h4>{t("footer_help")}</h4><ul>
            <li><Link href="/#faq">{t("nav_faq")}</Link></li>
            <li><Link href="/account">{t("my_orders")}</Link></li>
            {waLink() ? <li><a href={waLink()!} rel="noopener" target="_blank">{t("footer_contact")}</a></li> : null}
          </ul></div>
          <div><h4>{t("footer_follow")}</h4><ul>
            {(["instagram", "tiktok", "telegram", "email"] as const).filter((k) => social[k]).map((k) => (
              <li key={k}><a href={k === "email" && !social[k].startsWith("mailto:") ? `mailto:${social[k]}` : social[k]} rel="noopener" target="_blank">{t(k)}</a></li>
            ))}
          </ul></div>
        </div>
        <div className="legal"><span>Â© {num(new Date().getFullYear())} Maskati Â· Ù…Ø§Ø³ÙƒØ§ØªÙŠ. {t("rights")}.</span><span>{t("country")}</span></div>
      </div>
    </footer>
  );
}

/** The bag: Kokonut's cart button, fed by the real cart. */
export function CartDrawer() {
  const { t, L, money, num, lang, cartLines, subtotal, data, setQty, stockOf, drawerOpen, closeDrawer } = useShop();
  const router = useRouter();
  // the drawer sits at the end edge: the left in Arabic, the right in English
  const off = lang === "ar" ? "-100%" : "100%";
  const freeOver = Number(data.settings.free_shipping_over || 0);
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
            animate={{ x: 0 }} aria-label={t("bag_title")}
            className="fixed inset-y-0 end-0 z-[61] flex w-[min(440px,100%)] flex-col gap-4 bg-surface p-5 shadow-[var(--shadow-menu)]"
            exit={{ x: off }} initial={{ x: off }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
          >
            <div className="flex items-center justify-between">
              <h2 className="title">{t("bag_title")}</h2>
              <button aria-label={t("close")} className="icon-btn" onClick={closeDrawer} type="button"><X className="size-5" strokeWidth={1.5} /></button>
            </div>
            {cartLines.length && freeOver > 0 ? (
              <div className="ship-note">{subtotal >= freeOver ? t("free_ship_ok") : t("free_ship_left", money(freeOver - subtotal))}</div>
            ) : null}
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
            <p className="body-sm muted" style={{ margin: 0 }}>{t("shipping")}: {t("set_at_checkout")} Â· {num(cartLines.length)} {t("lines")}</p>
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
