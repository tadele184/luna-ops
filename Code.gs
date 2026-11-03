// LUNA server v18.3. Paste this whole file into Extensions > Apps Script (replace everything), then Run > setup.

// ============================================================================================================
// SHARED LOGIC (used by the server in Google Apps Script AND by the app on the phone).
// The forms follow the LUNA Daily Numbers data model: one number per item, coded STAGE-SEGMENT-ITEM.
//   LA Livestock Availability   entered on S-1 (animals in the lairage the day before slaughter)
//   AM Ante Mortem              done on S-1, recorded for the slaughter day S
//   RS Reservation              for S (the production order, the plan)
//   PR Production               on S (what was produced)
// Segments: OWN (Fresh Corner FC and Kitchen KIT), EXP export, SRV service customers.
// A saved line is {ic: item_code, ch: channel_code, cu: customer_code, q: qty}; Ante Mortem lines also carry rj
// (rejected heads) and why (the reason). Dates are ISO text "yyyy-mm-dd" everywhere.
// ============================================================================================================
var L = (function () {
  // ---------------------------------------------------------------- master data (item_master, customer_master, lookups)
  // code, stage, segment, item name, uom, channel required, customer required, sort order, active
  var ITEM_ROWS = [
    ["LA-OWN-SHP-HL", "LA", "OWN", "HL Sheep", "PCS", "N", "N", 10, "Y"], ["LA-OWN-GOT", "LA", "OWN", "Goat", "PCS", "N", "N", 20, "Y"],
    ["LA-OWN-CLF-SUP", "LA", "OWN", "Calf Supplier", "PCS", "N", "N", 30, "Y"], ["LA-OWN-CLF-OWN", "LA", "OWN", "Calf Own", "PCS", "N", "N", 40, "Y"],
    ["LA-OWN-BUL-SUP", "LA", "OWN", "Bull Supplier", "PCS", "N", "N", 50, "Y"], ["LA-OWN-BUL-OWN", "LA", "OWN", "Bull Own", "PCS", "N", "N", 60, "Y"],
    ["LA-SRV-SHP-HL", "LA", "SRV", "HL Sheep", "PCS", "N", "Y", 70, "Y"], ["LA-SRV-GOT", "LA", "SRV", "Goat", "PCS", "N", "Y", 80, "Y"],
    ["LA-SRV-CLF-SUP", "LA", "SRV", "Calf Supplier", "PCS", "N", "Y", 90, "Y"], ["LA-SRV-CLF-OWN", "LA", "SRV", "Calf Own", "PCS", "N", "Y", 100, "Y"],
    ["LA-SRV-BUL-SUP", "LA", "SRV", "Bull Supplier", "PCS", "N", "Y", 110, "Y"], ["LA-SRV-BUL-OWN", "LA", "SRV", "Bull Own", "PCS", "N", "Y", 120, "Y"],
    ["AM-OWN-SHG", "AM", "OWN", "Goat & Sheep", "PCS", "N", "N", 130, "Y"], ["AM-OWN-CAT", "AM", "OWN", "Cattle", "PCS", "N", "N", 140, "Y"],
    ["AM-SRV-SHG", "AM", "SRV", "Goat & Sheep", "PCS", "N", "N", 150, "Y"], ["AM-SRV-CAT", "AM", "SRV", "Cattle", "PCS", "N", "N", 160, "Y"],
    ["RS-OWN-VEAL", "RS", "OWN", "Veal", "PCS", "Y", "N", 170, "Y"], ["RS-OWN-MUTN", "RS", "OWN", "Mutton", "KG", "Y", "N", 180, "Y"],
    ["RS-OWN-LGOT", "RS", "OWN", "Local Goat", "KG", "Y", "N", 190, "Y"], ["RS-OWN-SBFC", "RS", "OWN", "Special Beef FC", "PCS", "Y", "N", 200, "Y"],
    ["RS-OWN-SRIB", "RS", "OWN", "Special Ribeye", "KG", "Y", "N", 210, "Y"], ["RS-OWN-SAGB", "RS", "OWN", "Special Aged Beef", "KG", "Y", "N", 220, "Y"],
    ["RS-OWN-RIBS", "RS", "OWN", "Ribs for Slow Cooking", "KG", "Y", "N", 230, "Y"], ["RS-OWN-OSSO", "RS", "OWN", "Ossobuco", "KG", "Y", "N", 240, "Y"],
    ["RS-EXP-VEAL", "RS", "EXP", "Veal", "PCS", "N", "N", 250, "Y"], ["RS-EXP-MUTN", "RS", "EXP", "Mutton", "KG", "N", "N", 260, "Y"],
    ["RS-EXP-LGOT", "RS", "EXP", "Local Goat", "KG", "N", "N", 270, "Y"], ["RS-EXP-SBFC", "RS", "EXP", "Special Beef FC", "PCS", "N", "N", 280, "Y"],
    ["RS-EXP-SRIB", "RS", "EXP", "Special Ribeye", "KG", "N", "N", 290, "Y"], ["RS-EXP-SAGB", "RS", "EXP", "Special Aged Beef", "KG", "N", "N", 300, "Y"],
    ["RS-EXP-RIBS", "RS", "EXP", "Ribs for Slow Cooking", "KG", "N", "N", 310, "Y"], ["RS-EXP-OSSO", "RS", "EXP", "Ossobuco", "KG", "N", "N", 320, "Y"],
    ["RS-SRV-SHG", "RS", "SRV", "Goat & Sheep", "KG", "N", "Y", 330, "Y"], ["RS-SRV-CAT", "RS", "SRV", "Cattle", "KG", "N", "Y", 340, "Y"],
    ["PR-OWN-VEAL", "PR", "OWN", "Veal", "PCS", "Y", "N", 350, "Y"], ["PR-OWN-MUTN", "PR", "OWN", "Mutton", "KG", "Y", "N", 360, "Y"],
    ["PR-OWN-LGOT", "PR", "OWN", "Local Goat", "KG", "Y", "N", 370, "Y"], ["PR-OWN-SBFC", "PR", "OWN", "Special Beef FC", "PCS", "Y", "N", 380, "Y"],
    ["PR-EXP-VEAL", "PR", "EXP", "Veal", "PCS", "N", "N", 390, "Y"], ["PR-EXP-MUTN", "PR", "EXP", "Mutton", "KG", "N", "N", 400, "Y"],
    ["PR-EXP-LGOT", "PR", "EXP", "Local Goat", "KG", "N", "N", 410, "Y"], ["PR-EXP-SBFC", "PR", "EXP", "Special Beef FC", "PCS", "N", "N", 420, "Y"],
    ["PR-SRV-SHG", "PR", "SRV", "Goat & Sheep", "KG", "N", "Y", 430, "Y"], ["PR-SRV-CAT", "PR", "SRV", "Cattle", "KG", "N", "Y", 440, "Y"]
  ];
  // Service livestock is counted per service customer (customer_required = Y), so each customer's animals can be
  // followed through ante mortem and production.
  // the service customers already used by Luna (customer_master)
  var CUSTOMER_ROWS = [["CUS-001", "YABU"], ["CUS-002", "BILASOT"], ["CUS-003", "BBM"], ["CUS-004", "ART MERI"], ["CUS-005", "GETACHEW"],
    ["CUS-006", "BLACK PHOENIX"], ["CUS-007", "HABTAMU DEMBEL"], ["CUS-008", "AL HALAL"], ["CUS-009", "YASMIN JIBRIL"], ["CUS-010", "HOMESIDE"], ["CUS-011", "FUAD"]];
  var STAGES = [["LA", "Livestock Availability"], ["AM", "Ante Mortem"], ["RS", "Reservation"], ["PR", "Production"]];
  var SEGMENTS = [["OWN", "Own (Fresh Corner & Kitchen)"], ["EXP", "Export"], ["SRV", "Service"]];
  var CHANNELS = [["FC", "Fresh Corner"], ["KIT", "Kitchen"]];
  var STAGE = { lv: "LA", am: "AM", order: "RS", prod: "PR" };
  var KINDS = { lv: "Livestock Availability", am: "Ante Mortem", order: "Reservation", prod: "Production", stock: "Dispatch & Stock" };
  var REASONS = ["Sick / fever", "Lame / injured", "Emaciated", "Pregnant", "Dead on arrival", "Other"];
  var GROUPS = [["SHG", "Goat & Sheep"], ["CAT", "Cattle"]];
  // Carcass weight per head, kg (cold carcass, Ethiopian highland and lowland breeds): the usual range and the most
  // that is physically possible. Used to check that kg reserved or produced can come from the heads that passed.
  var YIELD = { SHG: { lo: 8, hi: 22, max: 35 }, CAT: { lo: 90, hi: 300, max: 450 } };
  // which animals each product comes from
  var PGROUP = { VEAL: "CAT", MUTN: "SHG", LGOT: "SHG", SBFC: "CAT", SRIB: "CAT", SAGB: "CAT", RIBS: "CAT", OSSO: "CAT", SHG: "SHG", CAT: "CAT" };

  var ITEM = {}, ITEMS = ITEM_ROWS.map(function (r) {
    var it = { c: r[0], st: r[1], sg: r[2], nm: r[3], u: r[4], ch: r[5] === "Y", cu: r[6] === "Y", so: r[7], on: r[8] === "Y" };
    it.p = r[0].split("-").slice(2).join("-");                       // the item part of the code: VEAL, SHP-HL, ...
    it.g = r[1] === "AM" ? it.p : /^(SHP|GOT)/.test(it.p) ? "SHG" : /^(CLF|BUL)/.test(it.p) ? "CAT" : "";   // head group
    ITEM[r[0]] = it; return it;
  });
  var CUSTOMERS = CUSTOMER_ROWS.map(function (c) { return c[1]; }), CU = {};
  CUSTOMER_ROWS.forEach(function (c) { CU[c[0]] = c[1]; });
  function name(list, code) { for (var i = 0; i < list.length; i++) if (list[i][0] === code) return list[i][1]; return code; }
  function cuName(code) { return CU[code] || code || ""; }
  function chName(code) { return name(CHANNELS, code); }
  function sgName(code) { return name(SEGMENTS, code); }
  function sgShort(code) { return { OWN: "Own", EXP: "Export", SRV: "Service" }[code] || code; }
  function grpName(code) { return name(GROUPS, code); }
  function items(kind, all) { return ITEMS.filter(function (it) { return it.st === STAGE[kind] && (all || it.on); }); }
  function segs(kind) { var out = []; items(kind).forEach(function (it) { if (out.indexOf(it.sg) < 0) out.push(it.sg); }); return out; }

  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DOWL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // ---------------------------------------------------------------- dates
  function isISO(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s; }
  function addDays(iso, k) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); }
  function diff(a, b) { return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 864e5); }   // a - b in days
  function dObj(iso) { return new Date(iso + "T00:00:00Z"); }
  function dShort(iso) { var d = dObj(iso); return DOW[d.getUTCDay()] + " " + ("0" + d.getUTCDate()).slice(-2) + " " + MON[d.getUTCMonth()]; }
  function dLong(iso) { var d = dObj(iso); return DOWL[d.getUTCDay()] + " " + ("0" + d.getUTCDate()).slice(-2) + " " + MONL[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function dDM(iso) { var d = dObj(iso); return ("0" + d.getUTCDate()).slice(-2) + " " + MON[d.getUTCMonth()]; }
  function range(d1, d2) { var out = [], d = d1; while (d <= d2) { out.push(d); d = addDays(d, 1); } return out; }

  // Which dates each form may be saved for, relative to today. The admin may also correct the past week.
  function win(kind, admin) {
    var w = { lv: [-1, 0], am: [-1, 1], order: [-1, 2], prod: [-2, 0], stock: [-2, 0] }[kind];
    return admin ? [Math.min(w[0], -7), w[1]] : [w[0], w[1]];
  }
  function defaultDate(kind, t) { return addDays(t, { lv: 0, am: 1, order: 1, prod: 0, stock: 0 }[kind]); }

  // ---------------------------------------------------------------- numbers and text
  function n(x) { return x ? Math.round(x).toLocaleString("en-US") : "-"; }
  function n1(x) { return x ? (Math.round(x * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "-"; }
  function nu(x, u) { return u === "KG" ? n1(x) : n(x); }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function r1(x) { return Math.round((x || 0) * 10) / 10; }
  function int_(v, lo, hi) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    var f = Number(v);
    if (!isFinite(f) || f !== Math.floor(f) || f < lo || f > hi) return null;
    return f;
  }
  function num_(v, lo, hi) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    var f = Number(v);
    if (!isFinite(f) || f < lo || f > hi) return null;
    return Math.round(f * 10) / 10;
  }
  function qty(v, u, lo) { var z = v === "" || v == null ? 0 : v; return u === "KG" ? num_(z, lo || 0, 1e7) : int_(z, lo || 0, 100000); }
  function txt(v, max) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 80); }
  function key(r) { return r.ic + "|" + (r.ch || "") + "|" + (r.cu || ""); }          // the unique key, with the date
  function label(r) {                                                              // "Own · Fresh Corner", "Export", "YABU"
    var it = ITEM[r.ic] || {};
    return it.sg === "OWN" ? (r.ch ? chName(r.ch) : "Own") : it.sg === "SRV" ? (r.cu ? cuName(r.cu) : "Service") : sgShort(it.sg);
  }
  function remarks(r) { return r.rj ? "Inspected " + (r.q + r.rj) + ", rejected " + r.rj + ": " + (r.why || "") : (r.rm || ""); }

  // Saved before the data model changed (version 17 and older): kept in the sheet, not used by the app.
  function isNew(kind, rows) {
    if (!Array.isArray(rows)) return false;
    if (kind === "stock") return rows.every(function (r) { return r && PROD[r.sp] && Object.keys(r.out || {}).every(function (k) { return typeof r.out[k] === "number"; }); });
    return rows.every(function (r) { return r && ITEM[r.ic]; });
  }

  // ---------------------------------------------------------------- validation (the server always re-checks)
  // getDoc(kind, iso) returns the saved rows or null. Returns {d, rows, warn, err}.
  // allow(kind, date) decides whether a date may be saved (normal window, cut-off, reopened dates). Default: the window.
  function inWin(kind, d, t, admin) { var w = win(kind, admin), k = diff(d, t); return k >= w[0] && k <= w[1]; }
  function clean(kind, data, t, admin, getDoc, allow) {
    var bad = function (m) { return { err: m, warn: [] }; };
    if (!KINDS[kind]) return bad("Unknown form.");
    if (kind === "stock") return cleanStock(data, t, admin, allow);
    var d = data && data.d;
    if (!isISO(d)) return bad("Choose the date.");
    if (!(allow ? allow(kind, d) : inWin(kind, d, t, admin))) return bad("This date is closed. Ask the admin to reopen it.");
    var rows = data.rows;
    if (!Array.isArray(rows) || rows.length > 300) return bad("The data is not valid.");
    var out = [], at = {}, warn = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {}, it = ITEM[r.ic];
      if (!it || it.st !== STAGE[kind]) return bad("Line " + (i + 1) + ": unknown item.");
      if (!it.on) return bad(it.nm + " is no longer in use.");
      var who = sgShort(it.sg) + " " + it.nm;
      var ch = it.ch ? txt(r.ch).toUpperCase() : "", cu = it.cu ? txt(r.cu).toUpperCase() : "";
      if (it.ch && !CHANNELS.some(function (c) { return c[0] === ch; })) return bad(who + ": choose Fresh Corner or Kitchen.");
      if (it.cu && !CU[cu]) return bad(who + ": choose the service customer.");
      var q = qty(r.q, it.u);
      if (q === null) return bad(who + (it.u === "KG" ? ": kg must be a number." : ": enter whole numbers."));
      var x = { ic: it.c, ch: ch, cu: cu, q: q };
      if (kind === "am") {
        var rj = int_(r.rj === "" || r.rj == null ? 0 : r.rj, 0, 100000), why = txt(r.why, 120);
        if (rj === null) return bad(who + ": rejected heads must be a whole number.");
        if (rj && !why) return bad(who + ": give the reason for the " + rj + " rejected.");
        x.rj = rj; x.why = rj ? why : "";
      }
      if (!x.q && !x.rj) continue;
      var k = key(x);
      if (k in at) { var y = out[at[k]]; y.q = r1(y.q + x.q); if (x.rj) { y.rj = (y.rj || 0) + x.rj; y.why = y.why || x.why; } }
      else { at[k] = out.length; out.push(x); }
    }
    if (!out.length) return bad("Nothing entered yet.");
    if (kind === "am") {
      var av = available(d, getDoc), ins = {};
      out.forEach(function (r) { var g = ITEM[r.ic].sg + "|" + ITEM[r.ic].g; ins[g] = (ins[g] || 0) + r.q + (r.rj || 0); });
      Object.keys(ins).forEach(function (g) {
        var p = g.split("|");
        if (g in av && ins[g] > av[g]) warn.push(sgShort(p[0]) + " " + grpName(p[1]) + ": " + ins[g] + " inspected but " + av[g] + " available.");
      });
    }
    if (kind === "order" || kind === "prod") warn = warn.concat(kgCheck(kind, d, out, getDoc));
    return { d: d, rows: out, warn: warn, err: null };
  }
  // Kg reserved or produced cannot be more than the animals can give: Own and Export come from Luna's own heads that
  // passed ante mortem (or are available, before ante mortem); Service from each customer's own animals.
  function kgCheck(kind, d, rows, getDoc) {
    var warn = [], pass = getDoc("am", d) ? amPassed(d, getDoc) : available(d, getDoc), la = getDoc("lv", addDays(d, -1)) || [];
    var kg = {}, src = getDoc("am", d) ? "passed ante mortem" : "available";
    rows.forEach(function (r) {
      var it = ITEM[r.ic]; if (!it || it.u !== "KG") return;
      var g = PGROUP[it.p], k = it.sg === "SRV" ? "SRV|" + r.cu + "|" + g : "OWN|" + g;
      kg[k] = r1((kg[k] || 0) + r.q);
    });
    Object.keys(kg).forEach(function (k) {
      var p = k.split("|"), g = p[p.length - 1], heads = null, who;
      if (p[0] === "OWN") { heads = pass["OWN|" + g]; who = "Own and Export " + grpName(g).toLowerCase(); }
      else {
        var cnt = 0, any = false;
        la.forEach(function (r) { var it = ITEM[r.ic]; if (it && it.sg === "SRV" && r.cu === p[1] && it.g === g) { cnt += r.q; any = true; } });
        if (any) heads = cnt;
        who = cuName(p[1]) + " " + grpName(g).toLowerCase();
      }
      if (heads === null || heads === undefined) return;
      var most = heads * YIELD[g].max;
      if (kg[k] > most) warn.push(who + ": " + n1(kg[k]) + " kg " + (kind === "order" ? "reserved" : "produced") + " is more than " + n(heads) + " heads " + (p[0] === "OWN" ? src : "in the lairage") + " can give (at most about " + n(most) + " kg). Check the kg or the heads.");
    });
    return warn;
  }

  // ---------------------------------------------------------------- the plan for a slaughter day
  // heads per segment and group: {"OWN|SHG": n}
  function heads(rows, field) {
    var t = {};
    (rows || []).forEach(function (r) { var it = ITEM[r.ic]; if (!it || !it.g) return; var k = it.sg + "|" + it.g; t[k] = (t[k] || 0) + (Number(r[field || "q"]) || 0); });
    return t;
  }
  function available(S, getDoc) { return heads(getDoc("lv", addDays(S, -1))); }
  function amPassed(S, getDoc) { return heads(getDoc("am", S)); }

  function plan(S, getDoc) {
    var lvDay = addDays(S, -1);
    var la = getDoc("lv", lvDay), am = getDoc("am", S), rs = getDoc("order", S), pr = getDoc("prod", S);
    var hd = [], hk = {};
    ["OWN", "SRV"].forEach(function (sg) { GROUPS.forEach(function (g) { var x = { sg: sg, g: g[0], nm: g[1], av: null, ok: null, rj: 0, why: [] }; hk[sg + "|" + g[0]] = x; hd.push(x); }); });
    (la || []).forEach(function (r) { var it = ITEM[r.ic], x = it && hk[it.sg + "|" + it.g]; if (x) x.av = (x.av || 0) + r.q; });
    (am || []).forEach(function (r) {
      var it = ITEM[r.ic], x = it && hk[it.sg + "|" + it.g]; if (!x) return;
      x.ok = (x.ok || 0) + r.q; x.rj += r.rj || 0; if (r.rj) x.why.push(r.rj + " " + r.why);
    });
    var lines = {}, list = [];
    function add(rows, f) {
      (rows || []).forEach(function (r) {
        var it = ITEM[r.ic]; if (!it) return;
        var k = it.sg + "|" + it.p + "|" + (r.ch || "") + "|" + (r.cu || "");
        if (!lines[k]) { lines[k] = { sg: it.sg, p: it.p, nm: it.nm, u: it.u, ch: r.ch || "", cu: r.cu || "", res: null, act: null }; list.push(lines[k]); }
        lines[k][f] = r1((lines[k][f] || 0) + r.q);
      });
    }
    add(rs, "res"); add(pr, "act");
    var sgo = ["OWN", "EXP", "SRV"];
    list.sort(function (a, b) {
      return sgo.indexOf(a.sg) - sgo.indexOf(b.sg) || (a.cu ? CUSTOMERS.indexOf(cuName(a.cu)) : 0) - (b.cu ? CUSTOMERS.indexOf(cuName(b.cu)) : 0) ||
        prodOrder(a.p) - prodOrder(b.p) || (a.ch < b.ch ? -1 : a.ch > b.ch ? 1 : 0);
    });
    var tot = { av: 0, ok: 0, rj: 0, rp: 0, rk: 0, ap: 0, ak: 0 };
    hd.forEach(function (x) { tot.av += x.av || 0; tot.ok += x.ok || 0; tot.rj += x.rj; });
    list.forEach(function (x) { if (x.u === "KG") { tot.rk = r1(tot.rk + (x.res || 0)); tot.ak = r1(tot.ak + (x.act || 0)); } else { tot.rp += x.res || 0; tot.ap += x.act || 0; } });
    return { day: S, lvDay: lvDay, heads: hd.filter(function (x) { return x.av !== null || x.ok !== null; }), items: list, tot: tot, la: la || [],
      has: { lv: !!la, am: !!am, order: !!rs, prod: !!pr } };
  }
  function prodOrder(p) { var o = ["VEAL", "MUTN", "LGOT", "SBFC", "SRIB", "SAGB", "RIBS", "OSSO", "SHG", "CAT"]; var i = o.indexOf(p); return i < 0 ? 99 : i; }
  function hasAny(p) { return p.has.lv || p.has.am || p.has.order || p.has.prod; }
  function lineName(x) { return (x.sg === "OWN" ? "Own " + chName(x.ch) : x.sg === "EXP" ? "Export" : cuName(x.cu)) + " · " + x.nm; }

  // Alerts for one slaughter day: [level, text] with level "r" (red) or "a" (amber)
  function alerts(p) {
    var out = [];
    p.heads.forEach(function (x) {
      var who = sgShort(x.sg) + " " + x.nm, ins = x.ok === null ? null : x.ok + x.rj;
      if (x.rj) out.push(["a", who + " rejected: " + x.why.join("; ")]);
      if (ins !== null && x.av !== null && ins > x.av) out.push(["r", who + ": " + n(ins) + " inspected but only " + n(x.av) + " available"]);
      if (ins !== null && x.av !== null && ins < x.av) out.push(["a", who + ": " + n(x.av - ins) + " available but not inspected"]);
    });
    var cuHeads = {};
    (p.la || []).forEach(function (r) { var it = ITEM[r.ic]; if (it && it.sg === "SRV" && r.cu) { var k = r.cu + "|" + it.g; cuHeads[k] = (cuHeads[k] || 0) + r.q; } });
    p.items.forEach(function (x) {
      if (x.sg !== "SRV" || !x.cu || x.u !== "KG") return;
      var g = PGROUP[x.p], h = cuHeads[x.cu + "|" + g], kgv = Math.max(x.res || 0, x.act || 0);
      if (h !== undefined && kgv > h * YIELD[g].max) out.push(["r", lineName(x) + ": " + n1(kgv) + " kg but only " + n(h) + " heads of " + cuName(x.cu) + " in the lairage"]);
    });
    p.items.forEach(function (x) {
      var who = lineName(x), u = x.u === "KG" ? " kg" : " pcs";
      if (x.res && x.act !== null && x.act < 0.95 * x.res) out.push(["a", who + ": produced " + nu(x.act, x.u) + " of " + nu(x.res, x.u) + u + " (" + pct(x.act / x.res) + ")"]);
      if (x.res && x.act !== null && x.act > 1.1 * x.res) out.push(["a", who + ": produced " + nu(x.act, x.u) + u + ", more than the " + nu(x.res, x.u) + " reserved"]);
      if (x.res && x.act === null && p.has.prod) out.push(["a", who + ": " + nu(x.res, x.u) + u + " reserved, nothing produced"]);
    });
    return out;
  }

  // ---------------------------------------------------------------- dispatch and stock (the carcass entry sheet)
  // Products come from the Production items (Own and Export together; service per customer). Each product has one
  // unit (PCS or KG), like its item. One stock document per date: rows [{sp: product, open: qty or null, out: {line: qty}}].
  // In = Production of that date. Balance = BBF + In - local sale - service customers - export - damage - shrinkage (kg).
  // Detained carcasses stay in the warehouse (shown, not deducted).
  var PRODUCTS = [], PROD = {};
  ITEMS.forEach(function (it) {
    if (it.st !== "PR" || PROD[it.p]) return;
    PROD[it.p] = { k: it.p, nm: it.sg === "SRV" ? "Service " + it.nm.toLowerCase() : it.nm, u: it.u };
    PRODUCTS.push(PROD[it.p]);
  });
  var LOCAL = [["modjo", "Modjo Sales"], ["fk", "Fresh Kitchen"], ["fc", "Fresh Corner"]];
  var EXPORT = [["exp", "Own export"]];
  var QUALITY = [["detp", "Detained during production"], ["detl", "Detained during loading"], ["dmg", "Damage / condemnation"]];
  function outKeys() { return LOCAL.map(function (x) { return x[0]; }).concat(CUSTOMER_ROWS.map(function (c) { return c[0]; }), ["exp", "detp", "detl", "dmg", "shr"]); }
  function outLabel(k) {
    if (CU[k]) return CU[k];
    var all = LOCAL.concat(EXPORT, QUALITY, [["shr", "Shrinkage (kg)"]]);
    for (var i = 0; i < all.length; i++) if (all[i][0] === k) return all[i][1];
    return k;
  }
  function prodName(k) { return PROD[k] ? PROD[k].nm : k; }
  function prodUnit(k) { return PROD[k] ? PROD[k].u : "PCS"; }
  function cleanStock(data, t, admin, allow) {
    var bad = function (m) { return { err: m, warn: [] }; };
    var d = data && data.d;
    if (!isISO(d)) return bad("Choose the date.");
    if (!(allow ? allow("stock", d) : inWin("stock", d, t, admin))) return bad("This date is closed. Ask the admin to reopen it.");
    var rows = data.rows, keys = outKeys(), out = [], seen = {};
    if (!Array.isArray(rows) || rows.length > 20) return bad("The data is not valid.");
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {}, p = PROD[r.sp];
      if (!p) return bad("Choose the product.");
      if (seen[r.sp]) return bad(p.nm + " is listed twice."); seen[r.sp] = 1;
      var o = {}, src = r.out || {};
      for (var k in src) {
        if (keys.indexOf(k) < 0) return bad(p.nm + ": unknown line " + k + ".");
        if (k === "shr" && p.u !== "KG") return bad(p.nm + ": shrinkage is only for kg products.");
        var v = qty(src[k], p.u, k === "shr" ? -1000 : 0);
        if (v === null) return bad(p.nm + ", " + outLabel(k) + (p.u === "KG" ? ": kg must be a number." : ": enter whole pieces."));
        if (v) o[k] = v;
      }
      var open = null;
      if (admin && r.open !== null && r.open !== undefined && r.open !== "") {
        open = qty(r.open, p.u);
        if (open === null) return bad(p.nm + ": the opening stock must be a number.");
      }
      out.push({ sp: r.sp, open: open, out: o });
    }
    if (!out.length) return bad("Nothing entered yet.");
    return { d: d, rows: out, warn: [], err: null };
  }
  function prodByProduct(rows) {
    var t = {};
    (rows || []).forEach(function (r) { var it = ITEM[r.ic]; if (it) t[it.p] = r1((t[it.p] || 0) + r.q); });
    return t;
  }
  // What was produced that day per dispatch line, as a suggestion: Own FC -> Fresh Corner, KIT -> Fresh Kitchen,
  // Export -> Own export, service -> that customer.
  function useOf(rows) {
    var u = {};
    (rows || []).forEach(function (r) {
      var it = ITEM[r.ic]; if (!it) return;
      var k = it.sg === "OWN" ? (r.ch === "KIT" ? "fk" : "fc") : it.sg === "EXP" ? "exp" : r.cu;
      var x = (u[it.p] = u[it.p] || {}); x[k] = r1((x[k] || 0) + r.q);
    });
    return u;
  }
  // One product on one day. bbf and inn are numbers; row is the saved stock row (or null).
  function stockLine(sp, bbf, inn, row) {
    var o = (row && row.out) || {}, g = function (k) { return o[k] || 0; };
    var sumOf = function (ks) { return r1(ks.reduce(function (a, k) { return a + g(k); }, 0)); };
    var b = row && row.open !== null && row.open !== undefined ? row.open : bbf;
    var tot = r1(b + inn), local = sumOf(LOCAL.map(function (x) { return x[0]; })), service = sumOf(CUSTOMER_ROWS.map(function (c) { return c[0]; }));
    var exp = g("exp"), dmg = g("dmg"), det = sumOf(["detp", "detl"]), shr = g("shr");
    var bal = r1(tot - local - service - exp - dmg - shr), u = prodUnit(sp);
    return { sp: sp, nm: prodName(sp), u: u, open: !!(row && row.open !== null && row.open !== undefined), bbf: b, inn: inn, tot: tot, out: o, local: local, service: service,
      exp: exp, det: det, dmg: dmg, shr: shr, bal: bal, rate: u === "KG" && inn > 0 ? shr / inn : null, perf: inn > 0 ? (service + exp - shr) / inn : null };
  }
  // Runs the stock from the first day with production or stock up to "until". days = every date that has a prod or
  // stock document (any order). Returns {byDay: {day: {product: line}}, bal: {product: qty}}.
  function ledger(days, getDoc, until) {
    var list = days.filter(function (d) { return d <= until; }).sort(), seen = {}, bal = {}, byDay = {};
    list.forEach(function (d) {
      if (seen[d]) return; seen[d] = 1;
      var inn = prodByProduct(getDoc("prod", d)), st = getDoc("stock", d) || [], rowOf = {};
      st.forEach(function (r) { rowOf[r.sp] = r; });
      var ps = PRODUCTS.map(function (p) { return p.k; }).filter(function (k) { return bal[k] || inn[k] || rowOf[k]; });
      byDay[d] = {};
      ps.forEach(function (k) { var x = stockLine(k, bal[k] || 0, inn[k] || 0, rowOf[k] || null); byDay[d][k] = x; bal[k] = x.bal; });
    });
    return { byDay: byDay, bal: bal };
  }

  return {
    ITEMS: ITEMS, ITEM: ITEM, ITEM_ROWS: ITEM_ROWS, CUSTOMER_ROWS: CUSTOMER_ROWS, CUSTOMERS: CUSTOMERS, STAGES: STAGES, SEGMENTS: SEGMENTS, CHANNELS: CHANNELS,
    STAGE: STAGE, KINDS: KINDS, YIELD: YIELD, PGROUP: PGROUP, REASONS: REASONS, GROUPS: GROUPS, PRODUCTS: PRODUCTS, PROD: PROD, LOCAL: LOCAL, EXPORT: EXPORT, QUALITY: QUALITY,
    items: items, segs: segs, cuName: cuName, chName: chName, sgName: sgName, sgShort: sgShort, grpName: grpName, label: label, remarks: remarks, key: key, isNew: isNew,
    isISO: isISO, inWin: inWin, addDays: addDays, diff: diff, dShort: dShort, dLong: dLong, dDM: dDM, range: range, win: win, defaultDate: defaultDate,
    n: n, n1: n1, nu: nu, r1: r1, txt: txt, clean: clean, heads: heads, available: available, amPassed: amPassed, plan: plan, hasAny: hasAny, lineName: lineName, alerts: alerts,
    outKeys: outKeys, outLabel: outLabel, prodName: prodName, prodUnit: prodUnit, cleanStock: cleanStock, prodByProduct: prodByProduct, useOf: useOf, stockLine: stockLine, ledger: ledger
  };
})();

