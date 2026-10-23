(() => {
  "use strict";

  // ---------- state ----------
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  };
  let lang = store.get("mk_lang", "ar");
  let cart = store.get("mk_cart", []); // [{type:'product'|'bundle', id, qty}]
  const data = { products: [], bundles: [], faqs: [], reviews: [], zones: [], settings: {} };
  let loaded = false;

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

  // ---------- icons (1.5px line drawings, currentColor) ----------
  const I = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    arrow: '<svg class="flip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m3 17 6-5 4 3 3-2 5 4"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5L10 8.5Z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19l-4 1Z"/><path d="M9 10h6M9 13h4"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 4 3 11l6 2 2 6 3-4 5 4 2-15Z"/><path d="m9 13 8-6"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    leaves: '<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M100 190C60 150 40 100 70 40c40 40 50 100 30 150Z"/><path d="M100 190C90 140 80 100 70 40"/><path d="M104 188c10-50 40-80 86-90-10 50-40 80-86 90Z"/><path d="M104 188c30-30 55-60 86-90"/></svg>'
  };

  // ---------- data ----------
  async function loadData() {
    const [p, b, f, r, z, s] = await Promise.all([
      db.from("products").select("*").order("sort_order"),
      db.from("bundles").select("*").order("sort_order"),
      db.from("faqs").select("*").order("sort_order"),
      db.from("reviews").select("*").order("created_at", { ascending: false }).limit(60),
      db.from("shipping_zones").select("*").eq("is_active", true).order("sort_order"),
      db.from("site_settings").select("key,value")
    ]);
    data.products = p.data || [];
    data.bundles = b.data || [];
    data.faqs = f.data || [];
    data.reviews = r.data || [];
    data.zones = z.data || [];
    data.settings = Object.fromEntries((s.data || []).map((row) => [row.key, row.value]));
    loaded = true;
  }
  const productById = (id) => data.products.find((p) => p.id === id);
  const bundleById = (id) => data.bundles.find((b) => b.id === id);
  const waNumber = () => (data.settings.contact?.whatsapp || data.settings.social?.whatsapp || "").replace(/[^\d]/g, "");
  const waLink = (text) => {
    const n = waNumber();
    return n ? `https://wa.me/${n.startsWith("0") ? "2" + n : n}${text ? "?text=" + encodeURIComponent(text) : ""}` : null;
  };

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
    const found = cart.find((c) => c.type === type && c.id === id);
    if (found) found.qty = Math.min(20, found.qty + qty); else cart.push({ type, id, qty });
    saveCart();
    toast(t("added"));
    renderDrawer();
  }
  function setQty(type, id, qty) {
    if (qty <= 0) cart = cart.filter((c) => !(c.type === type && c.id === id));
    else { const c = cart.find((c) => c.type === type && c.id === id); if (c) c.qty = Math.min(20, qty); }
    saveCart(); renderDrawer();
    if (location.hash.startsWith("#/checkout")) renderSummary();
  }
  function renderCartCount() {
    const n = cart.reduce((s, c) => s + c.qty, 0);
    const el = $("#cart-count");
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
          <button class="icon-btn" id="bag-btn" type="button" aria-label="${t("bag")}">${I.bag}<span class="count" id="cart-count" hidden></span></button>
          <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="${t("menu")}" aria-expanded="false">${I.menu}</button>
        </div>
      </div>
      <nav class="wrap mobile-nav" id="mobile-nav" aria-label="mobile">
        <a href="#/shop">${t("nav_shop")}</a><a href="#/routines">${t("nav_routines")}</a>
        <a href="#/consult">${t("nav_consult")}</a><a href="#/story">${t("nav_story")}</a><a href="#/faq">${t("nav_faq")}</a>
      </nav>`;
    $("#lang-btn").onclick = () => { lang = lang === "ar" ? "en" : "ar"; store.set("mk_lang", lang); applyLang(); renderAll(); };
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
    const order = ["instagram", "tiktok", "whatsapp", "telegram", "email"];
    return order.filter((k) => s[k]).map((k) => {
      let href = s[k];
      if (k === "email" && !href.startsWith("mailto:")) href = "mailto:" + href;
      if (k === "whatsapp" && !/^https?:/.test(href)) href = waLink() || "#";
      return `<a class="social" href="${esc(href)}" target="_blank" rel="noopener">${I[k]}<span>${t(k)}</span></a>`;
    }).join("");
  }
  function renderFooter() {
    const year = new Date().getFullYear();
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
            <li><a href="#/faq">${t("footer_shipping")}</a></li>
            ${waLink() ? `<li><a href="${esc(waLink())}" target="_blank" rel="noopener">${t("footer_contact")}</a></li>` : ""}
          </ul></div>
          <div><h4>${t("footer_follow")}</h4><ul>
            ${["instagram", "tiktok", "telegram", "email"].filter((k) => data.settings.social?.[k]).map((k) => {
              let href = data.settings.social[k]; if (k === "email" && !href.startsWith("mailto:")) href = "mailto:" + href;
              return `<li><a href="${esc(href)}" target="_blank" rel="noopener">${t(k)}</a></li>`; }).join("")}
          </ul></div>
        </div>
        <div class="legal"><span>© ${num(year)} Maskati · ماسكاتي. ${t("rights")}.</span><span>${lang === "ar" ? "مصر" : "Egypt"}</span></div>
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
            <button class="btn btn-primary" type="button" data-add="bundle" data-id="${b.id}">${t("add_routine")}</button>
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
  function faqList(limit) {
    const list = limit ? data.faqs.slice(0, limit) : data.faqs;
    return `<div class="faq">${list.map((f) => `
      <details><summary><span>${esc(L(f, "question"))}</span><span class="plus">${I.plus}</span></summary><p>${esc(L(f, "answer"))}</p></details>`).join("")}
      ${waLink() ? `<p class="center" style="margin-top:24px"><a class="btn btn-ghost" href="${esc(waLink())}" target="_blank" rel="noopener">${t("faq_more")} ${I.arrow}</a></p>` : ""}
    </div>`;
  }

  // ---------- sections ----------
  const sections = {
    hero() {
      const h = data.settings.hero || {};
      const title = lang === "ar" ? h.ar_title : h.en_title;
      const text = lang === "ar" ? h.ar_text : h.en_text;
      const hero = data.products.find((p) => p.is_bestseller) || data.products[0];
      return `<section class="hero"><div class="wrap hero-grid">
        <div>
          <span class="eyebrow">${lang === "ar" ? "ماسكاتي · عناية بالشعر" : "Maskati · Hair care"}</span>
          <h1 class="display-xl">${esc(title || t("footer_tag"))}</h1>
          <p class="lede">${esc(text || "")}</p>
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
      const needs = ["dry", "damaged", "coloured"];
      return `<section class="tint" id="consult"><div class="wrap consult">
        <span class="eyebrow">${t("consult_eyebrow")}</span>
        <h2 class="display-md">${t("consult_title")}</h2>
        <p class="lede" style="margin:16px auto 0">${t("consult_text")}</p>
        <div class="consult-options" role="group">
          ${needs.map((n) => `<button type="button" class="consult-opt" data-need="${n}" aria-pressed="false"><strong>${t("need_" + n)}</strong><span>${t("need_" + n + "_hint")}</span></button>`).join("")}
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
    const html = order.filter((s) => s.visible && sections[s.id]).map((s) => sections[s.id]()).join("");
    return { html, after: () => { if (anchor) document.getElementById(anchor)?.scrollIntoView(); } };
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
          <div class="field"><label for="rv-name">${t("your_name")}</label><input class="input" id="rv-name" required maxlength="60"></div>
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
      $("#q-plus").onclick = () => { q = Math.min(20, q + 1); out.textContent = num(q); };
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
  function pageCheckout() {
    if (!cartLines().length) {
      return { html: `<div class="wrap thanks"><h1 class="display-lg">${t("bag_title")}</h1><p class="lede">${t("bag_empty")}</p><a class="btn btn-primary" href="#/shop">${t("continue_shopping")}</a></div>` };
    }
    const saved = store.get("mk_customer", {});
    return { html: `<div class="wrap checkout">
      <form id="checkout-form" novalidate>
        <h1 class="display-lg" style="margin-bottom:32px">${t("checkout_title")}</h1>
        <fieldset><legend class="title">${t("contact_info")}</legend>
          <div class="form-grid two">
            <div class="field"><label for="c-name">${t("full_name")}</label><input class="input" id="c-name" name="customer_name" autocomplete="name" required value="${esc(saved.customer_name || "")}"><span class="error" hidden></span></div>
            <div class="field"><label for="c-phone">${t("phone")}</label><input class="input" id="c-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="01xxxxxxxxx" required value="${esc(saved.phone || "")}"><span class="error" hidden></span></div>
          </div>
          <div class="field"><label for="c-email">${t("email_opt")}</label><input class="input" id="c-email" name="email" type="email" autocomplete="email" dir="ltr" value="${esc(saved.email || "")}"></div>
        </fieldset>
        <fieldset><legend class="title">${t("delivery")}</legend>
          <div class="form-grid two">
            <div class="field"><label for="c-zone">${t("governorate")}</label>
              <select class="input" id="c-zone" name="shipping_zone_id" required><option value="">${t("choose")}</option>
                ${data.zones.map((z) => `<option value="${z.id}" ${String(saved.shipping_zone_id) === String(z.id) ? "selected" : ""}>${esc(L(z, "name"))}</option>`).join("")}
              </select><span class="error" hidden></span></div>
            <div class="field"><label for="c-city">${t("city")}</label><input class="input" id="c-city" name="city" autocomplete="address-level2" required value="${esc(saved.city || "")}"><span class="error" hidden></span></div>
          </div>
          <div class="field"><label for="c-address">${t("address")}</label><textarea class="input" id="c-address" name="address" autocomplete="street-address" required placeholder="${t("address_ph")}">${esc(saved.address || "")}</textarea><span class="error" hidden></span></div>
          <div class="field"><label for="c-notes">${t("notes")}</label><input class="input" id="c-notes" name="notes" maxlength="500"></div>
        </fieldset>
        <fieldset><legend class="title">${t("payment")}</legend>
          ${[["cod", "pay_cod"], ["instapay", "pay_instapay"], ["vodafone_cash", "pay_vodafone"]].map(([v, k], i) => `
            <label class="radio-card"><input type="radio" name="payment_method" value="${v}" ${i === 0 ? "checked" : ""}><span><strong>${t(k)}</strong><small>${t(k + "_hint")}</small></span></label>`).join("")}
        </fieldset>
        <p class="error" id="checkout-error" role="alert" hidden></p>
        <button class="btn btn-primary btn-block" type="submit" id="place-btn">${t("place_order")}</button>
      </form>
      <aside class="summary" id="summary" aria-label="${t("order_summary")}"></aside>
    </div>`, after() {
      renderSummary();
      $("#c-zone").onchange = renderSummary;
      $("#checkout-form").onsubmit = submitOrder;
    } };
  }
  function shippingFor(zoneId, subtotal) {
    const z = data.zones.find((z) => String(z.id) === String(zoneId));
    if (!z) return null;
    const freeOver = Number(data.settings.free_shipping_over || 0);
    return { zone: z, fee: freeOver > 0 && subtotal >= freeOver ? 0 : Number(z.fee) };
  }
  function renderSummary() {
    const el = $("#summary"); if (!el) return;
    const lines = cartLines();
    const sub = cartSubtotal();
    const ship = shippingFor($("#c-zone")?.value, sub);
    el.innerHTML = `
      <h2 class="title">${t("order_summary")}</h2>
      ${lines.map((l) => `<div class="line-item">
        <div class="thumb"><img src="${esc(l.item.image_url || "/assets/maskati-mark.png")}" alt=""></div>
        <div><div>${esc(L(l.item, "name"))}</div><div class="body-sm muted">${num(l.qty)} × ${money(l.price)}</div></div>
        <div>${money(l.total)}</div></div>`).join("")}
      <div class="sum-row"><span>${t("subtotal")}</span><span>${money(sub)}</span></div>
      <div class="sum-row"><span>${t("shipping")}</span><span>${ship ? (ship.fee === 0 ? t("free") : money(ship.fee)) : `<span class="muted">${t("choose_gov_first")}</span>`}</span></div>
      ${ship ? `<div class="body-sm muted">${t("delivery_days", num(ship.zone.days))}</div>` : ""}
      <div class="sum-row sum-total"><span>${t("total")}</span><strong>${money(sub + (ship ? ship.fee : 0))}</strong></div>`;
  }
  async function submitOrder(e) {
    e.preventDefault();
    const form = e.target;
    let ok = true;
    const setErr = (input, msg) => {
      const span = input.parentElement.querySelector(".error");
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (span) { span.textContent = msg || ""; span.hidden = !msg; }
      if (msg && ok) { input.focus(); ok = false; }
    };
    ["c-name", "c-phone", "c-zone", "c-city", "c-address"].forEach((id) => setErr($("#" + id), ""));
    for (const id of ["c-name", "c-phone", "c-zone", "c-city", "c-address"]) {
      const el = $("#" + id);
      if (!el.value.trim()) setErr(el, t("err_required"));
    }
    const phone = $("#c-phone").value.replace(/[^\d+]/g, "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    if ($("#c-phone").value.trim() && !/^(\+?20|0)?1[0125]\d{8}$/.test(phone)) setErr($("#c-phone"), t("err_phone"));
    if (!ok) return;

    const payload = {
      customer_name: $("#c-name").value.trim(), phone, email: $("#c-email").value.trim(),
      shipping_zone_id: Number($("#c-zone").value), city: $("#c-city").value.trim(), address: $("#c-address").value.trim(),
      notes: $("#c-notes").value.trim(), payment_method: form.payment_method.value, lang,
      items: cart.map((c) => ({ type: c.type, id: c.id, quantity: c.qty }))
    };
    const btn = $("#place-btn"); btn.disabled = true; btn.textContent = t("placing");
    const errEl = $("#checkout-error"); errEl.hidden = true;
    const { data: res, error } = await db.rpc("place_order", { payload });
    btn.disabled = false; btn.textContent = t("place_order");
    if (error) {
      errEl.textContent = /unavailable/.test(error.message) ? t("err_unavailable") : /phone/.test(error.message) ? t("err_phone") : t("err_generic");
      errEl.hidden = false; return;
    }
    store.set("mk_customer", { customer_name: payload.customer_name, phone: payload.phone, email: payload.email, shipping_zone_id: payload.shipping_zone_id, city: payload.city, address: payload.address });
    store.set("mk_last_order", { ...res, payment_method: payload.payment_method });
    cart = []; saveCart();
    location.hash = `#/thanks/${res.order_number}`;
  }
  function pageThanks(n) {
    const last = store.get("mk_last_order", {});
    const wa = waLink(lang === "ar" ? `أهلًا ماسكاتي، عايزة أتابع طلبي رقم ${n}` : `Hello Maskati, I would like to follow up on order ${n}`);
    return { html: `<div class="wrap thanks">
      <img src="/assets/maskati-mark.png" alt="" width="72" height="69">
      <h1 class="display-lg">${t("thanks_title")}</h1>
      <p class="lede">${t("thanks_text", "#" + num(n))}</p>
      ${String(last.order_number) === String(n) ? `<p class="title">${t("total")}: ${money(last.total)}</p>` : ""}
      <div class="hero-actions" style="justify-content:center">
        ${wa ? `<a class="btn btn-primary" href="${esc(wa)}" target="_blank" rel="noopener">${t("thanks_wa")}</a>` : ""}
        <a class="btn btn-secondary" href="#/">${t("back_home")}</a>
      </div></div>` };
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
            <div class="stepper" style="margin-top:6px"><button type="button" data-q="${l.type}|${l.id}|${l.qty - 1}" aria-label="-">−</button><output>${num(l.qty)}</output><button type="button" data-q="${l.type}|${l.id}|${l.qty + 1}" aria-label="+">+</button></div>
          </div>
          <div style="text-align:end"><div>${money(l.total)}</div><button class="remove" type="button" data-q="${l.type}|${l.id}|0">${t("remove")}</button></div>
        </div>`).join("")}
      </div>
      <div class="drawer-foot">
        ${lines.length ? `<div class="sum-row"><span>${t("subtotal")}</span><strong>${money(sub)}</strong></div>
        <a class="btn btn-primary btn-block" href="#/checkout" id="go-checkout">${t("checkout")}</a>` : ""}
        <button class="btn btn-secondary btn-block" type="button" id="keep-shopping">${t("continue_shopping")}</button>
      </div>`;
    $("#drawer-close").onclick = closeDrawer;
    $("#keep-shopping").onclick = closeDrawer;
    $("#go-checkout")?.addEventListener("click", closeDrawer);
    $("#drawer").querySelectorAll("[data-q]").forEach((b) => b.onclick = () => { const [type, id, q] = b.dataset.q.split("|"); setQty(type, id, Number(q)); });
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ---------- router ----------
  function route() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const [path, query] = hash.split("?");
    const params = new URLSearchParams(query || "");
    const parts = path.split("/").filter(Boolean);
    let page;
    if (!loaded) page = { html: `<p class="loading">${t("loading")}</p>` };
    else if (parts.length === 0) page = pageHome();
    else if (["consult", "routines", "story", "faq"].includes(parts[0])) page = pageHome(parts[0]);
    else if (parts[0] === "shop") page = pageShop(params);
    else if (parts[0] === "product") page = pageProduct(decodeURIComponent(parts[1] || ""));
    else if (parts[0] === "checkout") page = pageCheckout();
    else if (parts[0] === "thanks") page = pageThanks(parts[1]);
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
    const contact = $("#sub-contact").value.trim();
    const { error } = await db.from("subscribers").insert({ contact });
    $("#sub-msg").textContent = !error || error.code === "23505" ? t("subscribed") : t("err_generic");
    if (!error) e.target.reset();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
  $("#drawer-backdrop").onclick = closeDrawer;
  window.addEventListener("scroll", () => $("#header").classList.toggle("scrolled", window.scrollY > 10), { passive: true });
  window.addEventListener("hashchange", route);

  // ---------- boot ----------
  applyLang();
  renderShell();
  route();
  loadData().then(() => {
    // drop cart lines for items that no longer exist
    cart = cart.filter((c) => (c.type === "bundle" ? bundleById(c.id) : productById(c.id)));
    saveCart();
    renderAll();
  }).catch(() => { $("#main").innerHTML = `<p class="loading">${t("err_generic")}</p>`; });
})();
