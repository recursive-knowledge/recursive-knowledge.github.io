import { loadBench, typeColor, typeChipHtml, Tooltip, TYPES, BENCHES, esc } from "./common.js";

/* A 3D star chart of the knowledge base. Claims live in a semantic cube (3D t-SNE):
   - BRIGHT STARS: the distilled / most-evidenced claims per topic, connected within
     each topic by a minimum spanning tree into a named constellation figure.
   - DUST: the thousands of raw per-task claims, faint, giving depth and density.
   Drag empty space to orbit the whole cloud; drag a star to pull it (its figure
   follows); scroll to zoom. Stars ignite by generation; figures draw themselves. */
const DARK = true;
const root = document.getElementById("viz");
const canvas = root.querySelector("canvas");
const ctx = canvas.getContext("2d");
const tooltip = new Tooltip();

const state = {
  bench: root.dataset.bench || "tb2",
  data: null, bright: [], brightSet: new Set(), edges: [], figures: [],
  gen: 10, playing: false, hidden: new Set(),
  hover: -1, reveal: 10,
  rotX: -0.15, rotY: 0.4, zoom: 1, autoRotate: true,
  W: 0, H: 0, dpr: 1, t0: 0,
  proj: null,                    // per-frame projected {x,y,scale,depth,vis}
};

const BRIGHT_PER_CLUSTER = 13;
const MAX_EDGE = 150;
const VD = 1500;                 // viewer distance along +z

function resize() {
  const r = canvas.getBoundingClientRect();
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.W = r.width; state.H = r.height;
  canvas.width = Math.round(r.width * state.dpr);
  canvas.height = Math.round(r.height * state.dpr);
}
const phase = (i) => (i * 2.399963) % 6.2832;
const focal = () => Math.min(state.W, state.H) * 1.15 * state.zoom;

/* rotate a world point by yaw(rotY) then pitch(rotX) */
function rotate(x, y, z) {
  const cy = Math.cos(state.rotY), sy = Math.sin(state.rotY);
  let rx = x * cy + z * sy;
  let rz = -x * sy + z * cy;
  const cx = Math.cos(state.rotX), sx = Math.sin(state.rotX);
  const ry = y * cx - rz * sx;
  rz = y * sx + rz * cx;
  return [rx, ry, rz];
}

/* project the whole cloud once per frame into state.proj */
function projectAll() {
  const pts = state.data.points;
  const F = focal(), cx = state.W / 2, cy = state.H / 2;
  const proj = state.proj || (state.proj = new Array(pts.length));
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const [rx, ry, rz] = rotate(p.x, p.y, p.z);
    const depth = VD - rz;
    if (depth < 60) { proj[i] = null; continue; }
    const s = F / depth;
    proj[i] = { x: cx + rx * s, y: cy - ry * s, scale: s, depth };
  }
}
function projectPoint(x, y, z) {
  const F = focal(), cx = state.W / 2, cy = state.H / 2;
  const [rx, ry, rz] = rotate(x, y, z);
  const depth = VD - rz;
  const s = F / depth;
  return { x: cx + rx * s, y: cy - ry * s, scale: s, depth };
}
/* ---------- bright tier + MST figures ---------- */
function buildFigures() {
  const pts = state.data.points;
  const byCluster = new Map();
  pts.forEach((p, i) => { (byCluster.get(p.k) || byCluster.set(p.k, []).get(p.k)).push(i); });

  const bright = [], edges = [], figures = [];
  const score = (p) => (p.d ? 200 : 0) + p.e * 6 + p.n * 3;
  const d3 = (a, b) => (pts[a].x - pts[b].x) ** 2 + (pts[a].y - pts[b].y) ** 2 + (pts[a].z - pts[b].z) ** 2;

  for (const cl of state.data.clusterLabels) {
    const members = byCluster.get(cl.id) || [];
    if (cl.n < 40 || members.length < 3) continue;
    const k = Math.max(4, Math.min(BRIGHT_PER_CLUSTER, Math.round(members.length / 45)));
    const stars = members.slice().sort((a, b) => score(pts[b]) - score(pts[a])).slice(0, Math.min(k, members.length));
    bright.push(...stars);

    const inTree = new Set([stars[0]]), rest = new Set(stars.slice(1));
    let figGen = pts[stars[0]].g;
    while (rest.size) {
      let bA = -1, bB = -1, bD = Infinity;
      for (const a of inTree) for (const b of rest) { const d = d3(a, b); if (d < bD) { bD = d; bA = a; bB = b; } }
      if (bB < 0) break;
      if (Math.sqrt(bD) <= MAX_EDGE) edges.push({ a: bA, b: bB });
      inTree.add(bB); rest.delete(bB); figGen = Math.min(figGen, pts[bB].g);
    }
    figures.push({ label: cl.text, x: cl.x, y: cl.y, z: cl.z, gen: figGen, ids: stars, n: cl.n });
  }
  state.bright = bright; state.brightSet = new Set(bright);
  state.edges = edges; state.figures = figures;
}

