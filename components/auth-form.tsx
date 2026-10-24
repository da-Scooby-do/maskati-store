"use client";

import { AlertCircle, ArrowLeft, Check, Eye, EyeOff, Loader2, Lock, Mail, MailCheck, Phone, User } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { ContinuousTabs } from "@/components/continuous-tabs";
import { LineLeaves } from "@/components/home";
import { EASE } from "@/components/motion";
import { useShop } from "@/components/shop-provider";
import { db } from "@/lib/supabase";

type Mode = "signin" | "create" | "reset";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** One labelled field: icon at the start, the message right under it. */
function Field({ id, label, icon, error, hint, aside, children }: {
  id: string; label: string; icon: ReactNode; error?: string; hint?: ReactNode; aside?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-bold" htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute inset-y-0 start-3.5 grid place-items-center text-ink-muted">{icon}</span>
        {children}
      </div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p animate={{ opacity: 1, height: "auto" }} className="flex items-center gap-1.5 text-sm text-danger" exit={{ opacity: 0, height: 0 }} id={`${id}-err`} initial={{ opacity: 0, height: 0 }} role="alert">
            <AlertCircle className="size-4 shrink-0" />{error}
          </motion.p>
        ) : hint ? <div className="text-sm text-ink-muted">{hint}</div> : null}
      </AnimatePresence>
    </div>
  );
}

const inputCls = "h-12 w-full rounded-xl border border-line-strong bg-surface ps-11 pe-4 text-base outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-muted/70 focus:border-olive focus:ring-4 focus:ring-olive/20 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

/** Sign in, create an account, or reset the password. `returnTo` is where the email link brings her back. */
export function AuthForm({ returnTo = "/account", initial = "signin" }: { returnTo?: string; initial?: Mode }) {
  const { t, lang } = useShop();
  const [mode, setMode] = useState<Mode>(initial);
  const [values, setValues] = useState({ name: "", phone: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [sentTo, setSentTo] = useState<{ email: string; kind: "confirm" | "reset" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const creating = mode === "create";
  const resetting = mode === "reset";

  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: "" }));
  };
  const switchTo = (m: Mode) => { setMode(m); setErrors({}); setFormError(""); setSentTo(null); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (creating && values.name.trim().length < 2) e.name = t("err_required");
    if (!EMAIL_RE.test(values.email.trim())) e.email = t("err_email");
    if (!resetting && !values.password) e.password = t("err_required");
    else if (creating && values.password.length < 8) e.password = t("password_hint");
    if (creating && values.phone.trim() && !/^(\+?20|0)?1[0125]\d{8}$/.test(values.phone.replace(/[^\d+]/g, ""))) e.phone = t("err_phone");
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById(`a-${first}`)?.focus();
    return !first;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setFormError("");
    if (!validate()) return;
    const email = values.email.trim();
    setBusy(true);
    if (resetting) {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/account" });
      setBusy(false);
      if (error) setFormError(error.message); else setSentTo({ email, kind: "reset" });
      return;
    }
    const { data: res, error } = creating
      ? await db.auth.signUp({ email, password: values.password, options: { emailRedirectTo: location.origin + returnTo, data: { full_name: values.name.trim(), phone: values.phone.trim() } } })
      : await db.auth.signInWithPassword({ email, password: values.password });
    setBusy(false);
    if (error) {
      const m = error.message;
      if (/invalid login/i.test(m)) setFormError(t("err_login"));
      else if (/not confirmed/i.test(m)) setFormError(t("err_confirm"));
      else if (/already registered/i.test(m)) { setErrors({ email: t("err_exists") }); }
      else setFormError(m);
      return;
    }
    if (creating && !res.session) setSentTo({ email, kind: "confirm" });
  };

  // after sign-up or a reset request: one clear next step
  if (sentTo) {
    return (
      <motion.div animate={{ opacity: 1, scale: 1 }} className="grid justify-items-center gap-4 py-4 text-center" initial={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.5, ease: EASE }}>
        <motion.span animate={{ scale: 1, rotate: 0 }} className="grid size-16 place-items-center rounded-full bg-tint text-olive-ink" initial={{ scale: 0, rotate: -20 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}>
          <MailCheck className="size-8" strokeWidth={1.5} />
        </motion.span>
        <h2 className="title">{t("check_inbox")}</h2>
        <p className="muted" style={{ margin: 0 }}>{t(sentTo.kind === "confirm" ? "check_email" : "reset_sent", sentTo.email)}</p>
        <p className="body-sm muted" style={{ margin: 0 }}>{t("check_spam")}</p>
        <button className="btn btn-secondary mt-2" onClick={() => switchTo("signin")} type="button">{t("back_to_sign_in")}</button>
      </motion.div>
    );
  }

  const pwChecks = [
    { ok: values.password.length >= 8, label: t("pw_rule_length") },
    { ok: /\d/.test(values.password) && /\D/.test(values.password), label: t("pw_rule_mix") },
  ];

  return (
    <div className="grid gap-6">
      {resetting ? (
        <button className="flex items-center gap-2 justify-self-start text-sm text-olive-ink" onClick={() => switchTo("signin")} type="button">
          <ArrowLeft className={`size-4 ${lang === "ar" ? "rotate-180" : ""}`} />{t("back_to_sign_in")}
        </button>
      ) : (
        <ContinuousTabs activeId={mode} fullWidth layoutId="auth-tabs" onChange={(id) => switchTo(id as Mode)} tabs={[{ id: "signin", label: t("sign_in") }, { id: "create", label: t("create_account") }]} />
      )}

      <AnimatePresence mode="wait">
        <motion.div animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} initial={{ opacity: 0, y: 6 }} key={mode} transition={{ duration: 0.3, ease: EASE }}>
          <h2 className="title" style={{ margin: 0 }}>{creating ? t("create_title") : resetting ? t("reset_password") : t("welcome_back")}</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>{creating ? t("create_account_text") : resetting ? t("reset_text") : t("sign_in_text")}</p>
        </motion.div>
      </AnimatePresence>

      <form className="grid gap-4" noValidate onSubmit={onSubmit}>
        <AnimatePresence initial={false}>
          {creating ? (
            <motion.div animate={{ height: "auto", opacity: 1 }} className="grid gap-4 overflow-hidden" exit={{ height: 0, opacity: 0 }} initial={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}>
              <Field error={errors.name} icon={<User className="size-[18px]" />} id="a-name" label={t("full_name")}>
                <input aria-describedby="a-name-err" aria-invalid={!!errors.name} autoComplete="name" className={inputCls} id="a-name" maxLength={80} onChange={set("name")} placeholder={t("name_ph")} value={values.name} />
              </Field>
              <Field error={errors.phone} hint={t("optional")} icon={<Phone className="size-[18px]" />} id="a-phone" label={t("phone")}>
                <input aria-invalid={!!errors.phone} autoComplete="tel" className={inputCls} dir="ltr" id="a-phone" inputMode="tel" onChange={set("phone")} placeholder="01xxxxxxxxx" type="tel" value={values.phone} />
              </Field>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Field error={errors.email} icon={<Mail className="size-[18px]" />} id="a-email" label={t("email")}>
          <input aria-invalid={!!errors.email} autoCapitalize="none" autoComplete="email" className={inputCls} dir="ltr" id="a-email" inputMode="email" onChange={set("email")} placeholder="name@example.com" type="email" value={values.email} />
        </Field>

        {!resetting ? (
          <Field
            aside={!creating ? <button className="text-sm text-olive-ink hover:underline" onClick={() => switchTo("reset")} type="button">{t("forgot_password")}</button> : null}
            error={errors.password}
            hint={creating ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {pwChecks.map((c) => (
                  <li className={`flex items-center gap-1 transition-colors ${c.ok ? "text-olive-ink" : ""}`} key={c.label}>
                    <motion.span animate={{ scale: c.ok ? 1 : 0.8 }} className={`grid size-4 place-items-center rounded-full ${c.ok ? "bg-action text-on-action" : "border border-line-strong"}`}>
                      {c.ok ? <Check className="size-3" strokeWidth={3} /> : null}
                    </motion.span>
                    {c.label}
                  </li>
                ))}
              </ul>
            ) : undefined}
            icon={<Lock className="size-[18px]" />} id="a-password" label={t("password")}
          >
            <input aria-invalid={!!errors.password} autoComplete={creating ? "new-password" : "current-password"} className={`${inputCls} pe-12`} dir="ltr" id="a-password" onChange={set("password")} type={showPw ? "text" : "password"} value={values.password} />
            <button aria-label={showPw ? t("hide_password") : t("show_password")} aria-pressed={showPw} className="absolute inset-y-0 end-1 grid w-11 place-items-center rounded-xl text-ink-muted hover:text-ink" onClick={() => setShowPw((s) => !s)} type="button">
              {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </Field>
        ) : null}

        <AnimatePresence>
          {formError ? (
            <motion.div animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }} className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" exit={{ opacity: 0 }} initial={{ opacity: 0 }} role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />{formError}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button className="btn btn-primary btn-block h-12 gap-2 text-base" disabled={busy} type="submit" whileTap={{ scale: 0.98 }}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : null}
          {creating ? t("create_account") : resetting ? t("send_reset") : t("sign_in")}
        </motion.button>

        {creating ? <p className="text-center text-xs text-ink-muted" style={{ margin: 0 }}>{t("create_terms")}</p> : null}
      </form>
    </div>
  );
}

