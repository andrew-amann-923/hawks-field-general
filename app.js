/* Hawks Field General — static app over the boxford-softball-intel data */
const D = window.APP_DATA;
const MAIN = document.getElementById("main");

/* ---------- field geometry (viewBox 320x480, plate at 160,295) ---------- */
const IFC = "#1f4fd6", OFC = "#e07b00", SFC = "#0a9a8d", PCC = "#5b6678";
const HITC = "#ffd23f", OUTC = "#B90018";
const FIXED = [["P", 160, 240], ["C", 160, 290]];

const GRASS = "#3f8b4b", DIRT = "#cf9d60";

function fieldGrass(fill) {
  return `<path d="M 135.6 321.4 L -22.4 175.2 A 187 187 0 0 1 342.4 175.2 L 184.4 321.4 Z" fill="${fill || "#e9efe6"}" stroke="#1c4524" stroke-width="2"/>`;
}

function fieldDirt() {
  return `<path d="M 90.6 230.8 A 70 70 0 0 1 229.4 230.8 L 174.9 281.2 A 15 15 0 1 1 145.1 281.2 Z" fill="${DIRT}"/>` +
    `<polygon points="160,208 197,239.9 160,270 123,239.9" fill="${GRASS}"/>` +
    `<circle cx="160" cy="240" r="10" fill="${DIRT}"/>` +
    `<circle cx="122" cy="302" r="5" fill="${DIRT}"/>` +
    `<circle cx="198" cy="302" r="5" fill="${DIRT}"/>`;
}

function fieldLines(depthArcs) {
  let s =
    '<path d="M 160 295 L 1 148" stroke="#fff" stroke-width="1.8" fill="none"/>' +
    '<path d="M 160 295 L 319 148" stroke="#fff" stroke-width="1.8" fill="none"/>' +
    '<path d="M 1 148 A 172.886 172.886 0 0 1 319 148" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>' +
    '<rect x="156.5" y="238.8" width="7" height="2.2" fill="#fff"/>' +
    '<rect x="146.5" y="272.5" width="6" height="11" fill="none" stroke="#fff" stroke-width="0.8"/>' +
    '<rect x="167.5" y="272.5" width="6" height="11" fill="none" stroke="#fff" stroke-width="0.8"/>' +
    '<polygon points="205,236 209,240 205,244 201,240" fill="#fff" stroke="#888"/>' +
    '<polygon points="160,196 164,200 160,204 156,200" fill="#fff" stroke="#888"/>' +
    '<polygon points="114,236 118,240 114,244 110,240" fill="#fff" stroke="#888"/>' +
    '<polygon points="160,274 164,278 160,282 156,278" fill="#fff" stroke="#888"/>';
  if (depthArcs) s +=
    '<path d="M 247.7 216.1 A 118 118 0 0 0 72.3 216.1" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.8" stroke-dasharray="4 3"/>' +
    '<path d="M 295.2 173.2 A 182 182 0 0 0 24.8 173.2" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.8" stroke-dasharray="4 3"/>';
  return s;
}

/* ---------- hit-zone wedges: L/C/R thirds x IF/OF, % of balls in play ---------- */
const DEG = Math.PI / 180;
function pt(ang, r) { return [160 - r * Math.sin(ang * DEG), 295 - r * Math.cos(ang * DEG)]; }
function fenceDist(ang) {
  const c = Math.cos(ang * DEG);
  return 79.114 * c + Math.sqrt(6259.02 * c * c + 23630.55);
}
const BINS = { L: [15.67, 47], C: [-15.67, 15.67], R: [-47, -15.67] };
const RADII = { IF: [38, 118], OF: [118, "fence"] };
const LABEL_R = { IF: 58, OF: 160 };

function wedgePts(a0, a1, r0, r1) {
  const pts = [], steps = 10;
  const rOut = a => (r1 === "fence" ? fenceDist(a) : r1);
  for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * i / steps; pts.push(pt(a, rOut(a))); }
  for (let i = steps; i >= 0; i--) pts.push(pt(a0 + (a1 - a0) * i / steps, r0));
  return pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
}

/* single-hue heat: one brick red, opacity scaled by share of balls (clean on print).
   heatAlpha = zone fill opacity; heatChip = the same tint pre-blended over white,
   used for the % chips so IF heat still reads on top of the dirt. */
const HEAT = [185, 0, 24];
function heatAlpha(t) { return 0.07 + 0.48 * t; }
function heatChip(t) {
  const a = heatAlpha(t);
  const ch = b => Math.round(255 - (255 - b) * a);
  return `rgb(${ch(HEAT[0])},${ch(HEAT[1])},${ch(HEAT[2])})`;
}

