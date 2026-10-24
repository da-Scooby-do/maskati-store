"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AuthForm } from "@/components/auth-form";
import { Loading } from "@/components/loading";
import { EgyptPhoneInput, SearchSelect, WhatsAppInput } from "@/components/pickers";
import { EASE, Reveal, WordsReveal } from "@/components/motion";
import { usePageTitle, useShop } from "@/components/shop-provider";
import { egyptNational, isEgyptMobile, joinInternational, splitInternational } from "@/lib/countries";
import { db } from "@/lib/supabase";

interface District { district_id: string; name_en: string; name_ar: string | null }
interface Promo { code: string; discount: number; free_shipping: boolean }

function Summary({ zoneId, promo, setPromo }: { zoneId: string; promo: Promo | null; setPromo: (p: Promo | null) => void }) {
  const { t, L, money, num, cartLines, subtotal, deliveryFeeFor, session } = useShop();
  const [code, setCode] = useState(promo?.code ?? "");
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ship = zoneId ? deliveryFeeFor(zoneId, subtotal) : null;
  const discount = promo ? Number(promo.discount) : 0;
  const shipFee = ship ? (promo?.free_shipping ? 0 : ship.fee) : 0;

  const check = async (c: string, quiet: boolean) => {
    const { data: r, error } = await db.rpc("check_promo", { p_code: c, p_subtotal: subtotal });
    if (error || !r) { if (!quiet) setMsg(t("err_generic")); return; }
    if (!r.ok) { const [kind, amount] = String(r.error).split(":"); setMsg(t("promo_" + kind, amount ? money(amount) : "")); return; }
    setMsg(""); setPromo(r as Promo);
  };
  // promo is checked again whenever the bag changes
  useEffect(() => { setPromo(null); }, [subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.aside animate={{ opacity: 1, y: 0 }} aria-label={t("order_summary")} className="summary" initial={{ opacity: 0, y: 30 }} transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}>
      <h2 className="title">{t("order_summary")}</h2>
      {cartLines.map((l) => (
        <div className="line-item" key={l.type + l.id}>
          <div className="thumb"><img alt="" src={l.item.image_url || "/assets/maskati-mark.png"} /></div>
          <div><div>{L(l.item, "name")}</div><div className="body-sm muted">{num(l.qty)} × {money(l.price)}</div></div>
          <div>{money(l.total)}</div>
        </div>
      ))}
      {session ? (
        <>
          <form className="promo" onSubmit={(e) => { e.preventDefault(); if (promo) { setPromo(null); setCode(""); } else if (code.trim()) check(code.trim(), false); }}>
            <label className="sr-only" htmlFor="promo-code">{t("promo_code")}</label>
            <input autoComplete="off" className="input" dir="ltr" id="promo-code" onChange={(e) => {
              setCode(e.target.value); setMsg(""); clearTimeout(timer.current);
              const c = e.target.value.trim();
              if (!promo && c.length >= 3) timer.current = setTimeout(() => check(c, true), 600);
            }} placeholder={t("promo_code")} value={code} />
            <button className="btn btn-secondary" type="submit">{promo ? t("remove") : t("apply")}</button>
          </form>
          <AnimatePresence mode="wait">
            {promo ? <motion.p animate={{ opacity: 1, scale: 1 }} className="body-sm" initial={{ opacity: 0, scale: 0.9 }} key="ok" style={{ margin: 0, color: "var(--olive-ink)" }}>{t("promo_applied", promo.code)}</motion.p>
              : msg ? <motion.p animate={{ opacity: 1 }} className="body-sm" initial={{ opacity: 0 }} key="err" style={{ margin: 0, color: "var(--danger)" }}>{msg}</motion.p> : null}
          </AnimatePresence>
        </>
      ) : null}
      <div className="sum-row"><span>{t("subtotal")}</span><span>{money(subtotal)}</span></div>
      {discount > 0 ? <div className="sum-row" style={{ color: "var(--olive-ink)" }}><span>{t("discount")}</span><span>− {money(discount)}</span></div> : null}
      <div className="sum-row"><span>{t("shipping")}</span><span>{ship ? (shipFee === 0 ? t("free") : money(shipFee)) : <span className="muted">{t("set_at_checkout")}</span>}</span></div>
      {ship ? <div className="body-sm muted">{t("delivery_days", num(ship.days))}</div> : null}
      <div className="sum-row sum-total"><span>{t("total")}</span><motion.strong animate={{ opacity: 1 }} initial={{ opacity: 0.4 }} key={subtotal - discount + shipFee}>{money(subtotal - discount + shipFee)}</motion.strong></div>
    </motion.aside>
  );
}

