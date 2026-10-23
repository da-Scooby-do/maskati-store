"use client";

import { Home, MessageCircle, ShoppingBag, Sparkles, Store, User, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ContinuousTabs } from "@/components/continuous-tabs";
import { AvatarFace, avatarSeed } from "@/components/kokonutui/avatar-picker";
import { EASE } from "@/components/motion";
import { useShop } from "@/components/shop-provider";

/** A short buzz on phones that support it (Android); silent elsewhere. */
export const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

/** True below the tablet breakpoint (767px), the same line the CSS uses. */
export function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

/** App-style tab bar along the bottom of the phone screen. */
export function MobileTabBar() {
  const { t, num, cartCount, openDrawer, drawerOpen, session, profile } = useShop();
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, [pathname]);
  const name = profile?.full_name || session?.user.email?.split("@")[0] || "";
  const active = drawerOpen ? "bag"
    : pathname.startsWith("/account") ? "account"
    : pathname.startsWith("/shop") || pathname.startsWith("/product") ? "shop"
    : pathname === "/" && hash === "#consult" ? "consult"
    : pathname === "/" ? "home" : "";
  const items = [
    { id: "home", href: "/", icon: Home, label: t("tab_home") },
    { id: "shop", href: "/shop", icon: Store, label: t("tab_shop") },
    { id: "consult", href: "/#consult", icon: Sparkles, label: t("tab_consult") },
    { id: "bag", icon: ShoppingBag, label: t("tab_bag") },
    { id: "account", href: "/account", icon: User, label: t("tab_account") },
  ];
  return (
    <nav aria-label="tabs" className="fixed inset-x-0 bottom-0 z-[55] border-t border-line bg-surface-raised/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map((it) => {
          const on = active === it.id;
          const Icon = it.icon;
          const inner = (
            <motion.span className="relative flex h-full flex-col items-center justify-center gap-0.5" whileTap={{ scale: 0.88 }}>
              {on ? <motion.span className="absolute top-1.5 h-8 w-14 rounded-full bg-tint" layoutId="tabbar-pill" transition={{ type: "spring", stiffness: 420, damping: 32 }} /> : null}
              <span className="relative grid h-8 place-items-center">
                {it.id === "account" && session ? (
                  <AvatarFace className={`size-6 rounded-full ${on ? "ring-2 ring-olive" : ""}`} seed={profile?.avatar_seed || avatarSeed(name, 0)} />
                ) : (
                  <Icon className={`size-[22px] transition-colors ${on ? "text-olive-ink" : "text-ink-muted"}`} strokeWidth={on ? 2 : 1.5} />
                )}
                {it.id === "bag" ? (
                  <AnimatePresence>
                    {cartCount > 0 ? (
                      <motion.span animate={{ scale: 1 }} className="absolute -top-1 -end-2.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-action px-1 text-[11px] font-bold text-on-action" exit={{ scale: 0 }} initial={{ scale: 0 }} key={cartCount} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
                        {num(cartCount)}
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                ) : null}
              </span>
              <span className={`relative text-[11px] leading-4 ${on ? "font-bold text-olive-ink" : "text-ink-muted"}`}>{it.label}</span>
            </motion.span>
          );
          return (
            <li key={it.id}>
              {it.href ? (
                <Link aria-current={on ? "page" : undefined} className="block h-full" href={it.href} onClick={() => haptic()}>{inner}</Link>
              ) : (
                <button aria-label={it.label} className="block h-full w-full" onClick={() => { haptic(); openDrawer(); }} type="button">{inner}</button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Full-screen menu for phones: big links, language and contact in one place. */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, setLang, waLink, data } = useShop();
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);
  const links = [["/shop", "nav_shop"], ["/#routines", "nav_routines"], ["/#consult", "nav_consult"], ["/#story", "nav_story"], ["/#faq", "nav_faq"], ["/account", "account"]] as const;
  const wa = waLink();
  return (
    <AnimatePresence>
      {open ? (
        <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-[70] flex flex-col bg-surface md:hidden" exit={{ opacity: 0 }} initial={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <div className="wrap flex h-[60px] items-center justify-between">
            <img alt="Maskati" className="h-7 w-auto" src="/assets/maskati-lockup.png" />
            <motion.button aria-label={t("close")} className="icon-btn" onClick={onClose} type="button" whileTap={{ scale: 0.85, rotate: 90 }}><X className="size-6" strokeWidth={1.5} /></motion.button>
          </div>
          <nav className="wrap flex flex-1 flex-col justify-center gap-1 overflow-y-auto">
            {links.map(([href, key], i) => (
              <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 24 }} key={href} transition={{ delay: 0.05 + i * 0.06, duration: 0.5, ease: EASE }}>
                <Link className="flex items-center justify-between border-b border-line py-4 text-[26px] leading-tight" href={href} onClick={() => { haptic(); onClose(); }} style={{ fontFamily: lang === "ar" ? "var(--font-arabic)" : "var(--font-display)" }}>
                  {t(key)}
                  <span className="text-olive">{lang === "ar" ? "←" : "→"}</span>
                </Link>
              </motion.div>
            ))}
          </nav>
          <motion.div animate={{ opacity: 1, y: 0 }} className="wrap grid gap-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-4" initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.4, duration: 0.5, ease: EASE }}>
            <ContinuousTabs activeId={lang} fullWidth layoutId="menu-lang" onChange={(id) => { haptic(); setLang(id as "ar" | "en"); }} tabs={[{ id: "ar", label: "العربية" }, { id: "en", label: "English" }]} />
            {wa ? (
              <a className="btn btn-primary btn-block h-12 gap-2" href={wa} rel="noopener" target="_blank"><MessageCircle className="size-5" />{t("footer_contact")}</a>
            ) : null}
            <p className="caption center muted" style={{ margin: 0 }}>{t("footer_tag")}{data.settings.contact?.phone ? ` · ${data.settings.contact.phone}` : ""}</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