// ============================================================================================================
// SERVER (Google Apps Script, inside your Google Sheet). It stores every entry in this spreadsheet:
//   Users    who may log in, their PIN and their forms (edit here: add people, change PINs, switch someone off)
//   Data     one line per form and date (the live entry; do not edit by hand)
//   History  every earlier version of an entry, kept when someone saves a correction
//   daily_entry      the numbers in the LUNA Daily Numbers layout: one row = one number (date, item, channel, customer)
//   daily_summary    change the yellow date: the day's figures roll up from daily_entry
//   item_master, customer_master, lookups, dq_checks   the master data and the checks of the data model
//   stock_entry      Dispatch & Stock as readable lines
//   Log      who saved, corrected or erased what, and when
//   Settings the cut-off date and the dates the admin reopened
// ============================================================================================================
var VERSION = "18.3";
var TZ = "Africa/Addis_Ababa";
var HEAD = {
  Users: ["Username", "Name", "Role", "PIN", "Forms", "Excel", "Admin", "Active", "Email"],
  Data: ["Form", "Date", "Data (do not edit)", "Saved by", "Saved at"],
  History: ["Form", "Date", "Data", "Saved by", "Saved at", "Replaced at"],
  daily_entry: ["entry_date", "item_code", "channel_code", "customer_code", "qty", "remarks", "entered_by", "created_at", "updated_at"],
  stock_entry: ["entry_date", "product", "line", "qty", "uom", "entered_by", "updated_at"],
  item_master: ["item_code", "stage_code", "segment_code", "item_name", "uom", "channel_required", "customer_required", "sort_order", "active"],
  customer_master: ["customer_code", "customer_name", "phone", "active"],
  lookups: ["stage_code", "stage_name", "segment_code", "segment_name", "channel_code", "channel_name", "uom", "yes_no"],
  Log: ["At", "By", "Action", "Form", "Date", "Note"],
  Settings: ["Key", "Value"],
  Push: ["Username", "Channel key (do not share)"],
  Messages: ["Id", "At", "From", "To", "Kind", "Text", "File", "Mime", "Topic", "Reply to", "Heard by", "Done by", "Seconds"]
};
var TEXT_COLS = { Users: 9, Data: 5, History: 6, daily_entry: 0, stock_entry: 0, item_master: 9, customer_master: 4, lookups: 8, Log: 6, Settings: 2, Push: 2, Messages: 12 };   // these first columns are kept as plain text
var DEFAULT_USERS = [
  ["tadele", "Tadele", "Super Admin", "all", "yes", "yes"],
  ["getamesay", "Getamesay", "Livestock Availability", "lv", "yes", "no"],
  ["tekeste", "Dr. Tekeste", "Ante Mortem", "am", "yes", "no"],
  ["sinidu", "Sinidu", "Production Order & Actual", "order, prod, stock", "yes", "no"],
  ["henok", "Dr. Henok", "Plant Manager", "", "yes", "no"],
  ["wada", "Wada Abe", "Viewer", "", "yes", "no"],
  ["hawi", "Hawi Gemechu", "Viewer", "", "yes", "no"]
];

