(function () {
"use strict";

const CITIES = window.CITIES;
const KEYS = ["osaka", "kyoto"];
const $ = (s) => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const NS = "http://www.w3.org/2000/svg";
const sv = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };

const store = {
  get(k, d) { try { const v = localStorage.getItem("kansai." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("kansai." + k, JSON.stringify(v)); } catch (e) {} }
};

const S = {
  city: KEYS.includes(store.get("city")) ? store.get("city") : "osaka",
  view: ["list", "map", "picks"].includes(store.get("view")) ? store.get("view") : "list",
  cat: "all",
  zoom: { osaka: 1, kyoto: innerWidth < 600 ? 2 : 1 },
  centered: {},
  picks: { osaka: new Set(store.get("picks.osaka", [])), kyoto: new Set(store.get("picks.kyoto", [])) }
};
for (const c of KEYS) {
  const names = new Set(CITIES[c].stores.map((d) => d.k));
  for (const k of [...S.picks[c]]) if (!names.has(k)) S.picks[c].delete(k);
}

/* ── store helpers ───────────────────────────── */
const tier = (d) => (d.f === "재방문" || d.n >= 3) ? 3 : (d.f === "족보" || d.n >= 2) ? 2 : 1;
const isLow = (d) => d.r === "1/5" || d.r === "2/5";
const hasPin = (d) => typeof d.lat === "number";
const priced = (p) => p && p !== "—";
const mapsUrl = (d) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(d.q);
const ytUrl = (id) => "https://www.youtube.com/shorts/" + id;
const isPicked = (c, d) => S.picks[c].has(d.k);
const totalPicks = () => KEYS.reduce((n, c) => n + S.picks[c].size, 0);
const BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12v17l-6-4.2-6 4.2z" stroke-linejoin="round"/></svg>';

function badges(d) {
  const b = [];
  if (d.f === "재방문") b.push(["또 가고싶은", "again"]);
  if (d.f === "족보") b.push(["족보정리", "jokbo"]);
  if (d.n >= 2) b.push(["쇼츠 " + d.n + "편", d.n >= 3 ? "reps hot" : "reps"]);
  if (d.r) b.push([d.r === "호불호" ? "호불호" : "채널 " + d.r, (isLow(d) || d.r === "호불호") ? "meh" : "good"]);
  return b;
}

function inBox(c, d) {
  const M = CITIES[c].map;
  return hasPin(d) && d.lon >= M.x0 && d.lon <= M.x1 && d.lat >= M.y0 && d.lat <= M.y1;
}

function dirText(M, d) {
  const [cy, cx] = M.center;
  const dy = d.lat - cy, dx = (d.lon - cx) * Math.cos(cy * Math.PI / 180);
  const km = Math.round(Math.hypot(dy, dx) * 111);
  const ns = dy > 0.02 ? "북" : dy < -0.02 ? "남" : "";
  const ew = dx > 0.02 ? "동" : dx < -0.02 ? "서" : "";
  return (ns + ew || "근교") + " " + km + "km";
}

/* ── card ────────────────────────────────────── */
function card(c, d, opts) {
  opts = opts || {};
  const a = el("article", "card t" + tier(d) + (isLow(d) ? " low" : ""));
  a.dataset.k = d.k; a.dataset.c = c;
  a.append(el("div", "nm", d.k));
  a.append(el("div", "sub", [d.j, d.a].filter(Boolean).join(" · ")));
  const bs = badges(d);
  if (bs.length) {
    const w = el("div", "badges");
    for (const [txt, cls] of bs) w.append(el("span", "badge " + cls, txt));
    a.append(w);
  }
  const m = el("div", "menu");
  m.append(document.createTextNode(d.m));
  if (priced(d.p)) { m.append(document.createTextNode(" ")); m.append(el("span", "yen", d.p)); }
  a.append(m);
  if (d.t) a.append(el("div", "note", d.t));
  if (d.h && d.h !== "—") a.append(el("div", "hours", d.h));

  const acts = el("div", "acts");
  const vl = CITIES[c].vlab;
  for (const id of d.v) {
    const l = el("a", "yt", vl[id] || "쇼츠");
    l.href = ytUrl(id); l.target = "_blank"; l.rel = "noopener";
    acts.append(l);
  }
  const g = el("a", "gm", "구글맵");
  g.href = mapsUrl(d); g.target = "_blank"; g.rel = "noopener";
  acts.append(g);
  if (!opts.inSheet && inBox(c, d)) {
    const mb = el("button", "onmap", "지도에서 보기");
    mb.type = "button";
    mb.addEventListener("click", () => { if (c !== S.city) setCity(c, true); go("map"); focusPin(c, d); });
    acts.append(mb);
  }
  a.append(acts);

  const b = el("button", "mark");
  b.type = "button"; b.innerHTML = BOOK;
  b.dataset.k = d.k; b.dataset.c = c;
  setMark(b, c, d);
  b.addEventListener("click", () => togglePick(c, d));
  a.append(b);
  return a;
}

function setMark(b, c, d) {
  const on = isPicked(c, d);
  b.setAttribute("aria-pressed", on ? "true" : "false");
  b.setAttribute("aria-label", (on ? "담은 곳에서 빼기: " : "담기: ") + d.k);
}

function togglePick(c, d) {
  const s = S.picks[c];
  const on = !s.has(d.k);
  on ? s.add(d.k) : s.delete(d.k);
  store.set("picks." + c, [...s]);
  for (const b of document.querySelectorAll(".mark")) {
    if (b.dataset.c === c && b.dataset.k === d.k) setMark(b, c, d);
  }
  updateCount();
  if (S.view === "map") renderMap();
  if (S.view === "picks" && !on) renderPicks();
  toast(on ? "담았어요 · 담은 곳 " + totalPicks() + "곳" : "뺐어요");
}

/* ── list ────────────────────────────────────── */
function renderList() {
  const C = CITIES[S.city];
  const again = C.stores.filter((d) => d.f === "재방문").length;
  const rep = C.stores.filter((d) => d.n >= 2).length;
  const st = $("#stats"); st.textContent = "";
  const add = (label, n) => { if (st.childNodes.length) st.append(" · "); st.append(label + " "); st.append(el("b", null, String(n))); };
  add("쇼츠", C.videos + "편"); add("가게", C.stores.length + "곳");
  if (again) add("또 가고싶은", again + "곳"); else add("재방문", rep + "곳");
  $("#blurb").textContent = C.blurb;

  const root = $("#list"); root.textContent = "";
  for (const cat of C.cats) {
    if (S.cat !== "all" && S.cat !== cat) continue;
    const items = C.stores.filter((d) => d.c === cat);
    const sec = el("section", "group");
    const gh = el("div", "group-h");
    gh.append(el("h2", null, cat), el("span", null, items.length + "곳"));
    sec.append(gh);
    for (const d of items) sec.append(card(S.city, d));
    const ex = C.asides[cat];
    if (ex) {
      const x = el("div", "aside");
      x.append(el("h3", null, ex.h), el("p", null, ex.p));
      const ul = el("ul");
      ex.l.forEach((t) => ul.append(el("li", null, t)));
      x.append(ul); sec.append(x);
    }
    root.append(sec);
  }
  const cr = $("#credit"); cr.textContent = "";
  cr.append("가격·영업시간·평점은 각 쇼츠 설명란 기준이라 바뀌었을 수 있어요. 출처: ");
  const a = el("a", null, "공간 탐닉 — " + C.name + " 재생목록");
  a.href = C.playlist; a.target = "_blank"; a.rel = "noopener";
  cr.append(a, ".");
}

/* ── chips ───────────────────────────────────── */
function renderChips() {
  const C = CITIES[S.city], w = $("#chips");
  w.textContent = "";
  const mk = (val, label, color) => {
    const b = el("button", "chip"); b.type = "button";
    if (color) { const i = el("i"); i.style.background = color; b.append(i); }
    b.append(document.createTextNode(label));
    b.setAttribute("aria-pressed", S.cat === val ? "true" : "false");
    b.addEventListener("click", () => {
      S.cat = val; renderChips(); renderView();
      if (S.view === "list") scrollTo({ top: 0 });
    });
    w.append(b);
  };
  mk("all", "전체");
  C.cats.forEach((c, i) => mk(c, C.short[c] || c, "var(--c" + (i + 1) + ")"));
}

/* ── map ─────────────────────────────────────── */
function renderMap() {
  const c = S.city, C = CITIES[c], M = C.map;
  const PX = (lo) => (lo - M.x0) / (M.x1 - M.x0) * M.W;
  const PY = (la) => (M.y1 - la) / (M.y1 - M.y0) * M.H;
  const pth = (pts) => pts.map((p, i) => (i ? "L" : "M") + PX(p[1]).toFixed(1) + " " + PY(p[0]).toFixed(1)).join(" ");

  $("#pinnote").textContent = C.pinNote + " 핀을 누르면 자세히 볼 수 있어요.";
  const wrap = $("#mapwrap");
  wrap.style.setProperty("--z", S.zoom[c]);
  $("#zlabel").textContent = S.zoom[c] + "×";
  $("#zout").disabled = S.zoom[c] <= 1;
  $("#zin").disabled = S.zoom[c] >= 4;

  const svg = $("#map");
  svg.setAttribute("viewBox", "0 0 " + M.W + " " + M.H);
  svg.setAttribute("aria-label", C.name + " 맛집 위치 약도");
  svg.textContent = "";
  for (const r of M.rivers) svg.append(sv("path", { class: "river", d: pth(r) }));
  for (const L of M.lines) svg.append(sv("path", { class: L.cls, d: pth(L.pts) + (L.closed ? " Z" : "") }));
  const label = (x, y, nm, an, off) => {
    const t = sv("text", { class: "lbl", x: an === "start" ? x + off : x - off, y: y + 4.5, "text-anchor": an });
    t.textContent = nm; svg.append(t);
  };
  for (const [la, lo, nm, an] of M.stations) {
    const x = PX(lo), y = PY(la);
    svg.append(sv("circle", { class: "stn", cx: x, cy: y, r: 3.8 }));
    label(x, y, nm, an, 8);
  }
  for (const [la, lo, nm, an] of M.landmarks) {
    const x = PX(lo), y = PY(la);
    svg.append(sv("rect", { class: "mark-l", x: x - 6, y: y - 6, width: 12, height: 12, transform: "rotate(45 " + x + " " + y + ")" }));
    label(x, y, nm, an, 12);
  }

  const cidx = {}; C.cats.forEach((x, i) => { cidx[x] = i + 1; });
  const vis = C.stores.map((d, i) => ({ d, i })).filter((o) => inBox(c, o.d));
  vis.sort((a, b) => (tier(b.d) - tier(a.d)) || (a.i - b.i));
  const leads = sv("g", {}), pins = sv("g", {});
  svg.append(leads, pins);
  const placed = [];
  for (const { d } of vis) {
    const ox = PX(d.lon), oy = PY(d.lat);
    let x = ox, y = oy, a = 0, r = 0;
    while (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 14)) {
      a += 1.05; r = 6 + a * 1.9;
      x = ox + Math.cos(a) * r; y = oy + Math.sin(a) * r;
      if (r > 90) break;
    }
    placed.push({ x, y });
    if (Math.hypot(x - ox, y - oy) > 8) leads.append(sv("line", { class: "lead", x1: ox, y1: oy, x2: x, y2: y }));
    const on = isPicked(c, d), off = S.cat !== "all" && S.cat !== d.c;
    const g = sv("g", {
      class: "pin" + (off ? " dim" : ""),
      transform: "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")",
      tabindex: off ? "-1" : "0", role: "button", "aria-label": d.k + (on ? " (담음)" : ""), "data-k": d.k
    });
    g.append(sv("circle", { class: "hit", r: 15 }));
    g.append(sv("circle", { class: "dot", r: on ? 7.5 : (tier(d) === 3 ? 7.5 : 6), fill: "var(--c" + cidx[d.c] + ")" }));
    if (on) g.append(sv("circle", { class: "ring", r: 11.5 }));
    g.addEventListener("click", () => openSheet(c, d));
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSheet(c, d); } });
    pins.append(g);
  }

  const om = $("#offmap"); om.textContent = "";
  const offs = C.stores.filter((d) => hasPin(d) && !inBox(c, d));
  const nops = C.stores.filter((d) => !hasPin(d));
  const chip = (d, txt) => { const b = el("button", "chip sm", txt); b.type = "button"; b.addEventListener("click", () => openSheet(c, d)); om.append(b); };
  if (offs.length) { om.append(el("span", "lab", "지도 밖")); offs.forEach((d) => chip(d, d.k + " · " + dirText(M, d))); }
  if (nops.length) { om.append(el("span", "lab", "주소 미표기")); nops.forEach((d) => chip(d, d.k)); }

  if (!S.centered[c]) {
    S.centered[c] = true;
    requestAnimationFrame(() => {
      const [la, lo] = M.center;
      wrap.scrollLeft = (PX(lo) / M.W) * wrap.scrollWidth - wrap.clientWidth / 2;
    });
  }
}

