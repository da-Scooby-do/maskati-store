(() => {
  "use strict";

  // ---------- state ----------
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  };
  let lang = store.get("mk_lang", "ar");
  let cart = store.get("mk_cart", []); // [{type:'product'|'bundle', id, qty}]
  const data = { products: [], bundles: [], faqs: [], reviews: [], zones: [], deliveryZones: [], settings: {} };
  let loaded = false;
  let session = null; // signed-in customer, if any
  let profile = null;
  let isOwner = false;
  let recovering = false; // arrived from a password-reset email
  let promo = null; // { code, discount, free_shipping } once checked
  const districtCache = {};
  const BASE_I18N = JSON.parse(JSON.stringify(I18N));

  const $ = (sel, root = document) => root.querySelector(sel);
  const t = (key, x) => (I18N[lang][key] ?? key).replace("{x}", x ?? "");
  const L = (obj, field) => obj?.[`${field}_${lang}`] || obj?.[`${field}_ar`] || "";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const arDigits = (s) => String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  const money = (n) => {
    const v = Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
    return lang === "ar" ? `${arDigits(v.replace(/,/g, "٬"))} ج.م` : `EGP ${v}`;
  };
  const num = (n) => (lang === "ar" ? arDigits(n) : String(n));
  const STATUS_STEPS = ["confirmed", "with_courier", "delivered"];
  const statusLabel = (s) => t("status_" + s);
  const trackUrl = (n) => `https://bosta.co/tracking-shipments?shipment-number=${encodeURIComponent(n)}`;

  // ---------- icons (1.5px line drawings, currentColor) ----------
  const I = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    account: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    arrow: '<svg class="flip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m3 17 6-5 4 3 3-2 5 4"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5L10 8.5Z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19l-4 1Z"/><path d="M9 10h6M9 13h4"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 4 3 11l6 2 2 6 3-4 5 4 2-15Z"/><path d="m9 13 8-6"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    leaves: '<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M100 190C60 150 40 100 70 40c40 40 50 100 30 150Z"/><path d="M100 190C90 140 80 100 70 40"/><path d="M104 188c10-50 40-80 86-90-10 50-40 80-86 90Z"/><path d="M104 188c30-30 55-60 86-90"/></svg>'
  };

  // ---------- data ----------
  async function loadData() {
    const res = await Promise.all([
      db.from("products").select("*").order("sort_order"),
      db.from("bundles").select("*").order("sort_order"),
      db.from("faqs").select("*").order("sort_order"),
      db.from("reviews").select("*").order("created_at", { ascending: false }).limit(60),
      db.from("shipping_zones").select("*").eq("is_active", true).order("sort_order"),
      db.from("delivery_zones").select("*").order("sort_order"),
      db.from("site_settings").select("key,value")
    ]);
    const failed = res.find((r) => r.error);
    if (failed) throw failed.error;
    const [p, b, f, r, z, dz, s] = res;
    data.products = p.data; data.bundles = b.data; data.faqs = f.data; data.reviews = r.data;
    data.zones = z.data; data.deliveryZones = dz.data;
    data.settings = Object.fromEntries(s.data.map((row) => [row.key, row.value]));
    applySiteText();
    loaded = true;
  }
  // owner's wording from the dashboard's Site text page; a blank field keeps the built-in text
  function applySiteText() {
    const overrides = data.settings.site_text || {};
    for (const l of ["ar", "en"]) {
      I18N[l] = { ...BASE_I18N[l] };
      for (const [key, v] of Object.entries(overrides)) if (v?.[l]?.trim()) I18N[l][key] = v[l];
    }
  }
  const productById = (id) => data.products.find((p) => p.id === id);
  const bundleById = (id) => data.bundles.find((b) => b.id === id);
  const waNumber = () => (data.settings.contact?.whatsapp || data.settings.social?.whatsapp || "").replace(/[^\d]/g, "");
  const waLink = (text) => {
    const n = waNumber();
    return n ? `https://wa.me/${n.startsWith("0") ? "2" + n : n}${text ? "?text=" + encodeURIComponent(text) : ""}` : null;
  };
  // how many of an item can be bought: a routine is limited by its scarcest product
  function stockOf(type, id) {
    if (type === "bundle") {
      const b = bundleById(id);
      const items = (b?.product_ids || []).map(productById).filter(Boolean);
      return items.length ? Math.min(...items.map((p) => p.stock)) : 0;
    }
    return productById(id)?.stock ?? 0;
  }
  function deliveryFeeFor(zoneId, subtotal) {
    const gov = data.zones.find((z) => String(z.id) === String(zoneId));
    if (!gov) return null;
    const dz = data.deliveryZones.find((d) => d.id === gov.delivery_zone_id);
    const freeOver = Number(data.settings.free_shipping_over || 0);
    let fee = dz ? Number(dz.fee) : Number(data.settings.flat_shipping_fee || 0);
    if (freeOver > 0 && subtotal >= freeOver) fee = 0;
    return { gov, fee, days: dz?.days || "2-4" };
  }
  async function districtsFor(cityId) {
    if (!cityId) return [];
    if (!districtCache[cityId]) {
      const { data: rows } = await db.from("bosta_districts").select("district_id,name_en,name_ar").eq("city_id", cityId).eq("dropoff", true).order("name_en");
      districtCache[cityId] = rows || [];
    }
    return districtCache[cityId];
  }

  // ---------- cart ----------
  const saveCart = () => { store.set("mk_cart", cart); renderCartCount(); };
  function cartLines() {
    return cart.map((c) => {
      const item = c.type === "bundle" ? bundleById(c.id) : productById(c.id);
      return item ? { ...c, item, price: Number(item.price), total: Number(item.price) * c.qty } : null;
    }).filter(Boolean);
  }
  const cartSubtotal = () => cartLines().reduce((s, l) => s + l.total, 0);
  function addToCart(type, id, qty = 1) {
    const max = stockOf(type, id);
    const found = cart.find((c) => c.type === type && c.id === id);
    const want = (found?.qty || 0) + qty;
    if (want > max) { toast(max > 0 ? t("only_left", num(max)) : t("out_of_stock")); if (!max) return; }
    if (found) found.qty = Math.min(max, 20, want); else cart.push({ type, id, qty: Math.min(max, 20, qty) });
    saveCart();
    if (want <= max) toast(t("added"));
    renderDrawer();
  }
  function setQty(type, id, qty) {
    const max = Math.min(20, stockOf(type, id));
    if (qty > max) { toast(t("only_left", num(max))); qty = max; }
    if (qty <= 0) cart = cart.filter((c) => !(c.type === type && c.id === id));
    else { const c = cart.find((c) => c.type === type && c.id === id); if (c) c.qty = qty; }
    saveCart(); renderDrawer();
    if (location.hash.startsWith("#/checkout")) { promo = null; route(); }
  }
  function renderCartCount() {
    const n = cart.reduce((s, c) => s + c.qty, 0);
    const el = $("#cart-count");
    if (!el) return;
    el.textContent = num(n); el.hidden = n === 0;
  }

  // ---------- shell ----------
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = lang === "ar" ? "ماسكاتي | عناية بالشعر في كل لحظة" : "Maskati | Hair care, every moment";
  }
  function renderShell() {
    const a = data.settings.announcement;
    $("#announce").textContent = a?.[lang] || "";
    $("#announce").hidden = !(a?.visible && a[lang]);
    $("#header").innerHTML = `
      <div class="wrap header-in">
        <a class="logo" href="#/" aria-label="Maskati"><img src="/assets/maskati-lockup.png" alt="Maskati" width="127" height="34"></a>
        <nav class="nav" aria-label="main">
          <a href="#/shop">${t("nav_shop")}</a>
          <a href="#/routines">${t("nav_routines")}</a>
          <a href="#/consult">${t("nav_consult")}</a>
          <a href="#/story">${t("nav_story")}</a>
          <a href="#/faq">${t("nav_faq")}</a>
        </nav>
        <div class="header-actions">
          <button class="lang-btn" id="lang-btn" type="button">${t("lang_switch")}</button>
          <a class="icon-btn" href="#/account" aria-label="${t("account")}">${I.account}</a>
          <button class="icon-btn" id="bag-btn" type="button" aria-label="${t("bag")}">${I.bag}<span class="count" id="cart-count" hidden></span></button>
          <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="${t("menu")}" aria-expanded="false">${I.menu}</button>
        </div>
      </div>
      <nav class="wrap mobile-nav" id="mobile-nav" aria-label="mobile">
        <a href="#/shop">${t("nav_shop")}</a><a href="#/routines">${t("nav_routines")}</a>
        <a href="#/consult">${t("nav_consult")}</a><a href="#/story">${t("nav_story")}</a><a href="#/faq">${t("nav_faq")}</a>
        <a href="#/account">${t("account")}</a>
      </nav>`;
    $("#lang-btn").onclick = () => {
      // keep anything typed into a form across the re-render
      const typed = [...document.querySelectorAll("#main input, #main select, #main textarea")].filter((el) => el.id && el.type !== "radio").map((el) => [el.id, el.value]);
      const payment = $("#checkout-form")?.payment_method?.value;
      lang = lang === "ar" ? "en" : "ar"; store.set("mk_lang", lang); applyLang(); renderAll();
      setTimeout(() => {
        typed.forEach(([id, value]) => { const el = document.getElementById(id); if (el && el.tagName !== "SELECT") el.value = value; });
        typed.filter(([id]) => document.getElementById(id)?.tagName === "SELECT").forEach(([id, value]) => { const el = document.getElementById(id); el.value = value; el.dispatchEvent(new Event("change")); });
        if (payment && $("#checkout-form")) $("#checkout-form").payment_method.value = payment;
      }, 0);
    };
    $("#bag-btn").onclick = openDrawer;
    $("#menu-btn").onclick = (e) => {
      const nav = $("#mobile-nav"); nav.classList.toggle("open");
      e.currentTarget.setAttribute("aria-expanded", nav.classList.contains("open"));
    };
    renderCartCount();
    renderFooter();
    const wa = waLink();
    $("#wa-float").hidden = !wa;
    if (wa) { $("#wa-float").href = wa; $("#wa-float").innerHTML = I.whatsapp; $("#wa-float").setAttribute("aria-label", t("whatsapp")); }
  }
  function socialLinks() {
    const s = data.settings.social || {};
    return ["instagram", "tiktok", "whatsapp", "telegram", "email"].filter((k) => s[k]).map((k) => {
      let href = s[k];
      if (k === "email" && !href.startsWith("mailto:")) href = "mailto:" + href;
      if (k === "whatsapp" && !/^https?:/.test(href)) href = waLink() || "#";
      return `<a class="social" href="${esc(href)}" target="_blank" rel="noopener">${I[k]}<span>${t(k)}</span></a>`;
    }).join("");
  }
  function renderFooter() {
    $("#footer").innerHTML = `
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <span class="footer-logo"><img src="/assets/maskati-lockup.png" alt="Maskati" width="112" height="30"></span>
            <p class="caption" style="margin-top:16px">${t("footer_tag")}</p>
          </div>
          <div><h4>${t("footer_shop")}</h4><ul>
            ${data.products.slice(0, 4).map((p) => `<li><a href="#/product/${esc(p.slug)}">${esc(L(p, "name"))}</a></li>`).join("")}
            <li><a href="#/routines">${t("nav_routines")}</a></li></ul></div>
          <div><h4>${t("footer_help")}</h4><ul>
            <li><a href="#/faq">${t("nav_faq")}</a></li>
            <li><a href="#/account">${t("my_orders")}</a></li>
            ${waLink() ? `<li><a href="${esc(waLink())}" target="_blank" rel="noopener">${t("footer_contact")}</a></li>` : ""}
          </ul></div>
          <div><h4>${t("footer_follow")}</h4><ul>
            ${["instagram", "tiktok", "telegram", "email"].filter((k) => data.settings.social?.[k]).map((k) => {
              let href = data.settings.social[k]; if (k === "email" && !href.startsWith("mailto:")) href = "mailto:" + href;
              return `<li><a href="${esc(href)}" target="_blank" rel="noopener">${t(k)}</a></li>`; }).join("")}
          </ul></div>
        </div>
        <div class="legal"><span>© ${num(new Date().getFullYear())} Maskati · ماسكاتي. ${t("rights")}.</span><span>${lang === "ar" ? "مصر" : "Egypt"}</span></div>
      </div>`;
  }

  // ---------- components ----------
  function productCard(p) {
    const badge = L(p, "badge");
    const soldOut = p.stock <= 0;
    return `
      <div class="card-wrap">
        <a class="card" href="#/product/${esc(p.slug)}">
          ${badge ? `<span class="disc">${esc(badge)}</span>` : ""}
          <div class="tile"><img src="${esc(p.image_url || "/assets/maskati-mark.png")}" alt="${esc(L(p, "name"))}" loading="lazy"></div>
          <div class="meta">
            <h3 class="title">${esc(L(p, "name"))}</h3>
            <div class="sub">${esc(L(p, "kind"))}${p.size ? " · " + esc(p.size) : ""}</div>
            <div class="price-line">${money(p.price)}${p.compare_at_price > p.price ? `<span class="compare">${money(p.compare_at_price)}</span>` : ""}</div>
          </div>
        </a>
        <div class="card-add center">
          <button class="btn btn-secondary" type="button" data-add="product" data-id="${p.id}" ${soldOut ? "disabled" : ""}>${soldOut ? t("out_of_stock") : t("add_to_bag")}</button>
        </div>
      </div>`;
  }
  function bundleCard(b) {
    const items = (b.product_ids || []).map(productById).filter(Boolean);
    const save = Number(b.compare_at_price) - Number(b.price);
    const soldOut = stockOf("bundle", b.id) <= 0;
    return `
      <article class="bundle">
        <div class="tile"><img src="${esc(b.image_url || "/assets/products/bundle.svg")}" alt="" loading="lazy"></div>
        <div class="bundle-body">
          <h3 class="title">${esc(L(b, "name"))}</h3>
          <p class="muted body-sm" style="margin:0">${esc(L(b, "description"))}</p>
          <ol>${items.map((p) => `<li><a href="#/product/${esc(p.slug)}">${esc(L(p, "name"))}</a></li>`).join("")}</ol>
          ${save > 0 ? `<div class="save">${t("you_save")} ${money(save)}</div>` : ""}
          <div class="buy">
            <div>${money(b.price)}${save > 0 ? `<span class="compare">${money(b.compare_at_price)}</span>` : ""}</div>
            <button class="btn btn-primary" type="button" data-add="bundle" data-id="${b.id}" ${soldOut ? "disabled" : ""}>${soldOut ? t("out_of_stock") : t("add_routine")}</button>
          </div>
        </div>
      </article>`;
  }
  function reviewCard(r) {
    const p = productById(r.product_id);
    return `
      <article class="review">
        <div class="stars" aria-label="${r.rating}/5">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
        ${r.title ? `<strong>${esc(r.title)}</strong>` : ""}
        <p style="margin:0">${esc(r.body)}</p>
        <div class="body-sm"><strong>${esc(r.customer_name)}</strong>${r.is_verified ? ` · <span class="verified">${t("verified")}</span>` : ""}</div>
        ${p ? `<div class="body-sm muted">${esc(L(p, "name"))}</div>` : ""}
      </article>`;
  }
  function faqList() {
    return `<div class="faq">${data.faqs.map((f) => `
      <details><summary><span>${esc(L(f, "question"))}</span><span class="plus">${I.plus}</span></summary><p>${esc(L(f, "answer"))}</p></details>`).join("")}
      ${waLink() ? `<p class="center" style="margin-top:24px"><a class="btn btn-ghost" href="${esc(waLink())}" target="_blank" rel="noopener">${t("faq_more")} ${I.arrow}</a></p>` : ""}
    </div>`;
  }

  // ---------- home sections ----------
  const sections = {
    hero() {
      const h = data.settings.hero || {};
      const hero = data.products.find((p) => p.is_bestseller) || data.products[0];
      return `<section class="hero"><div class="wrap hero-grid">
        <div>
          <span class="eyebrow">${t("hero_eyebrow")}</span>
          <h1 class="display-xl">${esc((lang === "ar" ? h.ar_title : h.en_title) || t("footer_tag"))}</h1>
          <p class="lede">${esc((lang === "ar" ? h.ar_text : h.en_text) || "")}</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#/shop">${t("shop_now")} ${I.arrow}</a>
            <a class="btn btn-secondary" href="#/consult">${t("discover_routine")}</a>
          </div>
        </div>
        <div class="hero-art">
          <div class="leaf-frame">${hero ? `<img src="${esc(hero.image_url)}" alt="${esc(L(hero, "name"))}">` : ""}</div>
          <img class="mark" src="/assets/maskati-mark.png" alt="" width="120" height="115">
          <div class="line-leaves">${I.leaves}</div>
        </div>
      </div></section>`;
    },
    bestsellers() {
      const list = data.products.filter((p) => p.is_bestseller).slice(0, 8);
      if (!list.length) return "";
      return `<section><div class="wrap">
        <div class="section-head"><div><span class="eyebrow">${t("bestsellers_eyebrow")}</span><h2 class="display-md">${t("bestsellers_title")}</h2></div>
        <a class="btn btn-ghost" href="#/shop">${t("view_all")} ${I.arrow}</a></div>
        <div class="grid">${list.map(productCard).join("")}</div>
      </div></section>`;
    },
    consult() {
      return `<section class="tint" id="consult"><div class="wrap consult">
        <span class="eyebrow">${t("consult_eyebrow")}</span>
        <h2 class="display-md">${t("consult_title")}</h2>
        <p class="lede" style="margin:16px auto 0">${t("consult_text")}</p>
        <div class="consult-options" role="group">
          ${["dry", "damaged", "coloured"].map((n) => `<button type="button" class="consult-opt" data-need="${n}" aria-pressed="false"><strong>${t("need_" + n)}</strong><span>${t("need_" + n + "_hint")}</span></button>`).join("")}
        </div>
        <div class="consult-result" id="consult-result" aria-live="polite"></div>
      </div></section>`;
    },
    bundles() {
      if (!data.bundles.length) return "";
      return `<section id="routines"><div class="wrap">
        <div class="section-head"><div><span class="eyebrow">${t("routines_eyebrow")}</span><h2 class="display-md">${t("routines_title")}</h2></div></div>
        <div class="bundles">${data.bundles.map(bundleCard).join("")}</div>
      </div></section>`;
    },
    story() {
      const s = data.settings.story || {};
      return `<section class="tint" id="story"><div class="wrap story">
        <div class="story-img leaf-frame"><img src="/assets/maskati-mark.png" alt="" width="300" height="288"></div>
        <div>
          <span class="eyebrow">${t("story_eyebrow")}</span>
          <h2 class="display-md">${t("story_title")}</h2>
          <p class="lede" style="margin-top:16px">${esc(s[lang] || "")}</p>
          <blockquote class="quote">${t("story_quote")}</blockquote>
          <div class="pillars">${[1, 2, 3].map((i) => `<div class="pillar"><h3>${t("pillar" + i + "_t")}</h3><p>${t("pillar" + i + "_p")}</p></div>`).join("")}</div>
        </div>
      </div></section>`;
    },
    reviews() {
      const list = data.reviews.slice(0, 6);
      return `<section><div class="wrap">
        <div class="section-head"><div><span class="eyebrow">${t("reviews_eyebrow")}</span><h2 class="display-md">${t("reviews_title")}</h2></div></div>
        ${list.length ? `<div class="reviews">${list.map(reviewCard).join("")}</div>` : `<p class="empty">${t("no_reviews")}</p>`}
      </div></section>`;
    },
    faq() {
      if (!data.faqs.length) return "";
      return `<section class="tint" id="faq"><div class="wrap">
        <div class="center" style="margin-bottom:32px"><span class="eyebrow">${t("faq_eyebrow")}</span><h2 class="display-md">${t("faq_title")}</h2></div>
        ${faqList()}
      </div></section>`;
    },
    community() {
      return `<section class="community"><div class="wrap">
        <span class="eyebrow">${t("community_eyebrow")}</span>
        <h2 class="display-md">${t("community_title")}</h2>
        <p class="lede" style="margin:16px auto 0">${t("community_text")}</p>
        <div class="socials">${socialLinks()}</div>
        <form class="subscribe" id="subscribe-form">
          <label class="sr-only" for="sub-contact">${t("subscribe_ph")}</label>
          <input class="input" id="sub-contact" name="contact" required minlength="5" maxlength="120" placeholder="${t("subscribe_ph")}">
          <button class="btn btn-primary" type="submit">${t("subscribe_btn")}</button>
        </form>
        <p class="body-sm muted" id="sub-msg" aria-live="polite"></p>
      </div></section>`;
    }
  };

  // ---------- pages ----------
  function pageHome(anchor) {
    const order = data.settings.home_sections || Object.keys(sections).map((id) => ({ id, visible: true }));
    return { html: order.filter((s) => s.visible && sections[s.id]).map((s) => sections[s.id]()).join(""),
      after: () => { if (anchor) document.getElementById(anchor)?.scrollIntoView(); } };
  }
  function pageShop(params) {
    const need = params.get("need") || "all";
    const list = data.products.filter((p) => need === "all" || (p.hair_needs || []).includes(need));
    return { html: `<section><div class="wrap">
      <div class="section-head"><div><span class="eyebrow">Maskati</span><h1 class="display-lg">${t("shop_title")}</h1>
      <p class="lede" style="margin-top:12px">${t("shop_text")}</p></div></div>
      <div class="pills" role="group">
        ${["all", "dry", "damaged", "coloured"].map((n) => `<a class="pill" href="#/shop${n === "all" ? "" : "?need=" + n}" aria-pressed="${need === n}">${n === "all" ? t("all") : t("need_" + n)}</a>`).join("")}
      </div>
      <div class="grid">${list.map(productCard).join("")}</div>
    </div></section>${sections.bundles()}` };
  }
  function pageProduct(slug) {
    const p = data.products.find((x) => x.slug === slug);
    if (!p) return pageNotFound();
    const reviews = data.reviews.filter((r) => r.product_id === p.id);
    const soldOut = p.stock <= 0;
    const save = Number(p.compare_at_price) - Number(p.price);
    return { html: `<div class="wrap">
      <nav class="crumbs"><a href="#/shop">${t("nav_shop")}</a> / ${esc(L(p, "name"))}</nav>
      <div class="pdp">
        <div class="pdp-media">${L(p, "badge") ? `<span class="disc">${esc(L(p, "badge"))}</span>` : ""}<img src="${esc(p.image_url || "/assets/maskati-mark.png")}" alt="${esc(L(p, "name"))}"></div>
        <div class="pdp-info">
          <span class="eyebrow" style="margin:0">${esc(L(p, "kind"))}${p.size ? " · " + esc(p.size) : ""}</span>
          <h1 class="display-lg">${esc(L(p, "name"))}</h1>
          <p class="lede">${esc(L(p, "short"))}</p>
          <div class="price-big">${money(p.price)}${save > 0 ? `<span class="compare">${money(p.compare_at_price)}</span>` : ""}</div>
          ${save > 0 ? `<div class="save" style="color:var(--olive-ink)">${t("you_save")} ${money(save)}</div>` : ""}
          ${!soldOut && p.stock <= 5 ? `<div class="body-sm" style="color:var(--olive-ink)">${t("only_left", num(p.stock))}</div>` : ""}
          <div class="buy-row">
            <div class="stepper" aria-label="${t("qty")}"><button type="button" id="q-minus" aria-label="-">−</button><output id="q-val">${num(1)}</output><button type="button" id="q-plus" aria-label="+">+</button></div>
            <button class="btn btn-primary" type="button" id="pdp-add" ${soldOut ? "disabled" : ""}>${soldOut ? t("out_of_stock") : t("add_to_bag")}</button>
          </div>
          <div class="tabs">
            <details open><summary>${t("description")} ${I.chev}</summary><p>${esc(L(p, "description"))}</p></details>
            ${L(p, "how_to_use") ? `<details><summary>${t("how_to_use")} ${I.chev}</summary><p>${esc(L(p, "how_to_use"))}</p></details>` : ""}
            ${L(p, "ingredients") ? `<details><summary>${t("ingredients")} ${I.chev}</summary><p>${esc(L(p, "ingredients"))}</p></details>` : ""}
          </div>
        </div>
      </div>
    </div>
    <section class="tint"><div class="wrap">
      <div class="section-head"><h2 class="display-md">${t("reviews_title")}</h2></div>
      ${reviews.length ? `<div class="reviews">${reviews.map(reviewCard).join("")}</div>` : `<p class="empty">${t("no_reviews")}</p>`}
      <form id="review-form" class="form-grid" style="max-width:640px;margin-top:48px">
        <h3 class="title">${t("write_review")}</h3>
        <div class="form-grid two">
          <div class="field"><label for="rv-name">${t("your_name")}</label><input class="input" id="rv-name" required maxlength="60" value="${esc(profile?.full_name?.split(" ")[0] || "")}"></div>
          <div class="field"><label for="rv-rating">${t("rating")}</label><select class="input" id="rv-rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label for="rv-title">${t("review_title")}</label><input class="input" id="rv-title" maxlength="120"></div>
        <div class="field"><label for="rv-body">${t("review_body")}</label><textarea class="input" id="rv-body" required minlength="3" maxlength="2000"></textarea></div>
        <div><button class="btn btn-primary" type="submit">${t("send_review")}</button></div>
        <p id="rv-msg" class="body-sm" aria-live="polite"></p>
      </form>
    </div></section>`, after() {
      let q = 1;
      const out = $("#q-val");
      $("#q-minus").onclick = () => { q = Math.max(1, q - 1); out.textContent = num(q); };
      $("#q-plus").onclick = () => { q = Math.min(20, p.stock, q + 1); out.textContent = num(q); };
      $("#pdp-add").onclick = () => { addToCart("product", p.id, q); openDrawer(); };
      $("#review-form").onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
        const { error } = await db.from("reviews").insert({
          product_id: p.id, customer_name: $("#rv-name").value.trim(), rating: Number($("#rv-rating").value),
          title: $("#rv-title").value.trim() || null, body: $("#rv-body").value.trim()
        });
        btn.disabled = false;
        $("#rv-msg").textContent = error ? t("err_generic") : t("review_sent");
        if (!error) e.target.reset();
      };
    } };
  }

  // ---------- checkout ----------
  function profileForCheckout() {
    if (!session || !profile) return {};
    const p = { customer_name: profile.full_name, phone: profile.phone, shipping_zone_id: profile.shipping_zone_id,
      city: profile.city, address: profile.address };
    return Object.fromEntries(Object.entries(p).filter(([, v]) => v));
  }
  function pageCheckout() {
    if (!cartLines().length) {
      return { html: `<div class="wrap thanks"><h1 class="display-lg">${t("bag_title")}</h1><p class="lede">${t("bag_empty")}</p><a class="btn btn-primary" href="#/shop">${t("continue_shopping")}</a></div>` };
    }
    if (!session) {
      // sign-in is required to order; the auth form sits inside checkout and brings her back here
      const auth = pageAuth(new URLSearchParams(location.hash.split("?")[1] || "").get("mode") === "create" ? "create" : "signin", "#/checkout");
      return { html: `<div class="wrap checkout">
        <div>${auth.html.replace('class="wrap" style="max-width:480px;padding-block:64px"', 'style="max-width:480px"').replace(/<span class="eyebrow">[^<]*<\/span>/, `<span class="eyebrow">${t("checkout_title")}</span>`)}
          <p class="body-sm muted">${t("checkout_sign_in_why")}</p></div>
        <aside class="summary" id="summary" aria-label="${t("order_summary")}"></aside>
      </div>`, after() { auth.after(); renderSummary(); } };
    }
    const saved = { ...store.get("mk_customer", {}), ...profileForCheckout() };
    const lastDistrict = store.get("mk_district", null);
    const wantsInstapay = !!(data.settings.contact?.instapay || waNumber());
    return { html: `<div class="wrap checkout">
      <form id="checkout-form" novalidate>
        <h1 class="display-lg" style="margin-bottom:8px">${t("checkout_title")}</h1>
        <p class="muted" style="margin:0 0 32px">${t("signed_in_as", esc(session.user.email))}</p>
        <fieldset><legend class="title">${t("contact_info")}</legend>
          <div class="form-grid two">
            <div class="field"><label for="c-name">${t("full_name")}</label><input class="input" id="c-name" autocomplete="name" required value="${esc(saved.customer_name || "")}"><span class="error" hidden></span></div>
            <div class="field"><label for="c-phone">${t("phone")}</label><input class="input" id="c-phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="01xxxxxxxxx" required value="${esc(saved.phone || "")}"><span class="error" hidden></span></div>
          </div>
        </fieldset>
        <fieldset><legend class="title">${t("delivery")}</legend>
          <div class="form-grid two">
            <div class="field"><label for="c-zone">${t("governorate")}</label>
              <select class="input" id="c-zone" required><option value="">${t("choose")}</option>
                ${data.zones.map((z) => `<option value="${z.id}" ${String(saved.shipping_zone_id) === String(z.id) ? "selected" : ""}>${esc(L(z, "name"))}</option>`).join("")}
              </select><span class="error" hidden></span></div>
            <div class="field"><label for="c-district">${t("district")}</label>
              <select class="input" id="c-district" required disabled><option value="">${t("choose_gov_first")}</option></select><span class="error" hidden></span></div>
          </div>
          <div class="field"><label for="c-address">${t("address")}</label><textarea class="input" id="c-address" autocomplete="street-address" required placeholder="${t("address_ph")}">${esc(saved.address || "")}</textarea><span class="error" hidden></span></div>
          <div class="field"><label for="c-notes">${t("notes")}</label><input class="input" id="c-notes" maxlength="500"></div>
        </fieldset>
        <fieldset><legend class="title">${t("payment")}</legend>
          <label class="radio-card"><input type="radio" name="payment_method" value="cod" checked><span><strong>${t("pay_cod")}</strong><small>${t("pay_cod_hint")}</small></span></label>
          ${wantsInstapay ? `<label class="radio-card"><input type="radio" name="payment_method" value="instapay"><span><strong>${t("pay_instapay")}</strong><small>${t("pay_instapay_hint")}</small></span></label>` : ""}
        </fieldset>
        <p class="error" id="checkout-error" role="alert" hidden></p>
        <button class="btn btn-primary btn-block" type="submit" id="place-btn">${t("place_order")}</button>
      </form>
      <aside class="summary" id="summary" aria-label="${t("order_summary")}"></aside>
    </div>`, async after() {
      const zoneSel = $("#c-zone"), distSel = $("#c-district");
      const fillDistricts = async (keep) => {
        const gov = data.zones.find((z) => String(z.id) === zoneSel.value);
        distSel.disabled = true;
        distSel.innerHTML = `<option value="">${gov ? t("loading") : t("choose_gov_first")}</option>`;
        if (!gov) { renderSummary(); return; }
        const list = await districtsFor(gov.bosta_city_id);
        if (zoneSel.value !== String(gov.id)) return;
        distSel.innerHTML = `<option value="">${t("choose")}</option>` + list.map((d) =>
          `<option value="${esc(d.district_id)}">${esc(lang === "ar" ? d.name_ar || d.name_en : d.name_en)}</option>`).join("");
        distSel.disabled = !list.length;
        if (keep && list.some((d) => d.district_id === keep)) distSel.value = keep;
        renderSummary();
      };
      zoneSel.onchange = () => fillDistricts();
      if (zoneSel.value) fillDistricts(lastDistrict);
      renderSummary();
      $("#checkout-form").onsubmit = submitOrder;
    } };
  }
  function renderSummary() {
    const el = $("#summary"); if (!el) return;
    const lines = cartLines();
    const sub = cartSubtotal();
    const ship = $("#c-zone")?.value ? deliveryFeeFor($("#c-zone").value, sub) : null;
    const discount = promo ? Number(promo.discount) : 0;
    const shipFee = ship ? (promo?.free_shipping ? 0 : ship.fee) : 0;
    el.innerHTML = `
      <h2 class="title">${t("order_summary")}</h2>
      ${lines.map((l) => `<div class="line-item">
        <div class="thumb"><img src="${esc(l.item.image_url || "/assets/maskati-mark.png")}" alt=""></div>
        <div><div>${esc(L(l.item, "name"))}</div><div class="body-sm muted">${num(l.qty)} × ${money(l.price)}</div></div>
        <div>${money(l.total)}</div></div>`).join("")}
      ${session ? `<form class="promo" id="promo-form">
        <label class="sr-only" for="promo-code">${t("promo_code")}</label>
        <input class="input" id="promo-code" placeholder="${t("promo_code")}" autocomplete="off" dir="ltr" value="${esc(promo?.code || "")}">
        <button class="btn btn-secondary" type="submit">${promo ? t("remove") : t("apply")}</button>
      </form><p class="body-sm" id="promo-msg" aria-live="polite" style="margin:0;${promo ? "color:var(--olive-ink)" : ""}">${promo ? t("promo_applied", promo.code) : ""}</p>` : ""}
      <div class="sum-row"><span>${t("subtotal")}</span><span>${money(sub)}</span></div>
      ${discount > 0 ? `<div class="sum-row" style="color:var(--olive-ink)"><span>${t("discount")}</span><span>− ${money(discount)}</span></div>` : ""}
      <div class="sum-row"><span>${t("shipping")}</span><span>${ship ? (shipFee === 0 ? t("free") : money(shipFee)) : `<span class="muted">${t("set_at_checkout")}</span>`}</span></div>
      ${ship ? `<div class="body-sm muted">${t("delivery_days", num(ship.days))}</div>` : ""}
      <div class="sum-row sum-total"><span>${t("total")}</span><strong>${money(sub - discount + shipFee)}</strong></div>`;
    $("#promo-form")?.addEventListener("submit", onPromo);
    // live check while typing (debounced)
    let timer;
    $("#promo-code")?.addEventListener("input", (e) => {
      clearTimeout(timer);
      if (promo) return;
      const code = e.target.value.trim();
      $("#promo-msg").textContent = "";
      if (code.length >= 3) timer = setTimeout(() => checkPromo(code, true), 600);
    });
  }
  async function checkPromo(code, quiet) {
    const msg = $("#promo-msg");
    const { data: r, error } = await db.rpc("check_promo", { p_code: code, p_subtotal: cartSubtotal() });
    if (error || !r) { if (!quiet) msg.textContent = t("err_generic"); return; }
    if (!r.ok) {
      const [kind, amount] = String(r.error).split(":");
      msg.style.color = "var(--danger)";
      msg.textContent = t("promo_" + kind, amount ? money(amount) : "");
      return;
    }
    promo = r;
    renderSummary();
  }
  function onPromo(e) {
    e.preventDefault();
    if (promo) { promo = null; renderSummary(); return; }
    const code = $("#promo-code").value.trim();
    if (code) checkPromo(code, false);
  }
  async function submitOrder(e) {
    e.preventDefault();
    let ok = true;
    const setErr = (input, msg) => {
      const span = input.parentElement.querySelector(".error");
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (span) { span.textContent = msg || ""; span.hidden = !msg; }
      if (msg && ok) { input.focus(); ok = false; }
    };
    const fields = ["c-name", "c-phone", "c-zone", "c-district", "c-address"];
    fields.forEach((id) => setErr($("#" + id), ""));
    for (const id of fields) { const el = $("#" + id); if (!el.disabled && !el.value.trim()) setErr(el, t("err_required")); }
    const phone = $("#c-phone").value.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^\d+]/g, "");
    if ($("#c-phone").value.trim() && !/^(\+?20|0)?1[0125]\d{8}$/.test(phone)) setErr($("#c-phone"), t("err_phone"));
    if (!ok) return;

    const payload = {
      customer_name: $("#c-name").value.trim(), phone, email: session.user.email,
      shipping_zone_id: Number($("#c-zone").value), district_id: $("#c-district").value,
      address: $("#c-address").value.trim(), notes: $("#c-notes").value.trim(),
      payment_method: $("#checkout-form").payment_method.value, promo_code: promo?.code || "", lang,
      items: cart.map((c) => ({ type: c.type, id: c.id, quantity: c.qty }))
    };
    const btn = $("#place-btn"); btn.disabled = true; btn.textContent = t("placing");
    const errEl = $("#checkout-error"); errEl.hidden = true;
    const { data: res, error } = await db.rpc("place_order", { payload });
    btn.disabled = false; btn.textContent = t("place_order");
    if (error) {
      const m = error.message || "";
      const known = ["item_unavailable", "too_fast", "too_many", "invalid_phone", "invalid_district", "invalid_zone", "invalid_address", "sign_in_required"].find((k) => m.includes(k));
      if (m.startsWith("promo_")) { promo = null; renderSummary(); }
      errEl.textContent = m.startsWith("promo_") ? t("promo_" + m.slice(6).split(":")[0], "") : known ? t("err_" + known) : t("err_generic");
      if (m.includes("item_unavailable")) loadData().then(() => { renderDrawer(); renderSummary(); });
      errEl.hidden = false; return;
    }
    store.set("mk_district", payload.district_id);
    store.set("mk_last_order", { ...res, payment_method: payload.payment_method });
    // the confirmation email; failures are recorded on the order and never block the customer
    db.functions.invoke("notify-order", { body: { history_id: res.history_id } }).catch(() => {});
    cart = []; promo = null; saveCart();
    loadProfile();
    loadData().catch(() => {});
    location.hash = `#/thanks/${res.order_number}`;
  }
  function pageThanks(n) {
    const last = store.get("mk_last_order", {});
    const mine = String(last.order_number) === String(n);
    const prepaid = mine && last.payment_method === "instapay";
    const msg = lang === "ar"
      ? `أهلًا ماسكاتي، عملت طلب رقم ${n} بإجمالي ${money(last.total)}${prepaid ? " وهحوّل على إنستاباي" : ""}.`
      : `Hello Maskati, I placed order ${n} for ${money(last.total)}${prepaid ? " and will pay by InstaPay" : ""}.`;
    const wa = waLink(msg);
    const instapay = data.settings.contact?.instapay;
    if (prepaid && wa && !sessionStorage.getItem("mk_wa_" + n)) {
      // InstaPay: open WhatsApp with the order number and total typed in
      try { sessionStorage.setItem("mk_wa_" + n, "1"); } catch {}
      setTimeout(() => window.open(wa, "_blank", "noopener"), 400);
    }
    return { html: `<div class="wrap thanks">
      <img src="/assets/maskati-mark.png" alt="" width="72" height="69">
      <h1 class="display-lg">${t("thanks_title")}</h1>
      <p class="lede">${t("thanks_text", "#" + num(n))}</p>
      ${mine ? (prepaid
        ? `<div class="ship-note">${t("instapay_next", money(last.total))}${instapay ? `<br><strong dir="ltr">${esc(instapay)}</strong>` : ""}</div>`
        : `<p class="title">${t("pay_on_delivery", money(last.total))}</p>`) : ""}
      <div class="hero-actions" style="justify-content:center">
        ${wa ? `<a class="btn btn-primary" href="${esc(wa)}" target="_blank" rel="noopener">${prepaid ? t("send_on_whatsapp") : t("thanks_wa")}</a>` : ""}
        <a class="btn btn-secondary" href="#/account">${t("my_orders")}</a>
      </div></div>` };
  }

  // ---------- customer account ----------
  async function loadProfile() {
    if (!session) { profile = null; isOwner = false; return; }
    const [{ data: row }, { data: owner }] = await Promise.all([
      db.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
      db.rpc("is_admin")
    ]);
    profile = row; isOwner = owner === true;
  }
  function timeline(o) {
    const terminal = ["cancelled", "returned"].includes(o.status);
    const reached = (s) => o.order_status_history.some((h) => h.status === s) || STATUS_STEPS.indexOf(o.status) >= STATUS_STEPS.indexOf(s);
    const when = (s) => { const h = o.order_status_history.filter((h) => h.status === s).pop(); return h ? new Date(h.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short" }) : ""; };
    const steps = terminal ? [...STATUS_STEPS.filter(reached), o.status] : STATUS_STEPS;
    return `<ol class="timeline">${steps.map((s) => `<li class="${reached(s) || s === o.status ? "done" : ""} ${["cancelled", "returned"].includes(s) ? "stop" : ""}">
      <span class="dot">${reached(s) ? I.check : ""}</span><span>${statusLabel(s)}</span><span class="body-sm muted">${when(s)}</span></li>`).join("")}</ol>`;
  }
  function pageAccount(params) {
    if (recovering) return pageNewPassword();
    if (!session) return pageAuth(params.get("mode") === "create" ? "create" : params.get("mode") === "reset" ? "reset" : "signin");
    const p = profile || {};
    return { html: `<div class="wrap" style="padding-block:48px 64px">
      <div class="section-head"><div><span class="eyebrow">${t("account")}</span>
        <h1 class="display-lg">${t("hello")}${p.full_name ? " " + esc(p.full_name.split(" ")[0]) : ""}</h1>
        <p class="muted" style="margin:8px 0 0">${esc(session.user.email)}</p></div>
        <div class="hero-actions">
          ${isOwner ? `<a class="btn btn-primary" href="/admin">${t("dashboard")}</a>` : ""}
          <button class="btn btn-secondary" type="button" id="sign-out">${t("sign_out")}</button></div></div>
      <div class="checkout" style="padding:0">
        <section style="padding:0"><h2 class="title" style="margin-bottom:24px">${t("my_orders")}</h2><div id="my-orders"><p class="muted">${t("loading")}</p></div></section>
        <div style="display:grid;gap:24px;align-content:start">
          <form class="summary" id="profile-form">
            <h2 class="title">${t("my_details")}</h2>
            <div class="field"><label for="p-name">${t("full_name")}</label><input class="input" id="p-name" autocomplete="name" value="${esc(p.full_name)}"></div>
            <div class="field"><label for="p-phone">${t("phone")}</label><input class="input" id="p-phone" type="tel" dir="ltr" autocomplete="tel" value="${esc(p.phone)}"></div>
            <div class="field"><label for="p-zone">${t("governorate")}</label><select class="input" id="p-zone"><option value="">${t("choose")}</option>
              ${data.zones.map((z) => `<option value="${z.id}" ${String(p.shipping_zone_id) === String(z.id) ? "selected" : ""}>${esc(L(z, "name"))}</option>`).join("")}</select></div>
            <div class="field"><label for="p-address">${t("address")}</label><textarea class="input" id="p-address">${esc(p.address)}</textarea></div>
            <button class="btn btn-primary" type="submit">${t("save")}</button>
            <p class="body-sm muted" id="profile-msg" aria-live="polite" style="margin:0"></p>
          </form>
          <form class="summary" id="password-form">
            <h2 class="title">${t("change_password")}</h2>
            <div class="field"><label for="pw-new">${t("new_password")}</label><input class="input" id="pw-new" type="password" dir="ltr" minlength="8" required autocomplete="new-password"></div>
            <button class="btn btn-secondary" type="submit">${t("change_password")}</button>
            <p class="body-sm muted" id="pw-msg" aria-live="polite" style="margin:0"></p>
          </form>
        </div>
      </div></div>`, async after() {
      $("#sign-out").onclick = async () => { await db.auth.signOut(); };
      $("#profile-form").onsubmit = async (e) => {
        e.preventDefault();
        const row = { full_name: $("#p-name").value.trim() || null, phone: $("#p-phone").value.trim() || null,
          shipping_zone_id: Number($("#p-zone").value) || null, address: $("#p-address").value.trim() || null };
        const { error } = await db.from("profiles").update(row).eq("id", session.user.id);
        $("#profile-msg").textContent = error ? t("err_generic") : t("details_saved");
        if (!error) profile = { ...profile, ...row };
      };
      $("#password-form").onsubmit = async (e) => {
        e.preventDefault();
        const { error } = await db.auth.updateUser({ password: $("#pw-new").value });
        $("#pw-msg").textContent = error ? error.message : t("password_changed");
        if (!error) e.target.reset();
      };
      const { data: orders } = await db.from("orders")
        .select("id,order_number,created_at,status,total,payment_method,bosta_tracking_number,order_items(name,quantity,product_id,bundle_id),order_status_history(status,created_at)")
        .order("created_at", { ascending: false });
      const el = $("#my-orders"); if (!el) return;
      el.innerHTML = orders?.length ? orders.map((o) => `
        <div class="review" style="margin-bottom:16px">
          <div class="sum-row"><strong>#${num(o.order_number)}</strong><span class="body-sm muted">${new Date(o.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></div>
          ${timeline(o)}
          <div class="body-sm">${o.order_items.map((i) => `${esc(lang === "ar" ? i.name.split(" / ")[0] : i.name.split(" / ").pop())} × ${num(i.quantity)}`).join("، ")}</div>
          ${o.bosta_tracking_number ? `<div class="body-sm">${t("tracking")}: <a href="${trackUrl(o.bosta_tracking_number)}" target="_blank" rel="noopener" dir="ltr">${esc(o.bosta_tracking_number)}</a></div>` : ""}
          <div class="sum-row"><span>${t("total")}</span><strong>${money(o.total)}</strong></div>
          <div><button class="btn btn-secondary" type="button" data-again="${o.id}">${t("order_again")}</button></div>
        </div>`).join("") : `<p class="empty">${t("no_orders")} <a href="#/shop">${t("shop_now")}</a></p>`;
      el.querySelectorAll("[data-again]").forEach((b) => b.onclick = () => {
        const o = orders.find((x) => x.id === b.dataset.again);
        let added = 0;
        for (const i of o.order_items) {
          const type = i.bundle_id ? "bundle" : "product"; const id = i.bundle_id || i.product_id;
          if (id && stockOf(type, id) > 0) { addToCart(type, id, i.quantity); added++; }
        }
        toast(added ? t("added") : t("out_of_stock"));
        if (added) openDrawer();
      });
    } };
  }
  function pageAuth(mode, returnTo = "#/account") {
    const creating = mode === "create", resetting = mode === "reset";
    const base = returnTo.split("?")[0];
    return { html: `<div class="wrap" style="max-width:480px;padding-block:64px">
      <span class="eyebrow">${t("account")}</span>
      <h1 class="display-lg" style="margin-bottom:12px">${creating ? t("create_account") : resetting ? t("reset_password") : t("sign_in")}</h1>
      <p class="lede" style="margin-bottom:32px">${creating ? t("create_account_text") : resetting ? t("reset_text") : t("sign_in_text")}</p>
      <form class="form-grid" id="auth-form">
        ${creating ? `<div class="field"><label for="a-name">${t("full_name")}</label><input class="input" id="a-name" autocomplete="name" required maxlength="80"></div>
        <div class="field"><label for="a-phone">${t("phone")}</label><input class="input" id="a-phone" type="tel" dir="ltr" autocomplete="tel" placeholder="01xxxxxxxxx"></div>` : ""}
        <div class="field"><label for="a-email">${t("email")}</label><input class="input" id="a-email" type="email" dir="ltr" autocomplete="email" required></div>
        ${resetting ? "" : `<div class="field"><label for="a-pass">${t("password")}</label><input class="input" id="a-pass" type="password" dir="ltr" required minlength="${creating ? 8 : 1}" autocomplete="${creating ? "new-password" : "current-password"}">
          ${creating ? `<span class="body-sm muted">${t("password_hint")}</span>` : ""}</div>`}
        <button class="btn btn-primary btn-block" type="submit">${creating ? t("create_account") : resetting ? t("send_reset") : t("sign_in")}</button>
        <p class="body-sm" id="auth-msg" role="status" style="margin:0"></p>
        <p class="center body-sm" style="margin:0">${creating ? t("have_account") : t("no_account")}
          <a href="${base}${creating ? "" : "?mode=create"}">${creating ? t("sign_in") : t("create_account")}</a>
          ${!creating && !resetting ? ` · <a href="#/account?mode=reset">${t("forgot_password")}</a>` : ""}</p>
      </form></div>`, after() {
      $("#auth-form").onsubmit = async (e) => {
        e.preventDefault();
        const msg = $("#auth-msg"); const btn = e.target.querySelector("button[type=submit]");
        const email = $("#a-email").value.trim();
        btn.disabled = true; msg.style.color = ""; msg.textContent = t("loading");
        if (resetting) {
          const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/#/account" });
          btn.disabled = false; msg.textContent = error ? error.message : t("reset_sent", email); return;
        }
        const password = $("#a-pass").value;
        const { data: res, error } = creating
          ? await db.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + "/" + base,
              data: { full_name: $("#a-name").value.trim(), phone: $("#a-phone").value.trim() } } })
          : await db.auth.signInWithPassword({ email, password });
        btn.disabled = false;
        if (error) {
          msg.style.color = "var(--danger)";
          msg.textContent = /invalid login/i.test(error.message) ? t("err_login") : /not confirmed/i.test(error.message) ? t("err_confirm") : /already registered/i.test(error.message) ? t("err_exists") : error.message;
          return;
        }
        if (creating && !res.session) { msg.textContent = t("check_email", email); return; }
        // signed in: onAuthStateChange re-renders the page
      };
    } };
  }
  function pageNewPassword() {
    return { html: `<div class="wrap" style="max-width:480px;padding-block:64px">
      <h1 class="display-lg" style="margin-bottom:24px">${t("new_password")}</h1>
      <form class="form-grid" id="newpw-form">
        <div class="field"><label for="np">${t("new_password")}</label><input class="input" id="np" type="password" dir="ltr" minlength="8" required autocomplete="new-password"></div>
        <button class="btn btn-primary btn-block" type="submit">${t("save")}</button>
        <p class="body-sm" id="np-msg" role="status"></p>
      </form></div>`, after() {
      $("#newpw-form").onsubmit = async (e) => {
        e.preventDefault();
        const { error } = await db.auth.updateUser({ password: $("#np").value });
        if (error) { $("#np-msg").textContent = error.message; return; }
        recovering = false; toast(t("password_changed")); route();
      };
    } };
  }
  function pageNotFound() {
    return { html: `<div class="wrap thanks"><h1 class="display-lg">404</h1><p class="lede">${t("not_found")}</p><a class="btn btn-primary" href="#/">${t("back_home")}</a></div>` };
  }

  // ---------- drawer ----------
  function openDrawer() { renderDrawer(); $("#drawer").classList.add("open"); $("#drawer-backdrop").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#drawer-close")?.focus(); }
  function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer-backdrop").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); }
  function renderDrawer() {
    const lines = cartLines();
    const sub = cartSubtotal();
    const freeOver = Number(data.settings.free_shipping_over || 0);
    $("#drawer").innerHTML = `
      <div class="drawer-head"><h2 class="title">${t("bag_title")}</h2><button class="icon-btn" id="drawer-close" type="button" aria-label="${t("close")}">${I.close}</button></div>
      <div class="drawer-body">
        ${lines.length ? (freeOver > 0 ? `<div class="ship-note">${sub >= freeOver ? t("free_ship_ok") : t("free_ship_left", money(freeOver - sub))}</div>` : "") : `<p class="muted">${t("bag_empty")}</p>`}
        ${lines.map((l) => `<div class="line-item">
          <div class="thumb"><img src="${esc(l.item.image_url || "/assets/maskati-mark.png")}" alt=""></div>
          <div><div>${esc(L(l.item, "name"))}</div><div class="body-sm muted">${money(l.price)}</div>
            <div class="stepper" style="margin-top:6px"><button type="button" data-q="${l.type}|${l.id}|${l.qty - 1}" aria-label="-">−</button><output>${num(l.qty)}</output><button type="button" data-q="${l.type}|${l.id}|${l.qty + 1}" aria-label="+" ${l.qty >= stockOf(l.type, l.id) ? "disabled" : ""}>+</button></div>
          </div>
          <div style="text-align:end"><div>${money(l.total)}</div><button class="remove" type="button" data-q="${l.type}|${l.id}|0">${t("remove")}</button></div>
        </div>`).join("")}
      </div>
      <div class="drawer-foot">
        ${lines.length ? `<div class="sum-row"><span>${t("subtotal")}</span><strong>${money(sub)}</strong></div>
        <div class="sum-row body-sm muted"><span>${t("shipping")}</span><span>${t("set_at_checkout")}</span></div>
        <a class="btn btn-primary btn-block" href="#/checkout" id="go-checkout">${t("checkout")}</a>` : ""}
        <button class="btn btn-secondary btn-block" type="button" id="keep-shopping">${t("continue_shopping")}</button>
      </div>`;
    $("#drawer-close").onclick = closeDrawer;
    $("#keep-shopping").onclick = closeDrawer;
    $("#go-checkout")?.addEventListener("click", closeDrawer);
    $("#drawer").querySelectorAll("[data-q]").forEach((b) => b.onclick = () => { const [type, id, q] = b.dataset.q.split("|"); setQty(type, id, Number(q)); });
  }

  // ---------- toast, load error ----------
  let toastTimer;
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }
  function showLoadError(show) {
    let bar = $("#load-error");
    if (!show) { bar?.remove(); return; }
    if (!bar) {
      bar = document.createElement("div"); bar.id = "load-error"; bar.className = "load-error"; bar.setAttribute("role", "alert");
      document.body.prepend(bar);
    }
    bar.innerHTML = `<span>${t("load_failed")}</span><button type="button" class="btn btn-secondary">${t("retry")}</button>`;
    bar.querySelector("button").onclick = () => boot(0);
  }

  // ---------- router ----------
  function route() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const [path, query] = hash.split("?");
    const params = new URLSearchParams(query || "");
    const parts = path.split("/").filter(Boolean);
    if (parts[0] && /access_token|error_description|type=recovery/.test(parts[0])) { location.replace("#/account"); return; } // back from an email link
    let page;
    if (!loaded) page = { html: `<p class="loading">${t("loading")}</p>` };
    else if (parts.length === 0) page = pageHome();
    else if (["consult", "routines", "story", "faq"].includes(parts[0])) page = pageHome(parts[0]);
    else if (parts[0] === "shop") page = pageShop(params);
    else if (parts[0] === "product") page = pageProduct(decodeURIComponent(parts[1] || ""));
    else if (parts[0] === "checkout") page = pageCheckout();
    else if (parts[0] === "thanks") page = pageThanks(parts[1]);
    else if (parts[0] === "account") page = pageAccount(params);
    else page = pageNotFound();
    $("#main").innerHTML = page.html;
    document.querySelectorAll(".nav a").forEach((a) => {
      if (a.getAttribute("href") === "#" + path) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    $("#mobile-nav")?.classList.remove("open");
    window.scrollTo(0, 0);
    if (page.after) page.after();
  }
  function renderAll() { renderShell(); route(); renderDrawer(); }

  // ---------- global events ----------
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { addToCart(add.dataset.add, add.dataset.id); return; }
    const opt = e.target.closest(".consult-opt");
    if (opt) {
      document.querySelectorAll(".consult-opt").forEach((b) => b.setAttribute("aria-pressed", b === opt));
      const need = opt.dataset.need;
      const b = data.bundles.find((x) => x.hair_need === need);
      const prods = data.products.filter((p) => (p.hair_needs || []).includes(need));
      $("#consult-result").innerHTML = `<h3 class="title" style="margin-bottom:24px">${t("consult_for_you")}</h3>
        ${b ? `<div style="max-width:420px;margin-inline:auto;text-align:start">${bundleCard(b)}</div>` : `<div class="grid">${prods.map(productCard).join("")}</div>`}`;
    }
  });
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "subscribe-form") return;
    e.preventDefault();
    const { error } = await db.from("subscribers").insert({ contact: $("#sub-contact").value.trim() });
    $("#sub-msg").textContent = !error || error.code === "23505" ? t("subscribed") : t("err_generic");
    if (!error) e.target.reset();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
  $("#drawer-backdrop").onclick = closeDrawer;
  window.addEventListener("scroll", () => $("#header").classList.toggle("scrolled", window.scrollY > 10), { passive: true });
  window.addEventListener("hashchange", route);

  db.auth.onAuthStateChange((event, s) => {
    session = s;
    if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
    if (event === "PASSWORD_RECOVERY") recovering = true;
    // defer so Supabase finishes its own auth work before we query
    setTimeout(async () => {
      await loadProfile();
      if (event === "PASSWORD_RECOVERY") { location.hash = "#/account"; route(); }
      else if (event === "SIGNED_IN" && $("#auth-form")) route();
      else if (event === "SIGNED_OUT" && /^#\/(account|checkout)/.test(location.hash)) route();
    }, 0);
  });

  // ---------- boot: load with a few automatic retries, then a Retry bar ----------
  async function boot(attempt) {
    try {
      await Promise.all([loadData(), db.auth.getSession().then(async ({ data: s }) => { session = s.session; await loadProfile(); })]);
      showLoadError(false);
      cart = cart.filter((c) => (c.type === "bundle" ? bundleById(c.id) : productById(c.id)));
      saveCart();
      renderAll();
    } catch {
      if (attempt < 3) setTimeout(() => boot(attempt + 1), 1000 * 2 ** attempt);
      else { showLoadError(true); $("#main").innerHTML = `<p class="loading">${t("load_failed")}</p>`; }
    }
  }
  applyLang();
  renderShell();
  route();
  boot(0);
})();