// ---------------------------------------------------------------- run once: Run > setup
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ["Users", "Data", "History", "daily_entry", "stock_entry", "Log", "Settings", "Messages", "Push"].forEach(function (n) { sheet_(n); });
  masters_();
  var us = ss.getSheetByName("Users");
  if (us.getRange(1, 9).getValues()[0][0] !== "Email") us.getRange(1, 9).setValue("Email");
  if (us.getLastRow() < 2) {
    var used = {};
    var rows = DEFAULT_USERS.map(function (u) {
      var pin; do { pin = String(1000 + Math.floor(Math.random() * 9000)); } while (used[pin]); used[pin] = 1;
      return [u[0], u[1], u[2], pin, u[3], u[4], u[5], "yes"];
    });
    us.getRange(2, 1, rows.length, 8).setValues(rows);
  }
  var yn = SpreadsheetApp.newDataValidation().requireValueInList(["yes", "no"], true).build();
  us.getRange("F2:H200").setDataValidation(yn);
  us.setColumnWidths(1, 8, 130);
  us.setColumnWidth(3, 200);
  mediaFolder_();
  // the daily summary email at 18:00 (to everyone with an Email who is an admin or a manager)
  var has = ScriptApp.getProjectTriggers().some(function (tr) { return tr.getHandlerFunction() === "dailyDigest"; });
  if (!has) ScriptApp.newTrigger("dailyDigest").timeBased().atHour(18).everyDays(1).inTimezone(TZ).create();
  var first = ss.getSheetByName("Sheet1");
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  ss.setActiveSheet(us);
  Logger.log("Ready. Open the Users tab to see each person's PIN.");
}

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var h = HEAD[name];
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight("bold").setBackground("#E6332A").setFontColor("#FFFFFF");
    sh.setFrozenRows(1);
    if (TEXT_COLS[name]) sh.getRange(1, 1, sh.getMaxRows(), TEXT_COLS[name]).setNumberFormat("@");
    else sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat("yyyy-mm-dd");      // entry_date is a real date (for SUMIFS)
  }
  return sh;
}