/** The sign-in screen: the form in a card, with what an account gives her beside it on wide screens. */
export function AuthScreen({ returnTo, initial }: { returnTo?: string; initial?: Mode }) {
  const { t } = useShop();
  const perks = ["perk_orders", "perk_address", "perk_avatar", "perk_offers"];
  return (
    <div className="wrap py-8 md:py-16">
      <div className="mx-auto grid max-w-5xl items-stretch overflow-hidden rounded-3xl border border-line bg-surface-raised shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] md:grid-cols-[1fr_1.1fr]">
        <div className="relative hidden flex-col justify-between gap-8 overflow-hidden bg-band p-10 text-on-band md:flex">
          <div>
            <img alt="" className="w-14" src="/assets/maskati-mark-light.png" />
            <h2 className="mt-6 text-3xl leading-snug" style={{ fontFamily: "var(--font-display)" }}>{t("auth_side_title")}</h2>
          </div>
          <ul className="grid gap-4">
            {perks.map((k, i) => (
              <motion.li animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3" initial={{ opacity: 0, x: 16 }} key={k} transition={{ delay: 0.15 + i * 0.1, duration: 0.6, ease: EASE }}>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/15"><Check className="size-4" /></span>
                <span>{t(k)}</span>
              </motion.li>
            ))}
          </ul>
          <LineLeaves className="pointer-events-none absolute -bottom-6 end-0 w-48 text-mint opacity-40" delay={0.3} />
        </div>
        <div className="p-6 sm:p-10">
          <div className="mb-6 flex items-center gap-3 md:hidden">
            <img alt="" className="w-10" src="/assets/maskati-mark.png" />
            <span className="text-sm text-ink-muted">{t("auth_side_title")}</span>
          </div>
          <AuthForm initial={initial} returnTo={returnTo} />
        </div>
      </div>
    </div>
  );
}