function setZoom(z) {
  const c = S.city, w = $("#mapwrap");
  z = Math.max(1, Math.min(4, z));
  if (z === S.zoom[c]) return;
  const r = w.getBoundingClientRect();
  const cx = (w.scrollLeft + w.clientWidth / 2) / w.scrollWidth;
  const visTop = Math.max(r.top, 0), visBot = Math.min(r.bottom, innerHeight);
  const mid = (visTop + visBot) / 2, cy = (mid - r.top) / r.height;
  S.zoom[c] = z;
  w.style.setProperty("--z", z);
  $("#zlabel").textContent = z + "×";
  $("#zout").disabled = z <= 1; $("#zin").disabled = z >= 4;
  requestAnimationFrame(() => {
    const r2 = w.getBoundingClientRect();
    w.scrollLeft = cx * w.scrollWidth - w.clientWidth / 2;
    scrollBy(0, (r2.top + cy * r2.height) - mid);
  });
}

function focusPin(c, d) {
  requestAnimationFrame(() => {
    const g = document.querySelector('#map .pin[data-k="' + CSS.escape(d.k) + '"]');
    if (!g) { openSheet(c, d); return; }
    const w = $("#mapwrap"), wr = w.getBoundingClientRect(), pr = g.getBoundingClientRect();
    w.scrollLeft += (pr.left + pr.width / 2) - (wr.left + w.clientWidth / 2);
    scrollBy(0, (pr.top + pr.height / 2) - innerHeight * 0.38);
    g.classList.add("pulse");
    setTimeout(() => g.classList.remove("pulse"), 2000);
    setTimeout(() => openSheet(c, d), 260);
  });
}