// The master data of the LUNA Daily Numbers model, the daily summary and the data checks. Master rows that exist are kept
// (the admin may set active = N or add a phone number); missing items and customers are added.
function masters_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fill = function (name, rows) {
    var sh = sheet_(name), v = sh.getDataRange().getValues(), have = {};
    for (var i = 1; i < v.length; i++) have[String(v[i][0])] = 1;
    if (name === "item_master") rows.forEach(function (r) {          // keep the rules of each item up to date (the admin's active = N stays)
      for (var j = 1; j < v.length; j++) if (String(v[j][0]) === r[0] && v[j].slice(1, 8).join("|") !== r.slice(1, 8).join("|")) sh.getRange(j + 1, 2, 1, 7).setValues([r.slice(1, 8)]);
    });
    var add = rows.filter(function (r) { return !have[String(r[0])]; });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
    return sh;
  };
  fill("item_master", L.ITEM_ROWS);
  fill("customer_master", L.CUSTOMER_ROWS.map(function (c) { return [c[0], c[1], "", "Y"]; }));
  var lk = sheet_("lookups");
  if (lk.getLastRow() < 2) {
    var rows = [];
    for (var i = 0; i < 4; i++) rows.push([L.STAGES[i][0], L.STAGES[i][1], L.SEGMENTS[i] ? L.SEGMENTS[i][0] : "", L.SEGMENTS[i] ? L.SEGMENTS[i][1] : "",
      L.CHANNELS[i] ? L.CHANNELS[i][0] : "", L.CHANNELS[i] ? L.CHANNELS[i][1] : "", ["PCS", "KG", "", ""][i], ["Y", "N", "", ""][i]]);
    lk.getRange(2, 1, rows.length, 8).setValues(rows);
  }
  if (!ss.getSheetByName("daily_summary")) {
    var sm = ss.insertSheet("daily_summary"), out = [["LUNA Daily Numbers", "", "", "", "", ""], ["Report date", today_(), "", "", "", ""], ["", "", "", "", "", ""],
      ["Item", "UOM", "Fresh Corner", "Kitchen", "Total", "item_code"]];
    var E = "daily_entry!$E:$E,daily_entry!$A:$A,$B$2,daily_entry!$B:$B,$F";
    L.STAGES.forEach(function (st) {
      out.push([st[1].toUpperCase(), "", "", "", "", ""]);
      L.SEGMENTS.forEach(function (sg) {
        var list = L.ITEMS.filter(function (it) { return it.st === st[0] && it.sg === sg[0]; });
        if (!list.length) return;
        out.push([sg[1], "", "", "", "", ""]);
        list.forEach(function (it) {
          var r = out.length + 1;
          out.push(["   " + it.nm, it.u, it.ch ? "=SUMIFS(" + E + r + ',daily_entry!$C:$C,"FC")' : "", it.ch ? "=SUMIFS(" + E + r + ',daily_entry!$C:$C,"KIT")' : "", "=SUMIFS(" + E + r + ")", it.c]);
        });
      });
    });
    sm.getRange(1, 1, out.length, 6).setValues(out);
    sm.getRange("B2").setNumberFormat("yyyy-mm-dd").setBackground("#FFF2CC");
    sm.getRange("A4:F4").setFontWeight("bold").setBackground("#E6332A").setFontColor("#FFFFFF");
    sm.getRange("A1").setFontWeight("bold");
  }
  if (!ss.getSheetByName("dq_checks")) {
    var dq = ss.insertSheet("dq_checks"), f = [["entry_date", "item_code", "item_known", "channel_ok", "customer_ok", "status"]];
    for (var r = 2; r <= 501; r++) f.push(['=IF(daily_entry!A' + r + '="","",daily_entry!A' + r + ')', '=IF(daily_entry!B' + r + '="","",daily_entry!B' + r + ')',
      '=IF(B' + r + '="","",IF(ISNUMBER(MATCH(B' + r + ',item_master!$A:$A,0)),"OK","ERR"))',
      '=IF(OR(B' + r + '="",C' + r + '="ERR"),"",IF(INDEX(item_master!$F:$F,MATCH(B' + r + ',item_master!$A:$A,0))="Y",IF(daily_entry!C' + r + '="","ERR","OK"),IF(daily_entry!C' + r + '="","OK","ERR")))',
      '=IF(OR(B' + r + '="",C' + r + '="ERR"),"",IF(INDEX(item_master!$G:$G,MATCH(B' + r + ',item_master!$A:$A,0))="Y",IF(daily_entry!D' + r + '="","ERR","OK"),IF(daily_entry!D' + r + '="","OK","ERR")))',
      '=IF(B' + r + '="","",IF(COUNTIF(C' + r + ':E' + r + ',"ERR")>0,"ERR","OK"))']);
    dq.getRange(1, 1, f.length, 6).setValues(f);
    dq.getRange("A1:F1").setFontWeight("bold").setBackground("#E6332A").setFontColor("#FFFFFF");
  }
}
// items and customers the admin switched off in the master sheets (active = N)
function activeMaster_() {
  var off = {}, ss = SpreadsheetApp.getActiveSpreadsheet();
  ["item_master", "customer_master"].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh) return;
    var v = sh.getDataRange().getValues(), col = n === "item_master" ? 8 : 3;
    for (var i = 1; i < v.length; i++) if (String(v[i][col]).trim().toUpperCase() === "N") off[String(v[i][0]).trim()] = 1;
  });
  return off;
}

