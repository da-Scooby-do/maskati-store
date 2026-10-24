"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * On phones the row inside becomes a sideways, snapping scroller (see .rail in shop.css), with dots under it
 * like Flair's. Wider screens keep the normal grid and show no dots. Nothing scrolls when everything fits.
 */
export function Rail({ children, label }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const row = ref.current?.firstElementChild as HTMLElement | null;
    if (!row) return;
    const measure = () => {
      const overflow = row.scrollWidth > row.clientWidth + 4;
      setCount(overflow ? row.children.length : 0);
      const first = row.children[0] as HTMLElement | undefined;
      if (!first) return;
      const step = first.offsetWidth + parseFloat(getComputedStyle(row).columnGap || "0");
      // scrollLeft runs negative in right-to-left pages, so use its size; at the very end, light the last dot
      const x = Math.abs(row.scrollLeft);
      const atEnd = x >= row.scrollWidth - row.clientWidth - 4;
      setActive(atEnd ? row.children.length - 1 : Math.min(row.children.length - 1, Math.round(x / Math.max(step, 1))));
    };
    measure();
    row.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => { row.removeEventListener("scroll", measure); ro.disconnect(); };
  }, [children]);

  const go = (i: number) => {
    const row = ref.current?.firstElementChild as HTMLElement | null;
    (row?.children[i] as HTMLElement | undefined)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };

  return (
    <div className="rail" ref={ref}>
      {children}
      {count > 1 ? (
        <div aria-label={label} className="rail-dots" role="tablist">
          {Array.from({ length: count }, (_, i) => (
            <button aria-label={`${i + 1} / ${count}`} aria-selected={i === active} className={i === active ? "on" : ""} key={i} onClick={() => go(i)} role="tab" type="button" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
