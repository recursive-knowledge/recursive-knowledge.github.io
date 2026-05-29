/* KCSI "knowledge bank" flywheel — four navigable stages.
 *
 *   Stage 1 · Task forum        A task is ASSIGNED to a fresh stateless Claude
 *                               (Haiku 4.5) agent; the agent works it in a TERMINAL;
 *                               then POSTS evidence into the task forum.
 *   Stage 2 · Cross-task forum  Sibling tasks' evidence CONVERGES; agents CONTRIBUTE
 *                               concrete thoughts (thought bubbles); a candidate rule
 *                               is GROUNDED in shared evidence.
 *   Stage 3 · Distillation      One transferable insight is DISTILLED and WRITTEN to
 *                               the knowledge bank; banked knowledge is pulled back up
 *                               and SOLVES MORE TASKS, generation after generation
 *                               (cumulative 19 → 42 / 89, 47.2%); the bank fills.
 *   Stage 4 · Results           The bank is left behind and REUSED on held-out tasks;
 *                               then a comparison finale (solve rate vs baselines +
 *                               cross-benchmark efficiency), ported from the walkthrough.
 *
 * Driven by a formula-code-style control bar (clickable stage tabs + per-stage
 * progress, sub-step chips, play/pause, 0.5/1/2x speed). rAF model: elapsed += dt*speed.
 * Honest run data only; themes via --color-* tokens; honors reduced motion.
 */
