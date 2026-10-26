"use client";

import { BookOpen, CircleHelp, Home, Layers, Leaf, MessageCircle, ShoppingBag, Sparkles, Store, User, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ContinuousTabs } from "@/components/continuous-tabs";
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
  const { t, lang, setLang, waLink, data, num, cartCount, openDrawer } = useShop();
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);
  // close if the screen grows wide enough for the header links while it is open
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1180px)");
    const on = () => { if (mq.matches) onClose(); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [onClose]);
  const links = [
    { href: "/", key: "tab_home", icon: Home },
    { href: "/shop", key: "nav_shop", icon: Store },
    { href: "/#routines", key: "nav_routines", icon: Layers },
    { href: "/#consult", key: "nav_consult", icon: Sparkles },
    { href: "/#ingredients", key: "nav_ingredients", icon: Leaf },
    { href: "/#story", key: "nav_story", icon: BookOpen },
    { href: "/#faq", key: "nav_faq", icon: CircleHelp },
    { href: "/account", key: "account", icon: User },
  ];
  const rowClass = "flex w-full items-center gap-4 border-b border-line py-3.5 text-[22px] leading-tight";
  const font = { fontFamily: lang === "ar" ? "var(--font-arabic)" : "var(--font-display)" };
  const arrow = <span className="ms-auto text-olive">{lang === "ar" ? "←" : "→"}</span>;
  const wa = waLink();
  return (
    // the shell shows and hides with plain CSS, so a closed menu never sits over the page catching taps,
    // even if a paused tab leaves the motion fade unfinished
    <div aria-hidden={!open} className={`fixed inset-0 z-[70] flex flex-col bg-surface transition-[opacity,visibility] duration-300 min-[1180px]:hidden ${open ? "visible opacity-100" : "pointer-events-none invisible opacity-0"}`} inert={!open}>
    <AnimatePresence>
      {open ? (
        <motion.div animate={{ opacity: 1 }} className="flex min-h-0 flex-1 flex-col" exit={{ opacity: 0 }} initial={{ opacity: 0 }} transition={{ duration: 0.25 }}>
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
                    <Icon className="size-6 shrink-0 text-olive" strokeWidth={1.5} />
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
    </div>
  );
}