/* zone heat for one of the 4 looks: pools the balls in play of every batter whose
   scouting call (callFor) is that look — "where do balls go when we're in this card" */
function zoneStats(cls) {
  const z = { LIF: 0, CIF: 0, RIF: 0, LOF: 0, COF: 0, ROF: 0 };
  let n = 0;
  D.at_bats.forEach(r => {
    if (r.hit_to && r.direction && r.depth && CALL_CLS[r.game + "|" + r.batter] === cls) { z[r.direction + r.depth]++; n++; }
  });
  return { z, n };
}

/* chip placement: nudge each % chip to the first offset clear of every r=14 bubble
   (and of already-placed chips) so nothing hides behind the position bubbles */
const CHIP_TRY = [[0, 0], [0, 6], [0, -8], [14, 0], [-14, 0], [12, -10], [-12, -10], [12, 10], [-12, 10], [0, 14], [0, -16], [20, 0], [-20, 0]];
function chipSpot(lx, ly, dots, placed) {
  for (const [ox, oy] of CHIP_TRY) {
    const cx = lx + ox, cy = ly + oy;
    let ok = true;
    for (const [x, y] of dots) {
      const nx = Math.max(cx - 14, Math.min(x, cx + 14));
      const ny = Math.max(cy - 6.75, Math.min(y, cy + 6.75));
      if (Math.hypot(x - nx, y - ny) < 15) { ok = false; break; }
    }
    if (ok) for (const [px, py] of placed) {
      if (Math.abs(cx - px) < 30 && Math.abs(cy - py) < 15.5) { ok = false; break; }
    }
    if (ok) return [cx, cy];
  }
  return [lx, ly];
}

function zoneLayers(zs, dots) {
  if (!zs || !zs.n) return { fills: "", labels: "" };
  const mx = Math.max(...Object.values(zs.z), 1);
  let fills = "", labels = "";
  const placed = [];
  ["L", "C", "R"].forEach(dir => ["IF", "OF"].forEach(dep => {
    const v = zs.z[dir + dep], t = v / mx;
    const [a0, a1] = BINS[dir], [r0, r1] = RADII[dep];
    fills += `<polygon points="${wedgePts(a0, a1, r0, r1)}" fill="rgb(${HEAT})" fill-opacity="${heatAlpha(t).toFixed(2)}" stroke="#fff" stroke-width="1"/>`;
    const [bx, by] = (dir === "C" && dep === "IF") ? [160, 260.5] : pt((a0 + a1) / 2, LABEL_R[dep]);
    const [lx, ly] = chipSpot(bx, by, dots || [], placed);
    placed.push([lx, ly]);
    labels += `<rect x="${(lx - 14).toFixed(1)}" y="${(ly - 6.75).toFixed(1)}" width="28" height="13.5" rx="6.75" fill="${heatChip(t)}" stroke="#aab" stroke-width="0.7"/>` +
      `<text x="${lx.toFixed(1)}" y="${(ly + 3.6).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="bold" fill="#1F2A44" font-family="Arial">${Math.round(100 * v / zs.n)}%</text>`;
  }));
  return { fills, labels };
}

/* ---------- the 4 looks x 2 base states: positions from scripts/build_positions.py
   (constrained k-means over the 737 Hawks batted-ball dots), prose here.
   Looks are named for where the BALL goes — batter hand doesn't matter. ---------- */
