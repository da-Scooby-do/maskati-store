"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { haptic, useIsPhone } from "@/components/mobile";
import { EASE } from "@/components/motion";
import { countries, dialOf, flagEmoji } from "@/lib/countries";

/** Arabic and English text made comparable: no diacritics, one alef, ة = ه, ى = ي, lower case. */
export const fold = (s: string) =>
  s.normalize("NFKD").replace(/[ً-ٰٟـ̀-ͯ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .toLowerCase().trim();

export interface PickOption { value: string; label: string; hint?: string; keywords?: string; icon?: ReactNode }

/**
 * A select she can type into. Wide screens: a panel under the field. Phones: a full-screen sheet with the
 * search box at the top, so the keyboard never hides the list.
 */
export function SearchSelect({
  id, value, onChange, options, placeholder, searchPlaceholder, emptyText, title, disabled, invalid, trigger, className,
}: {
  id: string; value: string; onChange: (v: string) => void; options: PickOption[]; placeholder: string; searchPlaceholder: string;
  emptyText: string; title: string; disabled?: boolean; invalid?: boolean; className?: string;
  /** a custom face for the closed field (the WhatsApp country chip uses this) */
  trigger?: (selected: PickOption | undefined) => ReactNode;
}) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  // the list follows the page direction even inside a left-to-right phone field
  const pageDir = typeof document !== "undefined" ? (document.documentElement.dir as "rtl" | "ltr") || "ltr" : "ltr";

  const shown = useMemo(() => {
    const f = fold(q);
    if (!f) return options;
    const hits = options.filter((o) => fold(`${o.label} ${o.keywords || ""}`).includes(f));
    // names that start with what she typed come first
    return hits.sort((a, b) => Number(!fold(a.label).startsWith(f)) - Number(!fold(b.label).startsWith(f)));
  }, [q, options]);

  const close = (focus = true) => { setOpen(false); setQ(""); if (focus) btn.current?.focus(); };
  const pick = (o: PickOption) => { haptic(); onChange(o.value); close(); };

  useEffect(() => { setActive(Math.max(0, shown.findIndex((o) => o.value === value))); }, [open, q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || phone) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) close(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open, phone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || !phone) return;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open, phone]);
  useEffect(() => { (list.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) pick(shown[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  };

  const body = (
    <>
      <div className="pick-search">
        <Search aria-hidden className="size-4 shrink-0 text-ink-muted" />
        <input
          aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined} aria-controls={listId} aria-label={searchPlaceholder}
          autoComplete="off" autoFocus onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={searchPlaceholder} role="combobox" aria-expanded value={q}
        />
        {q ? <button aria-label="clear" className="grid size-7 place-items-center rounded-full text-ink-muted" onClick={() => setQ("")} type="button"><X className="size-4" /></button> : null}
      </div>
      <ul className="pick-list" id={listId} ref={list} role="listbox">
        {shown.length ? shown.map((o, i) => (
          <li
            aria-selected={o.value === value} className={`pick-item ${i === active ? "is-active" : ""} ${o.value === value ? "is-chosen" : ""}`}
            id={`${listId}-${i}`} key={o.value} onClick={() => pick(o)} onMouseMove={() => setActive(i)} role="option"
          >
            {o.icon ? <span className="pick-icon">{o.icon}</span> : null}
            <span className="min-w-0 flex-1"><span className="block truncate">{o.label}</span>{o.hint ? <span className="pick-hint">{o.hint}</span> : null}</span>
            {o.value === value ? <Check className="size-4 shrink-0 text-olive-ink" /> : null}
          </li>
        )) : <li className="pick-empty">{emptyText}</li>}
      </ul>
    </>
  );

  return (
    <div className={`relative ${className || ""}`} ref={wrap}>
      <button
        aria-expanded={open} aria-haspopup="listbox" aria-invalid={invalid || undefined}
        className={trigger ? "pick-trigger-custom" : "input pick-trigger"} disabled={disabled} id={id}
        onClick={() => { haptic(); setOpen((v) => !v); }}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(true); } }}
        ref={btn} type="button"
      >
        {trigger ? trigger(selected) : (
          <>
            {selected?.icon ? <span className="pick-icon">{selected.icon}</span> : null}
            <span className={`min-w-0 flex-1 truncate text-start ${selected ? "" : "text-ink-muted"}`}>{selected?.label || placeholder}</span>
            <ChevronDown className={`size-4 shrink-0 text-ink-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>
      {/* opens with a slide, closes at once: a closing layer must never linger over the form catching taps */}
      {open ? (phone ? (
          <motion.div
            animate={{ y: 0 }} className="pick-sheet" dir={pageDir} initial={{ y: "100%" }} role="dialog" aria-label={title}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between gap-3 px-4 pt-4">
              <strong className="title">{title}</strong>
              <button aria-label="close" className="icon-btn" onClick={() => close()} type="button"><X className="size-5" /></button>
            </div>
            {body}
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }} className="pick-panel" dir={pageDir}
            initial={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.2, ease: EASE }}
          >
            {body}
          </motion.div>
      )) : null}
    </div>
  );
}

/** Egypt's flag: red, white and black bands with the golden eagle reduced to a mark. */
export function EgyptFlag({ className = "h-[14px] w-[21px]" }: { className?: string }) {
  return (
    <svg aria-hidden className={`${className} shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]`} viewBox="0 0 30 20">
      <rect fill="#ce1126" height="6.67" width="30" />
      <rect fill="#fff" height="6.67" width="30" y="6.67" />
      <rect fill="#000" height="6.67" width="30" y="13.33" />
      <path d="M15 7.6l1.3 1.2-.4 2.2h-1.8l-.4-2.2z" fill="#c09300" />
    </svg>
  );
}

/** Egyptian mobile only: a fixed 🇪🇬 +20 she can't change, then the 10 digits. `value` is those 10 digits. */
export function EgyptPhoneInput({ id, value, onChange, invalid, label }: { id: string; value: string; onChange: (raw: string) => void; invalid?: boolean; label: string }) {
  return (
    <div className={`phone-group ${invalid ? "is-invalid" : ""}`} dir="ltr">
      <span aria-label={label} className="phone-prefix"><EgyptFlag /><span>+20</span></span>
      <input
        aria-invalid={invalid || undefined} autoComplete="tel-national" id={id} inputMode="numeric" maxLength={16}
        onChange={(e) => onChange(e.target.value)} placeholder="10 1234 5678" type="tel" value={value}
      />
    </div>
  );
}

/** WhatsApp from any country: a searchable country chip (flag + code), then the number. */
export function WhatsAppInput({
  id, iso, number, onIso, onNumber, invalid, lang, labels,
}: {
  id: string; iso: string; number: string; onIso: (iso: string) => void; onNumber: (n: string) => void; invalid?: boolean; lang: "ar" | "en";
  labels: { country: string; search: string; empty: string };
}) {
  const options = useMemo<PickOption[]>(() => countries(lang).map((c) => ({
    value: c.iso, label: c.name, hint: `+${c.dial}`, keywords: `${c.other} ${c.dial} +${c.dial} ${c.iso}`,
    icon: c.iso === "EG" ? <EgyptFlag /> : <span className="text-[18px] leading-none">{flagEmoji(c.iso)}</span>,
  })), [lang]);
  return (
    <div className={`phone-group ${invalid ? "is-invalid" : ""}`} dir="ltr">
      <SearchSelect
        emptyText={labels.empty} id={`${id}-country`} onChange={onIso} options={options} placeholder={labels.country}
        searchPlaceholder={labels.search} title={labels.country} value={iso}
        trigger={(o) => (
          <span className="phone-prefix phone-prefix-btn" aria-label={`${labels.country}: ${o?.label || ""} +${dialOf(iso)}`}>
            {o?.icon}<span>+{dialOf(iso)}</span><ChevronDown className="size-3.5 opacity-60" />
          </span>
        )}
      />
      <input
        aria-invalid={invalid || undefined} autoComplete="tel-national" id={id} inputMode="numeric" maxLength={18}
        onChange={(e) => onNumber(e.target.value)} placeholder={iso === "EG" ? "10 1234 5678" : "50 123 4567"} type="tel" value={number}
      />
    </div>
  );
}
