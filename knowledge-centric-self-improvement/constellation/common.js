/* Shared helpers for the knowledge-base visual mockups (atlas + constellation).
   Both concepts read the same baked layout files in mockups/data/. */

export const TYPES = [
  { key: "transferable_insights", label: "Strategy",    light: "#2a78d6", dark: "#3987e5" },
  { key: "confirmed_constraints", label: "Constraint",  light: "#1baf7a", dark: "#199e70" },
  { key: "rejected_hypotheses",   label: "Dead end",    light: "#e87ba4", dark: "#d55181" },
  { key: "pitfalls",              label: "Pitfall",     light: "#eb6834", dark: "#d95926" },
  { key: "checks",                label: "Check",       light: "#eda100", dark: "#c98500" },
  { key: "next_steps",            label: "Next step",   light: "#4a3aa7", dark: "#9085e9" },
];

export const BENCHES = [
  { id: "tb2", label: "Terminal-Bench 2", dash: "tb2-haiku/" },
];

const cache = {};
export async function loadBench(id, variant = "atlas") {
  const key = `${variant}:${id}`;
  if (cache[key]) return cache[key];
  const res = await fetch(`data/${variant}_${id}.json`);
  const d = await res.json();
  // Cluster centroids (with a short display label) come baked into the file in
  // the same coordinate space as the points — 2D scaled for atlas, 3D centred
  // for star3d — so a display consumer just reads c.x/c.y/c.z.
  d.clusterLabels = d.clusters.map((c) => ({
    id: c.id, x: c.x, y: c.y, z: c.z ?? 0, n: c.n, text: prettyTerms(c.terms),
  }));
  cache[key] = d;
  return d;
}

function prettyTerms(terms) {
  // Drop near-duplicate multiword terms, keep up to 3 distinct tokens.
  const out = [];
  for (const t of terms) {
    if (out.some((o) => o.includes(t) || t.includes(o))) continue;
    out.push(t);
    if (out.length === 3) break;
  }
  return out.join(" · ");
}

export function isDark() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function typeColor(typeIdx, dark) {
  const t = TYPES[typeIdx];
  return dark ? t.dark : t.light;
}

/* Build a k=1 nearest-earlier-neighbor link for each point in generation order,
   so the constellation can grow as an accreting web. Uniform grid for speed. */
export function buildLinks(points) {
  const idx = points.map((_, i) => i).sort((a, b) => points[a].g - points[b].g);
  const cell = 60, grid = new Map();
  const key = (cx, cy) => cx + "," + cy;
  const links = new Array(points.length).fill(-1);
  for (const i of idx) {
    const p = points[i];
    const gx = Math.floor(p.x / cell), gy = Math.floor(p.y / cell);
    let best = -1, bestD = Infinity;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(key(gx + dx, gy + dy));
        if (!bucket) continue;
        for (const j of bucket) {
          const q = points[j];
          const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
          if (d < bestD) { bestD = d; best = j; }
        }
      }
    links[i] = best;
    (grid.get(key(gx, gy)) || grid.set(key(gx, gy), []).get(key(gx, gy))).push(i);
  }
  return links;
}

/* Tooltip that follows the cursor and clamps to the viewport. */
export class Tooltip {
  constructor() {
    this.el = document.createElement("div");
    this.el.className = "viz-tooltip";
    this.el.hidden = true;
    document.body.appendChild(this.el);
  }
  show(html, x, y) {
    this.el.innerHTML = html;
    this.el.hidden = false;
    const r = this.el.getBoundingClientRect();
    let nx = x + 14, ny = y + 14;
    if (nx + r.width > window.innerWidth - 8) nx = x - r.width - 14;
    if (ny + r.height > window.innerHeight - 8) ny = y - r.height - 14;
    this.el.style.transform = `translate(${Math.max(8, nx)}px, ${Math.max(8, ny)}px)`;
  }
  hide() { this.el.hidden = true; }
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export function typeChipHtml(typeIdx, dark) {
  const t = TYPES[typeIdx];
  return `<span class="viz-chip"><i style="background:${typeColor(typeIdx, dark)}"></i>${t.label}</span>`;
}