const PROSE = {
  SL1: { sp: "Whole defense shifts LEFT. 3B guards the line, SS deep in the 5-6 hole, 2B on the grass up the middle; RF alone in right.",
         ba: "Bases empty: 1B holds the bag for the out at first." },
  SL2: { sp: "Stacked LEFT, two-deep: short fielder shallow in front of LF/LCF for liners & bloops, OF deep behind.",
         ba: "Runner on 1B: force the lead runner at 2B (2B/SS cover). 1B is freed — drops back as the short fielder. Nobody holds first." },
  MID1: { sp: "For up-the-middle / spray hitters: SS & 2B deep on the grass either side of second; LCF/RCF guard the gaps.",
          ba: "Bases empty: 1B holds the bag for the out at first." },
  MID2: { sp: "Middle stacked: short fielder in front of second for up-the-middle liners; SS & 2B ready to turn two.",
          ba: "Runner on 1B: force at 2B. 1B freed to short center. Nobody holds first (batter conceded at 1B)." },
  SR1: { sp: "Whole defense shifts RIGHT. 1B guards the line, 2B deep in the 3-4 hole, SS on the grass behind second; LF alone in left.",
         ba: "Bases empty: 1B holds the bag for the out at first." },
  SR2: { sp: "Stacked RIGHT, two-deep: short fielder shallow in front of RF/RCF for dunkers, OF deep behind.",
         ba: "Runner on 1B: force at 2B (SS covers). 1B freed off the bag to short right. Nobody holds first." },
  SU1: { sp: "The DEFAULT. Honest positions weighted by the league-wide spray (a half-step left — righty league). No read on the batter? Play this.",
         ba: "Bases empty: 1B holds the bag for the out at first." },
  SU2: { sp: "Default with the force on: short fielder in front of second; SS & 2B ready to turn two.",
         ba: "Runner on 1B: force at 2B. 1B freed to short center. Nobody holds first." },
};
const KIND = { IF: IFC, OF: OFC, SF: SFC };
const LAY = {};
Object.keys(PROSE).forEach(k => {
  const a = D.alignments[k];
  LAY[k] = { f: a.f.map(d => [d[0], d[1], d[2], KIND[d[3]]]), st: a.st, sp: PROSE[k].sp, ba: PROSE[k].ba };
});
/* fam, title, call class (matches callFor), who the look is for */
const LOOKS = [
  ["SL", "STACK LEFT", "left", "hits the LEFT side — any hand"],
  ["MID", "MIDDLE", "middle", "up the middle / sprays it"],
  ["SR", "STACK RIGHT", "right", "hits the RIGHT side — any hand"],
  ["SU", "STRAIGHT UP", "def", "no read · R hitting right · L hitting left"],
];

function alignSVG(key, zones) {
  const L = LAY[key];
  const zl = zoneLayers(zones, FIXED.concat(L.f).map(d => [d[1], d[2]]));
  let s = '<svg viewBox="0 34 320 272" xmlns="http://www.w3.org/2000/svg" role="img">' +
    fieldGrass() + zl.fills + fieldDirt() + fieldLines(true) + zl.labels;
  L.st.forEach(p => { s += `<line x1="${p[0]}" y1="${p[1]}" x2="${p[2]}" y2="${p[3]}" stroke="${SFC}" stroke-width="1.2" stroke-dasharray="2 2"/>`; });
  // big white bubbles with a role-colored ring: max legibility on print, minimal ink
  FIXED.concat(L.f).forEach(d => {
    const col = d[3] || PCC;
    s += `<circle cx="${d[1]}" cy="${d[2]}" r="14" fill="#fff" stroke="${col}" stroke-width="2.6"/>` +
         `<text x="${d[1]}" y="${d[2]+3.4}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#1F2A44" font-family="Arial">${d[0]}</text>`;
  });
  return s + "</svg>";
}

function panelHTML(key, title, who, zones) {
  const L = LAY[key];
  return `<div class="panel"><h4>${title}</h4><p class="who">vs: ${who} · ${zones.n} BIP</p>${alignSVG(key, zones)}<p class="sp">${L.sp}</p><p class="ba">${L.ba}</p></div>`;
}

function viewField() {
  const zones = {};
  LOOKS.forEach(l => { zones[l[2]] = zoneStats(l[2]); });
  const row = sfx => LOOKS.map(([fam, name, cls, who]) =>
    panelHTML(fam + sfx, `${name} · ${sfx === "1" ? "bases empty" : "runner on 1B"}`, who, zones[cls])).join("");
  return `
  <div class="view-head"><h2>The 4 looks</h2>
    <span class="sub">named for where the ball goes — batter hand doesn't matter &times; 2 base states</span>
    <button class="print-btn" onclick="window.print()">Print card (1 page)</button></div>
  <p class="legend">Bubble ring color = role: <span class="dot if"></span>Infield (max 4)
    <span class="dot sf"></span>Short fielder (the freed 1B)
    <span class="dot of"></span>Deep OF
    <span class="dot pc"></span>P &amp; C (fixed) — all 10 players on every diagram &nbsp;·&nbsp; Dashed arcs = in-front line &amp; deep line &nbsp;·&nbsp;
    One color shows where balls land vs the hitters that look is for: <b style="color:#B90018">darker red = more balls</b> (% of balls in play per zone, scaled per card)</p>
  <section class="hand-section"><h3>ONE CARD<small>top row = bases empty (1B holds the bag) · bottom row = runner on 1B (force at 2B, 1B becomes the short fielder)</small></h3>
  <div class="grid4">${row("1")}${row("2")}</div></section>
  <p class="note">Prints as one landscape page. The Scout view's <b>Call</b> column picks one of these four looks per batter.
  House rules baked in: we never stack RIGHT on a known righty (it's rare they ALWAYS push — they get Straight up) and never
  stack LEFT on a known lefty (Straight up, or Middle if needed). Unknown hands trust the spray data.
  Player spots are optimized from the 737 Hawks batted-ball coordinates: hitters are grouped left / middle / right,
  and each fielder stands at the center of the balls he would be responsible for in that look (real-position rules enforced —
  SS &amp; 2B on the grass behind the baseline, never on a bag; 1B within reach of the bag when empty; OF a step behind the
  average ball). Straight up is fit over all 737 balls — the league-wide default. Zone percentages pool the at-bats of every
  opponent batter whose scouting call is that look.</p>`;
}

