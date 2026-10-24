"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { AuthScreen } from "@/components/auth-form";
import { ContinuousTabs } from "@/components/continuous-tabs";
import AvatarPicker, { AvatarFace } from "@/components/kokonutui/avatar-picker";
import SlideTextButton from "@/components/kokonutui/slide-text-button";
import { Loading } from "@/components/loading";
import { EASE, Reveal, Stagger, StaggerItem, WordsReveal } from "@/components/motion";
import { EgyptPhoneInput, SearchSelect, WhatsAppInput } from "@/components/pickers";
import { usePageTitle, useShop } from "@/components/shop-provider";
import { egyptNational, isEgyptMobile, joinInternational, splitInternational } from "@/lib/countries";
import { STATUS_STEPS, trackUrl } from "@/lib/shop";
import { db } from "@/lib/supabase";

interface OrderRow {
  id: string; order_number: number; created_at: string; status: string; total: number; payment_method: string; bosta_tracking_number: string | null;
  order_items: { name: string; quantity: number; product_id: string | null; bundle_id: string | null }[];
  order_status_history: { status: string; created_at: string }[];
}

function Timeline({ o }: { o: OrderRow }) {
  const { t, lang } = useShop();
  const terminal = ["cancelled", "returned"].includes(o.status);
  const idx = (s: string) => STATUS_STEPS.indexOf(s as (typeof STATUS_STEPS)[number]);
  const reached = (s: string) => o.order_status_history.some((h) => h.status === s) || idx(o.status) >= idx(s);
  const when = (s: string) => {
    const h = o.order_status_history.filter((x) => x.status === s).pop();
    return h ? new Date(h.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short" }) : "";
  };
  const steps: string[] = terminal ? [...STATUS_STEPS.filter(reached), o.status] : [...STATUS_STEPS];
  return (
    <ol className="timeline">
      {steps.map((s, i) => {
        const done = reached(s) || s === o.status;
        const stop = s === "cancelled" || s === "returned";
        return (
          <motion.li animate={{ opacity: 1, x: 0 }} className={`${done ? "done" : ""} ${stop ? "stop" : ""}`} initial={{ opacity: 0, x: 10 }} key={s} transition={{ delay: 0.15 * i, duration: 0.5, ease: EASE }}>
            <motion.span animate={{ scale: 1 }} className="dot" initial={{ scale: done ? 0.4 : 1 }} transition={{ delay: 0.15 * i + 0.2, type: "spring", stiffness: 400, damping: 15 }}>
              {done ? <Check className="size-3.5" strokeWidth={2} /> : null}
            </motion.span>
            <span>{t("status_" + s)}</span><span className="body-sm muted">{when(s)}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}

function Orders() {
  const { t, lang, money, num, stockOf, addToCart, openDrawer, toast } = useShop();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  useEffect(() => {
    db.from("orders")
      .select("id,order_number,created_at,status,total,payment_method,bosta_tracking_number,order_items(name,quantity,product_id,bundle_id),order_status_history(status,created_at)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders((data as OrderRow[]) || []));
  }, []);
  if (!orders) return <p className="muted">{t("loading")}</p>;
  if (!orders.length) return <p className="empty">{t("no_orders")} <Link href="/shop">{t("shop_now")}</Link></p>;
  const again = (o: OrderRow) => {
    let added = 0;
    for (const i of o.order_items) {
      const type = i.bundle_id ? "bundle" : "product";
      const id = i.bundle_id || i.product_id;
      if (id && stockOf(type, id) > 0) { addToCart(type, id, i.quantity); added++; }
    }
    if (added) openDrawer(); else toast(t("out_of_stock"));
  };
  return (
    <Stagger className="grid gap-4">
      {orders.map((o) => (
        <StaggerItem key={o.id}>
          <div className="review">
            <div className="sum-row"><strong>#{num(o.order_number)}</strong><span className="body-sm muted">{new Date(o.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></div>
            <Timeline o={o} />
            <div className="body-sm">{o.order_items.map((i) => `${lang === "ar" ? i.name.split(" / ")[0] : i.name.split(" / ").pop()} × ${num(i.quantity)}`).join("، ")}</div>
            {o.bosta_tracking_number ? <div className="body-sm">{t("tracking")}: <a dir="ltr" href={trackUrl(o.bosta_tracking_number)} rel="noopener" target="_blank">{o.bosta_tracking_number}</a></div> : null}
            <div className="sum-row"><span>{t("total")}</span><strong>{money(o.total)}</strong></div>
            <div><motion.button className="btn btn-secondary" onClick={() => again(o)} type="button" whileTap={{ scale: 0.97 }}>{t("order_again")}</motion.button></div>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function Details() {
  const { t, L, lang, data, profile, session, refreshProfile } = useShop();
  const [msg, setMsg] = useState("");
  const p = profile;
  // the same fields as checkout: Egyptian mobile behind a fixed +20, WhatsApp from any country, a searchable governorate
  const [phone, setPhone] = useState(egyptNational(p?.phone || ""));
  const startWa = splitInternational(p?.whatsapp);
  const [waIso, setWaIso] = useState(startWa.iso);
  const [wa, setWa] = useState(startWa.number);
  const [zone, setZone] = useState(String(p?.shipping_zone_id || ""));
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value.trim() || null;
    const waFull = joinInternational(waIso, wa);
    const errs = { phone: !!phone && !isEgyptMobile(phone), wa: !!wa && !waFull.valid };
    setBad(errs);
    if (errs.phone || errs.wa) { setMsg(errs.phone ? t("err_phone") : t("err_whatsapp")); return; }
    const { error } = await db.from("profiles").update({
      full_name: v("p-name"), phone: phone ? `+20${phone}` : null, whatsapp: wa ? waFull.e164 : null,
      shipping_zone_id: Number(zone) || null, address: v("p-address"),
    }).eq("id", session!.user.id);
    setMsg(error ? t("err_generic") : t("details_saved"));
    if (!error) refreshProfile();
  };
  return (
    <form className="summary" noValidate onSubmit={onSubmit} style={{ maxWidth: 560 }}>
      <h2 className="title">{t("my_details")}</h2>
      <div className="field"><label htmlFor="p-name">{t("full_name")}</label><input autoComplete="name" className="input" defaultValue={p?.full_name || ""} id="p-name" name="p-name" /></div>
      <div className="field"><label htmlFor="p-phone">{t("phone")}</label>
        <EgyptPhoneInput id="p-phone" invalid={bad.phone} label="Egypt +20" onChange={(x) => setPhone(egyptNational(x))} value={phone} />
        <span className="body-sm muted">{t("phone_hint")}</span></div>
      <div className="field"><label htmlFor="p-whatsapp">{t("whatsapp_number")}</label>
        <WhatsAppInput
          id="p-whatsapp" invalid={bad.wa} iso={waIso} labels={{ country: t("country"), search: t("search_country"), empty: t("no_matches") }} lang={lang}
          number={wa} onIso={(iso) => { setWaIso(iso); if (iso === "EG") setWa((n) => egyptNational(n)); }}
          onNumber={(n) => setWa(waIso === "EG" ? egyptNational(n) : n.replace(/[^\d٠-٩ ]/g, ""))}
        />
        <span className="body-sm muted">{t("whatsapp_hint")}</span></div>
      <div className="field"><label htmlFor="p-zone">{t("governorate")}</label>
        <SearchSelect
          emptyText={t("no_matches")} id="p-zone" onChange={setZone}
          options={data.zones.map((z) => ({ value: String(z.id), label: L(z, "name"), keywords: `${z.name_ar} ${z.name_en}` }))}
          placeholder={t("choose")} searchPlaceholder={t("search_gov")} title={t("governorate")} value={zone}
        /></div>
      <div className="field"><label htmlFor="p-address">{t("address")}</label><textarea className="input" defaultValue={p?.address || ""} id="p-address" name="p-address" /></div>
      <button className="btn btn-primary" type="submit">{t("save")}</button>
      <AnimatePresence>{msg ? <motion.p animate={{ opacity: 1 }} className="body-sm muted" exit={{ opacity: 0 }} initial={{ opacity: 0 }} style={{ margin: 0 }}>{msg}</motion.p> : null}</AnimatePresence>
    </form>
  );
}

/** Each customer spins her own face (Kokonut avatar picker); the seed is saved on her profile. */
function Avatar() {
  const { t, profile, session, refreshProfile, toast } = useShop();
  const name = profile?.avatar_name || profile?.full_name?.split(" ")[0] || session?.user.email?.split("@")[0] || "";
  return (
    <div className="flex justify-center" dir="ltr">
      <AvatarPicker
        className="w-[23rem] max-w-full shrink-0"
        defaultValue={{ displayName: name, variant: profile?.avatar_variant ?? 0 }}
        description={t("avatar_text")}
        nameLabel={t("your_name")}
        namePlaceholder={t("your_name")}
        onComplete={async (v) => {
          const { error } = await db.from("profiles").update({ avatar_seed: v.seed, avatar_name: v.displayName, avatar_variant: v.variant }).eq("id", session!.user.id);
          if (error) { toast(t("err_generic")); return; }
          await refreshProfile();
          toast(t("avatar_saved"));
        }}
        submitLabel={t("save_avatar")}
        title={t("my_avatar")}
      />
    </div>
  );
}

function Password() {
  const { t } = useShop();
  const [msg, setMsg] = useState("");
  return (
    <form className="summary" onSubmit={async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const { error } = await db.auth.updateUser({ password: (f.elements.namedItem("pw") as HTMLInputElement).value });
      setMsg(error ? error.message : t("password_changed"));
      if (!error) f.reset();
    }} style={{ maxWidth: 480 }}>
      <h2 className="title">{t("change_password")}</h2>
      <div className="field"><label htmlFor="pw-new">{t("new_password")}</label><input autoComplete="new-password" className="input" dir="ltr" id="pw-new" minLength={8} name="pw" required type="password" /></div>
      <button className="btn btn-secondary" type="submit">{t("change_password")}</button>
      <p aria-live="polite" className="body-sm muted" style={{ margin: 0 }}>{msg}</p>
    </form>
  );
}

function Account() {
  const { t, loaded, session, profile, isOwner, recovering, setRecovering, toast } = useShop();
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") || "orders";
  usePageTitle(t("account"));
  if (!loaded) return <Loading />;

  if (recovering) {
    return (
      <div className="wrap" style={{ maxWidth: 480, paddingBlock: 64 }}>
        <WordsReveal className="display-lg mb-6" text={t("new_password")} />
        <form className="form-grid" onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await db.auth.updateUser({ password: (e.currentTarget.elements.namedItem("np") as HTMLInputElement).value });
          if (error) { toast(error.message); return; }
          setRecovering(false); toast(t("password_changed"));
        }}>
          <div className="field"><label htmlFor="np">{t("new_password")}</label><input autoComplete="new-password" className="input" dir="ltr" id="np" minLength={8} name="np" required type="password" /></div>
          <button className="btn btn-primary btn-block" type="submit">{t("save")}</button>
        </form>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen initial={params.get("mode") === "create" ? "create" : "signin"} />;
  }

  const first = profile?.full_name?.split(" ")[0];
  return (
    <div className="wrap" style={{ paddingBlock: "48px 64px" }}>
      <div className="section-head">
        <div className="flex items-center gap-5">
          <motion.div animate={{ scale: 1, opacity: 1 }} className="size-20 overflow-hidden rounded-full bg-tint ring-2 ring-mint" initial={{ scale: 0.6, opacity: 0 }} transition={{ type: "spring", stiffness: 220, damping: 16 }}>
            {profile?.avatar_seed ? <AvatarFace className="size-full" seed={profile.avatar_seed} /> : <img alt="" className="size-full object-contain p-3" src="/assets/maskati-mark.png" />}
          </motion.div>
          <div>
            <span className="eyebrow">{t("account")}</span>
            <WordsReveal as="h1" className="display-lg" text={`${t("hello")}${first ? " " + first : ""}`} />
            <p className="muted" style={{ margin: "8px 0 0" }}>{session.user.email}</p>
          </div>
        </div>
        <div className="hero-actions">
          {isOwner ? <SlideTextButton className="h-11 rounded-full bg-action px-6 text-on-action hover:bg-action-hover" href="/admin" hoverText={t("open_dashboard")} text={t("dashboard")} /> : null}
          <button className="btn btn-secondary" onClick={async () => { await db.auth.signOut(); router.push("/"); }} type="button">{t("sign_out")}</button>
        </div>
      </div>
      <Reveal className="mb-8">
        <ContinuousTabs
          activeId={tab} layoutId="account-tabs"
          onChange={(id) => router.replace(id === "orders" ? "/account" : `/account?tab=${id}`, { scroll: false })}
          tabs={[{ id: "orders", label: t("my_orders") }, { id: "details", label: t("my_details") }, { id: "avatar", label: t("my_avatar") }, { id: "password", label: t("change_password") }]}
        />
      </Reveal>
      <AnimatePresence mode="wait">
        <motion.div animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -12, filter: "blur(4px)" }} initial={{ opacity: 0, y: 16, filter: "blur(4px)" }} key={tab} transition={{ duration: 0.45, ease: EASE }}>
          {tab === "details" ? <Details /> : tab === "avatar" ? <Avatar /> : tab === "password" ? <Password /> : <Orders />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function AccountPage() {
  return <Suspense fallback={<Loading />}><Account /></Suspense>;
}
