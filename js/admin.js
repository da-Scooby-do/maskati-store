(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "EGP " + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const date = (d) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  const PAY = { cod: "Cash on delivery", instapay: "InstaPay", vodafone_cash: "Vodafone Cash" };
  const SECTION_NAMES = {
    hero: ["Hero", "Headline, text and Shop now"], bestsellers: ["Best sellers", "Products marked best seller"],
    consult: ["Hair consultation", "Dry / damaged / after colour quiz"], bundles: ["Routines", "Every visible routine"],
    story: ["Our story", "Brand story and pillars"], reviews: ["Reviews", "Latest approved reviews"],
    faq: ["FAQ", "Visible questions"], community: ["Community", "Social links and sign-up"]
  };

  let toastTimer;
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600); };
  const fail = (error) => { if (error) { toast("Could not save: " + error.message); return true; } return false; };
  const toggle = (attrs, checked, label = "") => `<label class="toggle"><input type="checkbox" ${attrs} ${checked ? "checked" : ""}><span class="track"></span>${label}</label>`;

  // ---------- auth ----------
  async function boot() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return showLogin();
    const { data: isAdmin } = await db.rpc("is_admin");
    if (!isAdmin) return showLogin(`${session.user.email} is not an owner account for this shop.`, true);
    showShell(session.user.email);
  }
  function showLogin(msg = "", signedIn = false) {
    document.body.innerHTML = `<div class="login"><form class="login-card" id="login-form">
      <img src="/assets/maskati-lockup.png" alt="Maskati">
      <h1 style="font-size:26px">Owner dashboard</h1>
      ${msg ? `<p style="color:var(--danger);margin:0">${esc(msg)}</p>` : ""}
      ${signedIn ? `<button class="btn btn-secondary" type="button" id="logout">Sign out</button>` : `
      <label class="field"><span>Email</span><input class="input" id="email" type="email" required autocomplete="username"></label>
      <label class="field"><span>Password</span><input class="input" id="password" type="password" required autocomplete="current-password"></label>
      <button class="btn btn-primary" type="submit">Sign in</button>`}
      <p id="login-msg" class="muted" style="margin:0"></p>
      <a href="/">← Back to the shop</a>
    </form><div class="toast" id="toast"></div></div>`;
    $("#logout")?.addEventListener("click", async () => { await db.auth.signOut(); showLogin(); });
    $("#login-form").onsubmit = async (e) => {
      e.preventDefault();
      if (signedIn) return;
      $("#login-msg").textContent = "Signing in...";
      const { error } = await db.auth.signInWithPassword({ email: $("#email").value.trim(), password: $("#password").value });
      if (error) { $("#login-msg").textContent = error.message; return; }
      boot();
    };
  }

  // ---------- shell ----------
  const NAV = [
    ["Overview", [["overview", "Overview"]]],
    ["Sales", [["orders", "Orders"], ["subscribers", "Subscribers"]]],
    ["Catalogue", [["products", "Products"], ["bundles", "Routines"], ["reviews", "Reviews"]]],
    ["Website", [["home", "Home page"], ["announcement", "Announcement bar"], ["faq", "Q&A"], ["social", "Contact & social"]]],
    ["Store", [["shipping", "Shipping"]]]
  ];
  let pendingCount = 0;
  function showShell(email) {
    document.body.innerHTML = `<div class="shell">
      <nav class="sidebar" id="sidebar" aria-label="Dashboard">
        <a class="brand" href="#/overview"><img src="/assets/maskati-lockup.png" alt="Maskati"></a>
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
      db.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("reviews").select("id", { count: "exact", head: true }).eq("is_approved", false)
    ]);
    pendingCount = p || 0;
    const pb = $("#pending-badge"), rb = $("#review-badge");
    if (pb) { pb.textContent = p; pb.hidden = !p; }
    if (rb) { rb.textContent = r; rb.hidden = !r; }
  }
  function route() {
    const id = (location.hash.replace(/^#\/?/, "") || "overview").split("/")[0];
    $$("#sidebar a[data-id]").forEach((a) => a.dataset.id === id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    $("#sidebar").classList.remove("open");
    const page = PAGES[id] || PAGES.overview;
    $("#content").innerHTML = `<p class="muted">Loading...</p>`;
    page().catch((e) => { $("#content").innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`; });
  }
  const head = (title, action = "") => `<div class="page-head"><h1>${title}</h1>${action}</div>`;
  const panel = (title, desc, body, actions = "") => `<section class="panel"><div class="panel-head"><div><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ""}</div><div class="actions">${actions}</div></div>${body}</section>`;
  function openModal(html) { const m = $("#modal"); m.innerHTML = html; m.showModal(); m.querySelector("[data-close]")?.addEventListener("click", () => m.close()); return m; }
  const modalHead = (title) => `<div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Close">✕</button></div>`;
  async function getSetting(key) { const { data } = await db.from("site_settings").select("value").eq("key", key).maybeSingle(); return data?.value; }
  async function setSetting(key, value) { const { error } = await db.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }); return error; }

  // ---------- orders helpers ----------
  const orderRow = (o) => `<tr class="clickable" data-order="${o.id}">
    <td><strong>#${o.order_number}</strong></td><td>${esc(o.customer_name)}<div class="muted">${esc(o.phone)}</div></td>
    <td>${esc(o.governorate)}</td><td>${PAY[o.payment_method] || o.payment_method}</td>
    <td><span class="pill ${o.status}">${o.status}</span></td><td class="num">${money(o.total)}</td><td class="muted">${date(o.created_at)}</td></tr>`;
  const ordersTable = (list) => list.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Governorate</th><th>Payment</th><th>Status</th><th class="num">Total</th><th>Placed</th></tr></thead><tbody>${list.map(orderRow).join("")}</tbody></table></div>` : `<p class="empty">No orders yet.</p>`;
  function bindOrderRows(onChange) { $$("[data-order]").forEach((tr) => tr.onclick = () => showOrder(tr.dataset.order, onChange)); }
  async function showOrder(id, onChange) {
    const [{ data: o }, { data: items }] = await Promise.all([
      db.from("orders").select("*").eq("id", id).single(),
      db.from("order_items").select("*").eq("order_id", id)
    ]);
    const intl = o.phone.replace(/^\+?20/, "0").replace(/^0/, "20");
    const m = openModal(`${modalHead("Order #" + o.order_number)}<div class="modal-body form">
      <dl class="kv">
        <dt>Status</dt><dd><span class="pill ${o.status}">${o.status}</span></dd>
        <dt>Customer</dt><dd>${esc(o.customer_name)}</dd>
        <dt>Mobile</dt><dd><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a> · <a href="https://wa.me/${esc(intl)}" target="_blank" rel="noopener">WhatsApp</a></dd>
        ${o.email ? `<dt>Email</dt><dd>${esc(o.email)}</dd>` : ""}
        <dt>Address</dt><dd>${esc(o.governorate)}, ${esc(o.city)}<br>${esc(o.address)}</dd>
        ${o.notes ? `<dt>Notes</dt><dd>${esc(o.notes)}</dd>` : ""}
        <dt>Payment</dt><dd>${PAY[o.payment_method]}</dd>
        <dt>Placed</dt><dd>${date(o.created_at)} · ${o.lang === "ar" ? "Arabic" : "English"} site</dd>
      </dl>
      <div class="table-wrap"><table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead><tbody>
        ${items.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${i.quantity}</td><td class="num">${money(i.unit_price)}</td><td class="num">${money(i.line_total)}</td></tr>`).join("")}
        <tr><td colspan="3">Subtotal</td><td class="num">${money(o.subtotal)}</td></tr>
        <tr><td colspan="3">Delivery</td><td class="num">${money(o.shipping_fee)}</td></tr>
        <tr><td colspan="3"><strong>Total</strong></td><td class="num"><strong>${money(o.total)}</strong></td></tr>
      </tbody></table></div>
      <label class="field"><span>Change status</span><select class="input" id="o-status">${STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <div class="actions"><button class="btn btn-secondary" data-close>Close</button><button class="btn btn-primary" id="o-save">Save</button></div>
    </div>`);
    $("#o-save", m).onclick = async () => {
      const status = $("#o-status", m).value;
      if (status === "cancelled" && o.status !== "cancelled" && !confirm(`Cancel order #${o.order_number}?`)) return;
      const { error } = await db.from("orders").update({ status }).eq("id", o.id);
      if (fail(error)) return;
      m.close(); toast(`Saved. Order #${o.order_number} is ${status}.`); refreshBadges(); onChange?.();
    };
  }

  // ---------- pages ----------
  const PAGES = {
    async overview() {
      const [{ data: s, error }, { data: latest }, sections] = await Promise.all([
        db.rpc("admin_stats", { days: 30 }),
        db.from("orders").select("*").order("created_at", { ascending: false }).limit(8),
        getSetting("home_sections")
      ]);
      if (error) throw error;
      $("#content").innerHTML = head("Overview", `<a class="btn btn-primary" href="#/products/new">Add product</a>`) + `
        <div class="stats">
          <div class="stat"><span class="label">Sales · 30 days</span><span class="value">${money(s.sales)}</span></div>
          <div class="stat"><span class="label">Orders · 30 days</span><span class="value">${s.orders}</span></div>
          <div class="stat"><span class="label">Average order</span><span class="value">${money(s.avg)}</span></div>
          <div class="stat"><span class="label">Waiting on you</span><span class="value">${s.pending}</span><span class="muted">pending orders</span></div>
        </div>
        <div class="cols">
          ${panel("Sales", "Daily, last 30 days", `<div class="panel-body">${chart(s.daily)}</div>`)}
          ${panel("Home page", "Sections in order", `<ul class="sections">${(sections || []).map((x, i) => `<li><span class="pos">${i + 1}</span><span>${SECTION_NAMES[x.id]?.[0] || x.id}</span><span class="pill ${x.visible ? "live" : "hidden"}">${x.visible ? "live" : "hidden"}</span><span></span></li>`).join("")}</ul>`, `<a class="btn btn-secondary btn-sm" href="#/home">Manage</a>`)}
        </div>
        ${panel("Latest orders", "", ordersTable(latest || []), `<a class="btn btn-secondary btn-sm" href="#/orders">All orders</a>`)}`;
      bindOrderRows(() => PAGES.overview());
    },
    async orders() {
      let filter = "all";
      const render = async () => {
        let q = db.from("orders").select("*").order("created_at", { ascending: false }).limit(300);
        if (filter !== "all") q = q.eq("status", filter);
        const { data, error } = await q; if (error) throw error;
        $("#content").innerHTML = head("Orders") + `<div class="filters">${["all", ...STATUSES].map((s) => `<button data-f="${s}" aria-pressed="${s === filter}">${s}</button>`).join("")}</div>
          <section class="panel">${ordersTable(data)}</section>`;
        $$("[data-f]").forEach((b) => b.onclick = () => { filter = b.dataset.f; render(); });
        bindOrderRows(render);
      };
      await render();
    },
    async subscribers() {
      const { data, error } = await db.from("subscribers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      $("#content").innerHTML = head("Subscribers", `<button class="btn btn-secondary" id="csv">Download CSV</button>`) +
        `<section class="panel">${data.length ? `<div class="table-wrap"><table><thead><tr><th>Mobile or email</th><th>Joined</th></tr></thead><tbody>${data.map((s) => `<tr><td>${esc(s.contact)}</td><td class="muted">${date(s.created_at)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">No subscribers yet.</p>`}</section>`;
      $("#csv").onclick = () => {
        const csv = "contact,joined\n" + data.map((s) => `"${s.contact.replace(/"/g, '""')}",${s.created_at}`).join("\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "maskati-subscribers.csv"; a.click();
      };
    },
    async products() {
      const { data, error } = await db.from("products").select("*").order("sort_order");
      if (error) throw error;
      $("#content").innerHTML = head("Products", `<button class="btn btn-primary" id="add">Add product</button>`) + `<section class="panel"><div class="table-wrap"><table>
        <thead><tr><th></th><th>Product</th><th class="num">Price</th><th class="num">Stock</th><th>Best seller</th><th>On site</th><th></th></tr></thead><tbody>
        ${data.map((p) => `<tr><td><img class="thumb" src="${esc(p.image_url || "/assets/maskati-mark.png")}" alt=""></td>
          <td><strong>${esc(p.name_en)}</strong><div class="muted" dir="rtl" style="font-family:var(--font-arabic)">${esc(p.name_ar)}</div></td>
          <td class="num">${money(p.price)}</td><td class="num">${p.stock <= 0 ? `<span class="pill out">out</span>` : p.stock < 10 ? `<span class="pill pending">${p.stock}</span>` : p.stock}</td>
          <td>${toggle(`data-best="${p.id}"`, p.is_bestseller)}</td><td>${toggle(`data-vis="${p.id}"`, p.is_visible)}</td>
          <td><button class="btn btn-secondary btn-sm" data-edit="${p.id}">Edit</button></td></tr>`).join("")}
        </tbody></table></div></section>`;
      $("#add").onclick = () => editProduct(null);
      $$("[data-edit]").forEach((b) => b.onclick = () => editProduct(data.find((p) => p.id === b.dataset.edit)));
      $$("[data-vis]").forEach((c) => c.onchange = async () => { if (!fail((await db.from("products").update({ is_visible: c.checked }).eq("id", c.dataset.vis)).error)) toast(c.checked ? "Saved. The product is on the site." : "Saved. The product is hidden from the site."); });
      $$("[data-best]").forEach((c) => c.onchange = async () => { if (!fail((await db.from("products").update({ is_bestseller: c.checked }).eq("id", c.dataset.best)).error)) toast("Saved."); });
      if (location.hash === "#/products/new") editProduct(null);
    },
    async bundles() {
      const [{ data, error }, { data: products }] = await Promise.all([db.from("bundles").select("*").order("sort_order"), db.from("products").select("id,name_en").order("sort_order")]);
      if (error) throw error;
      const names = Object.fromEntries(products.map((p) => [p.id, p.name_en]));
      $("#content").innerHTML = head("Routines", `<button class="btn btn-primary" id="add">Add routine</button>`) + `<section class="panel"><div class="table-wrap"><table>
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
      $("#content").innerHTML = head("Reviews") + `<p class="muted" style="margin-top:-12px">Reviews appear on the site only after you approve them. Mark "Verified" only when the name matches a real order.</p><section class="panel">${data.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Review</th><th>Product</th><th>Status</th><th>Verified</th><th></th></tr></thead><tbody>
        ${data.map((r) => `<tr><td><div style="color:var(--brand-olive)">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>${r.title ? `<strong>${esc(r.title)}</strong><br>` : ""}${esc(r.body)}<div class="muted">${esc(r.customer_name)} · ${date(r.created_at)}</div></td>
          <td>${esc(names[r.product_id] || "—")}</td><td><span class="pill ${r.is_approved ? "approved" : "pending"}">${r.is_approved ? "approved" : "waiting"}</span></td>
          <td>${toggle(`data-ver="${r.id}"`, r.is_verified)}</td>
          <td><div class="actions">${r.is_approved ? `<button class="btn btn-secondary btn-sm" data-hide="${r.id}">Hide from site</button>` : `<button class="btn btn-primary btn-sm" data-ok="${r.id}">Approve</button>`}<button class="btn btn-danger btn-sm" data-del="${r.id}">Delete</button></div></td></tr>`).join("")}
        </tbody></table></div>` : `<p class="empty">No reviews yet.</p>`}</section>`;
      const upd = async (id, v, msg) => { if (!fail((await db.from("reviews").update(v).eq("id", id)).error)) { toast(msg); refreshBadges(); PAGES.reviews(); } };
      $$("[data-ok]").forEach((b) => b.onclick = () => upd(b.dataset.ok, { is_approved: true }, "Approved. The review is on the site."));
      $$("[data-hide]").forEach((b) => b.onclick = () => upd(b.dataset.hide, { is_approved: false }, "Hidden from the site."));
      $$("[data-ver]").forEach((c) => c.onchange = () => upd(c.dataset.ver, { is_verified: c.checked }, "Saved."));
      $$("[data-del]").forEach((b) => b.onclick = async () => { if (confirm("Delete this review permanently?") && !fail((await db.from("reviews").delete().eq("id", b.dataset.del)).error)) { toast("Deleted."); refreshBadges(); PAGES.reviews(); } });
    },
    async home() {
      let sections = (await getSetting("home_sections")) || [];
      const hero = (await getSetting("hero")) || {};
      const story = (await getSetting("story")) || {};
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
        panel("Our story", "", `<form class="panel-body form" id="story-form"><div class="row two">
          <label class="field"><span>Story (Arabic)</span><textarea class="input" dir="rtl" name="ar" rows="6">${esc(story.ar)}</textarea></label>
          <label class="field"><span>Story (English)</span><textarea class="input" name="en" rows="6">${esc(story.en)}</textarea></label></div>
          <div class="actions"><button class="btn btn-primary">Save</button></div></form>`);
      const bind = () => {
        $$("[data-sv]").forEach((c) => c.onchange = () => { sections[c.dataset.sv].visible = c.checked; });
        $$("[data-up]").forEach((b) => b.onclick = () => { const i = +b.dataset.up; [sections[i - 1], sections[i]] = [sections[i], sections[i - 1]]; $("#sec-list").innerHTML = renderList(); bind(); });
        $$("[data-down]").forEach((b) => b.onclick = () => { const i = +b.dataset.down; [sections[i + 1], sections[i]] = [sections[i], sections[i + 1]]; $("#sec-list").innerHTML = renderList(); bind(); });
      };
      bind();
      $("#sec-save").onclick = async () => { if (!fail(await setSetting("home_sections", sections))) toast("Saved. The home page is updated."); };
      $("#hero-form").onsubmit = async (e) => { e.preventDefault(); if (!fail(await setSetting("hero", Object.fromEntries(new FormData(e.target))))) toast("Saved. The hero is updated."); };
      $("#story-form").onsubmit = async (e) => { e.preventDefault(); if (!fail(await setSetting("story", Object.fromEntries(new FormData(e.target))))) toast("Saved."); };
    },
    async announcement() {
      const a = (await getSetting("announcement")) || {};
      const free = await getSetting("free_shipping_over");
      $("#content").innerHTML = head("Announcement bar") + panel("Announcement", "One line across the top of every page.", `<form class="panel-body form" id="ann-form">
        ${toggle(`name="visible"`, a.visible, " Show on site")}
        <label class="field"><span>Arabic</span><input class="input" dir="rtl" name="ar" value="${esc(a.ar)}"></label>
        <label class="field"><span>English</span><input class="input" name="en" value="${esc(a.en)}"></label>
        <div class="actions"><button class="btn btn-primary">Save</button></div></form>`) +
        panel("Free delivery", "Orders at or above this amount ship free. Set 0 to turn off.", `<form class="panel-body form" id="free-form">
        <label class="field" style="max-width:240px"><span>Free delivery over (EGP)</span><input class="input" type="number" min="0" step="1" name="v" value="${esc(free ?? 0)}"></label>
        <div class="actions"><button class="btn btn-primary">Save</button></div></form>`);
      $("#ann-form").onsubmit = async (e) => { e.preventDefault(); const f = e.target;
        if (!fail(await setSetting("announcement", { visible: f.visible.checked, ar: f.ar.value.trim(), en: f.en.value.trim() }))) toast(f.visible.checked ? "Saved. The announcement bar is live." : "Saved. The announcement bar is hidden."); };
      $("#free-form").onsubmit = async (e) => { e.preventDefault(); if (!fail(await setSetting("free_shipping_over", Number(e.target.v.value) || 0))) toast("Saved."); };
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
          ${f("instapay", "InstaPay address", contact.instapay, "name@instapay")}${f("vodafone_cash", "Vodafone Cash number", contact.vodafone_cash)}
          ${f("email", "Email", contact.email)}</div><div class="actions"><button class="btn btn-primary">Save</button></div></form>`) +
        panel("Social links", "Shown in this order in the community band and the footer. Leave empty to hide.", `<form class="panel-body form" id="social-form"><div class="row two">
          ${f("instagram", "Instagram URL", social.instagram, "https://instagram.com/...")}${f("tiktok", "TikTok URL", social.tiktok, "https://tiktok.com/@...")}
          ${f("whatsapp", "WhatsApp link", social.whatsapp, "https://wa.me/20...")}${f("telegram", "Telegram community URL", social.telegram, "https://t.me/...")}
          ${f("email", "Email", social.email)}</div><div class="actions"><button class="btn btn-primary">Save</button></div></form>`);
      const trimAll = (fd) => Object.fromEntries([...fd].map(([k, v]) => [k, String(v).trim()]));
      $("#contact-form").onsubmit = async (e) => { e.preventDefault(); if (!fail(await setSetting("contact", trimAll(new FormData(e.target))))) toast("Saved."); };
      $("#social-form").onsubmit = async (e) => { e.preventDefault(); if (!fail(await setSetting("social", trimAll(new FormData(e.target))))) toast("Saved. Social links are updated."); };
    },
    async shipping() {
      const { data, error } = await db.from("shipping_zones").select("*").order("sort_order");
      if (error) throw error;
      $("#content").innerHTML = head("Shipping", `<button class="btn btn-primary" id="save">Save</button>`) + `<section class="panel"><div class="table-wrap"><table>
        <thead><tr><th>Governorate</th><th>Fee (EGP)</th><th>Working days</th><th>Deliver</th></tr></thead><tbody>
        ${data.map((z) => `<tr data-z="${z.id}"><td>${esc(z.name_en)} <span class="muted" style="font-family:var(--font-arabic)">· ${esc(z.name_ar)}</span></td>
          <td><input class="input" style="max-width:110px" type="number" min="0" name="fee" value="${z.fee}"></td>
          <td><input class="input" style="max-width:110px" name="days" value="${esc(z.days)}"></td>
          <td>${toggle(`name="is_active"`, z.is_active)}</td></tr>`).join("")}
        </tbody></table></div></section>`;
      $("#save").onclick = async () => {
        const rows = $$("[data-z]").map((tr) => ({ id: +tr.dataset.z, fee: Number($("[name=fee]", tr).value) || 0, days: $("[name=days]", tr).value.trim() || "2-4", is_active: $("[name=is_active]", tr).checked }));
        const results = await Promise.all(rows.map((r) => db.from("shipping_zones").update(r).eq("id", r.id)));
        const err = results.find((r) => r.error); if (!fail(err?.error)) toast("Saved. Shipping fees are updated.");
      };
    }
  };

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
      m.close(); toast(p ? "Saved." : "Saved. The product is on the site."); location.hash = "#/products"; PAGES.products();
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