/* ── picks ───────────────────────────────────── */
function renderPicks() {
  const root = $("#picks"); root.textContent = "";
  const n = totalPicks();
  const head = el("div", "picks-h");
  head.append(el("h2", null, "담은 곳"), el("span", "n", n + "곳"));
  const sh = el("button", "btn primary", "공유하기");
  sh.type = "button"; sh.disabled = !n;
  sh.addEventListener("click", sharePicks);
  head.append(sh);
  root.append(head);
  if (!n) {
    const e = el("div", "empty");
    e.append(el("p", "big", "아직 담은 곳이 없어요"),
      el("p", "sm", "목록이나 지도에서 책갈피를 눌러 갈 곳을 담아보세요. 담은 곳은 이 기기에 저장되고, 공유하기로 친구에게 그대로 보낼 수 있어요."));
    root.append(e);
    return;
  }
  for (const c of KEYS) {
    const C = CITIES[c];
    const items = C.stores.filter((d) => S.picks[c].has(d.k));
    if (!items.length) continue;
    const sec = el("section", "group");
    const gh = el("div", "group-h");
    gh.append(el("h2", null, C.name), el("span", null, items.length + "곳"));
    sec.append(gh);
    for (const d of items) sec.append(card(c, d));
    root.append(sec);
  }
  root.append(el("p", "fine", "공유하기로 보낸 링크를 받은 사람이 열면, 이 목록을 자기 앱에 그대로 담을 수 있어요."));
}