(function () {
  "use strict";

  // ====================================================================== Layout
  const VBW = 960, VBH = 620;
  const FORUM   = { cx: 480, cy: 234, w: 240, h: 96, rx: 18 };   // rounded-rect "task forum"
  const RING_R  = 150, RING_A0 = 125, RING_SWEEP = 290;
  const CHANNEL = { x: 480, top: 338, bot: 452 };                 // token waypoints (center → bank)
  const BANK    = { x: 116, y: 474, w: 728, h: 118 };
  const BANK_CARD = { w: 128, h: 40, gap: 12, perRow: 5, rowGap: 8, padX: 20, padY: 18 };
  const GRID    = { x: 122, y: 92, w: 716, h: 196, cols: 5, rows: 3, gap: 12 };
  const IC      = { cx: 480, top: 150, w: 384 };
  const TERM    = { x: 296, y: 398, w: 368, h: 156 };             // stage-1 terminal panel (bank hidden then)
  const UNSEEN  = { x: 300, y: 470, w: 360, h: 120 };             // stage-4 held-out ghost tiles
  const FIN     = { x: 60, y: 120 };                              // results finale anchor

  const bankSlot = (k) => {
    const r = Math.floor(k / BANK_CARD.perRow), c = k % BANK_CARD.perRow;
    const x = BANK.x + BANK_CARD.padX + c * (BANK_CARD.w + BANK_CARD.gap);
    const y = BANK.y + BANK_CARD.padY + r * (BANK_CARD.h + BANK_CARD.rowGap);
    return { x, y, w: BANK_CARD.w, h: BANK_CARD.h, cx: x + BANK_CARD.w / 2, cy: y + BANK_CARD.h / 2 };
  };
  const gTileW = (GRID.w - (GRID.cols - 1) * GRID.gap) / GRID.cols;
  const gTileH = (GRID.h - (GRID.rows - 1) * GRID.gap) / GRID.rows;
  const gridTile = (i) => {
    const r = Math.floor(i / GRID.cols), c = i % GRID.cols;
    const x = GRID.x + c * (gTileW + GRID.gap), y = GRID.y + r * (gTileH + GRID.gap);
    return { x, y, w: gTileW, h: gTileH, cx: x + gTileW / 2, cy: y + gTileH / 2 };
  };
  const agentPos = (i, n, radius) => {
    const a = (RING_A0 + RING_SWEEP * (i / (n - 1))) * Math.PI / 180;
    return { x: FORUM.cx + (radius || RING_R) * Math.cos(a), y: FORUM.cy + (radius || RING_R) * Math.sin(a) };
  };

  // ====================================================================== Data (verbatim run data)
  const TOTAL_TASKS = 89;
  const AGENTS = [
    "path-tracing", "git-leak-recovery", "regex-log", "qemu-startup",
    "crack-7z-hash", "kv-store-grpc", "nginx-request-logging", "pytorch-model-cli",
  ];
  const GENESIS_SOURCES = [0, 7];                 // path-tracing, pytorch-model-cli (ground the G1 rule)
  const POST_AGENTS = [0, 2, 4, 6, 7];            // agents that post / contribute
  // Real, simplified cross-task thoughts (sourced from arc1_knowledge.json / tb2 run).
  const BUBBLES = [
    { agent: 0, text: "Exit code 0 didn't mean it worked — the artifact was empty.", cx: 214, cy: 432 },
    { agent: 2, text: "One passing example isn't proof — check every train pair.",    cx: 196, cy: 150 },
    { agent: 4, text: "Run the verifier yourself before submitting.",                 cx: 480, cy: 84  },
    { agent: 6, text: "Rank the segments by length, not position.",                   cx: 770, cy: 168 },
    { agent: 7, text: "The rule needs BOTH markers present — don't apply it blind.",  cx: 766, cy: 432 },
  ];
  // 15 grid tasks — the dramatic solves (verified in tb2_haiku.json tasks[id].per_gen) up front.
  const GRID_TASKS = [
    "bn-fit-modify", "prove-plus-comm", "large-scale-text-editing", "count-dataset-tokens", "query-optimize",
    "openssl-selfsigned-cert", "sanitize-git-repo", "compile-compcert", "break-filter-js-from-html", "pytorch-model-cli",
    "nginx-request-logging", "kv-store-grpc", "regex-log", "mcmc-sampling-stan", "portfolio-optimization",
  ];
  const tileIdx = (name) => GRID_TASKS.indexOf(name);
  const INSIGHTS = [
    { gen: 1, text: "Clean exit codes do not equal correctness — debug schemas and artifacts, not logic.",
      meta: "cross-task discussion · path-tracing + pytorch-model-cli" },
  ];
  // Bank slots (index = slot). Slot 0 is the genesis; slots 1–6 are the round drops; 7–9 fill at the end.
  const BANK_CARDS = [
    { gen: 1,  label: "Exit codes ≠ correctness" },  // slot 0 (genesis)
    { gen: 5,  label: "Schema, not a crash" },        // slot 1
    { gen: 7,  label: "Run the verifier" },           // slot 2
    { gen: 7,  label: "Exact fixture paths" },        // slot 3
    { gen: 8,  label: "C89 subset only" },            // slot 4
    { gen: 5,  label: "Tests are the spec" },         // slot 5
    { gen: 9,  label: "Find the missing step" },      // slot 6
    { gen: 3,  label: "Capture both streams" },       // slot 7 (fills at end)
    { gen: 6,  label: "Invalidate caches" },          // slot 8
    { gen: 2,  label: "Call a domain oracle" },       // slot 9
  ];
  // Dramatic solves climbing 19 → 42, gen after gen (tiles verified solved in the run).
  const ROUNDS = [
    { gen: 5, from: 19, to: 24, dropSlot: 1, riseSlot: 0, tiles: ["bn-fit-modify", "prove-plus-comm"] },
    { gen: 5, from: 24, to: 28, dropSlot: 5, riseSlot: 1, tiles: ["large-scale-text-editing", "count-dataset-tokens"] },
    { gen: 7, from: 28, to: 33, dropSlot: 2, riseSlot: 2, tiles: ["query-optimize", "openssl-selfsigned-cert"] },
    { gen: 7, from: 33, to: 37, dropSlot: 3, riseSlot: 3, tiles: ["sanitize-git-repo"] },
    { gen: 8, from: 37, to: 40, dropSlot: 4, riseSlot: 4, tiles: ["compile-compcert"] },
    { gen: 9, from: 40, to: 42, dropSlot: 6, riseSlot: 5, tiles: ["break-filter-js-from-html"] },
  ];
  // "failed Gx–Gy → solved Gn" flashes on the most dramatic tiles.
  const DRAMA = {
    "break-filter-js-from-html": "failed G1–8 → solved G9",
    "compile-compcert": "failed G1–7 → solved G8",
  };
  // Terminal panel content (stage 1) — honest shell lines.
  const TERM_LINES = [
    { t: "$ run-task path-tracing",       c: "cmd" },
    { t: "$ pytest tests/ -q",            c: "cmd" },
    { t: "....   exit 0",                 c: "out" },
    { t: "$ cat out/result.json",         c: "cmd" },
    { t: "{}    # exit 0 — but empty",     c: "note" },
  ];
  // Results finale (ported from the walkthrough's Act 3).
  const TB2_BASELINES = [
    { label: "OpenHands",      value: 13.9 },
    { label: "Terminus 2",     value: 28.3 },
    { label: "Mini-SWE-Agent", value: 29.8 },
    { label: "KCSI (ours)",    value: 47.2, accent: true },
  ];
  const EFFICIENCY_CHIPS = [
    { bench: "SWE-bench Pro", value: "84%", cost: "$76 / task", compare: "vs HyperAgents 42% at $276 — ~3.6× cheaper" },
    { bench: "ARC-AGI-1",     value: "82%", cost: "$46 / task" },
    { bench: "Polyglot",      value: "80%", cost: "$92 / task" },
  ];

  // ====================================================================== Timeline (4 stages)
  const STAGES = [
    { id: "task",    label: "Task forum",       dur: 8000 },
    { id: "cross",   label: "Cross-task forum", dur: 7000 },
    { id: "distil",  label: "Distillation",     dur: 13000 },
    { id: "results", label: "Results",          dur: 7000 },
  ];
  const BOUNDS = [];
  { let acc = 0; for (const s of STAGES) { BOUNDS.push({ start: acc, end: acc + s.dur }); acc += s.dur; } }
  const TOTAL_MS = BOUNDS[BOUNDS.length - 1].end;          // 35000
  const stageBounds = BOUNDS.map((b) => [b.start, b.end]);
  const stageAt = (t) => { for (let i = BOUNDS.length - 1; i >= 0; i--) if (t >= BOUNDS[i].start) return i; return 0; };

  const SUBSTEPS = [
    [ { label: "Assign task", at: 0 }, { label: "Terminal phase", at: 2600 }, { label: "Post evidence", at: 5000 } ],
    [ { label: "Evidence converges", at: 0 }, { label: "Agents contribute", at: 2200 }, { label: "Ground a rule", at: 5000 } ],
    [ { label: "Distill insight", at: 0 }, { label: "Write to base", at: 1500 }, { label: "Solve more tasks", at: 3650 }, { label: "Base fills", at: 11600 } ],
    [ { label: "Base reused", at: 0 }, { label: "Solve rate", at: 2600 }, { label: "Cross-benchmark", at: 4700 } ],
  ];
  const subAt = (t) => {
    const st = stageAt(t), local = t - BOUNDS[st].start, arr = SUBSTEPS[st];
    let idx = 0; for (let i = 0; i < arr.length; i++) if (local >= arr[i].at) idx = i;
    return { stage: st, idx };
  };

  // Local beats
  const S1 = { TITLE: [0, 900], ASSIGN: [700, 2600], TERM: [2600, 5000], POST: [5000, 8000] };
  const S2 = { CONVERGE: [0, 2200], BUBBLES: [2200, 5000], GROUND: [5000, 7000] };
  const S3 = { DISTILL: [0, 1700], DROP: [1500, 2900], SCALE: [2700, 3500], ROUNDS_START: 3650, ROUND_DUR: 1400, SURFACE: [11600, 13000] };
  const S4 = { REUSE: [0, 2600], BARS: [2600, 4700], CHIPS: [4700, 6200], TAG: [6200, 7000] };
  const S3_ROUNDS_END = S3.ROUNDS_START + ROUNDS.length * S3.ROUND_DUR;   // 12050
  const S3_START = BOUNDS[2].start, S4_START = BOUNDS[3].start;
  const s3RoundAt = (lt3) => {
    if (lt3 < S3.ROUNDS_START) return { idx: -1, pre: true };
    if (lt3 >= S3_ROUNDS_END) return { idx: ROUNDS.length - 1, p: 1, post: true };
    const i = Math.min(ROUNDS.length - 1, Math.floor((lt3 - S3.ROUNDS_START) / S3.ROUND_DUR));
    return { idx: i, p: (lt3 - S3.ROUNDS_START - i * S3.ROUND_DUR) / S3.ROUND_DUR };
  };
  const RWIN = { drop: [0.04, 0.40], rise: [0.28, 0.78], riseHit: 0.74, dropHit: 0.40 };

  // Bank reveal + tile solve times (absolute ms)
  const bankRevealT = new Array(BANK_CARDS.length).fill(Infinity);
  bankRevealT[0] = S3_START + S3.DROP[1];
  ROUNDS.forEach((R, idx) => { bankRevealT[R.dropSlot] = S3_START + S3.ROUNDS_START + (idx + RWIN.dropHit) * S3.ROUND_DUR; });
  for (let k = 0; k < bankRevealT.length; k++) if (!isFinite(bankRevealT[k])) bankRevealT[k] = S3_START + S3.SURFACE[0] + (k - 6) * 160;
  const tileSolveT = {};
  ROUNDS.forEach((R, idx) => { const at = S3_START + S3.ROUNDS_START + (idx + RWIN.riseHit) * S3.ROUND_DUR; R.tiles.forEach((nm) => { tileSolveT[nm] = at; }); });

  // ====================================================================== Helpers
  const SVGNS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs = {}, ...children) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; n.setAttribute(k, String(v)); }
    for (const c of children) { if (c == null) continue; n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }
    return n;
  };
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ptOnPolyline = (pts, t) => {
    const segs = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(d); total += d; }
    if (total === 0) return pts[0];
    let dist = clamp(t, 0, 1) * total;
    for (let i = 1; i < pts.length; i++) { if (dist <= segs[i - 1] || i === pts.length - 1) { const u = segs[i - 1] ? dist / segs[i - 1] : 0; return { x: lerp(pts[i - 1].x, pts[i].x, u), y: lerp(pts[i - 1].y, pts[i].y, u) }; } dist -= segs[i - 1]; }
    return pts[pts.length - 1];
  };
  const CHAR_W = { serif: 0.55, sans: 0.56, mono: 0.62 };
  const estW = (text, fontPx, kind = "serif") => String(text).length * fontPx * (CHAR_W[kind] || 0.56);
  const wrapToWidth = (text, maxPx, fontPx, kind = "serif") => {
    const words = String(text).split(/\s+/); const lines = []; let line = "";
    for (const w of words) { const trial = line ? line + " " + w : w; if (line && estW(trial, fontPx, kind) > maxPx) { lines.push(line); line = w; } else line = trial; }
    if (line) lines.push(line); return lines;
  };
  const wrapHyphen = (name, maxPx, fontPx) => {
    const parts = String(name).split("-"); const lines = []; let line = "";
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i] + (i < parts.length - 1 ? "-" : "");
      const trial = line + seg;
      if (line && estW(trial, fontPx, "mono") > maxPx) { lines.push(line); line = seg; } else line = trial;
    }
    if (line) lines.push(line); return lines;
  };
  const setClass = (el, name, on) => { if (el) el.classList.toggle(name, !!on); };
  const moveTo = (el, x, y) => { if (el) el.setAttribute("transform", `translate(${x.toFixed(1)}, ${y.toFixed(1)})`); };

  // Claude "sunburst" glyph — each task agent is a stateless Claude (Haiku 4.5) sub-agent.
  const claudeGlyph = () => {
    const g = svgEl("g", { class: "agent-claude" });
    const R = 12.5, innR = 2.6, blades = 12, halfDeg = 7;
    const pt = (r, ang) => `${(r * Math.cos(ang)).toFixed(2)},${(r * Math.sin(ang)).toFixed(2)}`;
    for (let i = 0; i < blades; i++) {
      const a = i * (360 / blades) * Math.PI / 180;
      const aL = a - halfDeg * Math.PI / 180, aR = a + halfDeg * Math.PI / 180;
      g.appendChild(svgEl("path", { d: `M${pt(innR, aL)} L${pt(R, aL)} L${pt(R, aR)} L${pt(innR, aR)} Z`, class: "agent-claude-blade" }));
    }
    return g;
  };

  // ====================================================================== State
  const S = { host: null, svg: null, groups: {}, headerGen: null, headerSolved: null, headerPct: null,
    agents: [], agentBase: [], posts: [], assignPill: null, connectors: [], bubbles: [],
    tiles: {}, tileDrama: {}, insightCards: [], bankCards: [], bankCountLabel: null,
    dropToken: null, riseTokens: [], ghosts: [], captionEl: null,
    termGroup: null, finBars: [], finChips: [], finTagline: null };

  // ====================================================================== Builders
  const buildHeader = (svg) => {
    const g = svgEl("g", { class: "anim-header" });
    S.headerGen    = svgEl("text", { x: 36, y: 32, class: "anim-header-gen" }, "Generation 1 of 10");
    S.headerSolved = svgEl("text", { x: VBW - 36, y: 32, "text-anchor": "end", class: "anim-header-solved" }, "Solved 0 / 89");
    S.headerPct    = svgEl("text", { x: VBW - 36, y: 48, "text-anchor": "end", class: "anim-header-pct" }, "0.0%");
    g.appendChild(svgEl("text", { x: 36, y: 48, class: "anim-header-bench" }, "Terminal-Bench 2 · 89 tasks · stateless Haiku 4.5 agent"));
    g.appendChild(S.headerGen); g.appendChild(S.headerSolved); g.appendChild(S.headerPct);
    svg.appendChild(g);
  };
  const buildBank = (svg) => {
    const g = svgEl("g", { class: "bank-shelf" });
    g.appendChild(svgEl("rect", { x: BANK.x, y: BANK.y, width: BANK.w, height: BANK.h, rx: 10, class: "bank-shelf-bg" }));
    S.bankCountLabel = svgEl("text", { x: BANK.x + 4, y: BANK.y - 8, class: "anim-zone-label" }, "KNOWLEDGE BASE · 0 INSIGHTS");
    g.appendChild(S.bankCountLabel);
    for (let k = 0; k < BANK_CARDS.length; k++) {
      const s = bankSlot(k), c = BANK_CARDS[k];
      const card = svgEl("g", { class: "bank-card", "data-k": k });
      card.appendChild(svgEl("rect", { x: s.x, y: s.y, width: s.w, height: s.h, rx: 6, class: "bank-card-bg" }));
      card.appendChild(svgEl("text", { x: s.x + 9, y: s.y + 15, class: "bank-card-tag" }, `G${c.gen}`));
      const lines = wrapToWidth(c.label, s.w - 18, 9.5, "sans").slice(0, 2);
      let ly = s.y + (lines.length === 1 ? 30 : 26);
      for (const ln of lines) { card.appendChild(svgEl("text", { x: s.x + 9, y: ly, class: "bank-card-label" }, ln)); ly += 11; }
      g.appendChild(card); S.bankCards.push(card);
    }
    svg.appendChild(g); S.groups.bank = g;
  };
  const buildForum = (svg) => {
    const g = svgEl("g", { class: "bank-forum" });
    const fx = FORUM.cx - FORUM.w / 2, fy = FORUM.cy - FORUM.h / 2;
    g.appendChild(svgEl("rect", { x: fx, y: fy, width: FORUM.w, height: FORUM.h, rx: FORUM.rx, class: "bank-hub-core" }));
    g.appendChild(svgEl("text", { x: FORUM.cx, y: FORUM.cy - 4, "text-anchor": "middle", class: "bank-hub-label" }, "TASK FORUM"));
    g.appendChild(svgEl("text", { x: FORUM.cx, y: FORUM.cy + 15, "text-anchor": "middle", class: "bank-hub-sub" }, "stateless Claude agents"));
    const n = AGENTS.length;
    // connectors (agent → forum) used during the cross-task stage
    for (let j = 0; j < POST_AGENTS.length; j++) {
      const p = agentPos(POST_AGENTS[j], n);
      const ln = svgEl("line", { x1: p.x, y1: p.y, x2: FORUM.cx, y2: FORUM.cy, class: "bank-connector" });
      g.appendChild(ln); S.connectors.push(ln);
    }
    for (let i = 0; i < n; i++) {
      const p = agentPos(i, n); S.agentBase.push(p);
      const ag = svgEl("g", { class: "bank-agent", "data-i": i, transform: `translate(${p.x.toFixed(1)}, ${p.y.toFixed(1)})` });
      ag.appendChild(claudeGlyph());
      const below = p.y > FORUM.cy + 30;
      ag.appendChild(svgEl("text", { x: 0, y: below ? 27 : -19, "text-anchor": "middle", class: "bank-agent-label" }, AGENTS[i]));
      g.appendChild(ag); S.agents.push(ag);
    }
    // assign pill (forum → agent 0)
    const pill = svgEl("g", { class: "assign-pill" });
    pill.appendChild(svgEl("rect", { x: -46, y: -11, width: 92, height: 22, rx: 11, class: "assign-pill-bg" }));
    pill.appendChild(svgEl("text", { x: 0, y: 4, "text-anchor": "middle", class: "assign-pill-text" }, "assign: path-tracing"));
    g.appendChild(pill); S.assignPill = pill;
    // post tokens
    for (let j = 0; j < POST_AGENTS.length; j++) {
      const tok = svgEl("g", { class: "bank-post" });
      tok.appendChild(svgEl("circle", { cx: 0, cy: 0, r: 5, class: "bank-post-dot" }));
      g.appendChild(tok); S.posts.push(tok);
    }
    svg.appendChild(g); S.groups.forum = g;
  };
  const buildTerminal = (svg) => {
    const g = svgEl("g", { class: "bank-terminal" });
    g.appendChild(svgEl("rect", { x: TERM.x, y: TERM.y, width: TERM.w, height: TERM.h, rx: 8, class: "bank-terminal-bg" }));
    g.appendChild(svgEl("rect", { x: TERM.x, y: TERM.y, width: TERM.w, height: 22, rx: 8, class: "bank-terminal-bar" }));
    for (let d = 0; d < 3; d++) g.appendChild(svgEl("circle", { cx: TERM.x + 14 + d * 12, cy: TERM.y + 11, r: 3.2, class: "bank-terminal-dot" }));
    g.appendChild(svgEl("text", { x: TERM.x + TERM.w / 2, y: TERM.y + 15, "text-anchor": "middle", class: "bank-terminal-title" }, "path-tracing · haiku 4.5"));
    let ly = TERM.y + 44;
    for (const line of TERM_LINES) {
      g.appendChild(svgEl("text", { x: TERM.x + 16, y: ly, class: `bank-terminal-line ${line.c}` }, line.t));
      ly += 21;
    }
    svg.appendChild(g); S.termGroup = g; S.groups.terminal = g;
  };
  const buildBubbles = (svg) => {
    const g = svgEl("g", { class: "bank-bubbles" });
    const n = AGENTS.length;
    for (let i = 0; i < BUBBLES.length; i++) {
      const b = BUBBLES[i];
      const bub = svgEl("g", { class: "thought-bubble", "data-i": i });
      const W = 178;
      const lines = wrapToWidth(b.text, W - 22, 11.5, "serif").slice(0, 3);
      const H = 16 + lines.length * 15;
      const x = clamp(b.cx - W / 2, 6, VBW - W - 6), y = clamp(b.cy - H / 2, 60, VBH - H - 6);
      const ap = agentPos(b.agent, n);
      bub.appendChild(svgEl("line", { x1: x + W / 2, y1: y + H / 2, x2: ap.x, y2: ap.y, class: "thought-bubble-tail" }));
      bub.appendChild(svgEl("rect", { x, y, width: W, height: H, rx: 10, class: "thought-bubble-bg" }));
      let ty = y + 18;
      for (const ln of lines) { bub.appendChild(svgEl("text", { x: x + 11, y: ty, class: "thought-bubble-text" }, ln)); ty += 15; }
      g.appendChild(bub); S.bubbles.push(bub);
    }
    svg.appendChild(g); S.groups.bubbles = g;
  };
  const buildGrid = (svg) => {
    const g = svgEl("g", { class: "bank-grid" });
    g.appendChild(svgEl("text", { x: GRID.x + 2, y: GRID.y - 10, class: "anim-zone-label" }, "TASK FORUMS · ONE PER TASK"));
    g.appendChild(svgEl("text", { x: GRID.x + GRID.w - 2, y: GRID.y - 10, "text-anchor": "end", class: "bank-grid-badge" }, "×10 GENERATIONS · 89 TASKS"));
    for (let i = 0; i < GRID_TASKS.length; i++) {
      const tl = gridTile(i), name = GRID_TASKS[i];
      const tile = svgEl("g", { class: "bank-tile", "data-i": i, "data-task": name });
      tile.appendChild(svgEl("rect", { x: tl.x, y: tl.y, width: tl.w, height: tl.h, rx: 7, class: "bank-tile-pulse" }));
      tile.appendChild(svgEl("rect", { x: tl.x, y: tl.y, width: tl.w, height: tl.h, rx: 7, class: "bank-tile-bg" }));
      const gx = tl.x + 15, gy = tl.y + 16;
      tile.appendChild(svgEl("circle", { cx: gx, cy: gy, r: 3, class: "bank-tile-hub" }));
      tile.appendChild(svgEl("circle", { cx: gx - 7, cy: gy - 5, r: 1.5, class: "bank-tile-orbit" }));
      tile.appendChild(svgEl("circle", { cx: gx + 7, cy: gy - 4, r: 1.5, class: "bank-tile-orbit" }));
      tile.appendChild(svgEl("circle", { cx: gx + 1, cy: gy + 7, r: 1.5, class: "bank-tile-orbit" }));
      tile.appendChild(svgEl("text", { x: tl.x + tl.w - 8, y: tl.y + 18, "text-anchor": "end", class: "bank-tile-check" }, "✓"));
      const hasDrama = !!DRAMA[name];
      const nameLines = wrapHyphen(name, tl.w - 14, 8).slice(0, 2);
      const nameBottom = tl.y + tl.h - (hasDrama ? 18 : 6);
      let ly = nameBottom - (nameLines.length - 1) * 10;
      for (const ln of nameLines) { tile.appendChild(svgEl("text", { x: tl.x + 7, y: ly, class: "bank-tile-label" }, ln)); ly += 10; }
      if (hasDrama) {
        const d = svgEl("text", { x: tl.x + 7, y: tl.y + tl.h - 5, class: "bank-tile-drama" }, DRAMA[name]);
        tile.appendChild(d); S.tileDrama[name] = d;
      }
      g.appendChild(tile); S.tiles[name] = tile;
    }
    svg.appendChild(g); S.groups.grid = g;
  };
  const buildInsightCards = (svg) => {
    const g = svgEl("g", { class: "bank-insights" });
    const x = IC.cx - IC.w / 2;
    for (let i = 0; i < INSIGHTS.length; i++) {
      const ins = INSIGHTS[i];
      const card = svgEl("g", { class: "bank-insight", "data-i": i });
      const tLines = wrapToWidth(ins.text, IC.w - 36, 13, "serif");
      const mLines = wrapToWidth(ins.meta, IC.w - 36, 10.5, "sans");
      const h = 26 + tLines.length * 17 + 8 + mLines.length * 13 + 12;
      card.appendChild(svgEl("rect", { x, y: IC.top, width: IC.w, height: h, rx: 9, class: "bank-insight-bg" }));
      card.appendChild(svgEl("text", { x: x + 16, y: IC.top + 19, class: "bank-insight-tag" }, `GEN ${ins.gen} · DISTILLED INSIGHT`));
      let ty = IC.top + 40;
      for (const ln of tLines) { card.appendChild(svgEl("text", { x: x + 16, y: ty, class: "bank-insight-text" }, ln)); ty += 17; }
      ty += 6;
      mLines.forEach((ln, k) => { card.appendChild(svgEl("text", { x: x + 16, y: ty, class: "bank-insight-meta" }, (k === 0 ? "↳ " : "   ") + ln)); ty += 13; });
      g.appendChild(card); S.insightCards.push(card);
    }
    svg.appendChild(g); S.groups.insights = g;
  };
  const buildTokens = (svg) => {
    const g = svgEl("g", { class: "bank-tokens" });
    const mk = (cls) => { const tok = svgEl("g", { class: `bank-token ${cls}` }); tok.appendChild(svgEl("rect", { x: -15, y: -11, width: 30, height: 22, rx: 5, class: "bank-token-bg" })); tok.appendChild(svgEl("text", { x: 0, y: 5, "text-anchor": "middle", class: "bank-token-glyph" }, "✦")); return tok; };
    S.dropToken = mk("drop"); g.appendChild(S.dropToken);
    for (let i = 0; i < 3; i++) { const r = mk("rise"); g.appendChild(r); S.riseTokens.push(r); }
    svg.appendChild(g); S.groups.tokens = g;
  };
  const buildUnseen = (svg) => {
    const g = svgEl("g", { class: "bank-unseen" });
    g.appendChild(svgEl("text", { x: UNSEEN.x + 2, y: UNSEEN.y - 8, class: "anim-zone-label" }, "UNSEEN TASKS · HELD-OUT, NEVER TRAINED ON"));
    const names = ["new-task-A", "new-task-B", "new-task-C", "new-task-D"];
    const tw = (UNSEEN.w - 3 * 12) / 4;
    for (let i = 0; i < names.length; i++) {
      const x = UNSEEN.x + i * (tw + 12);
      const tile = svgEl("g", { class: "bank-ghost-tile", "data-i": i });
      tile.appendChild(svgEl("rect", { x, y: UNSEEN.y, width: tw, height: UNSEEN.h - 14, rx: 7, class: "bank-ghost-tile-bg" }));
      tile.appendChild(svgEl("text", { x: x + tw - 8, y: UNSEEN.y + 18, "text-anchor": "end", class: "bank-ghost-check" }, "✓"));
      tile.appendChild(svgEl("text", { x: x + 8, y: UNSEEN.y + UNSEEN.h - 26, class: "bank-ghost-label" }, names[i]));
      g.appendChild(tile); S.ghosts.push({ el: tile, cx: x + tw / 2, cy: UNSEEN.y + (UNSEEN.h - 14) / 2 });
    }
    svg.appendChild(g); S.groups.unseen = g;
  };
  const buildFinale = (svg) => {
    const g = svgEl("g", { class: "stages-finale" });
    // Bars — TB2 solve rate vs baselines
    const bx = FIN.x, by = FIN.y + 14, rowH = 50, barX = bx + 130, barMaxW = 232, bw = 440;
    g.appendChild(svgEl("text", { x: bx, y: FIN.y - 4, class: "act3-section-label" }, "TERMINAL-BENCH 2 SOLVE RATE · SAME BACKBONE"));
    for (let i = 0; i < TB2_BASELINES.length; i++) {
      const b = TB2_BASELINES[i], y = by + i * rowH;
      const bar = svgEl("g", { class: "act3-bar", "data-i": i, "data-accent": b.accent ? "1" : "0" });
      bar.appendChild(svgEl("text", { x: bx, y: y + 15, class: "act3-bar-label" }, b.label));
      bar.appendChild(svgEl("rect", { x: barX, y: y + 2, width: barMaxW, height: 22, rx: 4, class: "act3-bar-bg" }));
      const fill = svgEl("rect", { x: barX, y: y + 2, width: 0, height: 22, rx: 4, class: "act3-bar-fill" });
      bar.appendChild(fill);
      bar.appendChild(svgEl("text", { x: bx + bw, y: y + 18, "text-anchor": "end", class: "act3-bar-value" }, `${b.value.toFixed(1)}%`));
      g.appendChild(bar); S.finBars.push({ root: bar, fill, target: (barMaxW * b.value) / 50 });
    }
    // Chips — cross-benchmark efficiency
    const cx0 = 540, cy0 = FIN.y + 14, chipW = 372, chipH = 64, gap = 14;
    g.appendChild(svgEl("text", { x: cx0, y: FIN.y - 4, class: "act3-section-label" }, "TRANSFER ACROSS BENCHMARKS · HAIKU 4.5"));
    for (let i = 0; i < EFFICIENCY_CHIPS.length; i++) {
      const c = EFFICIENCY_CHIPS[i], y = cy0 + i * (chipH + gap);
      const chip = svgEl("g", { class: "act3-chip", "data-i": i });
      chip.appendChild(svgEl("rect", { x: cx0, y, width: chipW, height: chipH, rx: 8, class: "act3-chip-bg" }));
      chip.appendChild(svgEl("text", { x: cx0 + 16, y: y + 24, class: "act3-chip-bench" }, c.bench));
      chip.appendChild(svgEl("text", { x: cx0 + 16, y: y + 44, class: "act3-chip-cost" }, c.cost));
      chip.appendChild(svgEl("text", { x: cx0 + chipW - 16, y: y + 32, "text-anchor": "end", class: "act3-chip-value" }, c.value));
      if (c.compare) chip.appendChild(svgEl("text", { x: cx0 + 16, y: y + 58, class: "act3-chip-compare" }, c.compare));
      g.appendChild(chip); S.finChips.push(chip);
    }
    S.finTagline = svgEl("text", { x: VBW / 2, y: FIN.y + 312, "text-anchor": "middle", class: "act3-tagline" }, "Same protocol. Same stateless agent. Four benchmarks.");
    g.appendChild(S.finTagline);
    svg.appendChild(g); S.groups.finale = g;
  };
  const buildSVG = () => {
    const svg = svgEl("svg", { class: "main-anim-svg bank-anim", viewBox: `0 0 ${VBW} ${VBH}`, role: "img", "aria-labelledby": "stages-anim-title", "aria-describedby": "stages-anim-desc", preserveAspectRatio: "xMidYMid meet" });
    svg.appendChild(svgEl("title", { id: "stages-anim-title" }, "Knowledge curation flywheel — task forum, cross-task forum, distillation, results"));
    buildHeader(svg); buildBank(svg); buildGrid(svg); buildForum(svg); buildTerminal(svg);
    buildBubbles(svg); buildInsightCards(svg); buildUnseen(svg); buildTokens(svg); buildFinale(svg);
    return svg;
  };

  // ====================================================================== Derived
  const cumulativeAt = (t) => {
    const stage = stageAt(t);
    if (stage < 2) return 0;
    if (stage >= 3) return 42;
    const lt3 = t - S3_START;
    if (lt3 < S3.DROP[0]) return 0;
    if (lt3 < S3.ROUNDS_START) return Math.round(ease(clamp((lt3 - S3.DROP[0]) / (S3.DROP[1] - S3.DROP[0]), 0, 1)) * 19);
    const r = s3RoundAt(lt3);
    if (r.post) return 42;
    const R = ROUNDS[r.idx];
    return Math.round(R.from + ease(clamp(r.p / 0.85, 0, 1)) * (R.to - R.from));
  };
  const genAt = (t) => {
    const stage = stageAt(t);
    if (stage < 2) return 1;
    if (stage >= 3) return 10;
    const lt3 = t - S3_START;
    if (lt3 < S3.ROUNDS_START) return 1;
    const r = s3RoundAt(lt3); return r.post ? 10 : ROUNDS[r.idx].gen;
  };

  // ====================================================================== Render
  const render = (t) => {
    const stage = stageAt(t);
    const inS1 = stage === 0, inS2 = stage === 1, inS3 = stage === 2, inS4 = stage === 3;
    const lt1 = t - BOUNDS[0].start, lt2 = t - BOUNDS[1].start, lt3 = t - S3_START, lt4 = t - S4_START;
    const finaleOn = inS4 && lt4 >= S4.BARS[0];

    // Header counter
    const solved = cumulativeAt(t), pct = (solved / TOTAL_TASKS) * 100;
    S.headerGen.textContent = `Generation ${genAt(t)} of 10`;
    S.headerSolved.textContent = `Solved ${solved} / ${TOTAL_TASKS}`;
    S.headerPct.textContent = `${pct.toFixed(1)}%`;

    // ---- Forum + agents (S1, S2, early S3) ----
    const forumOn = !finaleOn && (inS1 || inS2 || (inS3 && lt3 < S3.SCALE[1]));
    setClass(S.groups.forum, "show", forumOn);
    setClass(S.groups.forum, "hide", !forumOn);
    const n = AGENTS.length;
    const convergeP = inS2 ? ease(clamp(lt2 / S2.CONVERGE[1], 0, 1)) : 0;
    for (let i = 0; i < S.agents.length; i++) {
      const appear = inS1 ? (lt1 >= S1.TITLE[1] - 200 + i * 90) : true;
      setClass(S.agents[i], "show", forumOn && appear);
      // converge slightly inward during the cross-task stage
      if (inS2) { const p = agentPos(i, n, RING_R - 16 * convergeP); moveTo(S.agents[i], p.x, p.y); }
      else { const b = S.agentBase[i]; moveTo(S.agents[i], b.x, b.y); }
      const hl = ((inS2 && lt2 >= S2.GROUND[0]) || (inS3 && lt3 < S3.DISTILL[1])) && GENESIS_SOURCES.includes(i);
      setClass(S.agents[i], "hl", hl);
    }
    // connectors during cross-task convergence
    const connOn = inS2 && lt2 >= S2.CONVERGE[0] && lt2 < S2.GROUND[1];
    for (const ln of S.connectors) setClass(ln, "show", connOn);

    // assign pill (forum → agent 0) during S1.ASSIGN
    const assignOn = inS1 && lt1 >= S1.ASSIGN[0] && lt1 < S1.ASSIGN[1];
    setClass(S.assignPill, "show", assignOn);
    if (assignOn) {
      const p = ease(clamp((lt1 - S1.ASSIGN[0]) / (S1.ASSIGN[1] - S1.ASSIGN[0]), 0, 1));
      const dst = S.agentBase[0];
      const pt = ptOnPolyline([{ x: FORUM.cx, y: FORUM.cy }, { x: dst.x, y: dst.y - 24 }], p);
      moveTo(S.assignPill, pt.x, pt.y);
    }

    // terminal panel during S1.TERM
    setClass(S.termGroup, "show", inS1 && lt1 >= S1.TERM[0] && lt1 < S1.TERM[1]);

    // post tokens during S1.POST
    for (let j = 0; j < S.posts.length; j++) {
      const start = S1.POST[0] + j * 420;
      const active = inS1 && lt1 >= start && lt1 < S1.POST[1] + 200;
      setClass(S.posts[j], "show", active);
      if (active) {
        const src = S.agentBase[POST_AGENTS[j]];
        const p = ease(clamp((lt1 - start) / 1500, 0, 1));
        const pt = ptOnPolyline([src, { x: FORUM.cx, y: FORUM.cy }], p);
        moveTo(S.posts[j], pt.x, pt.y);
      }
    }

    // ---- thought bubbles (S2.BUBBLES) ----
    for (let i = 0; i < S.bubbles.length; i++) {
      const start = S2.BUBBLES[0] + i * 480;
      const shown = inS2 && lt2 >= start;
      const dim = inS2 && lt2 >= S2.GROUND[0];
      setClass(S.bubbles[i], "show", shown && lt2 < S2.GROUND[1]);
      setClass(S.bubbles[i], "dim", shown && dim);
    }

    // ---- grid (S3 from SCALE, and S4 reuse) ----
    const gridOn = (!finaleOn) && ((inS3 && lt3 >= S3.SCALE[0]) || (inS4 && lt4 < S4.BARS[0]));
    setClass(S.groups.grid, "show", gridOn);
    for (const name of Object.keys(S.tiles)) {
      const st = tileSolveT[name];
      const solvedTile = st != null && t >= st;
      setClass(S.tiles[name], "solved", solvedTile);
      setClass(S.tiles[name], "solving", st != null && t >= st - 280 && t < st + 360);
      if (S.tileDrama[name]) setClass(S.tileDrama[name], "show", st != null && t >= st - 280);
    }

    // ---- distilled insight card (S2.GROUND candidate rule + S3.DISTILL) ----
    const insightOn = (inS2 && lt2 >= S2.GROUND[0]) || (inS3 && lt3 >= S3.DISTILL[0] && lt3 < S3.SCALE[0]);
    for (let i = 0; i < S.insightCards.length; i++) setClass(S.insightCards[i], "show", insightOn && i === 0);

    // ---- bank shelf visibility (S3, S4) ----
    const bankOn = inS3 || inS4;
    setClass(S.groups.bank, "show", bankOn);

    // ---- tokens: drop (write) + rise (apply → solve) ----
    setClass(S.dropToken, "show", false);
    for (const rt of S.riseTokens) setClass(rt, "show", false);
    const dropCenter = { x: IC.cx, y: IC.top + 46 };
    const chTop = { x: CHANNEL.x, y: CHANNEL.top }, chBot = { x: CHANNEL.x, y: CHANNEL.bot };
    if (inS3 && lt3 >= S3.DROP[0] && lt3 < S3.DROP[1]) {
      const p = ease(clamp((lt3 - S3.DROP[0]) / (S3.DROP[1] - S3.DROP[0]), 0, 1));
      const dst = bankSlot(0);
      const pt = ptOnPolyline([dropCenter, chTop, chBot, { x: dst.cx, y: dst.cy }], p);
      setClass(S.dropToken, "show", true); moveTo(S.dropToken, pt.x, pt.y);
    } else if (inS3 && lt3 >= S3.ROUNDS_START && lt3 < S3_ROUNDS_END) {
      const r = s3RoundAt(lt3), R = ROUNDS[r.idx];
      if (r.p >= RWIN.drop[0] && r.p < RWIN.drop[1]) {
        const p = ease(clamp((r.p - RWIN.drop[0]) / (RWIN.drop[1] - RWIN.drop[0]), 0, 1));
        const dst = bankSlot(R.dropSlot);
        const pt = ptOnPolyline([dropCenter, chTop, chBot, { x: dst.cx, y: dst.cy }], p);
        setClass(S.dropToken, "show", true); moveTo(S.dropToken, pt.x, pt.y);
      }
      if (r.p >= RWIN.rise[0] && r.p < RWIN.rise[1]) {
        const p = ease(clamp((r.p - RWIN.rise[0]) / (RWIN.rise[1] - RWIN.rise[0]), 0, 1));
        const src = bankSlot(R.riseSlot);
        for (let k = 0; k < R.tiles.length && k < S.riseTokens.length; k++) {
          const tl = gridTile(tileIdx(R.tiles[k]));
          const pt = ptOnPolyline([{ x: src.cx, y: src.cy }, chBot, chTop, { x: tl.cx, y: tl.cy }], clamp(p - k * 0.06, 0, 1));
          setClass(S.riseTokens[k], "show", true); moveTo(S.riseTokens[k], pt.x, pt.y);
        }
      }
    }

    // ---- bank cards + count ----
    let lit = 0;
    for (let k = 0; k < S.bankCards.length; k++) {
      const on = t >= bankRevealT[k];
      setClass(S.bankCards[k], "lit", on);
      setClass(S.bankCards[k], "dim", on && k >= 7);
      setClass(S.bankCards[k], "fresh", on && t < bankRevealT[k] + 600);
      if (on) lit++;
    }
    S.bankCountLabel.textContent = `KNOWLEDGE BASE · ${lit} INSIGHT${lit === 1 ? "" : "S"}`;

    // ---- bank surfaces (end of S3) and stays risen through S4 ----
    let surf = 0;
    if (inS3 && lt3 >= S3.SURFACE[0]) surf = ease(clamp((lt3 - S3.SURFACE[0]) / (S3.SURFACE[1] - S3.SURFACE[0]), 0, 1));
    else if (inS4) surf = 1;
    if (surf > 0 && !finaleOn) S.groups.bank.setAttribute("transform", `translate(0, ${(-150 * surf).toFixed(1)})`);
    else S.groups.bank.removeAttribute("transform");

    // ---- unseen / reuse (S4 REUSE) ----
    const unseenOn = inS4 && lt4 < S4.BARS[0];
    setClass(S.groups.unseen, "show", unseenOn);
    for (let i = 0; i < S.ghosts.length; i++) {
      const solveAt = S4.REUSE[0] + 700 + i * 360;
      setClass(S.ghosts[i].el, "solved", inS4 && lt4 >= solveAt);
      // a rise token flying bank → ghost tile while it resolves
      if (unseenOn && lt4 >= solveAt - 360 && lt4 < solveAt + 60 && i < S.riseTokens.length) {
        const p = ease(clamp((lt4 - (solveAt - 360)) / 420, 0, 1));
        const src = bankSlot(i + 1); // risen bank position
        const srcPt = { x: src.cx, y: src.cy - 150 };
        const pt = ptOnPolyline([srcPt, { x: S.ghosts[i].cx, y: S.ghosts[i].cy }], p);
        setClass(S.riseTokens[i], "show", true); moveTo(S.riseTokens[i], pt.x, pt.y);
      }
    }

    // ---- results finale (S4 BARS / CHIPS / TAG) ----
    setClass(S.groups.finale, "show", finaleOn);
    for (let i = 0; i < S.finBars.length; i++) {
      const startMs = S4.BARS[0] + i * 430;
      const p = inS4 ? clamp((lt4 - startMs) / 600, 0, 1) : 0;
      S.finBars[i].fill.setAttribute("width", String((S.finBars[i].target * ease(p)).toFixed(1)));
      setClass(S.finBars[i].root, "show", finaleOn && lt4 >= startMs);
    }
    for (let i = 0; i < S.finChips.length; i++) setClass(S.finChips[i], "show", finaleOn && lt4 >= S4.CHIPS[0] + i * 380);
    setClass(S.finTagline, "show", finaleOn && lt4 >= S4.TAG[0]);

    // ---- caption ----
    let cap = "";
    if (inS1) {
      if (lt1 < S1.TERM[0]) cap = "A task is handed to a fresh, stateless Claude (Haiku 4.5) agent.";
      else if (lt1 < S1.POST[0]) cap = "The agent works the task in a terminal — here, exit 0 hid an empty result.";
      else cap = "Each agent posts what it learned — and what misled it — to the task forum.";
    } else if (inS2) {
      if (lt2 < S2.BUBBLES[0]) cap = "Cross-task forum: evidence from sibling tasks is brought together.";
      else if (lt2 < S2.GROUND[0]) cap = "Agents contribute concrete, reusable observations.";
      else cap = "A candidate rule is grounded in evidence shared across tasks.";
    } else if (inS3) {
      if (lt3 < S3.DROP[0]) cap = "The discussion is distilled into one transferable insight.";
      else if (lt3 < S3.ROUNDS_START) cap = "…and written to the knowledge base below.";
      else if (lt3 < S3.SURFACE[0]) cap = "Knowledge from the base is pulled back up — task after task starts solving.";
      else cap = "Generation after generation, the base grows and more tasks fall — 42 / 89 (47.2%).";
    } else {
      if (lt4 < S4.BARS[0]) cap = "The base is left behind — and reused on held-out tasks it never trained on.";
      else if (lt4 < S4.CHIPS[0]) cap = "Same stateless agent, same scaffold — 47.2% on Terminal-Bench 2.";
      else cap = "And the curated knowledge transfers across four benchmarks.";
    }
    if (S.captionEl && S.captionEl.textContent !== cap) S.captionEl.textContent = cap;
  };

  // ====================================================================== Controls
  const ctl = { elapsed: 0, playing: true, speed: 1, currentStage: 0, pinned: null, last: 0, rafId: null, inView: true, reducedMotion: false, userPaused: false };
  let tabs = [], speedBtns = [], playBtn = null, scrub = null, subRow = null, subBuiltStage = -1;
  const syncControls = () => {
    ctl.currentStage = stageAt(ctl.elapsed);
    tabs.forEach((tab, k) => {
      if (!BOUNDS[k]) return;
      const on = k === ctl.currentStage;
      tab.classList.toggle("is-active", on); tab.setAttribute("aria-pressed", on ? "true" : "false");
      const b = BOUNDS[k], p = ctl.elapsed <= b.start ? 0 : ctl.elapsed >= b.end ? 1 : (ctl.elapsed - b.start) / (b.end - b.start);
      const fill = tab.querySelector(".stage-progress > i"); if (fill) fill.style.width = (p * 100).toFixed(1) + "%";
    });
    if (scrub) scrub.value = String(Math.round(ctl.elapsed));
    if (playBtn) { playBtn.textContent = ctl.playing ? "⏸" : "▶"; playBtn.setAttribute("aria-label", ctl.playing ? "Pause" : "Play"); }
    speedBtns.forEach((b) => { const on = Number(b.dataset.speed) === ctl.speed; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    renderSubsteps();
  };
  const renderSubsteps = () => {
    if (!subRow) return;
    const { stage, idx } = subAt(ctl.elapsed);
    if (stage !== subBuiltStage) {
      subBuiltStage = stage;
      while (subRow.firstChild) subRow.removeChild(subRow.firstChild);
      SUBSTEPS[stage].forEach((s) => {
        const chip = document.createElement("button");
        chip.className = "substep-chip"; chip.type = "button";
        const dot = document.createElement("span"); dot.className = "substep-dot";
        chip.appendChild(dot); chip.appendChild(document.createTextNode(s.label));
        chip.addEventListener("click", () => { ctl.pinned = stage; ctl.userPaused = false; seek(BOUNDS[stage].start + s.at); play(); });
        subRow.appendChild(chip);
      });
    }
    const chips = subRow.children;
    for (let i = 0; i < chips.length; i++) { const on = i === idx; chips[i].classList.toggle("is-active", on); chips[i].setAttribute("aria-current", on ? "true" : "false"); }
  };
  const tick = (now) => {
    if (!ctl.playing || !ctl.inView) { ctl.rafId = null; return; }
    const dt = ctl.last ? (now - ctl.last) : 16; ctl.last = now;
    ctl.elapsed += dt * ctl.speed;
    if (ctl.pinned !== null) { const b = BOUNDS[ctl.pinned]; if (ctl.elapsed >= b.end) ctl.elapsed = b.start; }
    else if (ctl.elapsed >= TOTAL_MS) ctl.elapsed = 0;
    render(ctl.elapsed); syncControls();
    ctl.rafId = requestAnimationFrame(tick);
  };
  const play = () => {
    if (ctl.reducedMotion) return;
    if (ctl.pinned !== null && ctl.elapsed >= BOUNDS[ctl.pinned].end) ctl.elapsed = BOUNDS[ctl.pinned].start;
    ctl.playing = true; ctl.userPaused = false; ctl.last = 0;
    if (!ctl.rafId) ctl.rafId = requestAnimationFrame(tick);
    S.host.classList.remove("is-paused"); syncControls();
  };
  const pause = () => { ctl.playing = false; if (ctl.rafId) { cancelAnimationFrame(ctl.rafId); ctl.rafId = null; } S.host.classList.add("is-paused"); syncControls(); };
  const seek = (ms) => { ctl.elapsed = clamp(ms, 0, TOTAL_MS); render(ctl.elapsed); syncControls(); };
  const seekStage = (i) => { ctl.pinned = i; seek(BOUNDS[i].start); if (ctl.reducedMotion) return; play(); };
  const setSpeed = (s) => { ctl.speed = s; syncControls();
    if (ctl.playing && !ctl.rafId && ctl.inView && !ctl.reducedMotion) { ctl.last = 0; ctl.rafId = requestAnimationFrame(tick); } };
  const fastForward = (t) => { pause(); seek(t); };
  const wireControls = (wrap) => {
    tabs = Array.prototype.slice.call(wrap.querySelectorAll(".stage-tab"));
    speedBtns = Array.prototype.slice.call(wrap.querySelectorAll(".stages-speed-btn"));
    playBtn = wrap.querySelector('[data-act="playpause"]');
    const restartBtn = wrap.querySelector('[data-act="restart"]');
    scrub = wrap.querySelector(".stages-scrub");
    if (scrub) { scrub.max = String(TOTAL_MS); scrub.value = "0"; }
    subRow = wrap.querySelector(".stages-substeps");
    tabs.forEach((tab, k) => {
      tab.addEventListener("click", () => seekStage(k));
      tab.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); seekStage(k); } });
    });
    if (playBtn) playBtn.addEventListener("click", () => { if (ctl.playing) { ctl.userPaused = true; pause(); } else play(); });
    if (restartBtn) restartBtn.addEventListener("click", () => { ctl.pinned = null; seek(0); play(); });
    speedBtns.forEach((b) => b.addEventListener("click", () => setSpeed(Number(b.dataset.speed))));
    if (scrub) scrub.addEventListener("input", () => { ctl.pinned = null; ctl.userPaused = true; pause(); seek(Number(scrub.value)); });
  };

  // ====================================================================== Observers + boot
  const setupReducedMotion = () => {
    if (typeof window.matchMedia !== "function") return false;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    ctl.reducedMotion = mq.matches;
    if (mq.addEventListener) mq.addEventListener("change", (e) => { ctl.reducedMotion = e.matches; if (e.matches) { pause(); seek(TOTAL_MS - 1); } else play(); });
    return mq.matches;
  };
  const setupInView = () => {
    if (typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver((entries) => { for (const e of entries) { ctl.inView = e.isIntersecting; if (ctl.reducedMotion || ctl.userPaused) return; if (e.isIntersecting && ctl.playing && !ctl.rafId) { ctl.last = 0; ctl.rafId = requestAnimationFrame(tick); } } }, { threshold: 0.05 });
    io.observe(S.host);
  };
  const boot = () => {
    S.host = document.getElementById("stages-anim");
    if (!S.host) return;
    S.svg = buildSVG(); S.host.appendChild(S.svg);
    const wrap = S.host.closest(".stages-wrap") || S.host.parentNode;
    S.captionEl = wrap.querySelector(".stages-caption");
    wireControls(wrap);
    S.host.addEventListener("click", () => { if (ctl.playing) { ctl.userPaused = true; pause(); } else play(); });
    if (setupReducedMotion()) { seek(TOTAL_MS - 1); ctl.playing = false; S.host.classList.add("reduced-motion"); syncControls(); }
    else { render(0); syncControls(); setupInView(); ctl.rafId = requestAnimationFrame(tick); }
    window.__STAGES_ANIM = { fastForward, seekStage, seek, setSpeed, play, pause, stageBounds, total: TOTAL_MS, finalMs: TOTAL_MS, state: ctl };
    console.log("[stages-anim] boot complete (flywheel 4-stage controller v3)");
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
