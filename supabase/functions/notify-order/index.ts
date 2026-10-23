// Sends the order email for one status-history entry through Resend and records the result on that entry.
// Callers: the shop (customer, right after placing an order), the dashboard (owner), and the bosta function (server).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const arDigits = (s: string) => s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
const money = (n: number, lang: string) => {
  const v = Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return lang === "ar" ? `${arDigits(v)} ج.م` : `EGP ${v}`;
};

type Order = Record<string, any>;

function fill(text: string, order: Order, items: Order[], lang: string, status: string) {
  const ar = lang === "ar";
  const first = String(order.customer_name || "").trim().split(/\s+/)[0] || (ar ? "حبيبتي" : "there");
  const itemLines = items.map((i) => `• ${ar ? i.name.split(" / ")[0] : i.name.split(" / ").pop()} × ${i.quantity}`).join("\n");
  const tracking = order.bosta_tracking_number
    ? (ar ? `رقم التتبع: ${order.bosta_tracking_number}` : `Tracking number: ${order.bosta_tracking_number}`) +
      `\nhttps://bosta.co/tracking-shipments?shipment-number=${order.bosta_tracking_number}`
    : "";
  const cashDue = order.payment_method === "cod" && order.payment_status !== "paid" && ["confirmed", "with_courier"].includes(status);
  const paymentNote = cashDue
    ? (ar ? `ادفعي ${money(order.total, lang)} كاش للمندوب عند الاستلام.` : `Please pay ${money(order.total, lang)} in cash to the courier.`)
    : "";
  return text
    .replaceAll("{name}", first)
    .replaceAll("{order}", "#" + order.order_number)
    .replaceAll("{total}", money(order.total, lang))
    .replaceAll("{items}", itemLines)
    .replaceAll("{tracking}", tracking)
    .replaceAll("{payment_note}", paymentNote)
    .replace(/\n{3,}/g, "\n\n");
}

async function send(to: string, subject: string, text: string) {
  if (!RESEND_KEY) return { email_status: "no_key", error: "RESEND_API_KEY is not set" };
  const { data: fromRow } = await admin.from("site_settings").select("value").eq("key", "email_from").maybeSingle();
  const from = (fromRow?.value as string) || "Maskati <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (res.ok) return { email_status: "sent", error: null };
  const body = await res.text();
  // Resend refuses unverified sending domains (and, on the test domain, any address but the account owner's)
  if (res.status === 403 || /domain|verify|testing emails/i.test(body)) return { email_status: "verify_domain", error: body.slice(0, 500) };
  return { email_status: "failed", error: body.slice(0, 500) };
}

async function callerIsAdmin(token: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data } = await client.rpc("is_admin");
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const isServer = token === SERVICE_KEY;
  const body = await req.json().catch(() => ({}));

  // Owner's "Send test" on the Emails page
  if (body.test) {
    if (!isServer && !(await callerIsAdmin(token))) return json({ error: "forbidden" }, 403);
    const { status, lang, to } = body.test;
    const { data: tpl } = await admin.from("email_templates").select("*").eq("status", status).single();
    if (!tpl || !to) return json({ error: "bad_request" }, 400);
    const sample = { customer_name: lang === "ar" ? "نور أحمد" : "Nour Ahmed", order_number: 1234, total: 1026, payment_method: "cod",
      payment_status: "unpaid", bosta_tracking_number: status === "with_courier" ? "12345678" : null };
    const items = [{ name: "ماسك البامية / Okra Mask", quantity: 2 }];
    const subject = "[TEST] " + fill(lang === "ar" ? tpl.subject_ar : tpl.subject_en, sample, items, lang, status);
    const text = fill(lang === "ar" ? tpl.body_ar : tpl.body_en, sample, items, lang, status);
    return json(await send(to, subject, text));
  }

  const historyId = Number(body.history_id);
  if (!historyId) return json({ error: "history_id required" }, 400);
  const { data: entry } = await admin.from("order_status_history").select("*").eq("id", historyId).single();
  if (!entry) return json({ error: "not_found" }, 404);
  const { data: order } = await admin.from("orders").select("*").eq("id", entry.order_id).single();
  if (!order) return json({ error: "not_found" }, 404);

  if (!isServer) {
    let allowed = await callerIsAdmin(token);
    if (!allowed) {
      // a customer may trigger only the "confirmed" email of her own new order, once
      const { data: { user } } = await admin.auth.getUser(token);
      allowed = !!user && user.id === order.user_id && entry.status === "confirmed" && entry.email_status === "pending";
    }
    if (!allowed) return json({ error: "forbidden" }, 403);
  }
  if (entry.email_status === "sent" && !body.resend) return json({ email_status: "sent", error: null });

  let result: { email_status: string; error: string | null };
  if (!order.email) {
    result = { email_status: "no_address", error: null };
  } else {
    const { data: tpl } = await admin.from("email_templates").select("*").eq("status", entry.status).single();
    const { data: items } = await admin.from("order_items").select("name,quantity").eq("order_id", order.id);
    const lang = order.lang === "en" ? "en" : "ar";
    result = tpl
      ? await send(order.email,
          fill(lang === "ar" ? tpl.subject_ar : tpl.subject_en, order, items || [], lang, entry.status),
          fill(lang === "ar" ? tpl.body_ar : tpl.body_en, order, items || [], lang, entry.status))
      : { email_status: "skipped", error: "no template" };
  }
  await admin.from("order_status_history").update({ email_status: result.email_status, email_error: result.error }).eq("id", historyId);
  return json(result);
});
