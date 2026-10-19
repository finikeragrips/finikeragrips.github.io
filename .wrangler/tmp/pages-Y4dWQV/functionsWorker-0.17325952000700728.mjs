var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../server/http.mjs
var SECURITY_HEADERS = { "x-content-type-options": "nosniff", "cache-control": "no-store" };
var json = /* @__PURE__ */ __name((data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...SECURITY_HEADERS, ...headers } }), "json");
var error = /* @__PURE__ */ __name((status, message, extra = {}) => json({ error: message, ...extra }, status), "error");
var digest = /* @__PURE__ */ __name(async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)))), "digest");
async function isAdmin(req, env = {}) {
  const expected = env.ADMIN_TOKEN;
  if (!expected || expected.length < 24)
    return false;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token)
    return false;
  const [a, b] = await Promise.all([digest(token), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
__name(isAdmin, "isAdmin");
function sniffImage(bytes) {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 255 && b[1] === 216 && b[2] === 255)
    return { type: "image/jpeg", ext: "jpg" };
  if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71)
    return { type: "image/png", ext: "png" };
  if (b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80)
    return { type: "image/webp", ext: "webp" };
  return null;
}
__name(sniffImage, "sniffImage");
function clean(v, max = 200) {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
__name(clean, "clean");
var EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

// ../server/notify.mjs
var esc = /* @__PURE__ */ __name((s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), "esc");
async function notifyOrder(order, env = {}) {
  const { RESEND_API_KEY, NOTIFY_EMAIL, FROM_EMAIL } = env;
  if (!RESEND_API_KEY || !NOTIFY_EMAIL || !FROM_EMAIL)
    return;
  const rows = order.summary.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");
  const body = `<h2>${esc(order.ref)}</h2><table>${rows}</table>`;
  const send = /* @__PURE__ */ __name((to, subject, html) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
  }).catch(() => {
  }), "send");
  await Promise.all([
    send(NOTIFY_EMAIL, `Nuevo pedido ${order.ref} (${order.kind})`, body),
    send(
      order.customer.email,
      `Finikera Grips \u2014 recibimos tu solicitud ${order.ref}`,
      `<p>Hola ${esc(order.customer.name)}, gracias por tu solicitud. Te contactaremos pronto.</p>${body}`
    )
  ]);
}
__name(notifyOrder, "notifyOrder");