// ---------------------------------------------------------------- web entry points
function doGet() { return json_({ ok: true, server: "LUNA Ops", v: VERSION, t: today_() }); }

function doPost(e) {
  try {
    var q = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (q.a === "people") return json_({ ok: true, people: people_() });
    var user = auth_(q);
    if (user.error) return json_({ ok: false, error: user.error, auth: true });
    if (q.a === "ctx") return json_({ ok: true, ctx: ctx_(user, loadData_()) });
    if (q.a === "save") return json_(save_(q, user));
    if (q.a === "export") return json_(export_(q, user));
    if (q.a === "pin") return json_(pin_(q, user));
    if (/^msg/.test(q.a)) return json_(msg_(q, user));
    if (/^call/.test(q.a)) return json_(call_(q, user));
    if (/^admin/.test(q.a)) return json_(user.admin ? admin_(q, user) : { ok: false, error: "Only the admin can do this." });
    return json_({ ok: false, error: "Unknown request." });
  } catch (err) {
    var msg = String(err && err.message ? err.message : err);
    if (/DriveApp|MailApp|ScriptApp|auth\/drive|permission|authori/i.test(msg)) return json_({ ok: false, error: "The server needs one more permission for photos, videos and voice notes. Admin: open the Google Sheet, Extensions > Apps Script, choose setup and click Run, allow access, then Deploy > Manage deployments > New version." });
    return json_({ ok: false, error: "Server error: " + msg });
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function today_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }
function now_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm"); }
function iso_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd") : String(v == null ? "" : v).trim(); }
function at_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd HH:mm") : String(v == null ? "" : v).trim(); }
function yes_(v) { return /^(y|yes|true|1|✓|ok)$/i.test(String(v == null ? "" : v).trim()); }

// ---------------------------------------------------------------- users and PIN
function forms_(v, admin) {
  if (admin) return Object.keys(L.KINDS);
  var s = String(v || "").toLowerCase(), out = [];
  if (/\ball\b/.test(s)) return Object.keys(L.KINDS);
  var alias = { lv: "lv", livestock: "lv", available: "lv", am: "am", ante: "am", antemortem: "am", mortem: "am",
    order: "order", reservation: "order", prod: "prod", actual: "prod", production: "prod", stock: "stock", dispatch: "stock" };
  s.split(/[^a-z]+/).forEach(function (w) { var k = alias[w]; if (k && out.indexOf(k) < 0) out.push(k); });
  return ["lv", "am", "order", "prod", "stock"].filter(function (k) { return out.indexOf(k) >= 0; });
}

function users_() {
  var sh = sheet_("Users"), v = sh.getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) {
    var u = String(v[i][0] || "").trim().toLowerCase().replace(/^@/, "");
    if (!u) continue;
    var admin = yes_(v[i][6]);
    out.push({ u: u, nm: String(v[i][1] || u), r: String(v[i][2] || ""), pin: String(v[i][3] == null ? "" : v[i][3]).trim(),
      k: forms_(v[i][4], admin), xl: admin || yes_(v[i][5]), admin: admin, active: yes_(v[i][7]), row: i + 1,
      email: String(v[i][8] || "").trim(), mgr: admin || /manager/i.test(String(v[i][2] || "")) });
  }
  return out;
}

function people_() {
  return users_().filter(function (u) { return u.active; }).map(function (u) { return { u: u.u, nm: u.nm, r: u.r }; });
}

function auth_(q) {
  var name = String(q.u || "").trim().toLowerCase(), pin = String(q.pin == null ? "" : q.pin).trim();
  var cache = CacheService.getScriptCache(), key = "fail_" + name, fails = Number(cache.get(key) || 0);
  if (fails >= 5) return { error: "Too many wrong PINs. Wait 15 minutes, then try again." };
  var user = users_().filter(function (u) { return u.u === name && u.active; })[0];
  var good = user && pin && (user.pin === pin || (/^\d+$/.test(pin) && /^\d+$/.test(user.pin) && Number(user.pin) === Number(pin)));
  if (!good) {
    cache.put(key, String(fails + 1), 900);
    return { error: user ? "Wrong PIN." : "This user is not active. Ask the admin." };
  }
  if (fails) cache.remove(key);
  return user;
}

function pin_(q, user) {
  var p = String(q.newPin || "").trim();
  if (!/^\d{4,6}$/.test(p)) return { ok: false, error: "The PIN must be 4 to 6 digits." };
  sheet_("Users").getRange(user.row, 4).setValue(p);
  return { ok: true };
}