function shareUrl() {
  const parts = [];
  for (const c of KEYS) {
    const idx = [];
    CITIES[c].stores.forEach((d, i) => { if (S.picks[c].has(d.k)) idx.push(i); });
    if (idx.length) parts.push(c[0] + idx.join("."));
  }
  return location.origin + location.pathname + (parts.length ? "#p=" + parts.join("-") : "");
}

function shareText() {
  const out = [];
  for (const c of KEYS) {
    const C = CITIES[c];
    const items = C.stores.filter((d) => S.picks[c].has(d.k));
    if (!items.length) continue;
    out.push("■ " + C.name + " " + items.length + "곳");
    for (const d of items) {
      out.push("· " + d.k + " — " + d.m + (priced(d.p) ? " " + d.p : ""));
      out.push("  " + d.a + (d.h && d.h !== "—" ? " · " + d.h : ""));
      out.push("  " + mapsUrl(d));
    }
    out.push("");
  }
  return out.join("\n").trim();
}

async function sharePicks() {
  const n = totalPicks();
  const text = "간사이 맛집 족보 — 담은 곳 " + n + "곳\n앱에서 열면 이 목록이 그대로 담겨요 👉 " + shareUrl() + "\n\n" + shareText();
  if (navigator.share) {
    try { await navigator.share({ title: "간사이 맛집 족보", text }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(text); toast("목록을 복사했어요. 카톡에 붙여넣으세요"); }
  catch (e) { toast("복사하지 못했어요"); }
}

function offerImport() {
  const m = location.hash.match(/^#p=([a-z0-9.\-]+)$/i);
  if (!m) return;
  history.replaceState(null, "", location.pathname + location.search);
  const got = { osaka: [], kyoto: [] };
  for (const part of m[1].split("-")) {
    const c = part[0] === "o" ? "osaka" : part[0] === "k" ? "kyoto" : null;
    if (!c) continue;
    for (const s of part.slice(1).split(".")) {
      const d = CITIES[c].stores[Number(s)];
      if (/^\d+$/.test(s) && d) got[c].push(d.k);
    }
  }
  const n = got.osaka.length + got.kyoto.length;
  if (!n) return;
  const fresh = KEYS.reduce((a, c) => a + got[c].filter((k) => !S.picks[c].has(k)).length, 0);
  const b = $("#banner"); b.textContent = "";
  const desc = [got.osaka.length ? "오사카 " + got.osaka.length + "곳" : "", got.kyoto.length ? "교토 " + got.kyoto.length + "곳" : ""].filter(Boolean).join(" · ");
  b.append(el("p", null, fresh ? "공유받은 목록이 있어요 — " + desc : "공유받은 " + desc + "은 이미 다 담겨 있어요"));
  const row = el("div", "row");
  if (fresh) {
    const yes = el("button", "btn primary", "내 목록에 담기"); yes.type = "button";
    yes.addEventListener("click", () => {
      for (const c of KEYS) { got[c].forEach((k) => S.picks[c].add(k)); store.set("picks." + c, [...S.picks[c]]); }
      b.hidden = true; updateCount(); go("picks"); toast(fresh + "곳을 새로 담았어요");
    });
    row.append(yes);
  }
  const no = el("button", "btn", "닫기"); no.type = "button";
  no.addEventListener("click", () => { b.hidden = true; measure(); });
  row.append(no);
  b.append(row);
  b.hidden = false;
}

/* ── sheet & toast ───────────────────────────── */
let lastFocus = null;
function openSheet(c, d) {
  const body = $("#sheetbody"); body.textContent = "";
  body.append(card(c, d, { inSheet: true }));
  const cta = el("button", "cta"); cta.type = "button";
  const sync = () => { const on = isPicked(c, d); cta.textContent = on ? "담은 곳에서 빼기" : "담기"; cta.setAttribute("aria-pressed", on ? "true" : "false"); };
  sync();
  cta.addEventListener("click", () => { togglePick(c, d); sync(); });
  body.append(cta);
  lastFocus = document.activeElement;
  $("#sheetback").hidden = false; $("#sheet").hidden = false;
  $("#sheet").scrollTop = 0;
  cta.focus({ preventScroll: true });
}
function closeSheet() {
  if ($("#sheet").hidden) return;
  $("#sheetback").hidden = true; $("#sheet").hidden = true;
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}

let tt = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  requestAnimationFrame(() => t.classList.add("on"));
  clearTimeout(tt);
  tt = setTimeout(() => { t.classList.remove("on"); setTimeout(() => { t.hidden = true; }, 200); }, 1700);
}

/* ── chrome ──────────────────────────────────── */
function updateCount() {
  const n = totalPicks(), b = $("#pickcnt");
  b.textContent = n; b.hidden = !n;
}

function setCity(c, quiet) {
  S.city = c; S.cat = "all"; store.set("city", c);
  document.documentElement.dataset.city = c;
  for (const b of document.querySelectorAll(".seg button")) b.setAttribute("aria-pressed", b.dataset.city === c ? "true" : "false");
  const bar = getComputedStyle(document.documentElement).getPropertyValue("--bar").trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bar) meta.setAttribute("content", bar);
  renderChips();
  if (!quiet) { renderView(); scrollTo({ top: 0 }); }
}

function go(v) {
  S.view = v; store.set("view", v);
  document.documentElement.dataset.view = v;
  for (const t of document.querySelectorAll(".tab")) t.setAttribute("aria-current", t.dataset.v === v ? "page" : "false");
  for (const s of document.querySelectorAll(".view")) s.hidden = s.id !== "v-" + v;
  renderView();
  scrollTo({ top: 0 });
}

function renderView() {
  if (S.view === "list") renderList();
  else if (S.view === "map") renderMap();
  else renderPicks();
}

function measure() {
  const h = $("#appbar").getBoundingClientRect().height;
  document.documentElement.style.setProperty("--barh", h + "px");
}

/* ── wire up ─────────────────────────────────── */
for (const b of document.querySelectorAll(".seg button")) b.addEventListener("click", () => { if (b.dataset.city !== S.city) setCity(b.dataset.city); });
for (const t of document.querySelectorAll(".tab")) t.addEventListener("click", () => go(t.dataset.v));
$("#zin").addEventListener("click", () => setZoom(S.zoom[S.city] + 1));
$("#zout").addEventListener("click", () => setZoom(S.zoom[S.city] - 1));
$("#sheetback").addEventListener("click", closeSheet);
addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
addEventListener("hashchange", offerImport);
if ("ResizeObserver" in window) new ResizeObserver(measure).observe($("#appbar")); else addEventListener("resize", measure);

setCity(S.city, true);
updateCount();
measure();
go(S.view);
offerImport();

})();