/* ---------- scout: aggregate the 664 at-bats per team/batter ---------- */
const XBH = { "2B": 1, "3B": 1, "HR": 1 };
const TEAMS = (() => {
  const t = {};
  D.at_bats.forEach(r => {
    const T = (t[r.game] ||= { name: r.game, batters: {}, pa: 0, h: 0, L: 0, C: 0, R: 0, IF: 0, OF: 0 });
    const B = (T.batters[r.batter] ||= { name: r.batter, hand: "Unknown", pa: 0, ab: 0, h: 0, xbh: 0, bb: 0, k: 0, L: 0, C: 0, R: 0, IF: 0, OF: 0 });
    if (r.bats_hand && r.bats_hand !== "Unknown") B.hand = r.bats_hand;
    B.pa++; T.pa++;
    B.ab += +r.is_ab; B.h += +r.is_hit; T.h += +r.is_hit;
    if (XBH[r.result]) B.xbh++;
    if (r.result === "BB") B.bb++;
    if (r.result === "K") B.k++;
    if (r.hit_to) {
      if (r.direction) { B[r.direction]++; T[r.direction]++; }
      if (r.depth) { B[r.depth]++; T[r.depth]++; }
    }
  });
  return Object.values(t).sort((a, b) => b.h - a.h);
})();

function callFor(b) {
  const bip = b.L + b.C + b.R;
  if (bip < 3) return { cls: "def", label: "Straight up (default)" };
  const pL = b.L / bip, pC = b.C / bip, pR = b.R / bip, pOF = b.OF / (b.IF + b.OF || 1);
  let cls, label;
  if (pL >= 0.45 && b.L > b.R) { cls = "left"; label = "Stack LEFT"; }
  else if (pR >= 0.45 && b.R > b.L) { cls = "right"; label = "Stack RIGHT"; }
  else if (pC >= 0.4 || Math.abs(pL - pR) < 0.18) { cls = "middle"; label = "MIDDLE"; }
  else if (b.L > b.R) { cls = "left"; label = "Stack LEFT"; }
  else { cls = "right"; label = "Stack RIGHT"; }
  // house rules: never stack the push/oppo side of a known hand —
  // a righty hitting right or a lefty hitting left gets Straight up instead
  if (cls === "right" && b.hand === "Right") { cls = "def"; label = "Straight up (R oppo)"; }
  else if (cls === "left" && b.hand === "Left") { cls = "def"; label = "Straight up (L oppo)"; }
  if (pOF >= 0.6 && b.xbh >= 2) label += " · deep";
  return { cls, label };
}

/* batter -> call class, used by the Field view's per-look zone heat */
const CALL_CLS = (() => {
  const m = {};
  TEAMS.forEach(T => Object.values(T.batters).forEach(b => { m[T.name + "|" + b.name] = callFor(b).cls; }));
  return m;
})();

function tendency(b) {
  const bip = b.L + b.C + b.R;
  if (!bip) return "No balls in play recorded.";
  const pL = Math.round(100 * b.L / bip), pC = Math.round(100 * b.C / bip), pR = Math.round(100 * b.R / bip);
  const of = Math.round(100 * b.OF / (b.IF + b.OF || 1));
  let side;
  if (b.L >= b.R * 1.5 && b.L >= b.C) side = `hits LEFT (${pL}% L)`;
  else if (b.R >= b.L * 1.5 && b.R >= b.C) side = `hits RIGHT (${pR}% R)`;
  else if (b.C >= b.L && b.C >= b.R) side = `up the middle (${pC}% C)`;
  else side = `sprays it (L${pL}/C${pC}/R${pR})`;
  const air = of >= 55 ? "in the air" : of <= 35 ? "on the ground" : "mixed";
  return `${side}, ${air} (${of}% OF)`;
}

const state = { scoutTeam: TEAMS[0].name, f: { team: "", hand: "", direction: "", depth: "", result: "", batter: "" } };

function avgStr(h, ab) { return ab ? (h / ab).toFixed(3).replace(/^0/, "") : "—"; }

