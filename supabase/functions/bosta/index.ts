// Bosta courier integration.
//   ?action=sync-areas   owner (or anyone while the area table is empty): cache Bosta's cities and districts
//   ?action=create       owner: create the Bosta delivery for an order and move it to "with courier"
//   ?action=refresh      owner: pull the latest Bosta state for an order
//   ?action=webhook      Bosta: state changed. We never trust the payload; we re-read the delivery from Bosta.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BOSTA_KEY = Deno.env.get("BOSTA_API_KEY");
const BOSTA_BASE = Deno.env.get("BOSTA_BASE_URL") || "https://app.bosta.co/api/v2";
const EGYPT_COUNTRY_ID = "60e4482c7cb7d4bc4849c4d5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Bosta state code -> what it means for our order
const BOSTA_STATES: Record<number, string> = {
  10: "Pickup requested", 11: "Waiting for route", 20: "Route assigned", 21: "Picked up from business",
  24: "Received at warehouse", 30: "In transit between hubs", 41: "Out for delivery", 45: "Delivered",
  46: "Returned to business", 47: "Exception", 48: "Terminated", 49: "Cancelled", 60: "Returned to stock",
  100: "Lost", 101: "Damaged", 102: "Investigation", 103: "Awaiting your action", 104: "Archived", 105: "On hold",
};
function targetStatus(code: number, current: string, type: string) {
  if (code === 45 && /send/i.test(type || "SEND")) return current === "confirmed" || current === "with_courier" ? "delivered" : null;
  if (code === 46 || code === 60) return current === "with_courier" || current === "delivered" ? "returned" : null;
  if ([21, 24, 30, 41].includes(code)) return current === "confirmed" ? "with_courier" : null;
  return null;
}

async function bosta(path: string, init: RequestInit = {}) {
  const res = await fetch(BOSTA_BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(BOSTA_KEY ? { Authorization: BOSTA_KEY } : {}), ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.message || `Bosta HTTP ${res.status}`);
  return body.data;
}

async function isAdmin(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const client = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data } = await client.rpc("is_admin");
  return data === true;
}

async function notify(historyId: number) {
  await fetch(`${SUPABASE_URL}/functions/v1/notify-order`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ history_id: historyId }),
  }).catch(() => {});
}

