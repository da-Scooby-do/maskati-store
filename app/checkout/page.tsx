"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AuthForm } from "@/components/auth-form";
import { Loading } from "@/components/loading";
import { EASE, Reveal, WordsReveal } from "@/components/motion";
import { useShop } from "@/components/shop-provider";
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
  const [form, setForm] = useState({ name: "", phone: "", zone: "", district: "", address: "", notes: "", payment: "cod" });
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
    setForm((f) => ({
      ...f,
      name: profile?.full_name || saved.customer_name || f.name,
      phone: profile?.phone || saved.phone || f.phone,
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
    for (const k of ["name", "phone", "zone", "address"] as const) if (!form[k].trim()) errs[k] = t("err_required");
    if (districts?.length && !form.district) errs.district = t("err_required");
    const phone = form.phone.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^\d+]/g, "");
    if (form.phone.trim() && !/^(\+?20|0)?1[0125]\d{8}$/.test(phone)) errs.phone = t("err_phone");
    setErrors(errs);
    if (Object.keys(errs).length) { document.getElementById(`c-${Object.keys(errs)[0]}`)?.focus(); return; }

    const payload = {
      customer_name: form.name.trim(), phone, email: session!.user.email, shipping_zone_id: Number(form.zone),
      district_id: form.district, address: form.address.trim(), notes: form.notes.trim(), payment_method: form.payment,
      promo_code: promo?.code || "", lang, items: cart.map((c) => ({ type: c.type, id: c.id, quantity: c.qty })),
    };
    setBusy(true); setFormError("");
    const { data: res, error } = await db.rpc("place_order", { payload });
    setBusy(false);
    if (error) {
      const m = error.message || "";
      const known = ["item_unavailable", "too_fast", "too_many", "invalid_phone", "invalid_district", "invalid_zone", "invalid_address", "sign_in_required"].find((k) => m.includes(k));
      if (m.startsWith("promo_")) setPromo(null);
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
          <WordsReveal as="h1" className="display-lg mb-6" text={t("sign_in")} />
          <AuthForm returnTo="/checkout" />
          <p className="body-sm muted mt-6">{t("checkout_sign_in_why")}</p>
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
            {field("phone", t("phone"), <input aria-invalid={!!errors.phone} autoComplete="tel" className="input" dir="ltr" id="c-phone" inputMode="tel" onChange={set("phone")} placeholder="01xxxxxxxxx" type="tel" value={form.phone} />)}
          </div>
        </fieldset></Reveal>
        <Reveal><fieldset><legend className="title">{t("delivery")}</legend>
          <div className="form-grid two">
            {field("zone", t("governorate"), (
              <select aria-invalid={!!errors.zone} className="input" id="c-zone" onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value, district: "" }))} value={form.zone}>
                <option value="">{t("choose")}</option>
                {data.zones.map((z) => <option key={z.id} value={z.id}>{L(z, "name")}</option>)}
              </select>
            ))}
            {field("district", t("district"), (
              <select aria-invalid={!!errors.district} className="input" disabled={!districts?.length} id="c-district" onChange={set("district")} value={form.district}>
                <option value="">{!form.zone ? t("choose_gov_first") : districts === null ? t("loading") : t("choose")}</option>
                {(districts || []).map((d) => <option key={d.district_id} value={d.district_id}>{lang === "ar" ? d.name_ar || d.name_en : d.name_en}</option>)}
              </select>
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