function viewScout() {
  const T = TEAMS.find(t => t.name === state.scoutTeam) || TEAMS[0];
  const bip = T.L + T.C + T.R || 1;
  const rows = Object.values(T.batters).sort((a, b) => b.h - a.h).map(b => {
    const c = callFor(b);
    return `<tr><td>${b.name}</td><td class="num">${b.hand[0]}</td><td class="num">${b.pa}</td><td class="num">${b.ab}</td>
      <td class="num">${b.h}</td><td class="num">${avgStr(b.h, b.ab)}</td>
      <td class="num">${b.L}</td><td class="num">${b.C}</td><td class="num">${b.R}</td>
      <td class="num">${b.IF}</td><td class="num">${b.OF}</td>
      <td>${tendency(b)}</td><td><span class="call ${c.cls}">${c.label}</span></td></tr>`;
  }).join("");
  return `
  <div class="view-head"><h2>Opponent scouting</h2>
    <span class="sub">${D.at_bats.length} at-bats reconstructed from GameChanger play-by-play</span></div>
  <div class="teambar">${TEAMS.map(t =>
    `<button data-team="${t.name}" class="${t.name === state.scoutTeam ? "active" : ""}">${t.name} <small>(${t.h} H)</small></button>`).join("")}</div>
  <div class="teamsum"><b>${T.name}</b> — ${Object.keys(T.batters).length} batters · ${T.pa} PA · ${T.h} hits ·
    field side <b>${Math.round(100 * T.L / bip)}% L</b> / ${Math.round(100 * T.C / bip)}% C / <b>${Math.round(100 * T.R / bip)}% R</b> ·
    ${Math.round(100 * T.OF / (T.IF + T.OF || 1))}% to the outfield</div>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>Batter</th><th class="num">B</th><th class="num">PA</th><th class="num">AB</th>
    <th class="num">H</th><th class="num">AVG</th><th class="num">L</th><th class="num">C</th><th class="num">R</th>
    <th class="num">IF</th><th class="num">OF</th><th>Tendency</th><th>Call</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="note">B = bats (R/L/B, U = unknown — only 6 of 14 teams have handedness entered). L/C/R = field side the ball went to
  (catcher's view), not pull/oppo. Call = which of the 4 looks on the Field card to use (pick the bases-empty or runner-on-1B row
  by the situation). House rule: a known righty hitting right or a known lefty hitting left is never stacked — they get Straight up.</p>`;
}

/* ---------- hawks: our 15 hitters ---------- */
function spraySVG(p) {
  let s = '<svg viewBox="0 12 320 296" xmlns="http://www.w3.org/2000/svg" role="img">' + fieldGrass(GRASS) + fieldDirt() + fieldLines(false);
  p.outs.forEach(d => { s += `<circle cx="${d[0]}" cy="${d[1]}" r="5" fill="${OUTC}" stroke="#fff" stroke-width="0.6"/>`; });
  p.hits.forEach(d => { s += `<circle cx="${d[0]}" cy="${d[1]}" r="5" fill="${HITC}" stroke="#7a5c00" stroke-width="0.6"/>`; });
  const zpos = { LF: [28, 70], CF: [160, 30], RF: [292, 70] };
  Object.entries(p.zones || {}).forEach(([z, n]) => {
    if (!n || !zpos[z]) return;
    s += `<circle cx="${zpos[z][0]}" cy="${zpos[z][1]}" r="13" fill="${HITC}" stroke="#7a5c00" stroke-width="0.8"/>` +
         `<text x="${zpos[z][0]}" y="${zpos[z][1]+4}" text-anchor="middle" font-size="12" font-weight="bold" fill="#5b4500" font-family="Arial">${n}</text>`;
  });
  return s + "</svg>";
}

function viewHawks() {
  const order = D.batting.filter(r => r[0] !== "TEAM").map(r => r[0]);
  const cards = order.map(name => {
    const p = D.spray_players[name]; if (!p) return "";
    const b = D.batting.find(r => r[0] === name);
    const sm = D.spray_summary[name] || {};
    const line = b ? `AVG <b>${String(b[4]).replace(/^0/, "")}</b> · ${b[8]} H · ${b[12]} HR · ${b[13]} RBI · bats ${D.spray_bats[name] || "R"}` : "";
    return `<div class="pcard"><h4>${name}</h4><p class="line">${line}</p>${spraySVG(p)}<p class="desc">${sm.desc || ""}</p></div>`;
  }).join("");
  return `
  <div class="view-head"><h2>Hawks hitters</h2>
    <span class="sub">737 batted balls with true x,y coordinates · yellow = hit, red = out, bubbles = fence/over by zone</span></div>
  <div class="cards">${cards}</div>`;
}

/* ---------- schedule: 2026 season from GameChanger ---------- */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function lineupLocked(L) { return new Date() >= new Date(L.lock_at); }