// ../js/lib/case-config.mjs
var byId = /* @__PURE__ */ __name((list, id) => (list || []).find((o) => o.id === id) || null, "byId");
var clean2 = /* @__PURE__ */ __name((v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max), "clean");
var DEFAULT_DESIGN = {
  model: "case-1911",
  material: "wood",
  exterior: "walnut",
  hardware: "gold",
  lining: "burgundy",
  foam: "fitted",
  emblem: "horse",
  artwork: "none",
  placement: "lid-outside",
  artworkNotes: "",
  monogram: "",
  text: "",
  font: "roman",
  notes: ""
};
function normalizeDesign(input = {}, options) {
  const lim = options.limits || {};
  const errors = [];
  const d = {};
  const pick = /* @__PURE__ */ __name((key, list, label) => {
    const val = input[key] ?? DEFAULT_DESIGN[key];
    const opt = byId(list, val);
    if (!opt || opt.available === false)
      errors.push(`${label}: opci\xF3n no v\xE1lida`);
    d[key] = opt ? opt.id : null;
  }, "pick");
  pick("model", options.models, "Modelo");
  pick("material", options.materials, "Material");
  pick("exterior", options.exteriorColors, "Color exterior");
  pick("hardware", options.hardware, "Herrajes");
  pick("lining", options.linings, "Forro");
  pick("foam", options.foam, "Interior");
  pick("emblem", options.lidEmblems, "Emblema");
  pick("artwork", options.artwork, "Pintura");
  pick("placement", options.artworkPlacements, "Ubicaci\xF3n del arte");
  pick("font", options.textFonts, "Tipograf\xEDa");
  const ext = byId(options.exteriorColors, d.exterior);
  if (ext && ext.materials && !ext.materials.includes(d.material))
    errors.push("El color exterior no est\xE1 disponible en ese material");
  d.monogram = clean2(input.monogram, lim.monogram || 3).toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ&]/g, "");
  d.text = clean2(input.text, lim.text || 28);
  d.artworkNotes = clean2(input.artworkNotes, 600);
  d.notes = clean2(input.notes, lim.notes || 1500);
  if (d.artwork && d.artwork !== "none" && !d.artworkNotes && !input._hasUploads) {
    errors.push("Describe el arte deseado o sube una imagen de referencia");
  }
  return { design: d, errors };
}
__name(normalizeDesign, "normalizeDesign");
function estimate(d, options) {
  const lines = [];
  const reasons = [];
  const add = /* @__PURE__ */ __name((label, opt) => {
    if (!opt)
      return;
    if (opt.quote)
      reasons.push(`${label}: ${opt.label} se cotiza de forma individual`);
    else if (typeof opt.price !== "number")
      reasons.push(`${label}: ${opt.label} sin precio publicado`);
    else if (opt.price)
      lines.push({ label: `${label}: ${opt.label}`, amount: opt.price });
  }, "add");
  const model = byId(options.models, d.model);
  if (model && typeof model.price === "number")
    lines.unshift({ label: model.label, amount: model.price });
  else
    reasons.push("Precio base del modelo no publicado");
  add("Material", byId(options.materials, d.material));
  add("Exterior", byId(options.exteriorColors, d.exterior));
  add("Herrajes", byId(options.hardware, d.hardware));
  add("Forro", byId(options.linings, d.lining));
  add("Interior", byId(options.foam, d.foam));
  add("Emblema", byId(options.lidEmblems, d.emblem));
  add("Pintura", byId(options.artwork, d.artwork));
  if (d.monogram || d.text) {
    if (typeof options.textPrice === "number") {
      if (options.textPrice)
        lines.push({ label: "Personalizaci\xF3n de texto", amount: options.textPrice });
    } else
      reasons.push("Personalizaci\xF3n de texto sin precio publicado");
  }
  if (reasons.length)
    return { status: "quote", total: null, lines, reasons };
  return { status: "estimate", total: lines.reduce((s, l) => s + l.amount, 0), lines, reasons };
}
__name(estimate, "estimate");
function describe(d, options) {
  const L = /* @__PURE__ */ __name((list, id) => (byId(list, id) || {}).label || "\u2014", "L");
  const rows = [
    ["Modelo", L(options.models, d.model)],
    ["Material", L(options.materials, d.material)],
    ["Exterior", L(options.exteriorColors, d.exterior)],
    ["Herrajes", L(options.hardware, d.hardware)],
    ["Emblema de tapa", L(options.lidEmblems, d.emblem)],
    ["Forro interior", L(options.linings, d.lining)],
    ["Configuraci\xF3n interior", L(options.foam, d.foam)],
    ["Pintura a mano", L(options.artwork, d.artwork)]
  ];
  if (d.artwork !== "none")
    rows.push(["Ubicaci\xF3n del arte", L(options.artworkPlacements, d.placement)]);
  if (d.artworkNotes)
    rows.push(["Descripci\xF3n del arte", d.artworkNotes]);
  if (d.monogram)
    rows.push(["Monograma", d.monogram]);
  if (d.text)
    rows.push(["Texto", d.text]);
  if (d.monogram || d.text)
    rows.push(["Tipograf\xEDa", L(options.textFonts, d.font)]);
  if (d.notes)
    rows.push(["Notas para el artista", d.notes]);
  return rows;
}
__name(describe, "describe");

