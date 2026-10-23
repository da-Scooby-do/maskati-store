"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { ContinuousTabs } from "@/components/continuous-tabs";
import { EASE } from "@/components/motion";
import { useShop } from "@/components/shop-provider";
import { db } from "@/lib/supabase";

type Mode = "signin" | "create" | "reset";

/** Sign in, create an account, or ask for a password reset. `returnTo` is where the email link brings her back. */
export function AuthForm({ returnTo = "/account", initial = "signin" }: { returnTo?: string; initial?: Mode }) {
  const { t } = useShop();
  const [mode, setMode] = useState<Mode>(initial);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const v = (n: string) => ((f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "").trim();
    const email = v("email");
    setBusy(true); setMsg({ text: t("loading") });
    if (mode === "reset") {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/account" });
      setBusy(false); setMsg(error ? { text: error.message, error: true } : { text: t("reset_sent", email) }); return;
    }
    const password = (f.elements.namedItem("password") as HTMLInputElement).value;
    const { data: res, error } = mode === "create"
      ? await db.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + returnTo, data: { full_name: v("name"), phone: v("phone") } } })
      : await db.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      const m = error.message;
      setMsg({ error: true, text: /invalid login/i.test(m) ? t("err_login") : /not confirmed/i.test(m) ? t("err_confirm") : /already registered/i.test(m) ? t("err_exists") : m });
      return;
    }
    if (mode === "create" && !res.session) { setMsg({ text: t("check_email", email) }); return; }
    setMsg(null);
  };

  return (
    <div className="grid gap-6" style={{ maxWidth: 480 }}>
      {mode !== "reset" ? (
        <ContinuousTabs activeId={mode} layoutId="auth-tabs" onChange={(id) => { setMode(id as Mode); setMsg(null); }} tabs={[{ id: "signin", label: t("sign_in") }, { id: "create", label: t("create_account") }]} />
      ) : null}
      <AnimatePresence mode="wait">
        <motion.p animate={{ opacity: 1, y: 0 }} className="lede" exit={{ opacity: 0, y: -6 }} initial={{ opacity: 0, y: 6 }} key={mode} style={{ margin: 0 }} transition={{ duration: 0.35, ease: EASE }}>
          {mode === "create" ? t("create_account_text") : mode === "reset" ? t("reset_text") : t("sign_in_text")}
        </motion.p>
      </AnimatePresence>
      <form className="form-grid" onSubmit={onSubmit}>
        <AnimatePresence initial={false}>
          {mode === "create" ? (
            <motion.div animate={{ height: "auto", opacity: 1 }} className="form-grid overflow-hidden" exit={{ height: 0, opacity: 0 }} initial={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
              <div className="field"><label htmlFor="a-name">{t("full_name")}</label><input autoComplete="name" className="input" id="a-name" maxLength={80} name="name" required /></div>
              <div className="field"><label htmlFor="a-phone">{t("phone")}</label><input autoComplete="tel" className="input" dir="ltr" id="a-phone" name="phone" placeholder="01xxxxxxxxx" type="tel" /></div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="field"><label htmlFor="a-email">{t("email")}</label><input autoComplete="email" className="input" dir="ltr" id="a-email" name="email" required type="email" /></div>
        {mode !== "reset" ? (
          <div className="field">
            <label htmlFor="a-pass">{t("password")}</label>
            <input autoComplete={mode === "create" ? "new-password" : "current-password"} className="input" dir="ltr" id="a-pass" minLength={mode === "create" ? 8 : 1} name="password" required type="password" />
            {mode === "create" ? <span className="body-sm muted">{t("password_hint")}</span> : null}
          </div>
        ) : null}
        <motion.button className="btn btn-primary btn-block" disabled={busy} type="submit" whileTap={{ scale: 0.98 }}>
          {mode === "create" ? t("create_account") : mode === "reset" ? t("send_reset") : t("sign_in")}
        </motion.button>
        <AnimatePresence>
          {msg ? <motion.p animate={{ opacity: 1 }} className="body-sm" exit={{ opacity: 0 }} initial={{ opacity: 0 }} role="status" style={{ margin: 0, color: msg.error ? "var(--danger)" : undefined }}>{msg.text}</motion.p> : null}
        </AnimatePresence>
        <p className="center body-sm" style={{ margin: 0 }}>
          {mode === "reset"
            ? <button className="underline" onClick={() => setMode("signin")} type="button">{t("sign_in")}</button>
            : <button className="underline" onClick={() => setMode("reset")} type="button">{t("forgot_password")}</button>}
        </p>
      </form>
    </div>
  );
}