function viewSchedule() {
  const S26 = D.schedule_2026;
  const today = new Date().toISOString().slice(0, 10);
  const next = (S26.games.find(g => g.date >= today) || {}).date;
  let cur = "", rows = "";
  S26.games.forEach(g => {
    const m = MONTHS[+g.date.slice(5, 7) - 1] + " " + g.date.slice(0, 4);
    if (m !== cur) { cur = m; rows += `<p class="month-h">${m}</p>`; }
    const scout = g.scout
      ? `<button class="scoutlink" data-team="${g.scout}">Scout report</button>`
      : `<span class="noscout">no 2025 data</span>`;
    const L = D.lineups && D.lineups[g.date];
    const lchip = L ? (lineupLocked(L)
      ? '<span class="lineupchip locked">LINEUP IS LOCKED</span>'
      : '<span class="lineupchip set">LINEUP IS SET — tap to view</span>') : "";
    rows += `<div class="row game${g.date === next ? " next" : ""}${L ? " haslineup" : ""}" ${L ? `data-date="${g.date}"` : ""}>
      <span class="gdate">${g.dow} ${+g.date.slice(8, 10)}</span>
      <span class="gha ${g.home ? "h" : "a"}">${g.home ? "vs" : "@"}</span>
      <span class="gopp">${g.opponent}</span>
      ${lchip}
      <span class="gvenue">${g.venue}</span>
      <span class="gtime">${g.time}</span>
      ${scout}${g.date === next ? '<span class="nextchip">NEXT GAME</span>' : ""}
    </div>`;
  });
  return `
  <div class="view-head"><h2>2026 schedule</h2>
    <span class="sub">${S26.team} · ${S26.season} · ${S26.games.length} games · record ${S26.record} — from GameChanger (pulled ${S26.fetched})</span></div>
  ${rows}
  <p class="note">Tap a game with a lineup chip to see the batting order and the 7-inning field rotation.
  "Scout report" jumps to the 2025 scouting page for that opponent. Eagles were never scored on the opponent side in 2025, so there is no report for them.</p>`;
}

/* ---------- game detail: batting order + 7-inning fielding rotation ---------- */
function viewGame() {
  const L = (D.lineups && (D.lineups[state.gameDate] || Object.values(D.lineups)[0]));
  if (!L) { location.hash = "#schedule"; return ""; }
  const locked = lineupLocked(L);
  const status = locked
    ? '<span class="statusbig locked">THE LINEUP IS LOCKED</span>'
    : '<span class="statusbig set">LINEUP IS SET <small>— locks at 5:30 PM</small></span>';
  const innHead = [1, 2, 3, 4, 5, 6, 7].map(i => `<th class="num">Inn ${i}</th>`).join("");
  const rows = L.grid.map(r => {
    const cells = r.inn.map(p => p === "SIT"
      ? '<td class="num sit">SIT</td>'
      : `<td class="num${["P","C","SS"].includes(p) && r.inn.every(x => x === p) ? " anchor" : ""}">${p}</td>`).join("");
    return `<tr><td class="num"><b>${r.bat}</b></td><td>${r.player}</td>${cells}</tr>`;
  }).join("");
  const sits = [1, 2, 3, 4, 5, 6, 7].map(i => {
    const s = L.grid.find(r => r.inn[i - 1] === "SIT");
    return `<span class="poschip"><b>Inn ${i}</b> ${s ? s.player.replace(/ #\d+$/, "") + " sits" : "—"}</span>`;
  }).join("");
  return `
  <p><a href="#schedule" class="backlink">&larr; Back to schedule</a></p>
  <div class="lineup-sheet">
  <div class="gamecard">
    <div class="view-head" style="margin-bottom:4px">
      <h2>${L.home ? "vs" : "@"} ${L.opponent}</h2>
      <span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${status}<button class="print-btn" onclick="printLineupCard()">Print lineup</button></span></div>
    <p class="sub" style="color:#667;font-size:13.5px">Wed Jun 10 · first pitch ${L.time} · arrive ${L.arrive} · ${L.venue} · ${L.notes}</p>
    <p class="sub rsvp" style="color:#667;font-size:12.5px;margin-top:3px">RSVP: <b>${L.rsvp.going} going</b> · ${L.rsvp.not_going} out · ${L.rsvp.no_reply} no reply (last checked ${L.rsvp.last_checked.replace(L.date + " ", "")})</p>
  </div>
  <h3 class="month-h">Batting order &amp; field by inning <span style="font-weight:400;color:#667;font-size:12px">— everyone bats all game; SIT = fielding rest only</span></h3>
  <div class="tblwrap"><table class="tbl"><thead><tr><th class="num">Bat</th><th>Player</th>${innHead}</tr></thead><tbody>${rows}</tbody></table></div>
  <h3 class="month-h">Who sits each inning</h3>
  <div class="poschips">${sits}</div>
  </div>
  ${L.rules.map(r => `<p class="note" style="margin-top:4px">${r}</p>`).join("")}
  ${whyHTML(L)}
  ${oppLineupHTML(L)}`;
}