export default function CheckoutPage() {
  const shop = useShop();
  const { t, L, lang, data, loaded, session, profile, cartLines, cart, setCart, store, reloadData, refreshProfile, waLink } = shop;
  const router = useRouter();
  usePageTitle(t("checkout"));
  // phone = the 10 digits after +20; whatsapp = the number after the chosen country's code
  const [form, setForm] = useState({ name: "", phone: "", waIso: "EG", whatsapp: "", zone: "", district: "", address: "", notes: "", payment: "cod" });
  const [districts, setDistricts] = useState<District[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [promo, setPromo] = useState<Promo | null>(null);
  const filled = useRef(false);

  // fill in what we know: her profile, then what she typed last time
  useEffect(() => {
    if (filled.current || !session) return;
    const saved = store.get<Record<string, string>>("mk_customer", {});
    const wa = splitInternational(profile?.whatsapp || saved.whatsapp);
    setForm((f) => ({
      ...f,
      name: profile?.full_name || saved.customer_name || f.name,
      phone: egyptNational(profile?.phone || saved.phone || f.phone),
      waIso: wa.number ? wa.iso : f.waIso,
      whatsapp: wa.number || f.whatsapp,
      zone: String(profile?.shipping_zone_id || saved.shipping_zone_id || f.zone || ""),
      address: profile?.address || saved.address || f.address,
      district: store.get<string>("mk_district", ""),
    }));
    if (profile) filled.current = true;
  }, [session, profile, store]);

  const gov = useMemo(() => data.zones.find((z) => String(z.id) === form.zone), [data.zones, form.zone]);
  useEffect(() => {
    if (!gov?.bosta_city_id) { setDistricts(null); return; }
    let live = true;
    setDistricts(null);
    db.from("bosta_districts").select("district_id,name_en,name_ar").eq("city_id", gov.bosta_city_id).eq("dropoff", true).order("name_en")
      .then(({ data: rows }) => {
        if (!live) return;
        setDistricts(rows || []);
        setForm((f) => (rows || []).some((d) => d.district_id === f.district) ? f : { ...f, district: "" });
      });
    return () => { live = false; };
  }, [gov]);

  if (!loaded) return <Loading />;
  if (!cartLines.length) {
    return (
      <div className="wrap thanks">
        <WordsReveal className="display-lg" text={t("bag_title")} />
        <Reveal><p className="lede">{t("bag_empty")}</p></Reveal>
        <Reveal delay={0.2}><Link className="btn btn-primary" href="/shop">{t("continue_shopping")}</Link></Reveal>
      </div>
    );
  }

  const wantsInstapay = !!(data.settings.contact?.instapay || waLink());
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const k of ["name", "phone", "whatsapp", "zone", "address"] as const) if (!form[k].trim()) errs[k] = t("err_required");
    if (districts?.length && !form.district) errs.district = t("err_required");
    // the same minimums the server checks, so she sees them by the field instead of a general error
    if (form.name.trim() && form.name.trim().length < 2) errs.name = t("err_required");
    if (form.address.trim() && form.address.trim().length < 6) errs.address = t("err_invalid_address");
    // mobile: Egypt only, always +20; WhatsApp: any country she picked from the flag
    if (form.phone.trim() && !isEgyptMobile(form.phone)) errs.phone = t("err_phone");
    const wa = joinInternational(form.waIso, form.whatsapp);
    if (form.whatsapp.trim() && !wa.valid) errs.whatsapp = t("err_whatsapp");
    setErrors(errs);
    if (Object.keys(errs).length) { document.getElementById(`c-${Object.keys(errs)[0]}`)?.focus(); return; }

    const payload = {
      customer_name: form.name.trim(), phone: `+20${form.phone}`, whatsapp: wa.e164, email: session!.user.email, shipping_zone_id: Number(form.zone),
      district_id: form.district, address: form.address.trim(), notes: form.notes.trim(), payment_method: form.payment,
      promo_code: promo?.code || "", lang, items: cart.map((c) => ({ type: c.type, id: c.id, quantity: c.qty })),
    };
    setBusy(true); setFormError("");
    const { data: res, error } = await db.rpc("place_order", { payload });
    setBusy(false);
    if (error) {
      const m = error.message || "";
      const known = ["item_unavailable", "too_fast", "too_many", "invalid_whatsapp", "invalid_phone", "invalid_district", "invalid_zone", "invalid_address", "sign_in_required"].find((k) => m.includes(k));
      if (m.startsWith("promo_")) setPromo(null);
      // point at the field the server refused, like the checks above do
      const fieldOf: Record<string, string> = { invalid_address: "address", invalid_phone: "phone", invalid_whatsapp: "whatsapp", invalid_district: "district", invalid_zone: "zone", invalid_name: "name" };
      const bad = Object.keys(fieldOf).find((k) => m.includes(k));
      if (bad) { setErrors({ [fieldOf[bad]]: t("err_" + (bad === "invalid_name" ? "required" : bad)) }); document.getElementById(`c-${fieldOf[bad]}`)?.focus(); }
      setFormError(m.startsWith("promo_") ? t("promo_" + m.slice(6).split(":")[0], "") : known ? t("err_" + known) : t("err_generic"));
      if (m.includes("item_unavailable")) reloadData();
      return;
    }
    store.set("mk_district", payload.district_id);
    store.set("mk_last_order", { ...res, payment_method: payload.payment_method });
    // the confirmation email; failures are recorded on the order and never block the customer
    db.functions.invoke("notify-order", { body: { history_id: res.history_id } }).catch(() => {});
    setCart([]);
    refreshProfile();
    reloadData().catch(() => {});
    router.push(`/thanks/${res.order_number}`);
  };

  if (!session) {
    return (
      <div className="wrap checkout">
        <div>
          <Reveal><span className="eyebrow">{t("checkout_title")}</span></Reveal>
          <p className="muted" style={{ margin: "0 0 20px" }}>{t("checkout_sign_in_why")}</p>
          <div className="rounded-3xl border border-line bg-surface-raised p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] sm:p-8">
            <AuthForm returnTo="/checkout" />
          </div>
        </div>
        <Summary promo={promo} setPromo={setPromo} zoneId="" />
      </div>
    );
  }

  const field = (k: string, label: string, input: React.ReactNode) => (
    <div className="field">
      <label htmlFor={`c-${k}`}>{label}</label>
      {input}
      <AnimatePresence>{errors[k] ? <motion.span animate={{ opacity: 1, height: "auto" }} className="error" exit={{ opacity: 0, height: 0 }} initial={{ opacity: 0, height: 0 }}>{errors[k]}</motion.span> : null}</AnimatePresence>
    </div>
  );

  return (
    <div className="wrap checkout">
      <form noValidate onSubmit={submit}>
        <WordsReveal as="h1" className="display-lg" text={t("checkout_title")} />
        <Reveal><p className="muted" style={{ margin: "8px 0 32px" }}>{t("signed_in_as", session.user.email)}</p></Reveal>
        <Reveal><fieldset><legend className="title">{t("contact_info")}</legend>
          <div className="form-grid two">
            {field("name", t("full_name"), <input aria-invalid={!!errors.name} autoComplete="name" className="input" id="c-name" onChange={set("name")} value={form.name} />)}
            {field("phone", t("phone"), (
              <div className="grid gap-2">
                <EgyptPhoneInput id="c-phone" invalid={!!errors.phone} label="Egypt +20" onChange={(v) => setForm((f) => ({ ...f, phone: egyptNational(v) }))} value={form.phone} />
                <span className="body-sm muted">{t("phone_hint")}</span>
              </div>
            ))}
          </div>
          {field("whatsapp", t("whatsapp_number"), (
            <div className="grid gap-2">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <WhatsAppInput
                    id="c-whatsapp" invalid={!!errors.whatsapp} iso={form.waIso} lang={lang}
                    labels={{ country: t("country"), search: t("search_country"), empty: t("no_matches") }}
                    number={form.whatsapp} onIso={(iso) => setForm((f) => ({ ...f, waIso: iso, whatsapp: iso === "EG" ? egyptNational(f.whatsapp) : f.whatsapp }))}
                    onNumber={(n) => setForm((f) => ({ ...f, whatsapp: f.waIso === "EG" ? egyptNational(n) : n.replace(/[^\d٠-٩ ]/g, "") }))}
                  />
                </div>
                <motion.button className="btn btn-secondary shrink-0 px-4" disabled={!form.phone.trim()} onClick={() => setForm((f) => ({ ...f, waIso: "EG", whatsapp: f.phone }))} type="button" whileTap={{ scale: 0.95 }}>
                  {t("same_as_phone")}
                </motion.button>
              </div>
              <span className="body-sm muted">{t("whatsapp_hint")}</span>
            </div>
          ))}
        </fieldset></Reveal>
        <Reveal><fieldset><legend className="title">{t("delivery")}</legend>
          <div className="form-grid two">
            {field("zone", t("governorate"), (
              <SearchSelect
                emptyText={t("no_matches")} id="c-zone" invalid={!!errors.zone} onChange={(v) => setForm((f) => ({ ...f, zone: v, district: f.zone === v ? f.district : "" }))}
                options={data.zones.map((z) => ({ value: String(z.id), label: L(z, "name"), keywords: `${z.name_ar} ${z.name_en}` }))}
                placeholder={t("choose")} searchPlaceholder={t("search_gov")} title={t("governorate")} value={form.zone}
              />
            ))}
            {field("district", t("district"), (
              <SearchSelect
                disabled={!districts?.length} emptyText={t("no_matches")} id="c-district" invalid={!!errors.district}
                onChange={(v) => setForm((f) => ({ ...f, district: v }))}
                options={(districts || []).map((d) => ({ value: d.district_id, label: lang === "ar" ? d.name_ar || d.name_en : d.name_en, keywords: `${d.name_ar || ""} ${d.name_en}` }))}
                placeholder={!form.zone ? t("choose_gov_first") : districts === null ? t("loading") : t("choose")}
                searchPlaceholder={t("search_area")} title={t("district")} value={form.district}
              />
            ))}
          </div>
          {field("address", t("address"), <textarea aria-invalid={!!errors.address} autoComplete="street-address" className="input" id="c-address" onChange={set("address")} placeholder={t("address_ph")} value={form.address} />)}
          {field("notes", t("notes"), <input className="input" id="c-notes" maxLength={500} onChange={set("notes")} value={form.notes} />)}
        </fieldset></Reveal>
        <Reveal><fieldset><legend className="title">{t("payment")}</legend>
          {[["cod", "pay_cod"], ...(wantsInstapay ? [["instapay", "pay_instapay"]] : [])].map(([v, k]) => (
            <motion.label className="radio-card" key={v} whileHover={{ y: -2 }}>
              <input checked={form.payment === v} name="payment_method" onChange={() => setForm((f) => ({ ...f, payment: v }))} type="radio" value={v} />
              <span><strong>{t(k)}</strong><small>{t(k + "_hint")}</small></span>
            </motion.label>
          ))}
        </fieldset></Reveal>
        <AnimatePresence>{formError ? <motion.p animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }} className="error" initial={{ opacity: 0 }} role="alert">{formError}</motion.p> : null}</AnimatePresence>
        <motion.button className="btn btn-primary btn-block" disabled={busy} type="submit" whileTap={{ scale: 0.98 }}>{busy ? t("placing") : t("place_order")}</motion.button>
      </form>
      <Summary promo={promo} setPromo={setPromo} zoneId={form.zone} />
    </div>
  );
}
