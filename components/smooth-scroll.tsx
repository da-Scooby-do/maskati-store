"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect } from "react";

/**
 * The page glides when scrolled with a mouse wheel or trackpad (Lenis).
 * Touch screens keep their own scrolling, and so does anyone who asked for reduced motion.
 * Lists and drawers that scroll on their own keep working, and while the phone menu or a
 * picker locks the page (overflow hidden on <html>), the glide pauses too.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(pointer: coarse)").matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.09, anchors: { offset: -100 }, allowNestedScroll: true });
    const html = document.documentElement;
    const sync = () => (html.style.overflow === "hidden" ? lenis.stop() : lenis.start());
    const watch = new MutationObserver(sync);
    watch.observe(html, { attributes: true, attributeFilter: ["style"] });
    return () => { watch.disconnect(); lenis.destroy(); };
  }, []);
  return null;
}