/* ---------- render ---------- */
function frame(t) {
  if (!state.t0) state.t0 = t;
  if (!state.W || !state.H) resize();               // canvas not yet laid out
  const time = (t - state.t0) / 1000;
  state.reveal += (state.gen - state.reveal) * 0.08;
  if (state.autoRotate && !drag) state.rotY += 0.0016;
  const { W, H, dpr } = state;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
  g.addColorStop(0, "#12172a"); g.addColorStop(1, "#080b14");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (state.data) { projectAll(); drawSky(time); }
  requestAnimationFrame(frame);
}

function drawSky(time) {
  const pts = state.data.points, pr = state.proj, rev = state.reveal;
  const vis = (i) => pr[i] && pts[i].g <= state.gen + 0.001 && !state.hidden.has(pts[i].t);
  const appear = (i) => Math.max(0, Math.min(1, rev - (pts[i].g - 1)));
  const hoverCluster = state.hover >= 0 ? pts[state.hover].k : -1;
  const fog = (depth) => Math.max(0.25, Math.min(1, (VD + 480 - depth) / (960)));  // far = dimmer

  // 1) dust
  for (let i = 0; i < pts.length; i++) {
    if (state.brightSet.has(i) || !vis(i)) continue;
    const a = appear(i); if (a <= 0.02) continue;
    const pp = pr[i];
    if (pp.x < -3 || pp.y < -3 || pp.x > state.W + 3 || pp.y > state.H + 3) continue;
    const dim = hoverCluster >= 0 && pts[i].k !== hoverCluster ? 0.12 : 0.3;
    ctx.globalAlpha = a * dim * fog(pp.depth);
    ctx.fillStyle = typeColor(pts[i].t, DARK);
    const r = Math.max(0.5, Math.min(1.9, pp.scale * 1.5));
    ctx.beginPath(); ctx.arc(pp.x, pp.y, r, 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 2) figure lines
  for (const e of state.edges) {
    if (!vis(e.a) || !vis(e.b)) continue;
    const a = Math.min(appear(e.a), appear(e.b)); if (a <= 0.02) continue;
    const pa = pr[e.a], pb = pr[e.b];
    const lit = hoverCluster < 0 || pts[e.a].k === hoverCluster;
    ctx.lineWidth = Math.max(0.5, Math.min(1.6, (pa.scale + pb.scale) * 0.5));
    ctx.strokeStyle = `rgba(162,186,240,${(lit ? 0.55 : 0.12) * a * fog((pa.depth + pb.depth) / 2)})`;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }

  // 3) bright stars, sorted far -> near
  const order = state.bright.filter(vis).sort((a, b) => pr[b].depth - pr[a].depth);
  for (const i of order) {
    const a = appear(i); if (a <= 0.02) continue;
    const pp = pr[i];
    const tw = 0.82 + 0.18 * Math.sin(time * 1.5 + phase(i) * 2);
    const col = typeColor(pts[i].t, DARK);
    const focus = hoverCluster < 0 || pts[i].k === hoverCluster;
    const f = fog(pp.depth);
    const r = Math.max(1.6, Math.min(5.5, pp.scale * 3.4));
    ctx.globalAlpha = a * (focus ? 0.34 : 0.12) * tw * f;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(pp.x, pp.y, r * 2.1, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = a * (focus ? 1 : 0.4) * f;
    ctx.beginPath(); ctx.arc(pp.x, pp.y, r, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = a * (focus ? 0.9 : 0.3) * f;
    ctx.fillStyle = "#fbfcff";
    ctx.beginPath(); ctx.arc(pp.x, pp.y, r * 0.42, 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (state.hover >= 0 && vis(state.hover)) {
    const pp = pr[state.hover];
    ctx.strokeStyle = "rgba(251,252,255,.95)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(pp.x, pp.y, Math.max(1.6, Math.min(5.5, pp.scale * 3.4)) + 5, 0, 6.2832); ctx.stroke();
  }

  // 4) constellation names — projected centroid, collision-culled, largest first
  const labelSize = Math.max(9.5, Math.min(13, state.W / 115));
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `600 ${labelSize}px ${getComputedStyle(document.body).fontFamily}`;
  const placed = [];
  const figs = state.figures
    .filter((f) => f.gen <= state.gen + 0.001)
    .map((f) => ({ f, pp: projectPoint(f.x, f.y, f.z) }))
    .filter((o) => o.pp.depth > 60)
    .sort((A, B) => {
      const ah = hoverCluster >= 0 && A.f.ids.some((id) => pts[id].k === hoverCluster) ? 1e9 : 0;
      const bh = hoverCluster >= 0 && B.f.ids.some((id) => pts[id].k === hoverCluster) ? 1e9 : 0;
      return (bh + B.f.n) - (ah + A.f.n);
    });
  for (const { f, pp } of figs) {
    const a = Math.max(0, Math.min(1, state.reveal - (f.gen - 1)));
    if (a <= 0.02) continue;
    const txt = f.label.replace(/\b\w/g, (c) => c.toUpperCase());
    const w = ctx.measureText(txt).width;
    const lx = pp.x, ly = pp.y - Math.max(9, pp.scale * 16);
    const box = { x0: lx - w / 2 - 5, y0: ly - labelSize / 2 - 3, x1: lx + w / 2 + 5, y1: ly + labelSize / 2 + 3 };
    if (box.x0 < 3 || box.x1 > state.W - 3 || box.y0 < 3 || box.y1 > state.H - 3) continue;
    let clash = false;
    for (const p of placed) if (!(box.x1 < p.x0 - 3 || box.x0 > p.x1 + 3 || box.y1 < p.y0 - 2 || box.y0 > p.y1 + 2)) { clash = true; break; }
    if (clash) continue;
    placed.push(box);
    const isHoverFig = hoverCluster >= 0 && f.ids.some((id) => pts[id].k === hoverCluster);
    const dim = hoverCluster >= 0 && !isHoverFig ? 0.4 : 1;
    ctx.fillStyle = `rgba(8,11,18,${0.62 * a * dim})`;
    ctx.beginPath(); ctx.roundRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, 5); ctx.fill();
    ctx.fillStyle = `rgba(214,222,244,${(isHoverFig ? 0.98 : 0.9) * a * dim})`;
    ctx.fillText(txt, lx, ly);
  }
}

/* ---------- picking ---------- */
function pick(mx, my) {
  const pts = state.data.points, pr = state.proj;
  let best = -1, bestD = 100;
  for (const i of state.bright) {           // bright stars first (bigger target)
    if (!pr[i] || pts[i].g > state.gen || state.hidden.has(pts[i].t)) continue;
    const dx = pr[i].x - mx, dy = pr[i].y - my, d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best >= 0) return best;
  bestD = 42;
  for (let i = 0; i < pts.length; i++) {
    if (!pr[i] || pts[i].g > state.gen || state.hidden.has(pts[i].t)) continue;
    const dx = pr[i].x - mx, dy = pr[i].y - my, d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/* ---------- pointer: orbit + click-to-pin ---------- */
let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  state.autoRotate = false;                 // stop idle orbit once the user engages
  drag = { x: e.clientX, y: e.clientY, moved: false, rotX: state.rotX, rotY: state.rotY };
  root.classList.add("viz--dragging");
  canvas.setPointerCapture(e.pointerId);
  tooltip.hide();
});
canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  if (drag) {                                // orbit the cloud
    const ddx = e.clientX - drag.x, ddy = e.clientY - drag.y;
    if (Math.abs(ddx) + Math.abs(ddy) > 3) drag.moved = true;
    state.rotY = drag.rotY + ddx * 0.006;
    state.rotX = Math.max(-1.4, Math.min(1.4, drag.rotX + ddy * 0.006));
    return;
  }
  const hit = pick(mx, my);
  state.hover = hit;
  if (hit >= 0) {
    const p = state.data.points[hit];
    const kind = state.brightSet.has(hit)
      ? (p.d ? "distilled · cross-task" : `${p.e} evidence quote${p.e > 1 ? "s" : ""}`)
      : (p.task ? esc(p.task) + (p.cat ? " · " + esc(p.cat) : "") : "cross-task");
    tooltip.show(`${typeChipHtml(p.t, DARK)}<div>${esc(p.s.length > 190 ? p.s.slice(0, 188) + "…" : p.s)}</div><span class="tt-meta">${kind} · gen ${p.g}</span>`, e.clientX, e.clientY);
    canvas.style.cursor = "grab";
  } else { tooltip.hide(); canvas.style.cursor = "grab"; }
});
canvas.addEventListener("pointerup", (e) => {
  root.classList.remove("viz--dragging");
  if (drag && !drag.moved) {
    const r = canvas.getBoundingClientRect();
    const hit = pick(e.clientX - r.left, e.clientY - r.top);
    if (hit >= 0) pin(hit); else unpin();
  }
  drag = null;
});
canvas.addEventListener("pointerleave", () => { if (!drag) { state.hover = -1; tooltip.hide(); } });
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  state.zoom = Math.max(0.4, Math.min(4, state.zoom * Math.exp(-e.deltaY * 0.0012)));
}, { passive: false });
canvas.addEventListener("dblclick", () => {   // reset the view orientation + zoom
  state.rotX = -0.15; state.rotY = 0.4; state.zoom = 1;
});

