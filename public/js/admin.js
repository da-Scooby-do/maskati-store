(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "EGP " + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const date = (d) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const STATUSES = ["confirmed", "with_courier", "delivered", "cancelled", "returned"];
  const STATUS_LABEL = { confirmed: "Confirmed", with_courier: "With courier", delivered: "Delivered", cancelled: "Cancelled", returned: "Returned" };
  // which later steps each status may move to (orders only move forward)
  const NEXT = { confirmed: ["with_courier", "delivered", "cancelled"], with_courier: ["delivered", "cancelled", "returned"], delivered: ["returned"], cancelled: [], returned: [] };
  const PAY = { cod: "Cash on delivery", instapay: "InstaPay", vodafone_cash: "Vodafone Cash", paid: "Already paid" };
  const EMAIL_LABEL = { pending: "Sending…", sent: "Email sent", failed: "Email failed", no_key: "No email key", verify_domain: "Verify domain", no_address: "No email address", skipped: "No email" };
  const SECTION_NAMES = {
    hero: ["Hero", "Headline, text and Shop now"], bestsellers: ["Best sellers", "Products marked best seller"],
    consult: ["Hair consultation", "Dry / damaged / after colour quiz"], bundles: ["Routines", "Every visible routine"],
    story: ["Our story", "Brand story and pillars"], reviews: ["Reviews", "Latest approved reviews"],
    faq: ["FAQ", "Visible questions"], community: ["Community", "Social links"],
    needs: ["Shop by hair", "Dry / damaged / after colour cards"], ingredients: ["Our ingredients", "The secret of our ingredients"]
  };

  let toastTimer;
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 3200); };
  const fail = (error) => { if (error) { toast("Could not save: " + error.message); return true; } return false; };
  const toggle = (attrs, checked, label = "") => `<label class="toggle"><input type="checkbox" ${attrs} ${checked ? "checked" : ""}><span class="track"></span>${label}</label>`;
  const pill = (status) => `<span class="pill ${status}">${STATUS_LABEL[status] || status}</span>`;
  const itemName = (n) => String(n).split(" / ").pop();

  // ---------- auth ----------
  async function boot() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return showLogin();
    const { data: isAdmin } = await db.rpc("is_admin");
    // customers go to their own account page
    if (!isAdmin) { location.replace("/#/account"); return; }
    showShell(session.user.email);
  }
  function showLogin(msg = "", mode = "signin") {
    const creating = mode === "create";
    document.body.innerHTML = `<div class="login"><form class="login-card" id="login-form">
      <img src="/assets/maskati-lockup.png" alt="Maskati">
      <h1 style="font-size:26px">${creating ? "Create owner account" : "Owner dashboard"}</h1>
      ${msg ? `<p style="color:var(--danger);margin:0">${esc(msg)}</p>` : ""}
      ${creating ? `<p class="muted" style="margin:0">Use the owner email. Any other email becomes a customer account, which can't open the dashboard.</p>` : ""}
      <label class="field"><span>Email</span><input class="input" id="email" type="email" required autocomplete="username"></label>
      <label class="field"><span>Password</span><input class="input" id="password" type="password" required minlength="${creating ? 8 : 1}" autocomplete="${creating ? "new-password" : "current-password"}"></label>
      ${creating ? `<label class="field"><span>Repeat password</span><input class="input" id="password2" type="password" required minlength="8" autocomplete="new-password"></label>` : ""}
      <button class="btn btn-primary" type="submit">${creating ? "Create account" : "Sign in"}</button>
      <button class="btn btn-secondary" type="button" id="switch-mode">${creating ? "I already have an account" : "Create owner account"}</button>
      <p id="login-msg" class="muted" style="margin:0" aria-live="polite"></p>
      <a href="/">← Back to the shop</a>
    </form><div class="toast" id="toast"></div></div>`;
    $("#switch-mode").onclick = () => showLogin("", creating ? "signin" : "create");
    $("#login-form").onsubmit = async (e) => {
      e.preventDefault();
      const msgEl = $("#login-msg");
      const email = $("#email").value.trim(), password = $("#password").value;
      if (creating) {
        if (password !== $("#password2").value) { msgEl.textContent = "The two passwords are not the same."; return; }
        msgEl.textContent = "Creating your account...";
        const { data, error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + "/admin" } });
        if (error) { msgEl.textContent = error.message; return; }
        if (data.session) return boot();
        msgEl.textContent = `Account created. Open the email sent to ${email}, click the confirmation link, then sign in here.`;
        return;
      }
      msgEl.textContent = "Signing in...";
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) { msgEl.textContent = /not confirmed/i.test(error.message) ? "Confirm your email first: click the link Supabase sent you, then sign in." : error.message; return; }
      boot();
    };
  }

  // ---------- shell ----------
  const NAV = [
    ["Overview", [["overview", "Overview"]]],
    ["Sales", [["orders", "Orders"], ["customers", "Customers"], ["promos", "Promo codes"], ["subscribers", "Subscribers"]]],
    ["Catalogue", [["products", "Products"], ["bundles", "Routines"], ["reviews", "Reviews"]]],
    ["Website", [["home", "Home page"], ["announcement", "Announcement bar"], ["sitetext", "Site text"], ["faq", "Q&A"], ["social", "Contact & social"]]],
    ["Store", [["delivery", "Delivery & Bosta"], ["emails", "Emails"]]]
  ];
  function showShell(email) {
    document.body.innerHTML = `<div class="shell">
      <nav class="sidebar" id="sidebar" aria-label="Dashboard">
        <a class="brand" href="#/overview"><img src="/assets/maskati-lockup-light.png" alt="Maskati"></a>
        ${NAV.map(([g, items]) => `<div class="group">${g}</div>${items.map(([id, name]) => `<a href="#/${id}" data-id="${id}">${name}${id === "orders" ? `<span class="badge" id="pending-badge" hidden></span>` : ""}${id === "reviews" ? `<span class="badge" id="review-badge" hidden></span>` : ""}</a>`).join("")}`).join("")}
      </nav>
      <div>
        <div class="topbar">
          <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
          <span class="muted">${esc(email)}</span><span class="spacer"></span>
          <a class="btn btn-secondary btn-sm" href="/" target="_blank">View site</a>
          <button class="btn btn-secondary btn-sm" id="signout">Sign out</button>
        </div>
        <main class="content" id="content"></main>
      </div>
    </div><dialog id="modal"></dialog><div class="toast" id="toast" role="status"></div>`;
    $("#signout").onclick = async () => { await db.auth.signOut(); location.hash = ""; showLogin(); };
    $("#menu-toggle").onclick = () => $("#sidebar").classList.toggle("open");
    window.onhashchange = route;
    refreshBadges();
    route();
  }
  async function refreshBadges() {
    const [{ count: p }, { count: r }] = await Promise.all([
      db.from("orders").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
      db.from("reviews").select("id", { count: "exact", head: true }).eq("is_approved", false)
    ]);
    const pb = $("#pending-badge"), rb = $("#review-badge");
    if (pb) { pb.textContent = p; pb.hidden = !p; }
    if (rb) { rb.textContent = r; rb.hidden = !r; }
  }
  function route() {
    const id = (location.hash.replace(/^#\/?/, "") || "overview").split(/[/?]/)[0];
    $$("#sidebar a[data-id]").forEach((a) => a.dataset.id === id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    $("#sidebar").classList.remove("open");
    const page = PAGES[id] || PAGES.overview;
    $("#content").innerHTML = `<p class="muted">Loading...</p>`;
    page().catch((e) => { $("#content").innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`; });
  }
  const head = (title, action = "") => `<div class="page-head"><h1>${title}</h1><div class="actions">${action}</div></div>`;
  const panel = (title, desc, body, actions = "") => `<section class="panel"><div class="panel-head"><div><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ""}</div><div class="actions">${actions}</div></div>${body}</section>`;
  function openModal(html) { const m = $("#modal"); m.innerHTML = html; m.showModal(); $$("[data-close]", m).forEach((b) => b.addEventListener("click", () => m.close())); return m; }
  const modalHead = (title) => `<div class="modal-head"><h2>${title}</h2><button class="icon-btn" type="button" data-close aria-label="Close">✕</button></div>`;
  async function getSetting(key) { const { data } = await db.from("site_settings").select("value").eq("key", key).maybeSingle(); return data?.value; }
  async function setSetting(key, value) { const { error } = await db.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }); return error; }
  function download(name, text, type = "text/csv") {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + text], { type })); a.download = name; a.click();
  }
  const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  function parseCsv(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
  }

  // ---------- order actions shared by the list, bulk actions and the detail view ----------
  async function sendEmail(historyId) {
    const { data, error } = await db.functions.invoke("notify-order", { body: { history_id: historyId } });
    return error ? { email_status: "failed", error: error.message } : data;
  }
  async function moveOrder(order, status, note) {
    const { data: historyId, error } = await db.rpc("set_order_status", { p_order: order.id, p_status: status, p_note: note || null });
    if (error) throw new Error(/cannot_move/.test(error.message) ? `#${order.order_number} can't move from ${STATUS_LABEL[order.status]} to ${STATUS_LABEL[status]}.` : error.message);
    const mail = await sendEmail(historyId);
    return mail;
  }
  async function sendToBosta(order) {
    const { data, error } = await db.functions.invoke("bosta?action=create", { body: { order_id: order.id } });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    return data;
  }
  const bostaFetch = async (action, orderId) => {
    const { data, error } = await db.functions.invoke(`bosta?action=${action}`, { body: { order_id: orderId } });
    if (error) { let msg = error.message; try { msg = (await error.context.json()).error || msg; } catch {} throw new Error(msg); }
    return data;
  };
  const itemsSummary = (o) => (o.order_items || []).map((i) => `${itemName(i.name)} × ${i.quantity}`).join(" · ");
  const orderRow = (o, selectable) => `<tr class="clickable" data-order="${o.id}">
    ${selectable ? `<td onclick="event.stopPropagation()"><input type="checkbox" data-pick="${o.id}" aria-label="Select #${o.order_number}"></td>` : ""}
    <td><strong>#${o.order_number}</strong>${o.source !== "website" ? `<div class="muted">${esc(o.source)}</div>` : ""}</td>
    <td>${esc(o.customer_name)}<div class="muted">${esc(o.phone)}</div></td>
    <td>${esc(o.governorate)}${o.district_name ? `<div class="muted">${esc(o.district_name)}</div>` : ""}</td>
    <td class="muted" style="max-width:220px">${esc(itemsSummary(o))}</td>
    <td>${PAY[o.payment_method] || o.payment_method}${o.payment_method !== "cod" ? `<div><span class="pill ${o.payment_status === "paid" ? "delivered" : "confirmed"}">${o.payment_status}</span></div>` : ""}</td>
    <td>${pill(o.status)}${o.bosta_tracking_number ? `<div class="muted">Bosta ${esc(o.bosta_tracking_number)}</div>` : ""}</td>
    <td class="num">${money(o.total)}</td><td class="muted">${date(o.created_at)}</td></tr>`;
  const ordersTable = (list, selectable = false) => list.length ? `<div class="table-wrap"><table><thead><tr>
    ${selectable ? `<th><input type="checkbox" id="pick-all" aria-label="Select all"></th>` : ""}
    <th>Order</th><th>Customer</th><th>Area</th><th>Items</th><th>Payment</th><th>Status</th><th class="num">Total</th><th>Placed</th></tr></thead>
    <tbody>${list.map((o) => orderRow(o, selectable)).join("")}</tbody></table></div>` : `<p class="empty">No orders here.</p>`;
  function bindOrderRows(onChange) { $$("[data-order]").forEach((tr) => tr.onclick = () => showOrder(tr.dataset.order, onChange)); }
  const ORDER_SELECT = "*, order_items(name,quantity,unit_price,line_total,product_id,bundle_id)";

  async function showOrder(id, onChange) {
    const [{ data: o }, { data: history }] = await Promise.all([
      db.from("orders").select(ORDER_SELECT).eq("id", id).single(),
      db.from("order_status_history").select("*").eq("order_id", id).order("created_at")
    ]);
    // WhatsApp goes to the customer's WhatsApp number (any country), else her Egyptian mobile
    const intl = o.whatsapp ? o.whatsapp.replace(/[^\d]/g, "") : o.phone.replace(/^\+?20/, "0").replace(/^0/, "20");
    const nexts = NEXT[o.status];
    const m = openModal(`${modalHead("Order #" + o.order_number)}<div class="modal-body form">
      <div class="actions" style="justify-content:flex-start">${pill(o.status)}
        ${o.payment_method !== "cod" ? `<span class="pill ${o.payment_status === "paid" ? "delivered" : "confirmed"}">${o.payment_status}</span>` : ""}
        <a class="btn btn-secondary btn-sm" href="https://wa.me/${esc(intl)}?text=${encodeURIComponent(`Maskati order #${o.order_number}`)}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn btn-secondary btn-sm" href="tel:${esc(o.phone)}">Call</a></div>
      <dl class="kv">
        <dt>Customer</dt><dd>${esc(o.customer_name)}${o.user_id ? "" : ` <span class="muted">(no account)</span>`}</dd>
        <dt>Mobile</dt><dd dir="ltr" style="text-align:start">${esc(o.phone)}</dd>
        ${o.whatsapp ? `<dt>WhatsApp</dt><dd dir="ltr" style="text-align:start">${esc(o.whatsapp)}</dd>` : ""}
        ${o.email ? `<dt>Email</dt><dd>${esc(o.email)}</dd>` : ""}
        <dt>Address</dt><dd>${esc(o.governorate)}${o.district_name ? " · " + esc(o.district_name) : ""}<br>${esc(o.address)}</dd>
        ${o.notes ? `<dt>Customer notes</dt><dd>${esc(o.notes)}</dd>` : ""}
        <dt>Payment</dt><dd>${PAY[o.payment_method]}${o.paid_at ? ` · paid ${date(o.paid_at)}` : ""}</dd>
        ${o.promo_code ? `<dt>Promo</dt><dd>${esc(o.promo_code)}</dd>` : ""}
        <dt>Placed</dt><dd>${date(o.created_at)} · ${esc(o.source)} · ${o.lang === "ar" ? "Arabic" : "English"}</dd>
      </dl>
      <div class="table-wrap"><table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead><tbody>
        ${o.order_items.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${i.quantity}</td><td class="num">${money(i.unit_price)}</td><td class="num">${money(i.line_total)}</td></tr>`).join("")}
        <tr><td colspan="3">Subtotal</td><td class="num">${money(o.subtotal)}</td></tr>
        ${Number(o.discount) ? `<tr><td colspan="3">Discount</td><td class="num">− ${money(o.discount)}</td></tr>` : ""}
        <tr><td colspan="3">Delivery</td><td class="num">${money(o.shipping_fee)}</td></tr>
        <tr><td colspan="3"><strong>Total</strong></td><td class="num"><strong>${money(o.total)}</strong></td></tr>
      </tbody></table></div>

      <section class="panel" style="margin:0"><div class="panel-head"><div><h2>Bosta</h2>
        <p>${o.bosta_tracking_number ? `Tracking <a href="https://bosta.co/tracking-shipments?shipment-number=${esc(o.bosta_tracking_number)}" target="_blank" rel="noopener">${esc(o.bosta_tracking_number)}</a> · ${esc(o.bosta_state_label || "")}`
          : o.status !== "confirmed" ? "Not sent to Bosta."
          : o.payment_method !== "cod" && o.payment_status !== "paid" ? "Goes to Bosta automatically once you mark it paid."
          : o.bosta_next_try ? `Sending to Bosta automatically · try ${o.bosta_attempts + 1} at ${new Date(o.bosta_next_try).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`
          : o.bosta_error ? "Automatic sending stopped. Fix the problem below, then press Send to Bosta."
          : "Sending to Bosta automatically…"}</p>
        ${o.bosta_error ? `<p style="color:var(--danger)">Last error: ${esc(o.bosta_error)}</p>` : ""}</div>
        <div class="actions">${o.bosta_tracking_number ? `<button class="btn btn-secondary btn-sm" id="b-refresh">Refresh status</button>`
          : o.status === "confirmed" ? `<button class="btn btn-primary btn-sm" id="b-send">Send to Bosta</button>` : ""}</div></div></section>

      ${nexts.length ? `<div class="field"><span>Move order</span><div class="actions" style="justify-content:flex-start">
        ${nexts.map((s) => `<button class="btn ${s === "cancelled" || s === "returned" ? "btn-danger" : "btn-secondary"} btn-sm" data-move="${s}">${STATUS_LABEL[s]}</button>`).join("")}
      </div><span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">Each move saves a history entry and emails the customer. Cancelled and Returned put the stock back.</span></div>` : ""}
      ${o.payment_method !== "cod" && o.payment_status !== "paid" ? `<div><button class="btn btn-secondary btn-sm" id="mark-paid">Mark as paid</button> <span class="muted">Check the transfer screenshot first.</span></div>` : ""}

      <label class="field"><span>Private notes</span><textarea class="input" id="o-notes">${esc(o.admin_notes || "")}</textarea></label>
      <div><button class="btn btn-secondary btn-sm" id="save-notes">Save notes</button></div>

      <div class="field"><span>History</span>
        <div class="table-wrap"><table><tbody>${history.map((h) => `<tr><td class="muted">${date(h.created_at)}</td><td>${pill(h.status)}</td>
          <td>${esc(h.note || "")}</td><td>${h.email_status ? `<span class="muted" title="${esc(h.email_error || "")}">${EMAIL_LABEL[h.email_status] || h.email_status}</span>` : ""}
          ${["failed", "no_key", "verify_domain", "pending"].includes(h.email_status) ? ` <button class="btn btn-secondary btn-sm" data-resend="${h.id}">Resend</button>` : ""}</td></tr>`).join("")}</tbody></table></div></div>
    </div>`);
    const reload = () => { m.close(); onChange?.(); showOrder(id, onChange); refreshBadges(); };
    $$("[data-move]", m).forEach((b) => b.onclick = async () => {
      const s = b.dataset.move;
      if ((s === "cancelled" || s === "returned") && !confirm(`Mark order #${o.order_number} as ${STATUS_LABEL[s]}? Its stock goes back.`)) return;
      b.disabled = true;
      try { const mail = await moveOrder(o, s); toast(`Saved. #${o.order_number} is ${STATUS_LABEL[s]} · ${EMAIL_LABEL[mail?.email_status] || "email not sent"}.`); reload(); }
      catch (e) { toast(e.message); b.disabled = false; }
    });
    $("#b-send", m)?.addEventListener("click", async (e) => {
      e.target.disabled = true; e.target.textContent = "Sending…";
      try { const r = await sendToBosta(o); toast(`Sent to Bosta. Tracking ${r.tracking_number}.`); reload(); }
      catch (err) { toast("Bosta: " + err.message); reload(); }
    });
    $("#b-refresh", m)?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      try { const r = await bostaFetch("refresh", o.id); toast(r.changed ? `Bosta: ${r.label}` : "No change from Bosta."); reload(); }
      catch (err) { toast("Bosta: " + err.message); e.target.disabled = false; }
    });
    $("#mark-paid", m)?.addEventListener("click", async () => {
      if (!fail((await db.from("orders").update({ payment_status: "paid", paid_at: new Date().toISOString() }).eq("id", o.id)).error)) { toast(`Saved. #${o.order_number} is paid.`); reload(); }
    });
    $("#save-notes", m).onclick = async () => { if (!fail((await db.from("orders").update({ admin_notes: $("#o-notes", m).value.trim() || null }).eq("id", o.id)).error)) toast("Notes saved."); };
    $$("[data-resend]", m).forEach((b) => b.onclick = async () => {
      b.disabled = true; const r = await sendEmail(Number(b.dataset.resend)); toast(EMAIL_LABEL[r?.email_status] || "Done"); reload();
    });
  }

  // ---------- new order (WhatsApp / Instagram / phone) ----------
  async function newOrder(onDone) {
    const [{ data: zones }, { data: dzones }, { data: products }, { data: bundles }] = await Promise.all([
      db.from("shipping_zones").select("*").order("sort_order"), db.from("delivery_zones").select("*"),
      db.from("products").select("id,name_en,price,stock").order("sort_order"), db.from("bundles").select("id,name_en,price").order("sort_order")
    ]);
    const options = [...products.map((p) => `<option value="product|${p.id}">${esc(p.name_en)} · ${money(p.price)} · stock ${p.stock}</option>`),
      ...bundles.map((b) => `<option value="bundle|${b.id}">${esc(b.name_en)} (routine) · ${money(b.price)}</option>`)].join("");
    const line = () => `<div class="row" style="grid-template-columns:1fr 90px 40px;display:grid;gap:8px" data-line><select class="input" data-item>${options}</select><input class="input" type="number" min="1" value="1" data-qty><button type="button" class="icon-btn" data-rm aria-label="Remove">✕</button></div>`;
    const m = openModal(`${modalHead("New order")}<form class="modal-body form" id="no-form">
      <p class="muted" style="margin:0">For orders taken on WhatsApp, Instagram or the phone. Prices come from the catalogue, stock is reduced, and the order starts as Confirmed.</p>
      <div class="row two"><label class="field"><span>Customer name</span><input class="input" name="customer_name" required></label>
        <label class="field"><span>Mobile</span><input class="input" name="phone" required dir="ltr"></label></div>
      <div class="row two"><label class="field"><span>Email (optional, for status emails)</span><input class="input" type="email" name="email" dir="ltr"></label>
        <label class="field"><span>Came from</span><select class="input" name="source"><option>whatsapp</option><option>instagram</option><option>phone</option><option>other</option></select></label></div>
      <div class="row two"><label class="field"><span>Governorate</span><select class="input" name="shipping_zone_id" id="no-zone" required><option value="">Choose</option>${zones.map((z) => `<option value="${z.id}">${esc(z.name_en)}</option>`).join("")}</select></label>
        <label class="field"><span>Area (Bosta district)</span><select class="input" name="district_id" id="no-district"><option value="">Choose a governorate first</option></select></label></div>
      <label class="field"><span>Address</span><textarea class="input" name="address" required></textarea></label>
      <div class="field"><span>Items</span><div class="form" id="no-lines">${line()}</div><button type="button" class="btn btn-secondary btn-sm" id="no-add" style="justify-self:start">Add item</button></div>
      <div class="row three"><label class="field"><span>Delivery fee (EGP)</span><input class="input" type="number" min="0" name="shipping_fee" id="no-fee" value="0"></label>
        <label class="field"><span>Discount (EGP)</span><input class="input" type="number" min="0" name="discount" value="0"></label>
        <label class="field"><span>Payment</span><select class="input" name="payment_method"><option value="cod">Cash on delivery</option><option value="instapay">InstaPay</option><option value="paid">Already paid</option></select></label></div>
      <label class="field"><span>Notes</span><input class="input" name="notes"></label>
      <p id="no-msg" style="color:var(--danger);margin:0"></p>
      <div class="actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Save order</button></div></form>`);
    const bindLines = () => $$("[data-rm]", m).forEach((b) => b.onclick = () => { if ($$("[data-line]", m).length > 1) b.closest("[data-line]").remove(); });
    bindLines();
    $("#no-add", m).onclick = () => { $("#no-lines", m).insertAdjacentHTML("beforeend", line()); bindLines(); };
    $("#no-zone", m).onchange = async (e) => {
      const z = zones.find((x) => String(x.id) === e.target.value);
      const dz = dzones.find((d) => d.id === z?.delivery_zone_id);
      $("#no-fee", m).value = dz ? dz.fee : 0;
      const { data: ds } = z?.bosta_city_id ? await db.from("bosta_districts").select("district_id,name_en").eq("city_id", z.bosta_city_id).eq("dropoff", true).order("name_en") : { data: [] };
      $("#no-district", m).innerHTML = `<option value="">Choose</option>` + (ds || []).map((d) => `<option value="${esc(d.district_id)}">${esc(d.name_en)}</option>`).join("");
    };
    $("#no-form", m).onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      f.items = $$("[data-line]", m).map((l) => { const [type, id] = $("[data-item]", l).value.split("|"); return { type, id, quantity: Number($("[data-qty]", l).value) || 1 }; });
      if (f.payment_method === "paid") f.payment_method = "paid";
      const { data, error } = await db.rpc("admin_create_order", { payload: f });
      if (error) { $("#no-msg", m).textContent = /item_unavailable/.test(error.message) ? "Not enough stock for one of the items." : error.message; return; }
      if (f.payment_method === "paid") await db.from("orders").update({ payment_status: "paid", paid_at: new Date().toISOString() }).eq("id", data.order_id);
      if (f.email) await sendEmail(data.history_id);
      m.close(); toast(`Saved. Order #${data.order_number} · ${money(data.total)}.`); refreshBadges(); onDone?.();
    };
  }

  // ---------- CSV import ----------
  function importCsv(onDone) {
    const m = openModal(`${modalHead("Import orders from CSV")}<div class="modal-body form">
      <p class="muted" style="margin:0">One order per row, first row is the header. Columns:</p>
      <code style="font-size:12px;white-space:normal">customer_name, phone, email, governorate, district, address, items, delivery_fee, discount, payment_method, source, notes</code>
      <p class="muted" style="margin:0"><strong>items</strong>: product or routine names with quantities, e.g. <code>Okra Mask x2; Dew Touch x1</code>. <strong>governorate</strong>: English or Arabic name. <strong>district</strong> is optional. Each row follows the same rules as New order and reduces stock.</p>
      <button class="btn btn-secondary btn-sm" type="button" id="csv-template" style="justify-self:start">Download template</button>
      <input type="file" accept=".csv,text/csv" id="csv-file">
      <div id="csv-result"></div>
      <div class="actions"><button type="button" class="btn btn-secondary" data-close>Close</button></div></div>`);
    $("#csv-template", m).onclick = () => download("maskati-orders-template.csv",
      "customer_name,phone,email,governorate,district,address,items,delivery_fee,discount,payment_method,source,notes\nNour Ahmed,01012345678,,Cairo,,\"12 Tahrir St, floor 3\",\"Okra Mask x2; Dew Touch x1\",60,0,cod,whatsapp,\n");
    $("#csv-file", m).onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const rows = parseCsv(await file.text());
      const header = rows.shift().map((h) => h.trim().toLowerCase());
      const [{ data: zones }, { data: products }, { data: bundles }] = await Promise.all([
        db.from("shipping_zones").select("id,name_en,name_ar,bosta_city_id"), db.from("products").select("id,name_en,name_ar,slug"), db.from("bundles").select("id,name_en,name_ar,slug")]);
      const out = $("#csv-result", m); const done = [], failed = [];
      for (let i = 0; i < rows.length; i++) {
        const r = Object.fromEntries(header.map((h, j) => [h, (rows[i][j] || "").trim()]));
        out.innerHTML = `<p class="muted">Importing row ${i + 2} of ${rows.length + 1}…</p>`;
        try {
          const zone = zones.find((z) => [z.name_en, z.name_ar].some((n) => n && n.toLowerCase() === (r.governorate || "").toLowerCase()));
          if (!zone) throw new Error(`unknown governorate "${r.governorate}"`);
          const items = (r.items || "").split(/[;\n]/).map((s) => s.trim()).filter(Boolean).map((s) => {
            const mm = s.match(/^(.*?)\s*[x×*]\s*(\d+)$/i); const name = (mm ? mm[1] : s).trim().toLowerCase(); const quantity = mm ? Number(mm[2]) : 1;
            const p = products.find((p) => [p.name_en, p.name_ar, p.slug].some((n) => n?.toLowerCase() === name));
            const b = !p && bundles.find((b) => [b.name_en, b.name_ar, b.slug].some((n) => n?.toLowerCase() === name));
            if (!p && !b) throw new Error(`unknown item "${s}"`);
            return { type: p ? "product" : "bundle", id: (p || b).id, quantity };
          });
          let district_id = "";
          if (r.district && zone.bosta_city_id) {
            const { data: d } = await db.from("bosta_districts").select("district_id").eq("city_id", zone.bosta_city_id).or(`name_en.ilike.${r.district},name_ar.eq.${r.district}`).limit(1);
            district_id = d?.[0]?.district_id || "";
          }
          const { data, error } = await db.rpc("admin_create_order", { payload: { customer_name: r.customer_name, phone: r.phone, email: r.email,
            shipping_zone_id: zone.id, district_id, address: r.address, items, shipping_fee: Number(r.delivery_fee) || 0, discount: Number(r.discount) || 0,
            payment_method: ["cod", "instapay", "paid"].includes(r.payment_method) ? r.payment_method : "cod", source: r.source || "other", notes: r.notes } });
          if (error) throw new Error(/item_unavailable/.test(error.message) ? "not enough stock" : error.message);
          done.push(data.order_number);
        } catch (err) { failed.push({ row: i + 2, name: r.customer_name, reason: err.message }); }
      }
      out.innerHTML = `<p><strong>${done.length}</strong> orders imported${done.length ? ` (#${done[0]}–#${done[done.length - 1]})` : ""}. <strong>${failed.length}</strong> failed.</p>
        ${failed.length ? `<div class="table-wrap"><table><thead><tr><th>Row</th><th>Customer</th><th>Why</th></tr></thead><tbody>${failed.map((f) => `<tr><td>${f.row}</td><td>${esc(f.name)}</td><td>${esc(f.reason)}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
      refreshBadges(); onDone?.();
    };
  }

  // ---------- pages ----------
  const PAGES = {
    async overview() {
      const [{ data: s, error }, { data: latest }, { data: products }, { data: keyInfo }] = await Promise.all([
        db.rpc("admin_stats", { days: 30 }),
        db.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(10),
        db.from("products").select("name_en,stock").order("sort_order"),
        db.rpc("bosta_key_status")
      ]);
      if (error) throw error;
      $("#content").innerHTML = head("Overview", `<button class="btn btn-secondary" id="ov-new">New order</button><a class="btn btn-primary" href="#/orders">Orders to action</a>`) +
        (keyInfo && !keyInfo.set ? `<div class="key-notice"><strong>Bosta isn't connected yet.</strong> Orders are kept safe and go to Bosta as soon as you add the API key. <a href="#/delivery">Add the Bosta key</a></div>` : "") + `
        <div class="stats">
          <div class="stat"><span class="label">To action</span><span class="value">${s.to_action}</span><span class="muted">confirmed, not sent yet</span></div>
          <div class="stat"><span class="label">With courier</span><span class="value">${s.with_courier}</span><span class="muted">${s.unpaid_prepaid} prepaid unpaid</span></div>
          <div class="stat"><span class="label">Revenue · 30 days</span><span class="value">${money(s.sales)}</span><span class="muted">${s.orders} orders</span></div>
          <div class="stat"><span class="label">Average order</span><span class="value">${money(s.avg)}</span></div>
        </div>
        <div class="cols">
          ${panel("Sales", "Daily, last 30 days, without cancelled and returned orders", `<div class="panel-body">${chart(s.daily)}</div>`)}
          ${panel("Stock", "", `<div class="table-wrap"><table><tbody>${products.map((p) => `<tr><td>${esc(p.name_en)}</td><td class="num">${p.stock <= 0 ? `<span class="pill cancelled">out</span>` : p.stock < 10 ? `<span class="pill confirmed">${p.stock}</span>` : p.stock}</td></tr>`).join("")}</tbody></table></div>`, `<a class="btn btn-secondary btn-sm" href="#/products">Products</a>`)}
        </div>
        ${panel("Latest orders", "", ordersTable(latest || []), `<a class="btn btn-secondary btn-sm" href="#/orders">All orders</a>`)}`;
      $("#ov-new").onclick = () => newOrder(() => PAGES.overview());
      bindOrderRows(() => PAGES.overview());
    },
    async orders() {
      let filter = "confirmed", search = "";
      const counts = async () => Object.fromEntries(await Promise.all(STATUSES.map(async (s) => [s, (await db.from("orders").select("id", { count: "exact", head: true }).eq("status", s)).count || 0])));
      let list = [];
      const render = async () => {
        let q = db.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(500);
        const term = search.trim().replace(/[,()%]/g, "");
        if (term) {
          // search looks across every status
          const n = term.replace(/^#/, "");
          q = q.or(/^\d+$/.test(n) && n.length <= 7 ? `order_number.eq.${n},phone.ilike.%${n}%` : `customer_name.ilike.%${term}%,phone.ilike.%${term}%`);
        } else if (filter !== "all") q = q.eq("status", filter);
        const [{ data, error }, c] = await Promise.all([q, counts()]);
        if (error) throw error;
        list = data;
        $("#content").innerHTML = head("Orders", `<button class="btn btn-secondary" id="o-import">Import CSV</button><button class="btn btn-secondary" id="o-export">Export CSV</button><button class="btn btn-primary" id="o-new">New order</button>`) + `
          <div class="filters">${["all", ...STATUSES].map((s) => `<button data-f="${s}" aria-pressed="${!term && s === filter}">${s === "all" ? "All" : STATUS_LABEL[s]}${s !== "all" ? ` · ${c[s]}` : ""}</button>`).join("")}
            <input class="input" id="o-search" placeholder="Search number, name or phone" value="${esc(search)}" style="max-width:280px;min-height:34px"></div>
          <div class="actions" style="justify-content:flex-start;margin-bottom:12px" id="bulk" hidden>
            <span class="muted" id="bulk-count"></span>
            <button class="btn btn-primary btn-sm" data-bulk="bosta">Send to Bosta</button>
            <button class="btn btn-secondary btn-sm" data-bulk="with_courier">With courier</button>
            <button class="btn btn-secondary btn-sm" data-bulk="delivered">Delivered</button>
            <button class="btn btn-danger btn-sm" data-bulk="cancelled">Cancel</button>
          </div>
          <section class="panel">${ordersTable(list, true)}</section>`;
        $$("[data-f]").forEach((b) => b.onclick = () => { filter = b.dataset.f; search = ""; render(); });
        let timer; $("#o-search").oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { search = e.target.value; render().then(() => { const el = $("#o-search"); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }); }, 400); };
        $("#o-new").onclick = () => newOrder(render);
        $("#o-import").onclick = () => importCsv(render);
        $("#o-export").onclick = () => exportCsv(list, term ? "search" : filter);
        const picked = () => $$("[data-pick]:checked").map((c) => list.find((o) => o.id === c.dataset.pick));
        const syncBulk = () => { const n = picked().length; $("#bulk").hidden = !n; $("#bulk-count").textContent = `${n} selected`; };
        $$("[data-pick]").forEach((c) => c.onchange = syncBulk);
        $("#pick-all")?.addEventListener("change", (e) => { $$("[data-pick]").forEach((c) => (c.checked = e.target.checked)); syncBulk(); });
        $$("[data-bulk]").forEach((b) => b.onclick = async () => {
          const action = b.dataset.bulk, orders = picked();
          if (action === "cancelled" && !confirm(`Cancel ${orders.length} orders? Their stock goes back.`)) return;
          $$("[data-bulk]").forEach((x) => (x.disabled = true));
          let ok = 0, skipped = 0, failedMsgs = [];
          for (const o of orders) {
            const can = action === "bosta" ? o.status === "confirmed" && !o.bosta_tracking_number : NEXT[o.status].includes(action);
            if (!can) { skipped++; continue; }
            $("#bulk-count").textContent = `Working on #${o.order_number}…`;
            try { action === "bosta" ? await sendToBosta(o) : await moveOrder(o, action); ok++; }
            catch (e) { failedMsgs.push(`#${o.order_number}: ${e.message}`); }
            await sleep(1200); // spaced out so the email service doesn't block us
          }
          toast(`${ok} done${skipped ? `, ${skipped} skipped (can't move forward)` : ""}${failedMsgs.length ? `, ${failedMsgs.length} failed` : ""}.`);
          if (failedMsgs.length) alert(failedMsgs.join("\n"));
          refreshBadges(); render();
        });
        bindOrderRows(render);
      };
      await render();
    },
    async customers() {
      const [{ data, error }, { data: orders }, { data: zones }] = await Promise.all([
        db.from("profiles").select("*").order("created_at", { ascending: false }),
        db.from("orders").select("user_id,total,status").not("user_id", "is", null),
        db.from("shipping_zones").select("id,name_en")
      ]);
      if (error) throw error;
      const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name_en]));
      const stats = {};
      for (const o of orders || []) {
        const s = (stats[o.user_id] ||= { count: 0, spent: 0 });
        s.count++; if (!["cancelled", "returned"].includes(o.status)) s.spent += Number(o.total);
      }
      $("#content").innerHTML = head("Customers") + `<p class="muted" style="margin-top:-12px">Shoppers with an account. Orders you record from WhatsApp or CSV appear in Orders only.</p>
        <section class="panel">${data.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Customer</th><th>Mobile · WhatsApp</th><th>Governorate</th><th class="num">Orders</th><th class="num">Spent</th><th>Joined</th></tr></thead><tbody>
        ${data.map((c) => `<tr><td><strong>${esc(c.full_name || "—")}</strong><div class="muted">${esc(c.email || "")}</div></td>
          <td dir="ltr">${esc(c.phone || "—")}${c.whatsapp && c.whatsapp !== c.phone ? `<div class="muted">WA ${esc(c.whatsapp)}</div>` : ""}</td><td>${esc(zoneName[c.shipping_zone_id] || "—")}</td>
          <td class="num">${stats[c.id]?.count || 0}</td><td class="num">${money(stats[c.id]?.spent || 0)}</td><td class="muted">${date(c.created_at)}</td></tr>`).join("")}
        </tbody></table></div>` : `<p class="empty">No customer accounts yet.</p>`}</section>`;
    },
    async promos() {
      const { data, error } = await db.from("promo_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const describe = (p) => p.kind === "percent" ? `${Number(p.value)}% off` : p.kind === "fixed" ? `${money(p.value)} off` : "Free delivery";
      $("#content").innerHTML = head("Promo codes", `<button class="btn btn-primary" id="add">Add code</button>`) + `<p class="muted" style="margin-top:-12px">Customers type the code at checkout. Each customer can use a code once.</p>
        <section class="panel">${data.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Code</th><th>Gives</th><th class="num">Min. order</th><th class="num">Used</th><th>Expires</th><th>On</th><th></th></tr></thead><tbody>
        ${data.map((p) => `<tr><td><strong>${esc(p.code)}</strong></td><td>${describe(p)}</td><td class="num">${Number(p.min_order) ? money(p.min_order) : "—"}</td>
          <td class="num">${p.used_count}${p.usage_limit ? ` / ${p.usage_limit}` : ""}</td><td class="muted">${p.expires_at ? date(p.expires_at) : "Never"}</td>
          <td>${toggle(`data-on="${p.id}"`, p.is_active)}</td><td><button class="btn btn-secondary btn-sm" data-edit="${p.id}">Edit</button></td></tr>`).join("")}
        </tbody></table></div>` : `<p class="empty">No promo codes yet.</p>`}</section>`;
      const edit = (p) => {
        const m = openModal(`${modalHead(p ? "Edit code" : "Add code")}<form class="modal-body form" id="pc-form">
          <div class="row two"><label class="field"><span>Code</span><input class="input" name="code" required minlength="3" maxlength="30" style="text-transform:uppercase" value="${esc(p?.code)}"></label>
            <label class="field"><span>Type</span><select class="input" name="kind">${[["percent", "Percent off"], ["fixed", "EGP off"]].map(([v, l]) => `<option value="${v}" ${p?.kind === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
          <div class="row three"><label class="field"><span>Value (% or EGP)</span><input class="input" type="number" min="0" step="1" name="value" value="${p ? Number(p.value) : 10}"></label>
            <label class="field"><span>Minimum order (EGP)</span><input class="input" type="number" min="0" name="min_order" value="${p ? Number(p.min_order) : 0}"></label>
            <label class="field"><span>Usage limit (blank = none)</span><input class="input" type="number" min="1" name="usage_limit" value="${p?.usage_limit ?? ""}"></label></div>
          <label class="field" style="max-width:260px"><span>Expires (optional)</span><input class="input" type="datetime-local" name="expires_at" value="${p?.expires_at ? new Date(p.expires_at).toISOString().slice(0, 16) : ""}"></label>
          <div class="actions">${p ? `<button type="button" class="btn btn-danger" id="pc-del">Delete</button>` : ""}<button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Save</button></div></form>`);
        $("#pc-form", m).onsubmit = async (e) => {
          e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
          const row = { code: f.code.trim().toUpperCase(), kind: f.kind, value: Number(f.value) || 0, min_order: Number(f.min_order) || 0,
            usage_limit: f.usage_limit ? Number(f.usage_limit) : null, expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null };
          const { error } = p ? await db.from("promo_codes").update(row).eq("id", p.id) : await db.from("promo_codes").insert(row);
          if (!fail(error)) { m.close(); toast(`Saved. ${row.code} is ready.`); PAGES.promos(); }
        };
        $("#pc-del", m)?.addEventListener("click", async () => { if (confirm(`Delete ${p.code}?`) && !fail((await db.from("promo_codes").delete().eq("id", p.id)).error)) { m.close(); toast("Deleted."); PAGES.promos(); } });
      };
      $("#add").onclick = () => edit(null);
      $$("[data-edit]").forEach((b) => b.onclick = () => edit(data.find((p) => p.id === b.dataset.edit)));
      $$("[data-on]").forEach((c) => c.onchange = async () => { if (!fail((await db.from("promo_codes").update({ is_active: c.checked }).eq("id", c.dataset.on)).error)) toast(c.checked ? "Code switched on." : "Code switched off."); });
    },
    async subscribers() {
      const { data, error } = await db.from("subscribers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      $("#content").innerHTML = head("Subscribers", `<button class="btn btn-secondary" id="csv">Download CSV</button>`) +
        `<section class="panel">${data.length ? `<div class="table-wrap"><table><thead><tr><th>Mobile or email</th><th>Joined</th></tr></thead><tbody>${data.map((s) => `<tr><td>${esc(s.contact)}</td><td class="muted">${date(s.created_at)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">No subscribers yet.</p>`}</section>`;
      $("#csv").onclick = () => download("maskati-subscribers.csv", "contact,joined\n" + data.map((s) => `${csvCell(s.contact)},${s.created_at}`).join("\n"));
    },
    async products() {
      const { data, error } = await db.from("products").select("*").order("sort_order");
      if (error) throw error;
      $("#content").innerHTML = head("Products", `<button class="btn btn-primary" id="add">Add product</button>`) + `<section class="panel"><div class="table-wrap"><table>
        <thead><tr><th></th><th>Product</th><th class="num">Price</th><th class="num">Stock</th><th>Best seller</th><th>On site</th><th></th></tr></thead><tbody>
        ${data.map((p) => `<tr><td><img class="thumb" src="${esc(p.image_url || "/assets/maskati-mark.png")}" alt=""></td>
          <td><strong>${esc(p.name_en)}</strong><div class="muted" dir="rtl" style="font-family:var(--font-arabic)">${esc(p.name_ar)}</div></td>
          <td class="num">${money(p.price)}</td><td class="num">${p.stock <= 0 ? `<span class="pill cancelled">out</span>` : p.stock < 10 ? `<span class="pill confirmed">${p.stock}</span>` : p.stock}</td>
          <td>${toggle(`data-best="${p.id}"`, p.is_bestseller)}</td><td>${toggle(`data-vis="${p.id}"`, p.is_visible)}</td>
          <td><button class="btn btn-secondary btn-sm" data-edit="${p.id}">Edit</button></td></tr>`).join("")}
        </tbody></table></div></section>`;
      $("#add").onclick = () => editProduct(null);
      $$("[data-edit]").forEach((b) => b.onclick = () => editProduct(data.find((p) => p.id === b.dataset.edit)));
      $$("[data-vis]").forEach((c) => c.onchange = async () => { if (!fail((await db.from("products").update({ is_visible: c.checked }).eq("id", c.dataset.vis)).error)) toast(c.checked ? "Saved. The product is on the site." : "Saved. The product is hidden from the site."); });
      $$("[data-best]").forEach((c) => c.onchange = async () => { if (!fail((await db.from("products").update({ is_bestseller: c.checked }).eq("id", c.dataset.best)).error)) toast("Saved."); });
    },
    async bundles() {
      const [{ data, error }, { data: products }] = await Promise.all([db.from("bundles").select("*").order("sort_order"), db.from("products").select("id,name_en").order("sort_order")]);
      if (error) throw error;
      const names = Object.fromEntries(products.map((p) => [p.id, p.name_en]));
      $("#content").innerHTML = head("Routines", `<button class="btn btn-primary" id="add">Add routine</button>`) + `<p class="muted" style="margin-top:-12px">A routine uses the stock of each product inside it.</p><section class="panel"><div class="table-wrap"><table>
        <thead><tr><th>Routine</th><th>Steps</th><th class="num">Price</th><th class="num">Was</th><th>On site</th><th></th></tr></thead><tbody>
        ${data.map((b) => `<tr><td><strong>${esc(b.name_en)}</strong><div class="muted">${esc(b.hair_need || "")}</div></td><td>${b.product_ids.map((id, i) => `${i + 1}. ${esc(names[id] || "?")}`).join("<br>")}</td>
          <td class="num">${money(b.price)}</td><td class="num muted">${b.compare_at_price ? money(b.compare_at_price) : "—"}</td>
          <td>${toggle(`data-vis="${b.id}"`, b.is_visible)}</td><td><button class="btn btn-secondary btn-sm" data-edit="${b.id}">Edit</button></td></tr>`).join("")}
        </tbody></table></div></section>`;
      $("#add").onclick = () => editBundle(null, products);
      $$("[data-edit]").forEach((b) => b.onclick = () => editBundle(data.find((x) => x.id === b.dataset.edit), products));
      $$("[data-vis]").forEach((c) => c.onchange = async () => { if (!fail((await db.from("bundles").update({ is_visible: c.checked }).eq("id", c.dataset.vis)).error)) toast("Saved."); });
    },
    async reviews() {
      const [{ data, error }, { data: products }] = await Promise.all([db.from("reviews").select("*").order("created_at", { ascending: false }), db.from("products").select("id,name_en")]);
      if (error) throw error;
      const names = Object.fromEntries(products.map((p) => [p.id, p.name_en]));
      $("#content").innerHTML = head("Reviews", `<button class="btn btn-primary" id="rv-add">Write a review</button>`) + `<p class="muted" style="margin-top:-12px">Reviews appear on the site only after you approve them. Mark "Verified" only when the name matches a real order.</p><section class="panel">${data.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Review</th><th>Product</th><th>Status</th><th>Verified</th><th></th></tr></thead><tbody>
        ${data.map((r) => `<tr><td><div style="color:var(--brand-olive)">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>${r.title ? `<strong>${esc(r.title)}</strong><br>` : ""}${esc(r.body)}<div class="muted">${esc(r.customer_name)} · ${date(r.created_at)}</div></td>
          <td>${esc(names[r.product_id] || "—")}</td><td><span class="pill ${r.is_approved ? "delivered" : "confirmed"}">${r.is_approved ? "published" : "waiting"}</span></td>
          <td>${toggle(`data-ver="${r.id}"`, r.is_verified)}</td>
          <td><div class="actions">${r.is_approved ? `<button class="btn btn-secondary btn-sm" data-hide="${r.id}">Hide from site</button>` : `<button class="btn btn-primary btn-sm" data-ok="${r.id}">Approve</button>`}<button class="btn btn-danger btn-sm" data-del="${r.id}">Delete</button></div></td></tr>`).join("")}
        </tbody></table></div>` : `<p class="empty">No reviews yet.</p>`}</section>`;
      const upd = async (id, v, msg) => { if (!fail((await db.from("reviews").update(v).eq("id", id)).error)) { toast(msg); refreshBadges(); PAGES.reviews(); } };
      $$("[data-ok]").forEach((b) => b.onclick = () => upd(b.dataset.ok, { is_approved: true }, "Approved. The review is on the site."));
      $$("[data-hide]").forEach((b) => b.onclick = () => upd(b.dataset.hide, { is_approved: false }, "Hidden from the site."));
      $$("[data-ver]").forEach((c) => c.onchange = () => upd(c.dataset.ver, { is_verified: c.checked }, "Saved."));
      $$("[data-del]").forEach((b) => b.onclick = async () => { if (confirm("Delete this review permanently?") && !fail((await db.from("reviews").delete().eq("id", b.dataset.del)).error)) { toast("Deleted."); refreshBadges(); PAGES.reviews(); } });
      $("#rv-add").onclick = () => {
        const m = openModal(`${modalHead("Write a review")}<form class="modal-body form" id="rv-form">
          <p class="muted" style="margin:0">Only post words a real customer sent you, with her permission.</p>
          <div class="row three"><label class="field"><span>Customer first name</span><input class="input" name="customer_name" required></label>
            <label class="field"><span>Product</span><select class="input" name="product_id">${products.map((p) => `<option value="${p.id}">${esc(p.name_en)}</option>`).join("")}</select></label>
            <label class="field"><span>Rating</span><select class="input" name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}</select></label></div>
          <label class="field"><span>Title (optional)</span><input class="input" name="title"></label>
          <label class="field"><span>Review</span><textarea class="input" name="body" required></textarea></label>
          ${toggle(`name="is_verified"`, true, " Verified buyer")}
          <div class="actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Publish</button></div></form>`);
        $("#rv-form", m).onsubmit = async (e) => {
          e.preventDefault(); const f = e.target;
          const row = { customer_name: f.customer_name.value.trim(), product_id: f.product_id.value, rating: Number(f.rating.value),
            title: f.title.value.trim() || null, body: f.body.value.trim(), is_verified: f.is_verified.checked, is_approved: true };
          if (!fail((await db.from("reviews").insert(row)).error)) { m.close(); toast("Published. The review is on the site."); PAGES.reviews(); }
        };
      };
    },
    async home() {
      let sections = (await getSetting("home_sections")) || [];
      const hero = (await getSetting("hero")) || {};
      // the whole "Our story" section: heading, cover, every page of the book, back cover and the points under it
      const book = JSON.parse(JSON.stringify((await getSetting("story_book")) || {}));
      book.eyebrow ||= {}; book.title ||= {}; book.cover ||= {}; book.back ||= {}; book.pages ||= []; book.points ||= [];
      const PAGE_TYPES = [["text", "Text page"], ["quote", "Big quote"], ["numbered", "Numbered point (01, 02…)"]];
      const pair = (path, label, area = false, rows = 3) => {
        const get = (lang) => esc(path.reduce((o, k) => (o || {})[k], book)?.[lang] || "");
        const f = (lang) => area
          ? `<textarea class="input" ${lang === "ar" ? 'dir="rtl"' : ""} rows="${rows}" data-path="${path.join(".")}.${lang}">${get(lang)}</textarea>`
          : `<input class="input" ${lang === "ar" ? 'dir="rtl"' : ""} data-path="${path.join(".")}.${lang}" value="${get(lang)}">`;
        return `<div class="row two"><label class="field"><span>${label} (Arabic)</span>${f("ar")}</label><label class="field"><span>${label} (English)</span>${f("en")}</label></div>`;
      };
      const renderBook = () => `
        ${pair(["eyebrow"], "Small line above the title")}${pair(["title"], "Section title")}
        <h3 class="book-h">Cover</h3>${pair(["cover", "title"], "Cover title")}${pair(["cover", "sub"], "Cover line")}
        <h3 class="book-h">Pages inside the flip book <span class="muted">· ${book.pages.length} pages</span></h3>
        <div><button type="button" class="btn btn-primary" data-page-add>+ Add a new page to the book</button></div>
        ${book.pages.map((pg, i) => `<div class="book-page">
          <div class="book-page-head"><strong>Page ${i + 1}</strong>
            <select class="input" data-type="${i}" style="max-width:240px">${PAGE_TYPES.map(([v, n]) => `<option value="${v}" ${pg.type === v ? "selected" : ""}>${n}</option>`).join("")}</select>
            <span class="mv"><button type="button" class="icon-btn" data-pup="${i}" aria-label="Move page up" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="icon-btn" data-pdown="${i}" aria-label="Move page down" ${i === book.pages.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn btn-danger btn-sm" data-pdel="${i}">Delete page</button></span></div>
          ${pair(["pages", i, "heading"], "Small heading")}${pg.type === "quote" ? "" : pair(["pages", i, "title"], "Title (optional)")}${pair(["pages", i, "body"], pg.type === "quote" ? "Quote" : "Text", true, 5)}
        </div>`).join("")}
        <div><button type="button" class="btn btn-primary" data-page-add>+ Add a new page to the book</button></div>
        <h3 class="book-h">Back cover</h3>${pair(["back", "title"], "Back cover title")}${pair(["back", "sub"], "Back cover line")}
        <h3 class="book-h">Short notes shown under the book <span class="muted">· not inside the book · ${book.points.length}</span></h3>
        ${book.points.map((pt, i) => `<div class="book-page"><div class="book-page-head"><strong>Note ${i + 1}</strong><span class="mv"><button type="button" class="btn btn-danger btn-sm" data-ptdel="${i}">Delete</button></span></div>
          ${pair(["points", i, "title"], "Title")}${pair(["points", i, "text"], "Text", true, 2)}</div>`).join("")}
        ${book.points.length < 6 ? `<div><button type="button" class="btn btn-secondary" id="point-add">+ Add a note under the book</button></div>` : ""}`;
      const renderList = () => `<ul class="sections">${sections.map((s, i) => `<li><span class="pos">${i + 1}</span><span><strong>${SECTION_NAMES[s.id]?.[0] || s.id}</strong><div class="muted">${SECTION_NAMES[s.id]?.[1] || ""}</div></span>
        ${toggle(`data-sv="${i}"`, s.visible)}<span class="mv"><button class="icon-btn" data-up="${i}" aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button class="icon-btn" data-down="${i}" aria-label="Move down" ${i === sections.length - 1 ? "disabled" : ""}>↓</button></span></li>`).join("")}</ul>`;
      $("#content").innerHTML = head("Home page") +
        panel("Sections", "Show, hide and reorder what appears on the home page.", `<div id="sec-list">${renderList()}</div>`, `<button class="btn btn-primary btn-sm" id="sec-save">Save</button>`) +
        panel("Hero", "The first thing she sees.", `<form class="panel-body form" id="hero-form">
          <div class="row two"><label class="field"><span>Headline (Arabic)</span><input class="input" dir="rtl" name="ar_title" value="${esc(hero.ar_title)}"></label>
          <label class="field"><span>Headline (English)</span><input class="input" name="en_title" value="${esc(hero.en_title)}"></label></div>
          <div class="row two"><label class="field"><span>Text (Arabic)</span><textarea class="input" dir="rtl" name="ar_text">${esc(hero.ar_text)}</textarea></label>
          <label class="field"><span>Text (English)</span><textarea class="input" name="en_text">${esc(hero.en_text)}</textarea></label></div>
          <div class="actions"><button class="btn btn-primary">Save</button></div></form>`) +
        panel("Our story", "The book customers flip through: edit every page, add new ones, reorder or delete them. Mark words in the text: [[highlight]], __underline__, ((circle)), {{box}}. Press Enter for a new line.",
          `<form class="panel-body form" id="story-form"><div id="book-edit">${renderBook()}</div>
          <div class="actions" style="position:sticky;bottom:0;background:var(--surface-raised);padding-top:12px"><button class="btn btn-primary">Save the story</button></div></form>`);
      const bind = () => {
        $$("[data-sv]").forEach((c) => c.onchange = () => { sections[c.dataset.sv].visible = c.checked; });
        $$("[data-up]").forEach((b) => b.onclick = () => { const i = +b.dataset.up; [sections[i - 1], sections[i]] = [sections[i], sections[i - 1]]; $("#sec-list").innerHTML = renderList(); bind(); });
        $$("[data-down]").forEach((b) => b.onclick = () => { const i = +b.dataset.down; [sections[i + 1], sections[i]] = [sections[i], sections[i + 1]]; $("#sec-list").innerHTML = renderList(); bind(); });
      };
      bind();
      $("#sec-save").onclick = async () => { if (!fail(await setSetting("home_sections", sections))) toast("Saved. The home page is updated."); };
      $("#hero-form").onsubmit = async (e) => { e.preventDefault(); if (!fail(await setSetting("hero", Object.fromEntries(new FormData(e.target))))) toast("Saved. The hero is updated."); };
      // story editor: every field writes straight into `book`; structure changes redraw the editor
      const redraw = () => { $("#book-edit").innerHTML = renderBook(); bindBook(); };
      const bindBook = () => {
        $$("#book-edit [data-path]").forEach((el) => el.oninput = () => {
          const keys = el.dataset.path.split("."); let o = book;
          keys.slice(0, -1).forEach((k) => { o[k] ||= {}; o = o[k]; });
          o[keys[keys.length - 1]] = el.value;
        });
        $$("#book-edit [data-type]").forEach((el) => el.onchange = () => { book.pages[+el.dataset.type].type = el.value; redraw(); });
        const swap = (arr, a, b) => { [arr[a], arr[b]] = [arr[b], arr[a]]; redraw(); };
        $$("#book-edit [data-pup]").forEach((b) => b.onclick = () => swap(book.pages, +b.dataset.pup - 1, +b.dataset.pup));
        $$("#book-edit [data-pdown]").forEach((b) => b.onclick = () => swap(book.pages, +b.dataset.pdown, +b.dataset.pdown + 1));
        $$("#book-edit [data-pdel]").forEach((b) => b.onclick = () => { if (confirm(`Delete page ${+b.dataset.pdel + 1}?`)) { book.pages.splice(+b.dataset.pdel, 1); redraw(); } });
        $$("#book-edit [data-ptdel]").forEach((b) => b.onclick = () => { book.points.splice(+b.dataset.ptdel, 1); redraw(); });
        $$("#book-edit [data-page-add]").forEach((b) => b.onclick = () => {
          book.pages.push({ type: "text", heading: {}, title: {}, body: {} }); redraw();
          // jump to the new page and put the cursor in its text, so it is obvious where it went
          const card = $$("#book-edit .book-page")[book.pages.length - 1];
          card?.classList.add("is-new"); card?.scrollIntoView({ behavior: "smooth", block: "center" });
          card?.querySelector('[data-path$=".body.ar"]')?.focus({ preventScroll: true });
          toast(`Page ${book.pages.length} added to the book. Write it, then press Save the story.`);
        });
        const addPoint = $("#point-add"); if (addPoint) addPoint.onclick = () => { book.points.push({ title: {}, text: {} }); redraw(); };
      };
      bindBook();
      $("#story-form").onsubmit = async (e) => {
        e.preventDefault();
        if (!book.pages.length) { toast("Keep at least one page in the book."); return; }
        if (!fail(await setSetting("story_book", book))) toast("Saved. The story book on the site is updated.");
      };
    },
    async announcement() {
      const a = (await getSetting("announcement")) || {};
      $("#content").innerHTML = head("Announcement bar") + panel("Announcement", "One line across the top of every page.", `<form class="panel-body form" id="ann-form">
        ${toggle(`name="visible"`, a.visible, " Show on site")}
        <label class="field"><span>Arabic</span><input class="input" dir="rtl" name="ar" value="${esc(a.ar)}"></label>
        <label class="field"><span>English</span><input class="input" name="en" value="${esc(a.en)}"></label>
        <div class="actions"><button class="btn btn-primary">Save</button></div></form>`);
      $("#ann-form").onsubmit = async (e) => { e.preventDefault(); const f = e.target;
        if (!fail(await setSetting("announcement", { visible: f.visible.checked, ar: f.ar.value.trim(), en: f.en.value.trim() }))) toast(f.visible.checked ? "Saved. The announcement bar is live." : "Saved. The announcement bar is hidden."); };
    },
    async sitetext() {
      const overrides = (await getSetting("site_text")) || {};
      const keys = Object.keys(I18N.en);
      let q = "";
      const render = () => {
        const shown = keys.filter((k) => !q || [k, I18N.en[k], I18N.ar[k]].some((v) => String(v).toLowerCase().includes(q.toLowerCase())));
        $("#st-rows").innerHTML = shown.map((k) => `<tr><td class="muted" style="font-size:12px">${k}</td>
          <td><input class="input" data-k="${k}" data-l="ar" dir="rtl" placeholder="${esc(I18N.ar[k])}" value="${esc(overrides[k]?.ar || "")}"></td>
          <td><input class="input" data-k="${k}" data-l="en" placeholder="${esc(I18N.en[k])}" value="${esc(overrides[k]?.en || "")}"></td></tr>`).join("");
      };
      $("#content").innerHTML = head("Site text", `<button class="btn btn-primary" id="st-save">Save</button>`) +
        `<p class="muted" style="margin-top:-12px">Change any wording on the website. A blank field uses the built-in text shown in grey. Changes appear on the next page load. Use {x} where the original has it.</p>
        <input class="input" id="st-search" placeholder="Search text" style="max-width:320px;margin-bottom:12px">
        <section class="panel"><div class="table-wrap"><table><thead><tr><th>Key</th><th>Arabic</th><th>English</th></tr></thead><tbody id="st-rows"></tbody></table></div></section>`;
      render();
      $("#st-search").oninput = (e) => { collect(); q = e.target.value; render(); };
      const collect = () => $$("[data-k]").forEach((i) => { const k = i.dataset.k, l = i.dataset.l; (overrides[k] ||= {})[l] = i.value.trim(); if (!overrides[k].ar && !overrides[k].en) delete overrides[k]; });
      $("#st-save").onclick = async () => { collect(); if (!fail(await setSetting("site_text", overrides))) toast(`Saved. ${Object.keys(overrides).length} texts changed from the default.`); };
    },
    async faq() {
      const { data, error } = await db.from("faqs").select("*").order("sort_order");
      if (error) throw error;
      $("#content").innerHTML = head("Q&A", `<button class="btn btn-primary" id="add">Add question</button>`) + `<section class="panel"><div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Question</th><th>On site</th><th></th></tr></thead><tbody>
        ${data.map((f) => `<tr><td>${f.sort_order}</td><td><strong>${esc(f.question_en)}</strong><div class="muted" dir="rtl" style="font-family:var(--font-arabic)">${esc(f.question_ar)}</div></td>
          <td>${toggle(`data-vis="${f.id}"`, f.is_visible)}</td><td><button class="btn btn-secondary btn-sm" data-edit="${f.id}">Edit</button></td></tr>`).join("")}
        </tbody></table></div></section>`;
      const edit = (f) => {
        const m = openModal(`${modalHead(f ? "Edit question" : "Add question")}<form class="modal-body form" id="faq-form">
          <div class="row two"><label class="field"><span>Question (Arabic)</span><input class="input" dir="rtl" name="question_ar" required value="${esc(f?.question_ar)}"></label>
          <label class="field"><span>Question (English)</span><input class="input" name="question_en" required value="${esc(f?.question_en)}"></label></div>
          <div class="row two"><label class="field"><span>Answer (Arabic)</span><textarea class="input" dir="rtl" name="answer_ar" required>${esc(f?.answer_ar)}</textarea></label>
          <label class="field"><span>Answer (English)</span><textarea class="input" name="answer_en" required>${esc(f?.answer_en)}</textarea></label></div>
          <label class="field" style="max-width:160px"><span>Order</span><input class="input" type="number" name="sort_order" value="${f?.sort_order ?? data.length + 1}"></label>
          <div class="actions">${f ? `<button type="button" class="btn btn-danger" id="del">Delete</button>` : ""}<button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Save</button></div></form>`);
        $("#faq-form", m).onsubmit = async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)); v.sort_order = Number(v.sort_order) || 0;
          const { error } = f ? await db.from("faqs").update(v).eq("id", f.id) : await db.from("faqs").insert(v);
          if (!fail(error)) { m.close(); toast("Saved."); PAGES.faq(); } };
        $("#del", m)?.addEventListener("click", async () => { if (confirm("Delete this question from the site?") && !fail((await db.from("faqs").delete().eq("id", f.id)).error)) { m.close(); toast("Deleted."); PAGES.faq(); } });
      };
      $("#add").onclick = () => edit(null);
      $$("[data-edit]").forEach((b) => b.onclick = () => edit(data.find((f) => f.id === b.dataset.edit)));
      $$("[data-vis]").forEach((c) => c.onchange = async () => { if (!fail((await db.from("faqs").update({ is_visible: c.checked }).eq("id", c.dataset.vis)).error)) toast("Saved."); });
    },
    async social() {
      const contact = (await getSetting("contact")) || {};
      const social = (await getSetting("social")) || {};
      const f = (name, label, val, ph = "") => `<label class="field"><span>${label}</span><input class="input" name="${name}" value="${esc(val)}" placeholder="${ph}"></label>`;
      $("#content").innerHTML = head("Contact & social") +
        panel("Contact", "WhatsApp is the ordering and support channel. Use the number with country code, e.g. 201012345678.", `<form class="panel-body form" id="contact-form"><div class="row two">
          ${f("whatsapp", "WhatsApp number", contact.whatsapp, "2010...")}${f("phone", "Phone", contact.phone)}
          ${f("instapay", "InstaPay address (shown after an InstaPay order)", contact.instapay, "name@instapay")}${f("email", "Email", contact.email)}
          </div><div class="actions"><button class="btn btn-primary">Save</button></div></form>`) +
        panel("Social links", "Shown in this order in the community band and the footer. Leave empty to hide.", `<form class="panel-body form" id="social-form"><div class="row two">
          ${f("instagram", "Instagram URL", social.instagram, "https://instagram.com/...")}${f("tiktok", "TikTok URL", social.tiktok, "https://tiktok.com/@...")}
          ${f("facebook", "Facebook URL", social.facebook, "https://facebook.com/...")}
          ${f("whatsapp", "WhatsApp link", social.whatsapp, "https://wa.me/20...")}${f("telegram", "Telegram community URL", social.telegram, "https://t.me/...")}
          ${f("email", "Email", social.email)}</div><div class="actions"><button class="btn btn-primary">Save</button></div></form>`);
      const trimAll = (fd) => Object.fromEntries([...fd].map(([k, v]) => [k, String(v).trim()]));
      $("#contact-form").onsubmit = async (e) => { e.preventDefault(); if (!fail(await setSetting("contact", trimAll(new FormData(e.target))))) toast("Saved."); };
      $("#social-form").onsubmit = async (e) => { e.preventDefault(); if (!fail(await setSetting("social", trimAll(new FormData(e.target))))) toast("Saved. Social links are updated."); };
    },
    async delivery() {
      const [{ data: dz, error }, { data: govs }, { data: counts }, flat, bosta, { data: keyInfo }] = await Promise.all([
        db.from("delivery_zones").select("*").order("sort_order"),
        db.from("shipping_zones").select("*").order("sort_order"),
        db.from("bosta_districts").select("city_id").eq("dropoff", true),
        getSetting("flat_shipping_fee"), getSetting("bosta"), db.rpc("bosta_key_status")
      ]);
      const key = keyInfo || { set: false };
      if (error) throw error;
      const perCity = {}; (counts || []).forEach((r) => { perCity[r.city_id] = (perCity[r.city_id] || 0) + 1; });
      const cfg = bosta || {};
      $("#content").innerHTML = head("Delivery & Bosta") +
        panel("Delivery zones", "Each zone has one delivery price. Customers pay the price of the zone their governorate is in.", `<div class="table-wrap"><table>
          <thead><tr><th>Zone (English)</th><th>Zone (Arabic)</th><th>Price (EGP)</th><th>Return fee (EGP)</th><th>Working days</th><th></th></tr></thead><tbody id="dz-rows">
          ${dz.map((z) => `<tr data-dz="${z.id}"><td><input class="input" name="name_en" value="${esc(z.name_en)}"></td><td><input class="input" dir="rtl" name="name_ar" value="${esc(z.name_ar)}"></td>
            <td><input class="input" style="max-width:100px" type="number" min="0" name="fee" value="${Number(z.fee)}"></td><td><input class="input" style="max-width:100px" type="number" min="0" name="return_fee" value="${Number(z.return_fee)}"></td>
            <td><input class="input" style="max-width:90px" name="days" value="${esc(z.days)}"></td><td><button class="icon-btn" data-dzdel="${z.id}" aria-label="Delete zone">✕</button></td></tr>`).join("")}
          </tbody></table></div><div class="panel-body actions" style="justify-content:space-between"><button class="btn btn-secondary btn-sm" id="dz-add">Add zone</button><button class="btn btn-primary btn-sm" id="dz-save">Save zones</button></div>`) +
        panel("Governorates", "Pick each governorate's zone. Areas is how many Bosta delivery areas customers can choose from. Turn a governorate off to stop selling there.", `<div class="table-wrap"><table>
          <thead><tr><th>Governorate</th><th>Zone</th><th class="num">Bosta areas</th><th>Deliver</th></tr></thead><tbody>
          ${govs.map((g) => `<tr data-gov="${g.id}"><td>${esc(g.name_en)} <span class="muted" style="font-family:var(--font-arabic)">· ${esc(g.name_ar)}</span></td>
            <td><select class="input" name="delivery_zone_id" style="max-width:220px"><option value="">Flat rate</option>${dz.map((z) => `<option value="${z.id}" ${z.id === g.delivery_zone_id ? "selected" : ""}>${esc(z.name_en)} · ${money(z.fee)}</option>`).join("")}</select></td>
            <td class="num">${perCity[g.bosta_city_id] || `<span class="pill cancelled">0</span>`}</td><td>${toggle(`name="is_active"`, g.is_active)}</td></tr>`).join("")}
          </tbody></table></div><div class="panel-body actions"><button class="btn btn-primary btn-sm" id="gov-save">Save governorates</button></div>`) +
        panel("Rates", "", `<form class="panel-body form" id="rates-form"><div class="row two">
          <label class="field"><span>Flat rate for governorates without a zone (EGP)</span><input class="input" type="number" min="0" name="flat" value="${Number(flat || 0)}"></label></div>
          <div class="actions"><button class="btn btn-primary">Save</button></div></form>`) +
        panel("Bosta API key", "Paste the key from Bosta → Settings → API Integration. It is stored locked away: nobody can read it back, not even this page, which only shows its last 4 characters.", `<form class="panel-body form" id="bosta-key-form" autocomplete="off">
          <p style="margin:0" id="bk-status">${key.set
            ? `<span class="pill delivered">Key saved</span> ends in <strong dir="ltr">••••${esc(key.last4)}</strong> · saved ${date(key.updated_at)}`
            : `<span class="pill cancelled">No key yet</span> Orders wait safely and go to Bosta the moment you save a key.`}</p>
          <div class="row two"><label class="field"><span>${key.set ? "Replace with a new key" : "Bosta API key"}</span>
            <input class="input" dir="ltr" name="key" placeholder="Paste the Bosta API key" spellcheck="false" type="password" autocomplete="new-password"></label></div>
          <div class="actions" style="justify-content:space-between"><span class="actions">
            <button type="button" class="btn btn-secondary" id="bk-test" ${key.set ? "" : "disabled"}>Test connection</button>
            ${key.set ? `<button type="button" class="btn btn-danger" id="bk-remove">Remove key</button>` : ""}</span>
            <button class="btn btn-primary">Save key</button></div></form>`) +
        panel("Bosta", "Every order goes to Bosta by itself: cash orders the moment they are placed, InstaPay orders once you mark them paid. Failed sends retry on their own, cancelling an order cancels it at Bosta, and Bosta updates the status by itself: picked up, delivered or returned. Send to Bosta is only needed if automatic sending stops.", `<form class="panel-body form" id="bosta-form">
          <div class="row two"><label class="field"><span>Package size</span><select class="input" name="package_size">${["SMALL", "MEDIUM", "LARGE"].map((s) => `<option ${cfg.package_size === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
            <label class="field"><span>Bosta pickup location ID (optional)</span><input class="input" name="business_location_id" value="${esc(cfg.business_location_id || "")}" placeholder="Default pickup location"></label></div>
          <div class="actions" style="justify-content:space-between"><button type="button" class="btn btn-secondary" id="sync-areas">Update Bosta areas</button><button class="btn btn-primary">Save</button></div></form>`);
      $("#dz-add").onclick = () => $("#dz-rows").insertAdjacentHTML("beforeend", `<tr data-dz="new"><td><input class="input" name="name_en" placeholder="Zone name"></td><td><input class="input" dir="rtl" name="name_ar" placeholder="اسم المنطقة"></td>
        <td><input class="input" style="max-width:100px" type="number" min="0" name="fee" value="60"></td><td><input class="input" style="max-width:100px" type="number" min="0" name="return_fee" value="0"></td><td><input class="input" style="max-width:90px" name="days" value="2-4"></td><td></td></tr>`);
      $("#dz-save").onclick = async () => {
        const rows = $$("[data-dz]").map((tr) => ({ id: tr.dataset.dz, name_en: $("[name=name_en]", tr).value.trim(), name_ar: $("[name=name_ar]", tr).value.trim(),
          fee: Number($("[name=fee]", tr).value) || 0, return_fee: Number($("[name=return_fee]", tr).value) || 0, days: $("[name=days]", tr).value.trim() || "2-4" })).filter((r) => r.name_en && r.name_ar);
        for (const [i, r] of rows.entries()) {
          const { id, ...v } = r; v.sort_order = i + 1;
          const { error } = id === "new" ? await db.from("delivery_zones").insert(v) : await db.from("delivery_zones").update(v).eq("id", id);
          if (fail(error)) return;
        }
        toast("Saved. Delivery prices are updated."); PAGES.delivery();
      };
      $$("[data-dzdel]").forEach((b) => b.onclick = async () => {
        if (!confirm("Delete this zone? Its governorates fall back to the flat rate until you pick a new zone.")) return;
        if (!fail((await db.from("delivery_zones").delete().eq("id", b.dataset.dzdel)).error)) { toast("Deleted."); PAGES.delivery(); }
      });
      $("#gov-save").onclick = async () => {
        const res = await Promise.all($$("[data-gov]").map((tr) => db.from("shipping_zones").update({
          delivery_zone_id: Number($("[name=delivery_zone_id]", tr).value) || null, is_active: $("[name=is_active]", tr).checked }).eq("id", tr.dataset.gov)));
        if (!fail(res.find((r) => r.error)?.error)) toast("Saved. Governorates are updated.");
      };
      $("#rates-form").onsubmit = async (e) => { e.preventDefault(); const f = e.target;
        const err = await setSetting("flat_shipping_fee", Number(f.flat.value) || 0);
        if (!fail(err)) toast("Saved."); };
      $("#bosta-form").onsubmit = async (e) => { e.preventDefault(); const f = e.target;
        if (!fail(await setSetting("bosta", { ...cfg, package_size: f.package_size.value, business_location_id: f.business_location_id.value.trim() || null }))) toast("Saved."); };
      const testKey = async () => {
        const b = $("#bk-test"); if (b) { b.disabled = true; b.textContent = "Testing…"; }
        try {
          const r = await bostaFetch("check");
          toast(r.ok ? `Connected to Bosta. ${r.cities} cities available.` : `Bosta refused the key: ${r.error}`);
        } catch (err) { toast("Bosta: " + err.message); }
        if (b) { b.disabled = false; b.textContent = "Test connection"; }
      };
      $("#bosta-key-form").onsubmit = async (e) => {
        e.preventDefault();
        const value = e.target.key.value.trim();
        if (!value) { toast("Paste the key first."); e.target.key.focus(); return; }
        const { error } = await db.rpc("set_bosta_key", { p_key: value });
        e.target.key.value = "";
        if (error) { toast(/invalid_key/.test(error.message) ? "That doesn't look like a Bosta API key. Copy it again from Bosta." : "Could not save: " + error.message); return; }
        toast("Saved. Waiting orders are being sent to Bosta now.");
        await PAGES.delivery();
        testKey();
      };
      $("#bk-test")?.addEventListener("click", testKey);
      $("#bk-remove")?.addEventListener("click", async () => {
        if (!confirm("Remove the Bosta key? New orders will wait until you add a key again.")) return;
        if (!fail((await db.rpc("set_bosta_key", { p_key: "" })).error)) { toast("Key removed."); PAGES.delivery(); }
      });
      $("#sync-areas").onclick = async (e) => {
        e.target.disabled = true; e.target.textContent = "Updating…";
        try { const r = await bostaFetch("sync-areas"); toast(`Updated. ${r.cities} cities, ${r.districts} areas from Bosta.`); PAGES.delivery(); }
        catch (err) { toast("Bosta: " + err.message); e.target.disabled = false; e.target.textContent = "Update Bosta areas"; }
      };
    },
    async emails() {
      const [{ data: tpls, error }, from] = await Promise.all([db.from("email_templates").select("*"), getSetting("email_from")]);
      if (error) throw error;
      const byStatus = Object.fromEntries(tpls.map((t) => [t.status, t]));
      const { data: { session } } = await db.auth.getSession();
      $("#content").innerHTML = head("Emails") +
        `<p class="muted" style="margin-top:-12px">Customers get one email each time their order moves, in the language they ordered in. Placeholders: <code>{name}</code> <code>{order}</code> <code>{total}</code> <code>{items}</code> <code>{tracking}</code> <code>{payment_note}</code> (a "pay cash to the courier" line for unpaid cash orders).</p>` +
        panel("Sending", "Emails go out through Resend. Add the secret <strong>RESEND_API_KEY</strong> in Supabase → Edge Functions → Secrets. Until you verify your own domain in Resend, the test sender only delivers to your own Resend email.", `<form class="panel-body form" id="from-form">
          <label class="field"><span>From</span><input class="input" name="from" value="${esc(from || "")}" placeholder="Maskati <orders@yourdomain.com>"></label>
          <div class="actions"><button class="btn btn-primary">Save</button></div></form>`) +
        STATUSES.map((s) => panel(STATUS_LABEL[s], "", `<form class="panel-body form" data-tpl="${s}">
          <div class="row two"><label class="field"><span>Subject (Arabic)</span><input class="input" dir="rtl" name="subject_ar" value="${esc(byStatus[s]?.subject_ar)}"></label>
            <label class="field"><span>Subject (English)</span><input class="input" name="subject_en" value="${esc(byStatus[s]?.subject_en)}"></label></div>
          <div class="row two"><label class="field"><span>Text (Arabic)</span><textarea class="input" dir="rtl" name="body_ar" rows="7">${esc(byStatus[s]?.body_ar)}</textarea></label>
            <label class="field"><span>Text (English)</span><textarea class="input" name="body_en" rows="7">${esc(byStatus[s]?.body_en)}</textarea></label></div>
          <div class="actions"><select class="input" name="test_lang" style="max-width:120px"><option value="ar">Arabic</option><option value="en">English</option></select>
            <button type="button" class="btn btn-secondary" data-test="${s}">Send test to ${esc(session.user.email)}</button><button class="btn btn-primary">Save</button></div></form>`)).join("");
      $("#from-form").onsubmit = async (e) => { e.preventDefault(); if (!fail(await setSetting("email_from", e.target.from.value.trim()))) toast("Saved."); };
      $$("[data-tpl]").forEach((f) => f.onsubmit = async (e) => {
        e.preventDefault(); const v = Object.fromEntries(new FormData(f)); delete v.test_lang; v.updated_at = new Date().toISOString();
        if (!fail((await db.from("email_templates").update(v).eq("status", f.dataset.tpl)).error)) toast(`Saved. The ${STATUS_LABEL[f.dataset.tpl]} email is updated.`);
      });
      $$("[data-test]").forEach((b) => b.onclick = async () => {
        const f = b.closest("form"); b.disabled = true;
        const { data, error } = await db.functions.invoke("notify-order", { body: { test: { status: b.dataset.test, lang: f.test_lang.value, to: session.user.email } } });
        b.disabled = false;
        toast(error ? "Could not send: " + error.message : data.email_status === "sent" ? "Test sent. Check your inbox." : `${EMAIL_LABEL[data.email_status]}${data.error ? ": " + data.error.slice(0, 120) : ""}`);
      });
    }
  };

  // ---------- CSV export ----------
  function exportCsv(list, label) {
    const cols = ["order", "date", "status", "source", "customer", "phone", "whatsapp", "email", "governorate", "district", "address", "items", "subtotal", "discount", "delivery", "total", "payment", "paid", "promo", "bosta_tracking"];
    const rows = list.map((o) => [o.order_number, new Date(o.created_at).toISOString(), STATUS_LABEL[o.status], o.source, o.customer_name,
      // keep phone numbers as text so Excel doesn't turn them into numbers
      `="${o.phone}"`, o.whatsapp ? `="${o.whatsapp}"` : "", o.email, o.governorate, o.district_name, o.address, itemsSummary(o), o.subtotal, o.discount, o.shipping_fee, o.total,
      PAY[o.payment_method], o.payment_status, o.promo_code, o.bosta_tracking_number]);
    download(`maskati-orders-${label}-${new Date().toISOString().slice(0, 10)}.csv`, [cols.join(","), ...rows.map((r) => r.map((v, i) => i === 5 || i === 6 ? v : csvCell(v)).join(","))].join("\n"));
    toast(`Exported ${rows.length} orders.`);
  }

  // ---------- product editor ----------
  async function uploadImage(file) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await db.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return db.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }
  function editProduct(p) {
    const v = (k) => esc(p?.[k] ?? "");
    const needs = p?.hair_needs || [];
    const m = openModal(`${modalHead(p ? "Edit product" : "Add product")}<form class="modal-body form" id="p-form">
      <div class="row two"><label class="field"><span>Name (Arabic)</span><input class="input" dir="rtl" name="name_ar" required value="${v("name_ar")}"></label>
        <label class="field"><span>Name (English)</span><input class="input" name="name_en" required value="${v("name_en")}"></label></div>
      <div class="row three"><label class="field"><span>Price (EGP)</span><input class="input" type="number" min="0" step="1" name="price" required value="${v("price")}"></label>
        <label class="field"><span>Was (optional)</span><input class="input" type="number" min="0" step="1" name="compare_at_price" value="${v("compare_at_price")}"></label>
        <label class="field"><span>Stock</span><input class="input" type="number" min="0" step="1" name="stock" value="${p ? p.stock : 100}"></label></div>
      <div class="row three"><label class="field"><span>Type (Arabic)</span><input class="input" dir="rtl" name="kind_ar" value="${v("kind_ar")}" placeholder="ماسك للشعر"></label>
        <label class="field"><span>Type (English)</span><input class="input" name="kind_en" value="${v("kind_en")}" placeholder="Hair mask"></label>
        <label class="field"><span>Size</span><input class="input" name="size" value="${v("size")}" placeholder="250 ml"></label></div>
      <div class="field"><span>Hair needs</span><div class="checks">${["dry", "damaged", "coloured"].map((n) => `<label><input type="checkbox" name="need" value="${n}" ${needs.includes(n) ? "checked" : ""}> ${n === "coloured" ? "after colour" : n}</label>`).join("")}</div></div>
      <div class="row two"><label class="field"><span>One-line summary (Arabic)</span><input class="input" dir="rtl" name="short_ar" value="${v("short_ar")}"></label>
        <label class="field"><span>One-line summary (English)</span><input class="input" name="short_en" value="${v("short_en")}"></label></div>
      <div class="row two"><label class="field"><span>Description (Arabic)</span><textarea class="input" dir="rtl" name="description_ar">${v("description_ar")}</textarea></label>
        <label class="field"><span>Description (English)</span><textarea class="input" name="description_en">${v("description_en")}</textarea></label></div>
      <div class="row two"><label class="field"><span>How to use (Arabic)</span><textarea class="input" dir="rtl" name="how_to_use_ar">${v("how_to_use_ar")}</textarea></label>
        <label class="field"><span>How to use (English)</span><textarea class="input" name="how_to_use_en">${v("how_to_use_en")}</textarea></label></div>
      <div class="row two"><label class="field"><span>Ingredients (Arabic)</span><textarea class="input" dir="rtl" name="ingredients_ar">${v("ingredients_ar")}</textarea></label>
        <label class="field"><span>Ingredients (English)</span><textarea class="input" name="ingredients_en">${v("ingredients_en")}</textarea></label></div>
      <div class="row three"><label class="field"><span>Badge (Arabic)</span><input class="input" dir="rtl" name="badge_ar" value="${v("badge_ar")}" placeholder="جديد"></label>
        <label class="field"><span>Badge (English)</span><input class="input" name="badge_en" value="${v("badge_en")}" placeholder="New"></label>
        <label class="field"><span>Order on site</span><input class="input" type="number" name="sort_order" value="${p?.sort_order ?? 10}"></label></div>
      <div class="field"><span>Photo</span><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <img class="img-preview" id="p-img" src="${v("image_url") || "/assets/maskati-mark.png"}" alt="">
        <div class="form"><input type="file" accept="image/*" id="p-file"><span class="muted">Square-cornered, 4:5, product on a stone-white ground.</span></div></div></div>
      <div class="actions">${p ? `<button type="button" class="btn btn-danger" id="p-del">Delete</button>` : ""}<button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" id="p-save">Save</button></div>
    </form>`);
    let imageUrl = p?.image_url || null;
    $("#p-file", m).onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      $("#p-save", m).disabled = true; toast("Uploading photo...");
      try { imageUrl = await uploadImage(file); $("#p-img", m).src = imageUrl; toast("Photo uploaded."); }
      catch (err) { toast("Upload failed: " + err.message); }
      $("#p-save", m).disabled = false;
    };
    $("#p-form", m).onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const row = {};
      for (const [k, val] of fd) if (k !== "need") row[k] = String(val).trim() || null;
      row.price = Number(row.price) || 0;
      row.compare_at_price = row.compare_at_price ? Number(row.compare_at_price) : null;
      row.stock = Number(row.stock) || 0;
      row.sort_order = Number(row.sort_order) || 0;
      row.hair_needs = fd.getAll("need");
      row.image_url = imageUrl;
      if (!p) row.slug = (row.name_en || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
      const { error } = p ? await db.from("products").update(row).eq("id", p.id) : await db.from("products").insert(row);
      if (fail(error)) return;
      m.close(); toast(p ? "Saved." : "Saved. The product is on the site."); PAGES.products();
    };
    $("#p-del", m)?.addEventListener("click", async () => {
      if (!confirm(`Delete ${p.name_en}? It will be removed from the site. Past orders keep their record.`)) return;
      if (!fail((await db.from("products").delete().eq("id", p.id)).error)) { m.close(); toast("Deleted."); PAGES.products(); }
    });
  }
  function editBundle(b, products) {
    const v = (k) => esc(b?.[k] ?? "");
    const steps = b?.product_ids?.length ? [...b.product_ids] : [products[0]?.id];
    const stepSel = (id, i) => `<div style="display:flex;gap:8px;align-items:center"><span class="muted">${i + 1}.</span><select class="input" data-step>${products.map((p) => `<option value="${p.id}" ${p.id === id ? "selected" : ""}>${esc(p.name_en)}</option>`).join("")}</select><button type="button" class="icon-btn" data-rm="${i}" aria-label="Remove">✕</button></div>`;
    const m = openModal(`${modalHead(b ? "Edit routine" : "Add routine")}<form class="modal-body form" id="b-form">
      <div class="row two"><label class="field"><span>Name (Arabic)</span><input class="input" dir="rtl" name="name_ar" required value="${v("name_ar")}"></label>
        <label class="field"><span>Name (English)</span><input class="input" name="name_en" required value="${v("name_en")}"></label></div>
      <div class="row two"><label class="field"><span>Description (Arabic)</span><textarea class="input" dir="rtl" name="description_ar">${v("description_ar")}</textarea></label>
        <label class="field"><span>Description (English)</span><textarea class="input" name="description_en">${v("description_en")}</textarea></label></div>
      <div class="row four"><label class="field"><span>Price (EGP)</span><input class="input" type="number" min="0" name="price" required value="${v("price")}"></label>
        <label class="field"><span>Was</span><input class="input" type="number" min="0" name="compare_at_price" value="${v("compare_at_price")}"></label>
        <label class="field"><span>Hair need</span><select class="input" name="hair_need">${["", "dry", "damaged", "coloured"].map((n) => `<option value="${n}" ${b?.hair_need === n ? "selected" : ""}>${n || "—"}</option>`).join("")}</select></label>
        <label class="field"><span>Order</span><input class="input" type="number" name="sort_order" value="${b?.sort_order ?? 10}"></label></div>
      <div class="field"><span>Steps, in order of use</span><div class="form" id="steps"></div><button type="button" class="btn btn-secondary btn-sm" id="add-step" style="justify-self:start">Add step</button></div>
      <div class="actions">${b ? `<button type="button" class="btn btn-danger" id="b-del">Delete</button>` : ""}<button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary">Save</button></div>
    </form>`);
    const renderSteps = () => {
      $("#steps", m).innerHTML = steps.map(stepSel).join("");
      $$("[data-step]", m).forEach((s, i) => s.onchange = () => { steps[i] = s.value; });
      $$("[data-rm]", m).forEach((x) => x.onclick = () => { steps.splice(+x.dataset.rm, 1); renderSteps(); });
    };
    renderSteps();
    $("#add-step", m).onclick = () => { steps.push(products[0]?.id); renderSteps(); };
    $("#b-form", m).onsubmit = async (e) => {
      e.preventDefault();
      const row = Object.fromEntries([...new FormData(e.target)].map(([k, val]) => [k, String(val).trim() || null]));
      row.price = Number(row.price) || 0;
      row.compare_at_price = row.compare_at_price ? Number(row.compare_at_price) : null;
      row.sort_order = Number(row.sort_order) || 0;
      row.product_ids = steps.filter(Boolean);
      if (!b) { row.slug = (row.name_en || "routine").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6); row.image_url = "/assets/products/bundle.svg"; }
      const { error } = b ? await db.from("bundles").update(row).eq("id", b.id) : await db.from("bundles").insert(row);
      if (!fail(error)) { m.close(); toast("Saved."); PAGES.bundles(); }
    };
    $("#b-del", m)?.addEventListener("click", async () => { if (confirm(`Delete ${b.name_en} from the site?`) && !fail((await db.from("bundles").delete().eq("id", b.id)).error)) { m.close(); toast("Deleted."); PAGES.bundles(); } });
  }

  // ---------- chart ----------
  function chart(daily) {
    const W = 640, H = 220, P = 28;
    const max = Math.max(1, ...daily.map((d) => Number(d.total)));
    const bw = (W - P * 2) / daily.length;
    const grid = [0, .5, 1].map((f) => { const y = H - P - f * (H - P * 2); return `<line x1="${P}" x2="${W - P}" y1="${y}" y2="${y}" stroke="var(--chart-grid)"/><text x="${P - 4}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--ink-muted)">${Math.round(max * f)}</text>`; }).join("");
    const bars = daily.map((d, i) => { const h = (Number(d.total) / max) * (H - P * 2); return `<rect x="${P + i * bw + 2}" y="${H - P - h}" width="${Math.max(2, bw - 4)}" height="${h}" fill="var(--chart-1)"><title>${d.day}: ${money(d.total)}</title></rect>`; }).join("");
    const last = daily[daily.length - 1];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily sales">${grid}${bars}
      <text x="${W - P}" y="${H - 8}" text-anchor="end" font-size="11" fill="var(--ink-muted)">Today: ${money(last?.total)}</text>
      <text x="${P}" y="${H - 8}" font-size="11" fill="var(--ink-muted)">${daily[0]?.day || ""}</text></svg>`;
  }

  boot();
})();