// ---------------------------------------------------------------- data
function loadData_() {
  var v = sheet_("Data").getDataRange().getValues(), map = {};
  for (var i = 1; i < v.length; i++) {
    var k = String(v[i][0] || "").trim(), d = iso_(v[i][1]);
    if (!L.KINDS[k] || !L.isISO(d)) continue;
    var rows = null;
    try { rows = JSON.parse(v[i][2]).rows; } catch (e) { rows = null; }
    if (!L.isNew(k, rows)) continue;                  // saved in the layout before version 18: kept in the sheet, not used
    map[k + "|" + d] = { rows: rows, by: String(v[i][3] || ""), at: at_(v[i][4]), row: i + 1 };
  }
  return map;
}
function stockDays_(map) {
  var out = [];
  Object.keys(map).forEach(function (key) { var p = key.split("|"); if ((p[0] === "prod" || p[0] === "stock") && out.indexOf(p[1]) < 0) out.push(p[1]); });
  return out;
}
// ---------------------------------------------------------------- settings: cut-off and reopened dates
function settings_() {
  var v = sheet_("Settings").getDataRange().getValues(), o = {};
  for (var i = 1; i < v.length; i++) if (v[i][0]) o[String(v[i][0])] = v[i][1] instanceof Date ? iso_(v[i][1]) : String(v[i][1] == null ? "" : v[i][1]);
  var opens = [];
  try { opens = JSON.parse(o.opens || "[]"); } catch (e) { opens = []; }
  return { cut: L.isISO(o.cutoff) ? o.cutoff : "", opens: opens };
}
function setSetting_(key, value) {
  var sh = sheet_("Settings"), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  sh.appendRow([key, value]);
}
function isOpen_(st, k, d, t) { return st.opens.some(function (o) { return (o.k === k || o.k === "all") && o.d === d && o.until >= t; }); }
// A date may be saved when the admin reopened it, or when it is after the cut-off and inside the normal window.
function allow_(user, st, t) {
  return function (k, d) { return isOpen_(st, k, d, t) || (!(st.cut && d <= st.cut) && L.inWin(k, d, t, user.admin)); };
}
function log_(by, action, k, d, note) { sheet_("Log").appendRow([now_(), by, action, k ? L.KINDS[k] || k : "", d || "", note || ""]); }

function getter_(map) { return function (k, d) { var x = map[k + "|" + d]; return x ? x.rows : null; }; }

function save_(q, user) {
  var k = q.k;
  if (user.k.indexOf(k) < 0) return { ok: false, error: "You cannot save this form." };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var map = loadData_(), t = today_();
    var st = settings_(), c = L.clean(k, q, t, user.admin, getter_(map), allow_(user, st, t));
    if (c.err) return { ok: false, error: c.err };
    if (k === "stock") {
      var trial = {}; Object.keys(map).forEach(function (key) { trial[key] = map[key]; });
      trial["stock|" + c.d] = { rows: c.rows };
      var day = L.ledger(stockDays_(trial).concat([c.d]), getter_(trial), c.d).byDay[c.d] || {};
      for (var sp in day) {
        var x = day[sp];
        if (x.bal < 0 && x.u === "PCS") return { ok: false, error: x.nm + ": " + (-x.bal) + " pieces more dispatched than in stock (" + x.tot + ")." };
        if (x.bal < 0) c.warn.push(x.nm + ": the balance is below zero (" + x.bal + " kg). Check the weights.");
        if (x.u === "KG" && x.shr > 0 && x.tot > 0 && x.shr > 0.05 * x.tot) c.warn.push(x.nm + ": shrinkage " + x.shr + " kg is " + (x.shr / x.tot * 100).toFixed(1) + "% of the stock. Chilled carcasses usually lose 1-3%. Check the weights.");
      }
    } else {
      var off = activeMaster_(), gone = c.rows.filter(function (r) { return off[r.ic] || (r.cu && off[r.cu]); })[0];
      if (gone) return { ok: false, error: (off[gone.ic] ? L.ITEM[gone.ic].nm : L.cuName(gone.cu)) + " is switched off (active = N) in the master sheet." };
    }
    var sh = sheet_("Data"), at = now_(), old = map[k + "|" + c.d], json = JSON.stringify({ rows: c.rows });
    if (old) {
      var prev = sh.getRange(old.row, 1, 1, 5).getValues()[0];
      sheet_("History").appendRow([prev[0], iso_(prev[1]), prev[2], prev[3], at_(prev[4]), at]);
      sh.getRange(old.row, 1, 1, 5).setValues([[k, c.d, json, user.nm, at]]);
    } else {
      sh.appendRow([k, c.d, json, user.nm, at]);
    }
    map[k + "|" + c.d] = { rows: c.rows, by: user.nm, at: at };
    writeEntries_(k, c.d, c.rows, user.nm, at);
    log_(user.nm, old ? "Corrected" : "Saved", k, c.d);
    return { ok: true, replaced: !!old, warn: c.warn, ctx: ctx_(user, map) };
  } finally {
    lock.releaseLock();
  }
}

// daily_entry (the LUNA Daily Numbers layout): the rows of this form and date are replaced (upsert on date, item,
// channel and customer; created_at is kept for a key that already existed). Dispatch & Stock goes to stock_entry.
function writeEntries_(k, d, rows, by, at) {
  var stock = k === "stock", sh = sheet_(stock ? "stock_entry" : "daily_entry"), n = HEAD[stock ? "stock_entry" : "daily_entry"].length, last = sh.getLastRow();
  var all = last > 1 ? sh.getRange(2, 1, last - 1, n).getValues() : [], keep = [], created = {};
  var mine = function (r) { return iso_(r[0]) === d && (stock || String(r[1]).slice(0, 2) === L.STAGE[k]); };
  all.forEach(function (r) {
    r[0] = iso_(r[0]);
    if (mine(r)) { if (!stock) created[r[1] + "|" + r[2] + "|" + r[3]] = at_(r[7]); return; }
    if (!stock) { r[7] = at_(r[7]); r[8] = at_(r[8]); } else r[6] = at_(r[6]);
    keep.push(r);
  });
  rows.forEach(function (r) {
    if (stock) {
      var u = L.prodUnit(r.sp);
      if (r.open !== null && r.open !== undefined) keep.push([d, L.prodName(r.sp), "Opening stock (set)", r.open, u, by, at]);
      Object.keys(r.out).forEach(function (o) { keep.push([d, L.prodName(r.sp), L.outLabel(o), r.out[o], o === "shr" ? "KG" : u, by, at]); });
      return;
    }
    var key = r.ic + "|" + (r.ch || "") + "|" + (r.cu || "");
    keep.push([d, r.ic, r.ch || "", r.cu || "", r.q, L.remarks(r), by, created[key] || at, at]);
  });
  var so = function (r) { var it = L.ITEM[r[1]]; return it ? it.so : 0; };
  keep.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : stock ? 0 : so(a) - so(b); });
  if (last > 1) sh.getRange(2, 1, last - 1, n).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, n).setValues(keep);
}

// ---------------------------------------------------------------- what the app needs for one person
function ctx_(user, map) {
  var t = today_(), get = getter_(map), ks = user.k, data = {}, meta = {}, pre = {}, w = {}, dd = {};
  Object.keys(L.KINDS).forEach(function (k) { w[k] = L.win(k, user.admin); dd[k] = L.defaultDate(k, t); });
  var cfg = settings_(), ok = allow_(user, cfg, t), dates = {};
  Object.keys(L.KINDS).forEach(function (k) {     // the dates each form can be saved for now
    var out = [];
    for (var i = w[k][0]; i <= w[k][1]; i++) { var d0 = L.addDays(t, i); if (ok(k, d0)) out.push(d0); }
    cfg.opens.forEach(function (o) { if ((o.k === k || o.k === "all") && o.until >= t && out.indexOf(o.d) < 0) out.push(o.d); });
    dates[k] = out.sort();
    if (out.indexOf(dd[k]) < 0) dd[k] = out.length ? out[out.length - 1] : dd[k];
  });
  var days = function (k) { return dates[k]; };
  var pairs = function (o) { return Object.keys(o).map(function (key) { var p = key.split("|"); return [p[0], p[1], o[key]]; }); };
  ks.forEach(function (k) {
    days(k).forEach(function (d) {
      var x = map[k + "|" + d];
      if (x) { (data[k] = data[k] || {})[d] = x.rows; (meta[k] = meta[k] || {})[d] = [x.by, x.at]; }
    });
  });
  if (ks.indexOf("am") >= 0) { pre.av = {}; days("am").forEach(function (d) { pre.av[d] = L.available(d, get); }); }
  if (ks.indexOf("order") >= 0) {
    pre.ok = {}; pre.av2 = {};
    days("order").forEach(function (d) { pre.ok[d] = get("am", d) ? L.amPassed(d, get) : null; pre.av2[d] = L.available(d, get); });
  }
  if (ks.indexOf("prod") >= 0) { pre.res = {}; days("prod").forEach(function (d) { pre.res[d] = get("order", d) || []; }); }
  if (ks.indexOf("order") >= 0 || ks.indexOf("prod") >= 0) {      // service customers used lately, most recent first
    var cus = [];
    Object.keys(map).filter(function (key) { return /^(order|prod)\|/.test(key) && key.split("|")[1] >= L.addDays(t, -30); }).sort(function (a, b) { return a.split("|")[1] < b.split("|")[1] ? 1 : -1; })
      .forEach(function (key) { map[key].rows.forEach(function (r) { if (r.cu && cus.indexOf(r.cu) < 0) cus.push(r.cu); }); });
    pre.cus = cus;
  }
  if (ks.indexOf("lv") >= 0) {           // service customers whose animals were in the lairage lately
    var cl = [];
    Object.keys(map).filter(function (key) { return key.indexOf("lv|") === 0 && key.split("|")[1] >= L.addDays(t, -14); }).sort().reverse()
      .forEach(function (key) { map[key].rows.forEach(function (r) { if (r.cu && cl.indexOf(r.cu) < 0) cl.push(r.cu); }); });
    pre.cusLv = cl;
  }
  if (ks.indexOf("stock") >= 0) {
    pre.stk = {};
    days("stock").forEach(function (d) {
      var prod = get("prod", d) || [];
      pre.stk[d] = { bbf: L.ledger(stockDays_(map), get, L.addDays(d, -1)).bal, inn: L.prodByProduct(prod), use: L.useOf(prod) };
    });
  }
  var led = L.ledger(stockDays_(map).concat([t]), get, t), stock = { now: led.bal, days: [] };
  Object.keys(led.byDay).sort().reverse().slice(0, 7).forEach(function (d) {
    var day = led.byDay[d];
    stock.days.push([d, Object.keys(day).map(function (sp) { var x = day[sp]; return [sp, x.bbf, x.inn, L.r1(x.local + x.service + x.exp), L.r1(x.dmg + x.shr), x.bal, x.u]; }), !!get("stock", d)]);
  });
  var dl = [];                          // the last 10 slaughter days and tomorrow, newest first
  for (var i = 1; i >= -9; i--) {
    var dd2 = L.addDays(t, i), pl = L.plan(dd2, get), T = pl.tot;
    dl.push([dd2, [pl.has.lv, pl.has.am, pl.has.order, pl.has.prod, !!get("stock", dd2)].map(Number), T.av, T.ok, T.rp, T.rk, T.ap, T.ak, T.rj]);
  }
  var st = {}, rep = [];
  [t, L.addDays(t, 1)].forEach(function (d) {
    var p = L.plan(d, get);
    st[d] = ["lv", "am", "order", "prod", "stock"].map(function (k) { return k === "stock" ? (get("stock", d) ? 1 : 0) : p.has[k] ? 1 : 0; });
    rep.push([d, { heads: p.heads.map(function (x) { return [x.sg, x.g, x.av, x.ok, x.rj]; }), items: p.items.map(function (x) { return [x.sg, x.p, x.nm, x.u, x.ch, x.cu, x.res, x.act]; }), tot: p.tot }, L.alerts(p)]);
  });
  var hhmm = now_().slice(11);
  return { v: VERSION, dates: dates, cut: cfg.cut, opens: cfg.opens.filter(function (o) { return o.until >= t; }), u: user.u, nm: user.nm, r: user.r, su: user.admin, k: ks, xl: user.xl, t: t, hm: hhmm,
    off: activeMaster_(), rs: L.REASONS, w: w, dd: dd,
    data: data, meta: meta, pre: pre, st: st, rep: rep, stock: stock, days: dl,
    lab: { local: L.LOCAL, exp: L.EXPORT, q: L.QUALITY }, team: people_(), unread: unread_(user), push: pushCtx_(user) };
}