/* print one sheet of the game view: body class scopes the @media print rules to
   that sheet; @page orientation is injected per card (global default is landscape) */
function printCard(cls, orient) {
  document.body.classList.add(cls);
  const s = document.createElement("style");
  s.textContent = `@media print { @page { size: letter ${orient}; margin: 10mm; } }`;
  document.head.appendChild(s);
  window.addEventListener("afterprint", () => { document.body.classList.remove(cls); s.remove(); }, { once: true });
  window.print();
}
function printLineupCard() { printCard("print-lineup", "portrait"); }
function printOppCard() { printCard("print-opp", "landscape"); }

/* batting-order rationale: "why" strings authored in data/lineup_<date>.json */
function whyHTML(L) {
  const rows = L.grid.filter(r => r.why).map(r =>
    `<tr><td class="num"><b>${r.bat}</b></td><td class="pname">${r.player}</td><td class="reason">${r.why}</td></tr>`).join("");
  if (!rows) return "";
  return `
  <h3 class="month-h">Why the order is what it is <span style="font-weight:400;color:#667;font-size:12px">— 2025 numbers, lightly seasoned with jokes</span></h3>
  <div class="tblwrap wrapok"><table class="tbl"><thead><tr><th class="num">Bat</th><th>Player</th><th>The manager's reasoning</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function oppLineupHTML(L) {
  const opp = L.opponent_lineup;
  if (!opp) return "";
  const T = TEAMS.find(t => t.name === opp.team);
  const rows = opp.order.map((o, i) => {
    const b = T && T.batters[o.name];
    const hitTo = {};
    D.at_bats.forEach(r => { if (r.game === opp.team && r.batter === o.name && r.hit_to) hitTo[r.hit_to] = (hitTo[r.hit_to] || 0) + 1; });
    const hits = Object.entries(hitTo).sort((a, b2) => b2[1] - a[1]).map(([k, n]) => `${k}&times;${n}`).join(" · ") || "—";
    const c = b ? callFor(b) : null;
    return `<tr><td class="num"><b>${i + 1}</b></td>
      <td>${o.name}${o.jersey && o.name !== "#" + o.jersey ? ' <span style="color:#99a">#' + o.jersey + "</span>" : ""}</td>
      <td class="num">${o.pos || "—"}</td>
      <td class="num">${b ? b.ab : "—"}</td><td class="num">${b ? b.h : "—"}</td><td class="num">${b ? avgStr(b.h, b.ab) : "—"}</td>
      <td>${hits}</td><td>${b ? tendency(b) : "no data"}</td>
      <td>${c ? `<span class="call ${c.cls}">${c.label}</span>` : ""}</td></tr>`;
  }).join("");
  return `
  <div class="opp-sheet">
  <h3 class="month-h">${opp.team} lineup — know them before they swing
    <button class="print-btn" onclick="printOppCard()">Print opp card</button></h3>
  <p class="note oppsrc" style="margin:2px 0 8px">${opp.source}</p>
  <div class="tblwrap"><table class="tbl"><thead><tr><th class="num">#</th><th>Batter</th><th class="num">Pos</th>
    <th class="num">AB</th><th class="num">H</th><th class="num">AVG</th><th>Hits to (our positions)</th><th>Tendency</th><th>Call</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p style="margin-top:8px"><button class="scoutlink" data-team="${opp.team}">Full ${opp.team} scout report</button></p>
  </div>`;
}

/* ---------- data: at-bat explorer ---------- */
function distinct(key) { return [...new Set(D.at_bats.map(r => r[key]).filter(v => v !== ""))].sort(); }

function viewData() {
  const f = state.f;
  const rows = D.at_bats.filter(r =>
    (!f.team || r.game === f.team) && (!f.hand || r.bats_hand === f.hand) &&
    (!f.direction || r.direction === f.direction) && (!f.depth || r.depth === f.depth) &&
    (!f.result || r.result === f.result) &&
    (!f.batter || r.batter.toLowerCase().includes(f.batter.toLowerCase())));
  const hits = rows.reduce((a, r) => a + +r.is_hit, 0);
  const bipRows = rows.filter(r => r.hit_to);
  const pos = {};
  bipRows.forEach(r => { pos[r.hit_to] = (pos[r.hit_to] || 0) + 1; });
  const chips = Object.entries(pos).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `<span class="poschip"><b>${k}</b> ${n} (${Math.round(100 * n / (bipRows.length || 1))}%)</span>`).join("");
  const sel = (key, label, opts) =>
    `<div><label>${label}</label><select data-f="${key}"><option value="">All</option>` +
    opts.map(o => `<option ${f[key] === o ? "selected" : ""}>${o}</option>`).join("") + "</select></div>";
  const body = rows.map(r =>
    `<tr><td>${r.game}</td><td class="num">${r.inning}${r.half}</td><td>${r.batter}</td><td class="num">${(r.bats_hand || "U")[0]}</td>
     <td class="num">${r.result}</td><td class="num">${r.bb_type}</td><td class="num">${r.hit_to}</td>
     <td class="num">${r.direction}</td><td class="num">${r.depth}</td><td class="num">${r.out_base}</td></tr>`).join("");
  const posTable = D.positioning.map(p =>
    `<span class="poschip"><b>${p.fielder}</b> ${p.avg_location}${p.opp_pct ? " · opp " + p.opp_pct + "%" : ""}</span>`).join("");
  return `
  <div class="view-head"><h2>At-bat database</h2>
    <span class="sub">every opponent plate appearance, straight from opponents_2025.db</span></div>
  <div class="filters">
    ${sel("team", "Team", TEAMS.map(t => t.name))}
    ${sel("hand", "Bats", ["Right", "Left", "Both", "Unknown"])}
    ${sel("direction", "Direction", ["L", "C", "R"])}
    ${sel("depth", "Depth", ["IF", "OF"])}
    ${sel("result", "Result", distinct("result"))}
    <div><label>Batter</label><input data-f="batter" value="${f.batter}" placeholder="name contains…"></div>
  </div>
  <p class="statline"><b>${rows.length}</b> plate appearances · <b>${hits}</b> hits · <b>${bipRows.length}</b> balls in play</p>
  <div class="poschips">${chips}</div>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>Team</th><th class="num">Inn</th><th>Batter</th><th class="num">B</th>
    <th class="num">Result</th><th class="num">BB</th><th class="num">Hit to</th><th class="num">Dir</th>
    <th class="num">Depth</th><th class="num">Out@</th></tr></thead><tbody>${body}</tbody></table></div>
  <p class="statline" style="margin-top:14px">Where each fielder should set up (average of 737 Hawks batted balls + opponent frequency):</p>
  <div class="poschips">${posTable}</div>`;
}

/* ---------- router ---------- */
const VIEWS = { schedule: viewSchedule, game: viewGame, field: viewField, scout: viewScout, hawks: viewHawks, data: viewData };

function render() {
  let v = (location.hash || "#schedule").slice(1);
  if (!VIEWS[v]) v = "schedule";
  document.querySelectorAll("#menu a").forEach(a => a.classList.toggle("active", a.dataset.v === v || (v === "game" && a.dataset.v === "schedule")));
  MAIN.innerHTML = VIEWS[v]();
  window.scrollTo(0, 0);
}

MAIN.addEventListener("click", e => {
  const tb = e.target.closest(".teambar button");
  if (tb) { state.scoutTeam = tb.dataset.team; render(); return; }
  const sl = e.target.closest(".scoutlink");
  if (sl) { state.scoutTeam = sl.dataset.team; location.hash = "#scout"; return; }
  const gr = e.target.closest(".row.game.haslineup");
  if (gr) { state.gameDate = gr.dataset.date; location.hash = "#game"; }
});

/* status chips flip from SET to LOCKED on their own at 5:30 */
setInterval(() => {
  const v = (location.hash || "#schedule").slice(1);
  if (v === "schedule" || v === "game") render();
}, 30000);
MAIN.addEventListener("change", e => {
  if (e.target.dataset.f) { state.f[e.target.dataset.f] = e.target.value; render(); }
});
MAIN.addEventListener("keyup", e => {
  if (e.target.dataset.f === "batter") { state.f.batter = e.target.value; renderDataTableOnly(); }
});
function renderDataTableOnly() {
  if ((location.hash || "#field").slice(1) !== "data") return;
  const el = document.activeElement, pos = el && el.selectionStart;
  render();
  const inp = MAIN.querySelector('input[data-f="batter"]');
  if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
}

window.addEventListener("hashchange", render);

/* game day: opening the app with no hash lands straight on today's game card */
if (!location.hash) {
  const today = new Date().toISOString().slice(0, 10);
  if (D.lineups && D.lineups[today]) { state.gameDate = today; location.hash = "#game"; }
}
render();