/* ---------- pin card ---------- */
function pin(idx) {
  const p = state.data.points[idx];
  const dash = BENCHES.find((b) => b.id === state.bench).dash;
  const card = document.getElementById("card");
  const kind = state.brightSet.has(idx)
    ? (p.d ? "Cross-task distilled" : `Task: ${esc(p.task)}`)
    : (p.task ? `Task: ${esc(p.task)}` : "Cross-task distilled");
  card.innerHTML = `
    <button class="viz-close" aria-label="Close">×</button>
    ${typeChipHtml(p.t, DARK)}
    <h4>${esc(p.s)}</h4>
    ${p.w ? `<p class="vc-when">Applies when: ${esc(p.w)}</p>` : ""}
    <div class="vc-meta">
      <span>Generation ${p.g}</span><span>${kind}</span>
      ${p.e ? `<span>${p.e} evidence quote${p.e > 1 ? "s" : ""}</span>` : ""}
      ${p.n > 1 ? `<span>seen ${p.n}×</span>` : ""}
    </div>
    <p style="margin-top:.7rem"><a href="/knowledge-centric-self-improvement/${dash}" target="_blank" rel="noopener">Read the full knowledge assets ↗</a></p>`;
  card.hidden = false;
  card.querySelector(".viz-close").onclick = unpin;
}
function unpin() { document.getElementById("card").hidden = true; }