// ---------------------------------------------------------------- data for the Excel report (built on the phone)
function export_(q, user) {
  if (!user.xl) return { ok: false, error: "The Excel report is not enabled for you. Ask the admin." };
  var d1 = q.d1, d2 = q.d2;
  if (!L.isISO(d1) || !L.isISO(d2) || d2 < d1 || L.diff(d2, d1) > 92) return { ok: false, error: "Choose a period of up to 3 months." };
  var map = loadData_(), lo = L.addDays(d1, -1), docs = {};
  Object.keys(map).forEach(function (key) {
    var d = key.split("|")[1];
    if (d >= lo && d <= d2) docs[key] = { rows: map[key].rows, by: map[key].by, at: map[key].at };
  });
  var led = L.ledger(stockDays_(map).concat(L.range(d1, d2)), getter_(map), d2).byDay, ledg = {};
  L.range(d1, d2).forEach(function (d) { ledg[d] = led[d] || {}; });
  return { ok: true, d1: d1, d2: d2, docs: docs, led: ledg, at: now_() };
}

// ---------------------------------------------------------------- admin: cut-off, reopen, erase, activity
function admin_(q, user) {
  var t = today_(), st = settings_();
  if (q.a === "admin") {
    var map = loadData_(), count = {};
    Object.keys(map).forEach(function (key) { var k = key.split("|")[0]; count[k] = (count[k] || 0) + 1; });
    var lg = sheet_("Log").getDataRange().getValues().slice(1).map(function (r) { return [at_(r[0]), String(r[1]), String(r[2]), String(r[3]), iso_(r[4]), String(r[5] || "")]; });
    return { ok: true, cut: st.cut, opens: st.opens.filter(function (o) { return o.until >= t; }), count: count, log: lg.slice(-60).reverse(), t: t, firebase: settingsRaw_("firebase") };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (q.a === "adminCutoff") {
      if (q.d && (!L.isISO(q.d) || q.d > t)) return { ok: false, error: "Choose a date up to today." };
      setSetting_("cutoff", q.d || "");
      log_(user.nm, q.d ? "Cut-off set" : "Cut-off removed", "", q.d || st.cut, q.d ? "Entries up to this date are closed" : "");
    } else if (q.a === "adminReopen") {
      if (!(L.KINDS[q.k] || q.k === "all") || !L.isISO(q.d) || q.d > L.addDays(t, 2)) return { ok: false, error: "Choose the form and a date." };
      var days = Math.max(1, Math.min(14, Number(q.days) || 1)), until = L.addDays(t, days - 1);
      var opens = st.opens.filter(function (o) { return o.until >= t && !(o.k === q.k && o.d === q.d); });
      opens.push({ k: q.k, d: q.d, until: until });
      setSetting_("opens", JSON.stringify(opens));
      log_(user.nm, "Reopened", q.k === "all" ? "" : q.k, q.d, (q.k === "all" ? "All forms" : "") + " open until " + until);
    } else if (q.a === "adminFirebase") {
      var url = String(q.url || "").trim().replace(/\/+$/, "");
      if (url && !/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)$/.test(url)) return { ok: false, error: "Paste the database link from Firebase. It starts with https:// and ends with firebaseio.com or firebasedatabase.app." };
      if (url) {
        var test = fbFetch_(url, "inbox/" + pushKey_(user.u), "post", { t: "test", at: Date.now() });
        if (test !== 200) return { ok: false, error: "Firebase did not accept the test (code " + test + "). Check that the database exists and the rules are published." };
      }
      setSetting_("firebase", url);
      log_(user.nm, url ? "Calls switched on" : "Calls switched off", "", "", url);
    } else if (q.a === "adminClose") {
      setSetting_("opens", JSON.stringify(st.opens.filter(function (o) { return o.until >= t && !(o.k === q.k && o.d === q.d); })));
      log_(user.nm, "Closed", q.k === "all" ? "" : q.k, q.d);
    } else if (q.a === "adminErase") {
      var ks = (q.kinds || []).filter(function (k) { return L.KINDS[k]; });
      if (!ks.length || !L.isISO(q.d1) || !L.isISO(q.d2) || q.d2 < q.d1) return { ok: false, error: "Choose the forms and the dates." };
      if (q.confirm !== "ERASE") return { ok: false, error: "Type ERASE to confirm." };
      var sh = sheet_("Data"), v = sh.getDataRange().getValues(), at = now_(), gone = [];
      for (var i = v.length - 1; i >= 1; i--) {
        var k = String(v[i][0]), d = iso_(v[i][1]);
        if (ks.indexOf(k) < 0 || d < q.d1 || d > q.d2) continue;
        sheet_("History").appendRow([k, d, v[i][2], v[i][3], at_(v[i][4]), "ERASED " + at + " by " + user.nm]);
        sh.deleteRow(i + 1);
        writeEntries_(k, d, [], "", "");
        gone.push(k + " " + d);
      }
      log_(user.nm, "Erased", "", q.d1 + " to " + q.d2, ks.map(function (k) { return L.KINDS[k]; }).join(", ") + ": " + gone.length + " entries");
      var r = admin_({ a: "admin" }, user); r.erased = gone.length; r.gone = gone; r.ctx = ctx_(user, loadData_());
      return r;
    } else return { ok: false, error: "Unknown request." };
  } finally {
    lock.releaseLock();
  }
  var res = admin_({ a: "admin" }, user); res.ctx = ctx_(user, loadData_());
  return res;
}