// ../server/handler.mjs
var D;
function createHandler(deps) {
  return (req) => {
    D = deps;
    return handler(req);
  };
}
__name(createHandler, "createHandler");
var store = /* @__PURE__ */ __name((name) => D.store(name), "store");
var getCatalog = /* @__PURE__ */ __name(async () => await store("config").get("products.json", { type: "json" }) || D.bundled("products.json"), "getCatalog");
var getOptions = /* @__PURE__ */ __name(async () => await store("config").get("case-options.json", { type: "json" }) || D.bundled("case-options.json"), "getOptions");
var saveConfig = /* @__PURE__ */ __name((name, value) => store("config").setJSON(name, value), "saveConfig");
var randomBytes = /* @__PURE__ */ __name((n) => crypto.getRandomValues(new Uint8Array(n)), "randomBytes");
var hex = /* @__PURE__ */ __name((bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(""), "hex");
var STATUSES = ["new", "reviewing", "quoted", "awaiting-payment", "paid", "in-production", "shipped", "completed", "cancelled"];
var CONTACT_PREFS = ["instagram", "email", "phone", "whatsapp"];
var PAYMENT_PREFS = ["zelle", "apple-pay", "other"];
var MAX_BODY = 55e5;
async function handler(req) {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/(\.netlify\/functions\/)?api\/?/, "");
  const m = req.method;
  try {
    if (m === "GET" && route === "catalog")
      return json(publicCatalog(await getCatalog()), 200, { "cache-control": "public, max-age=60" });
    if (m === "GET" && route === "options")
      return json(await getOptions(), 200, { "cache-control": "public, max-age=60" });
    if (m === "POST" && route === "orders")
      return await createOrder(req);
    if (m === "GET" && route.startsWith("media/"))
      return await serveBlob("media", route.slice(6), true);
    if (route.startsWith("admin/")) {
      if (!await isAdmin(req, D.env))
        return error(401, "No autorizado");
      const r = route.slice(6);
      if (m === "GET" && r === "orders")
        return json(await listOrders(url.searchParams.get("status")));
      if (m === "GET" && r === "orders.csv")
        return await exportCsv();
      if (r.startsWith("orders/")) {
        const ref = r.slice(7);
        if (!/^FG-\d{6}-[A-Z2-9]{5}$/.test(ref))
          return error(400, "Referencia inv\xE1lida");
        if (m === "GET")
          return await getOrder(ref);
        if (m === "PATCH")
          return await updateOrder(ref, req);
      }
      if (m === "GET" && r.startsWith("uploads/"))
        return await serveBlob("uploads", r.slice(8), false);
      if (m === "GET" && r === "catalog")
        return json(await getCatalog());
      if (m === "PUT" && r === "catalog")
        return await putCatalog(req);
      if (m === "PUT" && r === "options")
        return await putOptions(req);
      if (m === "POST" && r === "media")
        return await uploadMedia(req);
    }
    return error(404, "No encontrado");
  } catch (e) {
    console.error(e);
    return error(500, "Error interno");
  }
}
__name(handler, "handler");
function publicCatalog(cat) {
  return { ...cat, products: cat.products.filter((p) => p.active !== false) };
}
__name(publicCatalog, "publicCatalog");
var IMG_PATH = /^(assets\/[\w.-]+\.(jpe?g|png|webp)|\/api\/media\/product\/[\w.-]+)$/i;
function validateProduct(p, i) {
  const errs = [];
  const id = clean(p.id, 80);
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id))
    errs.push(`#${i + 1}: id inv\xE1lido`);
  const type = p.type === "case" ? "case" : "grip";
  const num = /* @__PURE__ */ __name((v, label, int) => {
    if (v === null || v === "" || v === void 0)
      return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || int && !Number.isInteger(n)) {
      errs.push(`#${i + 1}: ${label} inv\xE1lido`);
      return null;
    }
    return n;
  }, "num");
  const images = (Array.isArray(p.images) ? p.images : []).map((s) => String(s).trim()).filter(Boolean);
  if (!images.length)
    errs.push(`#${i + 1}: requiere al menos una imagen`);
  images.forEach((s) => {
    if (!IMG_PATH.test(s))
      errs.push(`#${i + 1}: ruta de imagen no permitida (${clean(s, 60)})`);
  });
  const variants = (Array.isArray(p.variants) ? p.variants : []).slice(0, 30).map((v) => ({
    id: clean(v.id, 40),
    label: clean(v.label, 80),
    price: num(v.price, "precio de variante"),
    stock: num(v.stock, "stock de variante", true)
  })).filter((v) => v.id && v.label);
  return {
    errs,
    product: {
      id,
      type,
      model: clean(p.model, 40),
      color: clean(p.color, 40),
      name: clean(p.name, 120),
      description: clean(p.description, 600),
      finish: clean(p.finish, 80),
      images: images.slice(0, 30),
      featured: !!p.featured,
      active: p.active !== false,
      price: num(p.price, "precio"),
      stock: num(p.stock, "stock", true),
      variants
    }
  };
}
__name(validateProduct, "validateProduct");
async function putCatalog(req) {
  const body = await readJson(req, 1e6);
  if (!body || !Array.isArray(body.products) || body.products.length > 2e3)
    return error(400, "Formato inv\xE1lido");
  const errors = [], products = [], ids = /* @__PURE__ */ new Set();
  body.products.forEach((p, i) => {
    const { errs, product } = validateProduct(p || {}, i);
    if (!product.name)
      errs.push(`#${i + 1}: nombre requerido`);
    if (ids.has(product.id))
      errs.push(`#${i + 1}: id duplicado (${product.id})`);
    ids.add(product.id);
    errors.push(...errs);
    products.push(product);
  });
  if (errors.length)
    return error(422, "Errores de validaci\xF3n", { errors: errors.slice(0, 50) });
  await saveConfig("products.json", { currency: "USD", updatedAt: (/* @__PURE__ */ new Date()).toISOString(), products });
  return json({ ok: true, count: products.length });
}
__name(putCatalog, "putCatalog");
async function putOptions(req) {
  const body = await readJson(req, 2e5);
  const required = ["models", "materials", "exteriorColors", "hardware", "linings", "foam", "lidEmblems", "artwork", "artworkPlacements", "textFonts"];
  const errors = [];
  if (!body || typeof body !== "object")
    return error(400, "Formato inv\xE1lido");
  for (const k of required) {
    if (!Array.isArray(body[k]) || !body[k].length) {
      errors.push(`${k}: debe ser una lista no vac\xEDa`);
      continue;
    }
    body[k].forEach((o, i) => {
      if (!o || !/^[a-z0-9-]{1,40}$/.test(o.id || ""))
        errors.push(`${k}[${i}]: id inv\xE1lido`);
      if (!o || !clean(o.label, 120))
        errors.push(`${k}[${i}]: label requerido`);
      if (o && "price" in o && o.price !== null && !(Number.isFinite(o.price) && o.price >= 0))
        errors.push(`${k}[${i}]: price debe ser n\xFAmero \u2265 0 o null`);
      if (o && o.hex && !/^#[0-9a-f]{6}$/i.test(o.hex))
        errors.push(`${k}[${i}]: hex inv\xE1lido`);
    });
  }
  if (body.textPrice !== null && body.textPrice !== void 0 && !(Number.isFinite(body.textPrice) && body.textPrice >= 0))
    errors.push("textPrice inv\xE1lido");
  if (errors.length)
    return error(422, "Errores de validaci\xF3n", { errors: errors.slice(0, 50) });
  await saveConfig("case-options.json", body);
  return json({ ok: true });
}
__name(putOptions, "putOptions");
var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newRef() {
  const d = /* @__PURE__ */ new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, "");
  const rnd = [...randomBytes(5)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  return `FG-${ymd}-${rnd}`;
}
__name(newRef, "newRef");
function validateCustomer(c = {}) {
  const errors = [];
  const customer = {
    name: clean(c.name, 80),
    email: clean(c.email, 254).toLowerCase(),
    phone: clean(c.phone, 30),
    instagram: clean(c.instagram, 40).replace(/^@/, ""),
    state: clean(c.state, 40),
    city: clean(c.city, 60),
    contactPref: CONTACT_PREFS.includes(c.contactPref) ? c.contactPref : "email",
    paymentPref: PAYMENT_PREFS.includes(c.paymentPref) ? c.paymentPref : "zelle"
  };
  if (customer.name.length < 2)
    errors.push("Nombre requerido");
  if (!EMAIL_RE.test(customer.email))
    errors.push("Correo electr\xF3nico inv\xE1lido");
  if (customer.phone && !/^[+\d\s().-]{7,30}$/.test(customer.phone))
    errors.push("Tel\xE9fono inv\xE1lido");
  if (customer.instagram && !/^[\w.]{1,30}$/.test(customer.instagram))
    errors.push("Usuario de Instagram inv\xE1lido");
  if (!customer.state)
    errors.push("Estado requerido");
  return { customer, errors };
}
__name(validateCustomer, "validateCustomer");
async function createOrder(req) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY)
    return error(413, "Archivos demasiado grandes");
  let form;
  try {
    form = await req.formData();
  } catch {
    return error(400, "Formulario inv\xE1lido");
  }
  if (form.get("website"))
    return json({ ok: true, ref: newRef() });
  let payload;
  try {
    payload = JSON.parse(String(form.get("payload") || "{}"));
  } catch {
    return error(400, "Datos inv\xE1lidos");
  }
  const kind = payload.kind === "cart" ? "cart" : "custom-case";
  const { customer, errors } = validateCustomer(payload.customer);
  if (payload.consent !== true)
    errors.push("Debes aceptar los t\xE9rminos");
  const options = await getOptions();
  const lim = options.limits || {};
  const files = form.getAll("files").filter((f) => f && typeof f === "object" && f.size > 0);
  if (kind === "cart" && files.length)
    errors.push("Este pedido no admite archivos");
  if (files.length > (lim.uploads || 3))
    errors.push(`M\xE1ximo ${lim.uploads || 3} im\xE1genes`);
  const uploads = [];
  for (const f of files.slice(0, lim.uploads || 3)) {
    if (f.size > (lim.uploadBytes || 18e5)) {
      errors.push(`"${clean(f.name, 60)}" supera el tama\xF1o m\xE1ximo`);
      continue;
    }
    const bytes = await f.arrayBuffer();
    const kindOf = sniffImage(bytes);
    if (!kindOf) {
      errors.push(`"${clean(f.name, 60)}" no es una imagen JPG, PNG o WebP`);
      continue;
    }
    uploads.push({ bytes, ...kindOf, originalName: clean(f.name, 80) });
  }
  let order;
  const ref = newRef();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (kind === "custom-case") {
    const { design, errors: dErr } = normalizeDesign({ ...payload.design, _hasUploads: uploads.length > 0 }, options);
    errors.push(...dErr);
    if (errors.length)
      return error(422, "Revisa los datos", { errors });
    const est = estimate(design, options);
    order = {
      ref,
      kind,
      status: "new",
      createdAt: now,
      customer,
      design,
      estimate: est,
      requestType: est.status === "estimate" ? "order" : "quote",
      summary: describe(design, options)
    };
  } else {
    const catalog = await getCatalog();
    const items = (Array.isArray(payload.items) ? payload.items : []).slice(0, 25);
    if (!items.length)
      errors.push("El carrito est\xE1 vac\xEDo");
    const lines = [];
    for (const it of items) {
      const p = catalog.products.find((x) => x.id === it.id && x.active !== false);
      const qty = Math.trunc(Number(it.qty));
      if (!p) {
        errors.push("Un producto ya no est\xE1 disponible");
        continue;
      }
      if (!(qty >= 1 && qty <= 10)) {
        errors.push(`Cantidad inv\xE1lida para ${p.name}`);
        continue;
      }
      const v = it.variant ? (p.variants || []).find((x) => x.id === it.variant) : null;
      if (it.variant && !v) {
        errors.push(`Variante no disponible para ${p.name}`);
        continue;
      }
      const unit = v && typeof v.price === "number" ? v.price : p.price;
      const stock = v ? v.stock : p.stock;
      if (typeof stock === "number" && stock < qty)
        errors.push(`${p.name}: solo quedan ${stock}`);
      lines.push({ id: p.id, name: p.name + (v ? ` \u2014 ${v.label}` : ""), variant: v ? v.id : null, qty, unitPrice: typeof unit === "number" ? unit : null });
    }
    if (errors.length)
      return error(422, "Revisa los datos", { errors });
    const priced = lines.every((l) => l.unitPrice !== null);
    const total = priced ? lines.reduce((s, l) => s + l.unitPrice * l.qty, 0) : null;
    order = {
      ref,
      kind,
      status: "new",
      createdAt: now,
      customer,
      items: lines,
      notes: clean(payload.notes, 1e3),
      estimate: { status: priced ? "estimate" : "quote", total },
      requestType: priced ? "order" : "quote",
      summary: lines.map((l) => [`${l.qty} \xD7 ${l.name}`, l.unitPrice === null ? "Precio a confirmar" : `$${l.unitPrice * l.qty}`])
    };
  }
  const up = store("uploads");
  order.uploads = [];
  for (const [i, u] of uploads.entries()) {
    const key = `${ref}/ref-${i + 1}.${u.ext}`;
    await up.set(key, u.bytes, { metadata: { contentType: u.type, originalName: u.originalName } });
    order.uploads.push({ key, contentType: u.type, originalName: u.originalName, bytes: u.bytes.byteLength });
  }
  order.history = [{ at: now, status: "new", note: "Pedido recibido" }];
  await store("orders").setJSON(`${ref}.json`, order);
  await notifyOrder(order, D.env);
  return json({ ok: true, ref, status: order.status, requestType: order.requestType, estimate: order.estimate, summary: order.summary }, 201);
}
__name(createOrder, "createOrder");
async function loadOrders() {
  const s = store("orders");
  const { blobs } = await s.list();
  const all = await Promise.all(blobs.filter((b) => b.key.endsWith(".json")).map((b) => s.get(b.key, { type: "json" })));
  return all.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
__name(loadOrders, "loadOrders");
async function listOrders(status) {
  const orders = await loadOrders();
  return {
    statuses: STATUSES,
    orders: orders.filter((o) => !status || o.status === status).map((o) => ({
      ref: o.ref,
      kind: o.kind,
      status: o.status,
      createdAt: o.createdAt,
      requestType: o.requestType,
      name: o.customer.name,
      email: o.customer.email,
      total: o.estimate?.total ?? null,
      quotedPrice: o.quotedPrice ?? null,
      uploads: o.uploads.length
    }))
  };
}
__name(listOrders, "listOrders");
async function getOrder(ref) {
  const o = await store("orders").get(`${ref}.json`, { type: "json" });
  return o ? json(o) : error(404, "Pedido no encontrado");
}
__name(getOrder, "getOrder");
async function updateOrder(ref, req) {
  const s = store("orders");
  const o = await s.get(`${ref}.json`, { type: "json" });
  if (!o)
    return error(404, "Pedido no encontrado");
  const body = await readJson(req, 2e4) || {};
  const entry = { at: (/* @__PURE__ */ new Date()).toISOString() };
  if (body.status !== void 0) {
    if (!STATUSES.includes(body.status))
      return error(422, "Estado inv\xE1lido");
    o.status = entry.status = body.status;
  }
  if (body.quotedPrice !== void 0) {
    const n = body.quotedPrice === null || body.quotedPrice === "" ? null : Number(body.quotedPrice);
    if (n !== null && !(Number.isFinite(n) && n >= 0))
      return error(422, "Precio inv\xE1lido");
    o.quotedPrice = entry.quotedPrice = n;
  }
  if (body.tracking !== void 0)
    o.tracking = entry.tracking = clean(body.tracking, 80);
  if (body.note)
    entry.note = clean(body.note, 1e3);
  o.history.push(entry);
  o.updatedAt = entry.at;
  await s.setJSON(`${ref}.json`, o);
  return json(o);
}
__name(updateOrder, "updateOrder");
async function exportCsv() {
  const orders = await loadOrders();
  const cell = /* @__PURE__ */ __name((v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s))
      s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  }, "cell");
  const head = ["ref", "created_at", "kind", "request_type", "status", "name", "email", "phone", "instagram", "state", "city", "contact_pref", "payment_pref", "estimate_total", "quoted_price", "tracking", "uploads", "details"];
  const rows = orders.map((o) => [
    o.ref,
    o.createdAt,
    o.kind,
    o.requestType,
    o.status,
    o.customer.name,
    o.customer.email,
    o.customer.phone,
    o.customer.instagram,
    o.customer.state,
    o.customer.city,
    o.customer.contactPref,
    o.customer.paymentPref,
    o.estimate?.total ?? "",
    o.quotedPrice ?? "",
    o.tracking ?? "",
    o.uploads.length,
    o.summary.map(([k, v]) => `${k}: ${v}`).join(" | ")
  ]);
  const csv = "\uFEFF" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="finikera-pedidos-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