/* ---------- timeline + chrome ---------- */
let timer = null;
function setGen(g) {
  state.gen = g;
  document.getElementById("genval").innerHTML = `Gen <b>${g}</b> / 10`;
  document.getElementById("slider").value = g;
  const dust = state.data.points.filter((p, i) => !state.brightSet.has(i) && p.g <= g && !state.hidden.has(p.t)).length;
  const stars = state.bright.filter((i) => state.data.points[i].g <= g && !state.hidden.has(state.data.points[i].t)).length;
  document.getElementById("count").textContent = `${stars} stars · ${dust.toLocaleString()} claims`;
}
const PLAY = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 3l9 5-9 5z"/></svg>`;
const PAUSE = `<svg viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></svg>`;
function togglePlay() {
  state.playing = !state.playing;
  document.getElementById("play").innerHTML = state.playing ? PAUSE : PLAY;
  if (state.playing) {
    if (state.gen >= 10) { state.reveal = 1; setGen(1); }
    timer = setInterval(() => { if (state.gen >= 10) { togglePlay(); return; } setGen(state.gen + 1); }, 1100);
  } else clearInterval(timer);
}

async function reload() {
  state.data = await loadBench(state.bench, "star3d");
  buildFigures(); state.proj = null; setGen(state.gen);
}

function buildChrome() {
  document.getElementById("play").innerHTML = PLAY;
  document.getElementById("play").onclick = togglePlay;
  const slider = document.getElementById("slider");
  slider.oninput = () => { if (state.playing) togglePlay(); setGen(+slider.value); };

  const seg = document.getElementById("benchseg");   // omitted on the TB2-only page
  if (seg) {
    seg.innerHTML = BENCHES.map((b) => `<button data-b="${b.id}" aria-pressed="${b.id === state.bench}">${b.label}</button>`).join("");
    seg.querySelectorAll("button").forEach((btn) => {
      btn.onclick = async () => {
        if (btn.dataset.b === state.bench) return;
        state.bench = btn.dataset.b;
        seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.b === state.bench)));
        unpin(); state.reveal = 10; await reload();
      };
    });
  }

  const legend = document.getElementById("legend");
  legend.innerHTML = TYPES.map((t, i) => `<button data-t="${i}" aria-pressed="true"><i style="background:${typeColor(i, DARK)}"></i>${t.label}</button>`).join("");
  legend.querySelectorAll("button").forEach((btn) => {
    const i = +btn.dataset.t;
    btn.onclick = () => {
      if (state.hidden.has(i)) state.hidden.delete(i); else state.hidden.add(i);
      btn.setAttribute("aria-pressed", String(!state.hidden.has(i)));
      setGen(state.gen);
    };
  });
}

window.addEventListener("resize", resize);
new ResizeObserver(resize).observe(canvas);         // catch late layout (embed/iframe)
(async function () {
  buildChrome();
  state.data = await loadBench(state.bench, "star3d");
  buildFigures();
  resize();
  setGen(10);
  requestAnimationFrame(frame);
})();