// ---------------------------------------------------------------- team messages: voice, photo, video, text
function mediaFolder_() {
  var id = settingsRaw_("mediaFolder"), f = null;
  if (id) { try { f = DriveApp.getFolderById(id); } catch (e) { f = null; } }
  if (!f) { f = DriveApp.createFolder("LUNA Media"); setSetting_("mediaFolder", f.getId()); }
  return f;
}
function settingsRaw_(key) {
  var v = sheet_("Settings").getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === key) return String(v[i][1] || "");
  return "";
}
function messages_() {
  var v = sheet_("Messages").getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    out.push({ id: String(v[i][0]), at: at_(v[i][1]), from: String(v[i][2]), to: String(v[i][3] || "all"), kind: String(v[i][4]), text: String(v[i][5] || ""),
      file: String(v[i][6] || ""), mime: String(v[i][7] || ""), topic: String(v[i][8] || ""), re: String(v[i][9] || ""),
      heard: String(v[i][10] || "").split(",").filter(String), done: String(v[i][11] || "").split(",").filter(String), sec: Number(v[i][12]) || 0, row: i + 1 });
  }
  return out;
}
function visible_(m, user) { return m.to === "all" || m.to === user.u || m.from === user.u || (m.to === "managers" && user.mgr); }
function unread_(user) { try { return messages_().filter(function (m) { return visible_(m, user) && m.from !== user.u && m.heard.indexOf(user.u) < 0; }).length; } catch (e) { return 0; } }
function msg_(q, user) {
  if (q.a === "msgList") {
    var names = {}; users_().forEach(function (u) { names[u.u] = u.nm; });
    var list = messages_().filter(function (m) { return visible_(m, user); }).slice(-150).reverse().map(function (m) {
      return { id: m.id, at: m.at, from: m.from, fromNm: names[m.from] || m.from, to: m.to, toNm: m.to === "all" ? "Everyone" : m.to === "managers" ? "Management" : names[m.to] || m.to,
        kind: m.kind, text: m.text, mime: m.mime, has: !!m.file, topic: m.topic, re: m.re, sec: m.sec,
        heard: m.heard.map(function (u) { return names[u] || u; }), done: m.done.map(function (u) { return names[u] || u; }),
        iHeard: m.heard.indexOf(user.u) >= 0 || m.from === user.u, iDone: m.done.indexOf(user.u) >= 0 };
    });
    return { ok: true, list: list, team: people_(), unread: unread_(user) };
  }
  if (q.a === "msgMedia") {
    var m = messages_().filter(function (x) { return x.id === q.id; })[0];
    if (!m || !visible_(m, user) || !m.file) return { ok: false, error: "This message cannot be opened." };
    var blob = DriveApp.getFileById(m.file).getBlob();
    return { ok: true, mime: m.mime, b64: Utilities.base64Encode(blob.getBytes()) };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_("Messages");
    if (q.a === "msgSend") {
      var kind = q.kind, to = String(q.to || "all"), text = L.txt(q.text, 1000), file = "", mime = "";
      if (["text", "voice", "photo", "video"].indexOf(kind) < 0) return { ok: false, error: "Unknown message type." };
      if (to !== "all" && to !== "managers" && !users_().some(function (u) { return u.u === to && u.active; })) return { ok: false, error: "Choose who receives it." };
      if (kind === "text" && !text) return { ok: false, error: "Write the message." };
      if (kind !== "text") {
        if (!q.b64 || !/^(audio|image|video)\//.test(String(q.mime))) return { ok: false, error: "The recording is missing." };
        if (q.b64.length > 36000000) return { ok: false, error: "The file is too large (more than 25 MB). Record a shorter clip." };
        mime = String(q.mime).split(";")[0];
        var ext = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/webm": "webm", "video/mp4": "mp4", "video/3gpp": "3gp" }[mime] || "bin";
        var name = now_().replace(/[: ]/g, "-") + "_" + user.u + "_" + kind + "." + ext;
        file = mediaFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(q.b64), mime, name)).getId();
      }
      var id = String(Date.now()) + Math.floor(Math.random() * 1000);
      sh.appendRow([id, now_(), user.u, to, kind, text, file, mime, L.txt(q.topic, 60), L.txt(q.re, 30), "", "", Number(q.sec) || 0]);
      log_(user.nm, "Sent " + kind, "", "", to === "all" ? "to everyone" : "to " + to);
      notify_(recipients_(to, user), { t: "msg", id: id, from: user.u, fromNm: user.nm, kind: kind, text: text.slice(0, 120), to: to });
    } else if (q.a === "msgMark") {
      var mm = messages_().filter(function (x) { return x.id === q.id; })[0];
      if (!mm || !visible_(mm, user)) return { ok: false, error: "Message not found." };
      var col = q.what === "done" ? 12 : 11, list = q.what === "done" ? mm.done : mm.heard;
      if (list.indexOf(user.u) < 0) { list.push(user.u); sh.getRange(mm.row, col).setValue(list.join(",")); }
      if (q.what === "done" && mm.heard.indexOf(user.u) < 0) { mm.heard.push(user.u); sh.getRange(mm.row, 11).setValue(mm.heard.join(",")); }
    } else if (q.a === "msgDelete") {
      var md = messages_().filter(function (x) { return x.id === q.id; })[0];
      if (!md || (md.from !== user.u && !user.admin)) return { ok: false, error: "You can delete only your own messages." };
      if (md.file) { try { DriveApp.getFileById(md.file).setTrashed(true); } catch (e) { /* already gone */ } }
      sh.deleteRow(md.row);
    } else return { ok: false, error: "Unknown request." };
  } finally {
    lock.releaseLock();
  }
  return msg_({ a: "msgList" }, user);
}

// ---------------------------------------------------------------- the daily summary email (runs at 18:00)
function dailyDigest() {
  var map = loadData_(), get = getter_(map), t = today_(), p = L.plan(t, get), nx = L.plan(L.addDays(t, 1), get), T = p.tot, N = nx.tot;
  var led = L.ledger(stockDays_(map).concat([t]), get, t).bal, sk = [0, 0];
  Object.keys(led).forEach(function (k) { if (L.prodUnit(k) === "KG") sk[1] += led[k]; else sk[0] += led[k]; });
  var to = users_().filter(function (u) { return u.active && u.email && u.mgr; }).map(function (u) { return u.email; });
  if (!to.length) return;
  var tile = function (lab, val, sub) { return '<td style="padding:12px 14px;background:#f4f5f7;border-radius:12px;border-top:3px solid #e6332a"><div style="font:700 11px Arial;color:#6e8592;text-transform:uppercase">' + lab + '</div><div style="font:800 24px Arial;color:#1c2730">' + val + '</div><div style="font:12px Arial;color:#6e8592">' + (sub || "") + "</div></td>"; };
  var n = function (x) { return Math.round(x || 0).toLocaleString("en-US"); };
  var al = L.alerts(p).concat(L.alerts(nx)).map(function (a) { return "<li>" + (a[0] === "r" ? "🔴 " : "🟠 ") + a[1] + "</li>"; }).join("");
  var html = '<div style="max-width:620px;font-family:Arial"><div style="height:5px;background:linear-gradient(90deg,#e6332a 25%,#f39200 25% 50%,#3daa35 50% 75%,#0076a8 75%)"></div>' +
    '<h2 style="margin:14px 0 2px">Slaughter day summary</h2><div style="color:#6e8592;font-size:13px">' + L.dLong(t) + '</div><table style="width:100%;border-spacing:8px;margin:10px -8px"><tr>' +
    tile("Passed", n(T.ok), n(T.rj) + " rejected") + tile("Reserved", n(T.rk) + " kg", n(T.rp) + " pcs") + tile("Produced", n(T.ak) + " kg", n(T.ap) + " pcs") + "</tr><tr>" +
    tile("Stock now", n(sk[1]) + " kg", n(sk[0]) + " pcs") + tile("Tomorrow passed", n(N.ok), "heads") + tile("Tomorrow reserved", n(N.rk) + " kg", n(N.rp) + " pcs") + "</tr></table>" +
    (al ? "<h3>Alerts</h3><ul>" + al + "</ul>" : "<p>No alerts.</p>") + '<p style="color:#6e8592;font-size:12px">Sent by LUNA at 18:00. Open the app for the full report.</p></div>';
  MailApp.sendEmail({ to: to.join(","), subject: "LUNA daily summary · " + L.dShort(t), htmlBody: html });
}

// ---------------------------------------------------------------- calls and notifications (Firebase Realtime Database)
// Each person has a secret channel key. The server drops a note in the person's inbox (inbox/<key>) for a new message or
// a call; the Luna app (and its background service on Android) listens to that inbox and rings or notifies. Voice goes
// straight between the phones (WebRTC); the database only carries the call set-up (calls/<id>).
function fbUrl_() { return settingsRaw_("firebase").replace(/\/+$/, ""); }
function fbFetch_(db, path, method, body) {
  try {
    var r = UrlFetchApp.fetch(db + "/" + path + ".json", { method: method, contentType: "application/json", payload: JSON.stringify(body), muteHttpExceptions: true });
    return r.getResponseCode();
  } catch (e) { return 0; }
}
function pushKey_(u) {
  var sh = sheet_("Push"), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === u && String(v[i][1]).length >= 32) return String(v[i][1]);
  var key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
  sh.appendRow([u, key]);
  return key;
}
function pushCtx_(user) {
  var db = fbUrl_();
  if (!db) return null;
  var ice = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  try { var turn = JSON.parse(settingsRaw_("turn") || "null"); if (turn && turn.urls) ice.push(turn); } catch (e) { /* no relay set */ }
  return { db: db, key: pushKey_(user.u), ice: ice };
}
// who receives something sent "to": everyone, management, or one person (never the sender)
function recipients_(to, user) {
  return users_().filter(function (u) { return u.active && u.u !== user.u && (to === "all" || u.u === to || (to === "managers" && u.mgr)); });
}
function notify_(list, note) {
  var db = fbUrl_();
  if (!db || !list.length) return;
  note.at = Date.now();
  var reqs = list.map(function (u) { return { url: db + "/inbox/" + pushKey_(u.u) + ".json", method: "post", contentType: "application/json", payload: JSON.stringify(note), muteHttpExceptions: true }; });
  try { UrlFetchApp.fetchAll(reqs); } catch (e) { /* the message is saved; only the alert is lost */ }
}
function call_(q, user) {
  var db = fbUrl_();
  if (!db) return { ok: false, error: "Calls are not switched on yet. Admin: open Admin > Calls and notifications." };
  var sh = sheet_("Messages");
  if (q.a === "callStart") {
    var to = String(q.to || "all"), list = recipients_(to, user);
    if (!list.length) return { ok: false, error: "Nobody to call." };
    var id = "c" + Date.now() + Math.floor(Math.random() * 1e6), names = {};
    users_().forEach(function (u) { names[u.u] = u.nm; });
    var toNm = to === "all" ? "Everyone" : to === "managers" ? "Management" : names[to] || to;
    var info = { from: user.u, fromNm: user.nm, to: to, toNm: toNm, at: Date.now(), members: [user.u].concat(list.map(function (u) { return u.u; })), state: "ringing" };
    if (fbFetch_(db, "calls/" + id + "/info", "put", info) !== 200) return { ok: false, error: "Could not reach Firebase. Check the internet and try again." };
    notify_(list, { t: "call", id: id, from: user.u, fromNm: user.nm, to: to, toNm: toNm });
    sh.appendRow([id, now_(), user.u, to, "call", "Voice call", "", "", "call", "", "", "", 0]);
    log_(user.nm, "Called", "", "", toNm);
    return { ok: true, id: id, toNm: toNm, info: info, ice: pushCtx_(user).ice };
  }
  if (q.a === "callEnd") {          // the caller reports how it ended: answered (with the length) or not answered
    var m = messages_().filter(function (x) { return x.id === q.id && x.kind === "call"; })[0];
    if (!m || m.from !== user.u) return { ok: true };
    var sec = Math.max(0, Math.min(36000, Math.round(Number(q.sec) || 0)));
    sh.getRange(m.row, 6).setValue(q.answered ? "Voice call" : "Missed call");
    sh.getRange(m.row, 13).setValue(sec);
    if (!q.answered) notify_(recipients_(m.to, user), { t: "missed", id: m.id, from: user.u, fromNm: user.nm });
    return { ok: true };
  }
  return { ok: false, error: "Unknown request." };
}