__name(exportCsv, "exportCsv");
async function uploadMedia(req) {
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY)
    return error(413, "Archivo demasiado grande");
  const form = await req.formData().catch(() => null);
  const f = form && form.get("file");
  if (!f || typeof f !== "object")
    return error(400, "Falta el archivo");
  const bytes = await f.arrayBuffer();
  const t = sniffImage(bytes);
  if (!t)
    return error(422, "Solo JPG, PNG o WebP");
  const key = `product/${hex(randomBytes(9))}.${t.ext}`;
  await store("media").set(key, bytes, { metadata: { contentType: t.type } });
  return json({ ok: true, url: `/api/media/${key}` }, 201);
}
__name(uploadMedia, "uploadMedia");
async function serveBlob(storeName, key, isPublic) {
  if (!/^[\w-]+(\/[\w.-]+)+$/.test(key) || key.includes(".."))
    return error(400, "Clave inv\xE1lida");
  if (isPublic && !key.startsWith("product/"))
    return error(404, "No encontrado");
  const res = await store(storeName).getWithMetadata(key, { type: "arrayBuffer" });
  if (!res)
    return error(404, "No encontrado");
  const type = ["image/jpeg", "image/png", "image/webp"].includes(res.metadata?.contentType) ? res.metadata.contentType : "application/octet-stream";
  return new Response(res.data, { headers: {
    "content-type": type,
    "x-content-type-options": "nosniff",
    "cache-control": isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
    "content-security-policy": "default-src 'none'"
  } });
}
__name(serveBlob, "serveBlob");
async function readJson(req, max) {
  const text = await req.text();
  if (text.length > max)
    return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
__name(readJson, "readJson");

// ../server/stores/kv.mjs
function kvStore(kv, name) {
  const k = /* @__PURE__ */ __name((key) => `${name}/${key}`, "k");
  return {
    async get(key, opts = {}) {
      return kv.get(k(key), { type: opts.type === "json" ? "json" : opts.type === "arrayBuffer" ? "arrayBuffer" : "text" });
    },
    async getWithMetadata(key, opts = {}) {
      const { value, metadata } = await kv.getWithMetadata(k(key), { type: opts.type === "arrayBuffer" ? "arrayBuffer" : "text" });
      return value === null ? null : { data: value, metadata: metadata || {} };
    },
    async set(key, value, opts = {}) {
      await kv.put(k(key), value, opts.metadata ? { metadata: opts.metadata } : {});
    },
    async setJSON(key, value) {
      await kv.put(k(key), JSON.stringify(value));
    },
    async delete(key) {
      await kv.delete(k(key));
    },
    async list({ prefix = "" } = {}) {
      const blobs = [];
      let cursor;
      do {
        const page = await kv.list({ prefix: k(prefix), cursor });
        page.keys.forEach((x) => blobs.push({ key: x.name.slice(name.length + 1) }));
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      return { blobs };
    }
  };
}
__name(kvStore, "kvStore");

// api/[[path]].js
async function onRequest({ request, env }) {
  if (!env.FG_KV)
    return new Response(JSON.stringify({ error: "Falta la conexi\xF3n FG_KV" }), { status: 503, headers: { "content-type": "application/json" } });
  const handle = createHandler({
    store: (name) => kvStore(env.FG_KV, name),
    bundled: async (file) => (await env.ASSETS.fetch(new URL(`/data/${file}`, request.url))).json(),
    env
  });
  return handle(request);
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-Y4dWQV/functionsRoutes-0.49094163889617093.mjs
var routes = [
  {
    routePath: "/api/:path*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../../../../tmp/claude-0/-home-user-finikeragrips-github-io/a0079174-6b4c-5392-b61b-4f42799e44f6/scratchpad/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../tmp/claude-0/-home-user-finikeragrips-github-io/a0079174-6b4c-5392-b61b-4f42799e44f6/scratchpad/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler2 of route.middlewares.flat()) {
        yield {
          handler: handler2,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler2 of route.modules.flat()) {
        yield {
          handler: handler2,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler: handler2, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: () => {
            isFailOpen = true;
          }
        };
        const response = await handler2(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error2) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error2;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../../tmp/claude-0/-home-user-finikeragrips-github-io/a0079174-6b4c-5392-b61b-4f42799e44f6/scratchpad/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../tmp/claude-0/-home-user-finikeragrips-github-io/a0079174-6b4c-5392-b61b-4f42799e44f6/scratchpad/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error2 = reduceError(e);
    return Response.json(error2, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-HxVGIF/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../../tmp/claude-0/-home-user-finikeragrips-github-io/a0079174-6b4c-5392-b61b-4f42799e44f6/scratchpad/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-HxVGIF/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.17325952000700728.mjs.map
