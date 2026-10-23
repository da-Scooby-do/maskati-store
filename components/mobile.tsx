"use client";

import { BookOpen, CircleHelp, Home, Layers, MessageCircle, ShoppingBag, Sparkles, Store, User, X } from "lucide-react";
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

/** Full-screen menu for phones: every page link, the bag, language and contact in one place. */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, setLang, waLink, data, num, cartCount, openDrawer, session, profile } = useShop();
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);
  // close if the screen grows to desktop size while it is open
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => { if (mq.matches) onClose(); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [onClose]);
  const name = profile?.full_name || session?.user.email?.split("@")[0] || "";
  const links = [
    { href: "/", key: "tab_home", icon: Home },
    { href: "/shop", key: "nav_shop", icon: Store },
    { href: "/#routines", key: "nav_routines", icon: Layers },
    { href: "/#consult", key: "nav_consult", icon: Sparkles },
    { href: "/#story", key: "nav_story", icon: BookOpen },
    { href: "/#faq", key: "nav_faq", icon: CircleHelp },
    { href: "/account", key: "account", icon: User },
  ];
  const rowClass = "flex w-full items-center gap-4 border-b border-line py-3.5 text-[22px] leading-tight";
  const font = { fontFamily: lang === "ar" ? "var(--font-arabic)" : "var(--font-display)" };
  const arrow = <span className="ms-auto text-olive">{lang === "ar" ? "←" : "→"}</span>;
  const wa = waLink();
  return (
    <AnimatePresence>
      {open ? (
        <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-[70] flex flex-col bg-surface md:hidden" exit={{ opacity: 0 }} initial={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <div className="wrap flex h-[60px] shrink-0 items-center justify-between">
            <img alt="Maskati" className="h-7 w-auto" src="/assets/maskati-lockup.png" />
            <motion.button aria-label={t("close")} className="icon-btn" onClick={onClose} type="button" whileTap={{ scale: 0.85, rotate: 90 }}><X className="size-6" strokeWidth={1.5} /></motion.button>
          </div>
          <nav className="wrap flex flex-1 flex-col justify-center overflow-y-auto">
            {links.map(({ href, key, icon: Icon }, i) => {
              const here = href === pathname;
              return (
                <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 24 }} key={href} transition={{ delay: 0.05 + i * 0.05, duration: 0.5, ease: EASE }}>
                  <Link aria-current={here ? "page" : undefined} className={`${rowClass} ${here ? "text-olive-ink" : ""}`} href={href} onClick={() => { haptic(); onClose(); }} style={font}>
                    {key === "account" && session ? (
                      <AvatarFace className="size-7 shrink-0 rounded-full" seed={profile?.avatar_seed || avatarSeed(name, 0)} />
                    ) : (
                      <Icon className="size-6 shrink-0 text-olive" strokeWidth={1.5} />
                    )}
                    {t(key)}
                    {arrow}
                  </Link>
                </motion.div>
              );
            })}
            <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 24 }} transition={{ delay: 0.05 + links.length * 0.05, duration: 0.5, ease: EASE }}>
              <button className={rowClass} onClick={() => { haptic(); onClose(); openDrawer(); }} style={font} type="button">
                <ShoppingBag className="size-6 shrink-0 text-olive" strokeWidth={1.5} />
                {t("tab_bag")}
                {cartCount > 0 ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-action px-1.5 text-[13px] font-bold text-on-action">{num(cartCount)}</span> : null}
                {arrow}
              </button>
            </motion.div>
          </nav>
          <motion.div animate={{ opacity: 1, y: 0 }} className="wrap grid shrink-0 gap-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-4" initial={{ opacity: 0, y: 20 }} transition={{ delay: 0.4, duration: 0.5, ease: EASE }}>
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