// Apply a Bosta state to our order: store it, move the status when it means something, and note exceptions.
async function applyState(order: Record<string, any>, delivery: Record<string, any>) {
  const code = Number(delivery?.state?.code ?? delivery?.state);
  const label = delivery?.state?.value || BOSTA_STATES[code] || `State ${code}`;
  if (!code) return { changed: false };
  if (order.bosta_state === code) return { changed: false, state: code, label };
  await db.from("orders").update({ bosta_state: code, bosta_state_label: label }).eq("id", order.id);

  const next = targetStatus(code, order.status, delivery?.type?.value || delivery?.type);
  if (next) {
    const { data: historyId, error } = await db.rpc("set_order_status", { p_order: order.id, p_status: next, p_note: `Bosta: ${label}` });
    if (!error && historyId) await notify(historyId);
    return { changed: true, state: code, label, status: next };
  }
  if ([47, 48, 49, 100, 101, 103].includes(code)) {
    const reason = delivery?.exceptionReason ? ` — ${delivery.exceptionReason}` : "";
    await db.from("order_status_history").insert({ order_id: order.id, status: order.status, note: `Bosta: ${label}${reason}`, email_status: "skipped" });
  }
  return { changed: true, state: code, label };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const action = new URL(req.url).searchParams.get("action");
  const body = await req.json().catch(() => ({}));

  try {
    if (action === "webhook") {
      // Bosta posts { trackingNumber, state, ... }. Re-read it from Bosta with our key so a forged call can't change anything.
      const tracking = String(body.trackingNumber || "");
      if (!tracking || !BOSTA_KEY) return json({ ok: true });
      const { data: order } = await db.from("orders").select("*").eq("bosta_tracking_number", tracking).maybeSingle();
      if (!order) return json({ ok: true });
      const delivery = await bosta(`/deliveries/business/${encodeURIComponent(tracking)}`);
      return json({ ok: true, ...(await applyState(order, delivery)) });
    }

    if (action === "sync-areas") {
      const { count } = await db.from("bosta_districts").select("district_id", { count: "exact", head: true });
      if ((count || 0) > 0 && !(await isAdmin(req))) return json({ error: "forbidden" }, 403);
      const cities = await bosta(`/cities/getAllDistricts?countryId=${EGYPT_COUNTRY_ID}`);
      const rows = cities.flatMap((c: any) => (c.districts || []).map((d: any) => ({
        district_id: d.districtId, city_id: c.cityId, city_name: c.cityName, city_name_ar: c.cityOtherName,
        name_en: d.districtName, name_ar: d.districtOtherName, zone_id: d.zoneId, zone_name: d.zoneName,
        dropoff: d.dropOffAvailability !== false && c.dropOffAvailability !== false,
      })));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db.from("bosta_districts").upsert(rows.slice(i, i + 500));
        if (error) throw error;
      }
      return json({ ok: true, cities: cities.length, districts: rows.length });
    }

    if (!(await isAdmin(req))) return json({ error: "forbidden" }, 403);
    const { data: order } = await db.from("orders").select("*").eq("id", body.order_id).single();
    if (!order) return json({ error: "order_not_found" }, 404);
    if (!BOSTA_KEY) return json({ error: "BOSTA_API_KEY is not set. Add it in Supabase → Edge Functions → Secrets." }, 400);

    if (action === "refresh") {
      if (!order.bosta_tracking_number) return json({ error: "This order has no Bosta delivery yet." }, 400);
      const delivery = await bosta(`/deliveries/business/${encodeURIComponent(order.bosta_tracking_number)}`);
      return json({ ok: true, ...(await applyState(order, delivery)) });
    }

    if (action === "create") {
      if (order.bosta_tracking_number) return json({ error: `Already sent to Bosta (tracking ${order.bosta_tracking_number}).` }, 400);
      if (order.status !== "confirmed") return json({ error: `Only confirmed orders can be sent to Bosta (this one is ${order.status}).` }, 400);
      const [{ data: items }, { data: gov }, { data: settings }] = await Promise.all([
        db.from("order_items").select("name,quantity").eq("order_id", order.id),
        db.from("shipping_zones").select("bosta_city_id,name_en").eq("id", order.shipping_zone_id).single(),
        db.from("site_settings").select("value").eq("key", "bosta").maybeSingle(),
      ]);
      const district = order.district_id
        ? (await db.from("bosta_districts").select("*").eq("district_id", order.district_id).maybeSingle()).data
        : null;
      if (!district) return json({ error: "This order has no Bosta district. Edit the address and choose a district first." }, 400);
      const cfg = (settings?.value || {}) as Record<string, any>;
      const nameParts = String(order.customer_name).trim().split(/\s+/);
      const phone = String(order.phone).replace(/^\+?20/, "0");
      const cod = order.payment_method === "cod" && order.payment_status !== "paid" ? Number(order.total) : 0;
      const payload = {
        type: 10,
        specs: {
          packageType: "Parcel",
          size: cfg.package_size || "SMALL",
          packageDetails: {
            itemsCount: (items || []).reduce((s: number, i: any) => s + i.quantity, 0),
            description: (items || []).map((i: any) => `${i.name.split(" / ").pop()} x${i.quantity}`).join(", ").slice(0, 200),
          },
        },
        notes: order.notes || undefined,
        cod,
        dropOffAddress: {
          city: district.city_name || gov?.name_en,
          districtId: district.district_id,
          zoneId: district.zone_id || undefined,
          firstLine: order.address,
        },
        receiver: {
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(" ") || nameParts[0],
          phone,
          ...(order.email ? { email: order.email } : {}),
        },
        businessReference: String(order.order_number),
        uniqueBusinessReference: order.id,
        allowToOpenPackage: false,
        webhookUrl: `${SUPABASE_URL}/functions/v1/bosta?action=webhook`,
        ...(cfg.business_location_id ? { businessLocationId: cfg.business_location_id } : {}),
      };
      let delivery;
      try {
        delivery = await bosta("/deliveries?apiVersion=1", { method: "POST", body: JSON.stringify(payload) });
      } catch (e) {
        await db.from("orders").update({ bosta_error: String((e as Error).message).slice(0, 500) }).eq("id", order.id);
        throw e;
      }
      await db.from("orders").update({
        bosta_delivery_id: delivery._id, bosta_tracking_number: String(delivery.trackingNumber),
        bosta_state: delivery?.state?.code ?? 10, bosta_state_label: delivery?.state?.value || "Pickup requested", bosta_error: null,
      }).eq("id", order.id);
      const { data: historyId, error } = await db.rpc("set_order_status", {
        p_order: order.id, p_status: "with_courier", p_note: `Sent to Bosta · tracking ${delivery.trackingNumber}`,
      });
      if (error) throw error;
      await notify(historyId);
      return json({ ok: true, tracking_number: String(delivery.trackingNumber), history_id: historyId });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
