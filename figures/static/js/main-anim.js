/* KCSI animated main figure — three-act protocol walkthrough.
 *
 *   Act 1 (~14s)  Zoom into Generation 8: a stateless agent reads the
 *                 prior bundle, runs compile-compcert, per-task forum
 *                 extracts evidence, cross-task forum brings in
 *                 polyglot-c-py / polyglot-rust-c, distillation
 *                 produces a new typed bundle row.
 *   Act 2 (~12s)  Ten-generation accumulation timelapse. The montage
 *                 pauses on four milestone gens (G1, G4, G7, G8) to show
 *                 their real star insight; the others tick fast. The
 *                 bundle grows, the 89-cell grid fills to 42, the
 *                 compile-compcert tracker flips ✗→✓ at G8.
 *   Act 3 (~6s)   Final results: TB2 bar chart vs OpenHands / Terminus /
 *                 Mini-SWE-Agent, efficiency chips for SWE-bench Pro /
 *                 ARC-AGI-1 / Polyglot, tagline.
 *
 * All quoted insight text and evidence is verbatim from the run's
 * knowledge.json + the hand-curated PINNED_PER_GEN map in
 * scripts/build_tb2_dashboard.py.
 *
 * Pure vanilla JS + inline SVG. No external animation library. Honors
 * prefers-reduced-motion (renders final frame only). Pause-on-hover,
 * click-to-toggle, IntersectionObserver pauses when out of view.
 */
(function () {
  "use strict";

  // ====================================================================== Layout
  const VBW = 960, VBH = 540;
  const STAGE_Y    = 68;
  const STAGE_H    = 330;
  const STRIP_Y    = 408;
  const STRIP_H    = 24;
  const FOOTER_Y   = 446;
  const FOOTER_H   = 88;

  const BUNDLE = { x: 740, y: STAGE_Y, w: 196, h: STAGE_H };
  const STAGE  = { x: 36,  y: STAGE_Y, w: 680, h: STAGE_H };

  // ====================================================================== TB2 data
  const TOTAL_TASKS = 89;
  const TB2_GENS = [
    { gen: 1,  delta: 19, cumulative: 19 },
    { gen: 2,  delta: 5,  cumulative: 24 },
    { gen: 3,  delta: 5,  cumulative: 29 },
    { gen: 4,  delta: 4,  cumulative: 33 },
    { gen: 5,  delta: 4,  cumulative: 37 },
    { gen: 6,  delta: 0,  cumulative: 37 },
    { gen: 7,  delta: 3,  cumulative: 40 },
    { gen: 8,  delta: 1,  cumulative: 41 },
    { gen: 9,  delta: 1,  cumulative: 42 },
    { gen: 10, delta: 0,  cumulative: 42 },
  ];

  // Star insights per generation, lifted from PINNED_PER_GEN.caption,
  // trimmed to one short sentence each. Shown for the milestone gens.
  const STAR_INSIGHTS = [
    { gen: 1,  text: "Clean exit codes do not equal correctness — debug schemas and artifacts, not logic." },
    { gen: 2,  text: "Before submitting, invoke a domain-specific oracle: chess.legal_moves, FPBase, biochem validators." },
    { gen: 3,  text: "Multi-phase compilers interleave streams — capture both with make 2>&1 | tee build.log." },
    { gen: 4,  text: "Read the tests as spec — grep /tests/ before writing any solution code." },
    { gen: 5,  text: "Three zero exit codes plus reward 0 means schema mismatch, not a runtime crash." },
    { gen: 6,  text: "Modifying state without re-querying produces stale reads — invalidate caches after writes." },
    { gen: 7,  text: "Run the verifier yourself — execute its checks locally before submitting." },
    { gen: 8,  text: "Cross-compilation needs shared-subset grammar — C89-only, no language-specific keywords." },
    { gen: 9,  text: "Hardcoded fixture paths are gate-keepers — character-for-character precision required." },
    { gen: 10, text: "The same failure across 5+ gens means a missing diagnostic step, not a wrong algorithm." },
  ];
  const MILESTONES = [1, 4, 7, 8];   // gens the Act 2 montage pauses on

  // Act 1 — the G8 walkthrough payload. All text is real run data.
  const ACT1 = {
    featureGen: 8,
    preCumulative: 40,    // cumulative through G7
    postCumulative: 41,   // after compile-compcert solves at G8
    bundleReadCard: {
      label: "Bundle insight from G7",
      text:  "Run the verifier yourself — run its checks locally before submitting.",
    },
    trace: [
      "$ cat /tests/test.sh",
      "$ make compcert && bash /tests/test.sh",
      "verifier_exit=0   reward=1.0   ✓",
    ],
    perTaskBullets: [
      "Building the CompCert binary alone never satisfied the verifier — test.sh defines acceptance.",
      "Reading and running test.sh first unblocks the path-and-invocation mismatch.",
    ],
    forumBubbles: [
      { task: "polyglot-c-py",    post: 2260, quote: "int, long, for, if, return only — exclude Python keywords (def, class, import)." },
      { task: "polyglot-rust-c",  post: 2546, quote: "extern \"C\" { fn fibonacci(n: c_long) -> c_long; } links Rust to C objects." },
      { task: "compile-compcert", post: 1206, quote: "Mixing Python multiline strings with C preprocessor directives breaks the C89 subset." },
    ],
    distilled: {
      meta: "transferable insight · high confidence · 3 evidence posts",
      text: "Cross-compilation and polyglot tasks require a shared-subset grammar: C89-compatible constructs only (int, long, for, if, return, printf/scanf), excluding language-specific reserved words.",
      transfer: "Synthesized from polyglot-c-py + polyglot-rust-c — and read by compile-compcert, which solves this generation.",
    },
  };

  // Act 3 — final-results numbers (verbatim from the landing page copy).
  const TB2_BASELINES = [
    { label: "OpenHands",      value: 13.9 },
    { label: "Terminus",       value: 28.3 },
    { label: "Mini-SWE-Agent", value: 29.8 },
    { label: "KCSI (ours)",    value: 47.2, accent: true },
  ];
  const EFFICIENCY_CHIPS = [
    { bench: "SWE-bench Pro", value: "84%", cost: "$76 / task",
      compare: "vs HyperAgents 42% at $276 — ~6× cheaper" },
    { bench: "ARC-AGI-1",     value: "82%", cost: "$46 / task" },
    { bench: "Polyglot",      value: "80%", cost: "$92 / task" },
  ];

  // ====================================================================== Timeline
  const ACT1_END = 14000;

  // Act 1 scene boundaries (relative to t=0)
  const A1 = {
    TITLE:     [0,     800],
    AGENT:     [800,   2300],
    TRACE:     [2300,  4000],
    SOLVE:     [4000,  5000],
    PERTASK:   [5000,  6800],
    CROSSTASK: [6800,  9000],
    DISTILL:   [9000, 11500],
    BUNDLE:    [11500, 13000],
    HANDOFF:   [13000, ACT1_END],
  };
  const A1_SOLVE_TICK = 4400;   // when the header solve count bumps 40→41

  // Act 2 — variable per-gen dwell; pause on milestones.
  const A2_LEADIN = 600;        // rewind beat before the montage
  const A2_DWELL  = TB2_GENS.map((g) => MILESTONES.includes(g.gen) ? 2000 : 450);
  const A2_START  = [];
  {
    let acc = A2_LEADIN;
    for (let i = 0; i < 10; i++) { A2_START[i] = acc; acc += A2_DWELL[i]; }
    var ACT2_DUR = acc + 300;   // small tail pad
  }
  const ACT2_END = ACT1_END + ACT2_DUR;
  const ACT3_DUR = 6000;
  const ACT3_END = ACT2_END + ACT3_DUR;
  const TAIL_MS  = 900;
  const TOTAL_MS = ACT3_END + TAIL_MS;

  /** Within Act 2 (local time), which gen are we on and how far through. */
  const a2GenAt = (local) => {
    if (local < A2_LEADIN) return { idx: -1, p: 0, leadin: true };
    for (let i = 9; i >= 0; i--) {
      if (local >= A2_START[i]) return { idx: i, p: clamp((local - A2_START[i]) / A2_DWELL[i], 0, 1), leadin: false };
    }
    return { idx: 0, p: 0, leadin: false };
  };

  // ====================================================================== SVG helpers
  const SVGNS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs = {}, ...children) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      n.setAttribute(k, String(v));
    }
    for (const c of children) {
      if (c == null) continue;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ease  = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const inRange = (t, [a, b]) => t >= a && t < b;

  // Conservative per-character width as a fraction of font size (slightly
  // over-estimates so wrapped text under-fills its box rather than overflows).
  const CHAR_W = { serif: 0.55, sans: 0.56, mono: 0.62 };
  const estW = (text, fontPx, kind = "serif") => String(text).length * fontPx * (CHAR_W[kind] || 0.56);
  /** Greedy word-wrap to a pixel budget; returns an array of lines. */
  const wrapToWidth = (text, maxPx, fontPx, kind = "serif") => {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      const trial = line ? line + " " + w : w;
      if (line && estW(trial, fontPx, kind) > maxPx) { lines.push(line); line = w; }
      else line = trial;
    }
    if (line) lines.push(line);
    return lines;
  };
  /** Append wrapped <text> lines into parent; returns the y after the last line. */
  const addWrapped = (parent, text, x, y, maxPx, fontPx, lineH, cls, kind = "serif") => {
    const lines = wrapToWidth(text, maxPx, fontPx, kind);
    let ly = y;
    for (const ln of lines) { parent.appendChild(svgEl("text", { x, y: ly, class: cls }, ln)); ly += lineH; }
    return { bottom: ly - lineH, nLines: lines.length };
  };

  // ====================================================================== State
  const state = {
    host: null, svg: null, groups: {},
    headerGen: null, headerSolved: null, headerPct: null, headerTask: null,
    bundleLayers: [], bundleCount: null,
    cells: [], compcertMarks: [],
    act3Bars: [], act3Chips: [], act3Tagline: null,
    act1Agent: null, act1Read: null, act1Trace: null, act1Evidence: null,
    act1Forum: null, act1Distilled: null, act1Handoff: null,
    act2Cards: {},        // gen -> milestone card group
    act2Rewind: null,
    sparkPath: null, sparkCursor: null, sparkFZ: null,
    captionText: null, timelineDots: [],
    startedAt: 0, paused: false, pauseOffset: 0,
    inView: true, rafId: null, reducedMotion: false,
  };
  const setClass = (el, name, on) => { if (el) el.classList.toggle(name, !!on); };

  // ====================================================================== Builders
  const buildHeader = (svg) => {
    const g = svgEl("g", { class: "anim-header" });
    state.headerGen = svgEl("text", { x: 36, y: 32, class: "anim-header-gen" }, "Generation 1 of 10");
    state.headerTask = svgEl("text", { x: 232, y: 32, class: "anim-header-task" }, "");
    state.headerSolved = svgEl("text", { x: VBW - 36, y: 32, "text-anchor": "end", class: "anim-header-solved" }, "Solved 0 / 89");
    state.headerPct = svgEl("text", { x: VBW - 36, y: 48, "text-anchor": "end", class: "anim-header-pct" }, "0.0%");
    g.appendChild(svgEl("text", { x: 36, y: 48, class: "anim-header-bench" }, "Terminal-Bench 2 · 89 tasks · stateless Haiku 4.5 agent"));
    g.appendChild(state.headerGen);
    g.appendChild(state.headerTask);
    g.appendChild(state.headerSolved);
    g.appendChild(state.headerPct);
    svg.appendChild(g);
    state.groups.header = g;
  };

  const buildCaption = (svg) => {
    const g = svgEl("g", { class: "anim-captions" });
    state.captionText = svgEl("text", { x: VBW / 2, y: 80, "text-anchor": "middle", class: "anim-caption" }, "");
    g.appendChild(state.captionText);
    svg.appendChild(g);
  };

  const buildBundle = (svg) => {
    const g = svgEl("g", { class: "anim-bundle" });
    g.appendChild(svgEl("rect", { x: BUNDLE.x, y: BUNDLE.y + 12, width: BUNDLE.w, height: BUNDLE.h - 18, rx: 10, class: "anim-bundle-frame" }));
    g.appendChild(svgEl("rect", { x: BUNDLE.x + BUNDLE.w / 2 - 28, y: BUNDLE.y, width: 56, height: 14, rx: 3, class: "anim-bundle-tab" }));
    state.bundleCount = svgEl("text", { x: BUNDLE.x + BUNDLE.w / 2, y: BUNDLE.y + 32, "text-anchor": "middle", class: "anim-bundle-count" }, "BUNDLE · 0 LAYERS");
    g.appendChild(state.bundleCount);
    const layerH = 22, layerGap = 4;
    const layersStartY = BUNDLE.y + BUNDLE.h - 24;
    for (let i = 0; i < 10; i++) {
      const y = layersStartY - i * (layerH + layerGap);
      const layer = svgEl("g", { class: "anim-bundle-layer", "data-gen": i + 1 });
      layer.appendChild(svgEl("rect", { x: BUNDLE.x + 14, y, width: BUNDLE.w - 28, height: layerH, rx: 4, class: "anim-bundle-layer-rect" }));
      layer.appendChild(svgEl("text", { x: BUNDLE.x + 22, y: y + 14, class: "anim-bundle-layer-tag" }, `G${i + 1}`));
      state.bundleLayers.push(layer);
      g.appendChild(layer);
    }
    svg.appendChild(g);
    state.groups.bundle = g;
  };

  // 89-cell task grid (upper region of the stage; prominent in Act 2)
  const buildGrid = (svg) => {
    const gZ = { x: STAGE.x + 8, y: STAGE.y + 30, w: STAGE.w - 16, h: 168 };
    const g = svgEl("g", { class: "anim-grid" });
    g.appendChild(svgEl("text", { x: gZ.x, y: gZ.y - 12, class: "anim-zone-label" }, "89 TASKS · CUMULATIVE SOLVES"));
    const cols = 12, rows = 8;
    const cellW = (gZ.w - 6) / cols, cellH = (gZ.h - 6) / rows;
    for (let i = 0; i < TOTAL_TASKS; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const cell = svgEl("rect", {
        x: gZ.x + c * cellW, y: gZ.y + r * cellH,
        width: cellW - 4, height: cellH - 4, rx: 3,
        class: "anim-task-cell", "data-i": i,
      });
      state.cells.push(cell);
      g.appendChild(cell);
    }
    svg.appendChild(g);
    state.groups.grid = g;
  };

  const buildCompcertStrip = (svg) => {
    const g = svgEl("g", { class: "compcert-strip" });
    g.appendChild(svgEl("rect", { x: 0, y: STRIP_Y - 2, width: VBW, height: STRIP_H + 4, class: "compcert-strip-bg" }));
    g.appendChild(svgEl("text", { x: 36, y: STRIP_Y + 16, class: "compcert-strip-label" }, "compile-compcert  ·  per-generation status:"));
    const dotsStart = 360, dotW = 36;
    for (let i = 0; i < 10; i++) {
      const x = dotsStart + i * dotW;
      const mark = svgEl("g", { class: "compcert-mark", "data-gen": i + 1, transform: `translate(${x}, ${STRIP_Y + 16})` });
      const glyph = svgEl("text", { class: "compcert-mark-glyph" }, i < 7 ? "✗" : "·");
      mark.appendChild(glyph);
      mark.glyphNode = glyph;
      mark.appendChild(svgEl("text", { y: 14, "text-anchor": "middle", class: "compcert-mark-gen" }, `G${i + 1}`));
      state.compcertMarks.push(mark);
      g.appendChild(mark);
    }
    svg.appendChild(g);
    state.groups.compcert = g;
  };

  const buildSparkline = (svg) => {
    const fZ = { x: 36, y: FOOTER_Y, w: VBW - 72, h: FOOTER_H };
    const g = svgEl("g", { class: "anim-footer" });
    g.appendChild(svgEl("text", { x: fZ.x, y: fZ.y + 14, class: "anim-zone-label" }, "CUMULATIVE SOLVES PER GENERATION"));
    g.appendChild(svgEl("line", { x1: fZ.x, y1: fZ.y + 70, x2: fZ.x + fZ.w, y2: fZ.y + 70, class: "anim-timeline-baseline" }));
    const tickSpacing = fZ.w / 9;
    // Sparkline y-scale: max cumulative is 42 / 89; scaling vs the full 89 makes
    // the climb visually flat. Use a tight upper bound (max + small headroom)
    // so the 19→42 climb traverses most of the 44 px chart height.
    const SPARK_Y_MAX = 45;
    const SPARK_BASE_Y = fZ.y + 64;   // y for cum = 0 (baseline)
    const SPARK_RANGE  = 44;          // px from baseline to top of climb area
    const cumY = (cum) => SPARK_BASE_Y - (cum / SPARK_Y_MAX) * SPARK_RANGE;
    state.sparkPts = [];
    for (let i = 0; i < 10; i++) {
      const cx = fZ.x + i * tickSpacing;
      const dot = svgEl("circle", { cx, cy: fZ.y + 70, r: 4, class: "anim-timeline-dot", "data-gen": i + 1 });
      state.timelineDots.push(dot);
      g.appendChild(dot);
      g.appendChild(svgEl("text", { x: cx, y: fZ.y + 86, "text-anchor": "middle", class: "anim-timeline-label" }, `G${i + 1}`));
      state.sparkPts.push({ x: cx, y: cumY(TB2_GENS[i].cumulative) });
    }
    // The path is redrawn each frame up to the current gen (rasterizer-proof;
    // no reliance on pathLength / dash-offset reveal).
    state.sparkPath = svgEl("path", { d: "", class: "anim-sparkline" });
    g.appendChild(state.sparkPath);
    state.sparkCursor = svgEl("circle", { cx: fZ.x, cy: cumY(TB2_GENS[0].cumulative), r: 5, class: "anim-sparkline-cursor" });
    g.appendChild(state.sparkCursor);
    svg.appendChild(g);
    state.groups.footer = g;
    state.sparkFZ = fZ;
  };

  // ============================================================ Act 1 stage
  const buildAct1 = (svg) => {
    const g = svgEl("g", { class: "act1" });
    const ax = STAGE.x + 50, ay = STAGE.y + 70;

    // agent glyph (persistent through Act 1)
    const agentG = svgEl("g", { class: "act1-agent" });
    agentG.appendChild(svgEl("rect", { x: ax - 22, y: ay - 8, width: 44, height: 32, rx: 8, class: "act1-agent-body" }));
    agentG.appendChild(svgEl("circle", { cx: ax, cy: ay - 18, r: 10, class: "act1-agent-head" }));
    agentG.appendChild(svgEl("circle", { cx: ax, cy: ay - 30, r: 2, class: "act1-agent-dot" }));
    agentG.appendChild(svgEl("text", { x: ax, y: ay + 44, "text-anchor": "middle", class: "act1-agent-label" }, "Stateless agent"));
    state.act1Agent = agentG;
    g.appendChild(agentG);

    // "reads bundle" group: arrow + label + read-card (shown only AGENT..TRACE)
    const readG = svgEl("g", { class: "act1-read" });
    readG.appendChild(svgEl("path", { d: `M ${ax + 26} ${ay + 4} Q ${ax + 110} ${ay - 20} ${ax + 220} ${ay - 6}`, class: "act1-read-arrow", "marker-end": "url(#act1-arrow-head)" }));
    readG.appendChild(svgEl("text", { x: ax + 120, y: ay - 30, "text-anchor": "middle", class: "act1-arrow-label" }, "reads bundle"));
    const cardX = ax + 86, cardY = ay - 6, cardW = 252;
    const rcLines = wrapToWidth(ACT1.bundleReadCard.text, cardW - 24, 13, "mono");
    const cardH = 24 + rcLines.length * 15 + 8;
    readG.appendChild(svgEl("rect", { x: cardX, y: cardY, width: cardW, height: cardH, rx: 6, class: "act1-card-bg" }));
    readG.appendChild(svgEl("text", { x: cardX + 12, y: cardY + 17, class: "act1-card-tag" }, ACT1.bundleReadCard.label.toUpperCase()));
    let ry = cardY + 34;
    for (const ln of rcLines) { readG.appendChild(svgEl("text", { x: cardX + 12, y: ry, class: "act1-card-text-mono" }, ln)); ry += 15; }
    state.act1Read = readG;
    g.appendChild(readG);

    // Shared stage band for the swapping scene cards
    const sx = STAGE.x + 36, sw = 552, sy = STAGE.y + 150;

    // Trace card (terminal)
    const traceG = svgEl("g", { class: "act1-trace" });
    const th = 108;
    traceG.appendChild(svgEl("rect", { x: sx, y: sy, width: sw, height: th, rx: 8, class: "act1-trace-bg" }));
    traceG.appendChild(svgEl("text", { x: sx + 14, y: sy + 22, class: "act1-card-tag" }, "G8 AGENT TRACE · compile-compcert"));
    for (let i = 0; i < ACT1.trace.length; i++) {
      traceG.appendChild(svgEl("text", { x: sx + 14, y: sy + 48 + i * 22, class: "act1-trace-line", "data-i": i }, ACT1.trace[i]));
    }
    state.act1Trace = traceG;
    g.appendChild(traceG);

    // Per-task evidence card
    const evG = svgEl("g", { class: "act1-evidence" });
    const evLineSets = ACT1.perTaskBullets.map((b) => wrapToWidth(b, sw - 70, 12.5, "serif"));
    const evH = 30 + evLineSets.reduce((a, ls) => a + Math.max(ls.length, 1) * 15 + 10, 0) + 8;
    evG.appendChild(svgEl("rect", { x: sx, y: sy, width: sw, height: evH, rx: 8, class: "act1-card-bg-alt" }));
    evG.appendChild(svgEl("text", { x: sx + 14, y: sy + 22, class: "act1-card-tag" }, "PER-TASK FORUM · evidence from this trace"));
    let ey = sy + 44;
    for (let i = 0; i < evLineSets.length; i++) {
      const bullet = svgEl("g", { class: "act1-evidence-bullet", "data-i": i });
      bullet.appendChild(svgEl("circle", { cx: sx + 24, cy: ey - 4, r: 3, class: "act1-bullet-dot" }));
      let by = ey;
      for (const ln of evLineSets[i]) { bullet.appendChild(svgEl("text", { x: sx + 38, y: by, class: "act1-bullet-text" }, ln)); by += 15; }
      evG.appendChild(bullet);
      ey = by + 10;
    }
    state.act1Evidence = evG;
    g.appendChild(evG);

    // Cross-task forum bubbles
    const fmG = svgEl("g", { class: "act1-forum" });
    fmG.appendChild(svgEl("text", { x: sx + 2, y: sy + 6, class: "act1-card-tag" }, "CROSS-TASK FORUM · 3 sibling tasks ground the rule"));
    const bubbleW = 178, gap = 11, by0 = sy + 20;
    let maxBubbleH = 0;
    const bubbleData = ACT1.forumBubbles.map((b) => {
      const lines = wrapToWidth("“" + b.quote + "”", bubbleW - 24, 11, "serif");
      const h = 42 + lines.length * 14 + 10;
      maxBubbleH = Math.max(maxBubbleH, h);
      return { ...b, lines };
    });
    for (let i = 0; i < bubbleData.length; i++) {
      const b = bubbleData[i];
      const bx = sx + i * (bubbleW + gap);
      const bub = svgEl("g", { class: "act1-forum-bubble", "data-i": i });
      bub.appendChild(svgEl("rect", { x: bx, y: by0, width: bubbleW, height: maxBubbleH, rx: 8, class: "act1-bubble-bg" }));
      bub.appendChild(svgEl("text", { x: bx + 12, y: by0 + 18, class: "act1-bubble-task" }, b.task));
      bub.appendChild(svgEl("text", { x: bx + bubbleW - 12, y: by0 + 33, "text-anchor": "end", class: "act1-bubble-post" }, `post ${b.post}`));
      let qy = by0 + 40;
      for (const ln of b.lines) { bub.appendChild(svgEl("text", { x: bx + 12, y: qy, class: "act1-bubble-quote" }, ln)); qy += 14; }
      fmG.appendChild(bub);
    }
    state.act1Forum = fmG;
    g.appendChild(fmG);

    // Distilled typed-bundle row card
    const dG = svgEl("g", { class: "act1-distilled" });
    const dLines = wrapToWidth("“" + ACT1.distilled.text + "”", sw - 28, 13.5, "serif");
    const tLines = wrapToWidth(ACT1.distilled.transfer, sw - 40, 11, "sans");
    const dH = 60 + dLines.length * 18 + 6 + tLines.length * 14 + 12;
    dG.appendChild(svgEl("rect", { x: sx, y: sy, width: sw, height: dH, rx: 8, class: "act1-distilled-bg" }));
    dG.appendChild(svgEl("text", { x: sx + 14, y: sy + 22, class: "act1-card-tag-strong" }, "DISTILLED · NEW TYPED BUNDLE ROW"));
    dG.appendChild(svgEl("text", { x: sx + 14, y: sy + 40, class: "act1-distilled-meta" }, ACT1.distilled.meta));
    let dy = sy + 60;
    for (const ln of dLines) { dG.appendChild(svgEl("text", { x: sx + 14, y: dy, class: "act1-distilled-text" }, ln)); dy += 18; }
    dy += 8;
    tLines.forEach((ln, i) => {
      dG.appendChild(svgEl("text", { x: sx + 26, y: dy, class: "act1-distilled-transfer" }, (i === 0 ? "↳ " : "   ") + ln));
      dy += 14;
    });
    state.act1Distilled = dG;
    g.appendChild(dG);

    // Handoff arrow ("read by every G9 agent")
    const hG = svgEl("g", { class: "act1-handoff" });
    hG.appendChild(svgEl("path", { d: `M ${BUNDLE.x + BUNDLE.w / 2} ${BUNDLE.y + BUNDLE.h + 6} L ${BUNDLE.x + BUNDLE.w / 2} ${BUNDLE.y + BUNDLE.h + 20}`, class: "act1-handoff-arrow", "marker-end": "url(#act1-arrow-head)" }));
    hG.appendChild(svgEl("text", { x: BUNDLE.x + BUNDLE.w / 2, y: BUNDLE.y + BUNDLE.h + 36, "text-anchor": "middle", class: "act1-handoff-label" }, "read by every G9 agent →"));
    state.act1Handoff = hG;
    g.appendChild(hG);

    svg.appendChild(g);
    state.groups.act1 = g;
  };

  // ============================================================ Act 2 milestone cards
  const buildAct2 = (svg) => {
    const g = svgEl("g", { class: "act2" });

    // Rewind cue (shown during the lead-in beat) — sits in the clear band
    // below the (empty) grid so it never overlaps the cells.
    state.act2Rewind = svgEl("text", { x: VBW / 2, y: STAGE.y + 272, "text-anchor": "middle", class: "act2-rewind" }, "↺ replaying all ten generations");
    g.appendChild(state.act2Rewind);

    // Cross-task provenance per milestone (verified against the run's evidence).
    const A2_TRANSFER = {
      1: "from path-tracing + pytorch-model-cli (solves at G3)",
      4: "from 7 tasks; query-optimize + openssl go on to solve at G7",
      7: "from mteb-retrieve + db-wal-recovery",
      8: "from polyglot-c-py + polyglot-rust-c → compile-compcert solves",
    };
    // One milestone card per milestone gen, all in the same reserved band.
    const cardW = 560, cardX = STAGE.x + STAGE.w / 2 - cardW / 2, cardY = STAGE.y + 208;
    for (const gen of MILESTONES) {
      const insight = STAR_INSIGHTS[gen - 1].text;
      const lines = wrapToWidth(insight, cardW - 36, 14, "serif");
      const xfer = A2_TRANSFER[gen];
      const xLines = xfer ? wrapToWidth(xfer, cardW - 52, 11, "sans") : [];
      const cardH = 34 + lines.length * 18 + (xLines.length ? 6 + xLines.length * 14 : 0) + 12;
      const card = svgEl("g", { class: "act2-card", "data-gen": gen });
      card.appendChild(svgEl("rect", { x: cardX, y: cardY, width: cardW, height: cardH, rx: 8, class: "act2-card-bg" }));
      card.appendChild(svgEl("text", { x: cardX + 18, y: cardY + 20, class: "act2-card-tag" }, `GEN ${gen} · STAR INSIGHT`));
      let ly = cardY + 40;
      for (const ln of lines) { card.appendChild(svgEl("text", { x: cardX + 18, y: ly, class: "act2-card-text" }, ln)); ly += 18; }
      ly += 6;
      xLines.forEach((ln, i) => {
        card.appendChild(svgEl("text", { x: cardX + 26, y: ly, class: "act2-card-transfer" }, (i === 0 ? "↳ " : "   ") + ln));
        ly += 14;
      });
      g.appendChild(card);
      state.act2Cards[gen] = card;
    }
    svg.appendChild(g);
    state.groups.act2 = g;
  };

  // ============================================================ Act 3 bars + chips
  const buildAct3 = (svg) => {
    const g = svgEl("g", { class: "act3" });

    // Solve-rate bar chart (left)
    const barsG = svgEl("g", { class: "act3-bars" });
    const bx = 60, by = STAGE.y + 56, bw = 440, rowH = 52, barX = bx + 130, barMaxW = 232;
    barsG.appendChild(svgEl("text", { x: bx, y: by - 16, class: "act3-section-label" }, "TERMINAL-BENCH 2 SOLVE RATE · SAME BACKBONE"));
    for (let i = 0; i < TB2_BASELINES.length; i++) {
      const b = TB2_BASELINES[i];
      const y = by + i * rowH;
      const bar = svgEl("g", { class: "act3-bar", "data-i": i, "data-accent": b.accent ? "1" : "0" });
      bar.appendChild(svgEl("text", { x: bx, y: y + 15, class: "act3-bar-label" }, b.label));
      bar.appendChild(svgEl("rect", { x: barX, y: y + 2, width: barMaxW, height: 22, rx: 4, class: "act3-bar-bg" }));
      const fullW = (barMaxW * b.value) / 50;   // 50% scale max
      const fill = svgEl("rect", { x: barX, y: y + 2, width: 0, height: 22, rx: 4, class: "act3-bar-fill" });
      bar.appendChild(fill);
      bar.appendChild(svgEl("text", { x: bx + bw, y: y + 18, "text-anchor": "end", class: "act3-bar-value" }, `${b.value.toFixed(1)}%`));
      barsG.appendChild(bar);
      state.act3Bars.push({ root: bar, fill, target: fullW });
    }
    g.appendChild(barsG);
    state.groups.act3Bars = barsG;

    // Efficiency chips (right)
    const chipsG = svgEl("g", { class: "act3-chips" });
    const cx0 = 530, cy0 = STAGE.y + 56, chipW = 388, chipH = 64, gap = 13;
    chipsG.appendChild(svgEl("text", { x: cx0, y: cy0 - 16, class: "act3-section-label" }, "TRANSFER ACROSS BENCHMARKS · HAIKU 4.5"));
    for (let i = 0; i < EFFICIENCY_CHIPS.length; i++) {
      const c = EFFICIENCY_CHIPS[i];
      const y = cy0 + i * (chipH + gap);
      const chip = svgEl("g", { class: "act3-chip", "data-i": i });
      chip.appendChild(svgEl("rect", { x: cx0, y, width: chipW, height: chipH, rx: 8, class: "act3-chip-bg" }));
      chip.appendChild(svgEl("text", { x: cx0 + 16, y: y + 24, class: "act3-chip-bench" }, c.bench));
      chip.appendChild(svgEl("text", { x: cx0 + 16, y: y + 44, class: "act3-chip-cost" }, c.cost));
      chip.appendChild(svgEl("text", { x: cx0 + chipW - 16, y: y + 32, "text-anchor": "end", class: "act3-chip-value" }, c.value));
      if (c.compare) chip.appendChild(svgEl("text", { x: cx0 + 16, y: y + 58, class: "act3-chip-compare" }, c.compare));
      chipsG.appendChild(chip);
      state.act3Chips.push(chip);
    }
    g.appendChild(chipsG);
    state.groups.act3Chips = chipsG;

    state.act3Tagline = svgEl("text", { x: VBW / 2, y: STAGE.y + STAGE.h - 14, "text-anchor": "middle", class: "act3-tagline" }, "Same protocol. Same stateless agent. Four benchmarks.");
    g.appendChild(state.act3Tagline);

    svg.appendChild(g);
    state.groups.act3 = g;
  };

  const buildDefs = (svg) => {
    const defs = svgEl("defs");
    const marker = svgEl("marker", { id: "act1-arrow-head", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" });
    marker.appendChild(svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", class: "act1-arrow-marker" }));
    defs.appendChild(marker);
    svg.appendChild(defs);
  };

  const buildSVG = () => {
    const svg = svgEl("svg", {
      class: "main-anim-svg", viewBox: `0 0 ${VBW} ${VBH}`,
      role: "img", "aria-labelledby": "main-anim-title", "aria-describedby": "main-anim-desc",
      preserveAspectRatio: "xMidYMid meet",
    });
    svg.appendChild(svgEl("title", { id: "main-anim-title" }, "Knowledge-centric self-improvement protocol — animated three-act walkthrough"));
    buildDefs(svg);
    buildHeader(svg);
    buildCaption(svg);
    buildGrid(svg);
    buildBundle(svg);
    buildCompcertStrip(svg);
    buildSparkline(svg);
    buildAct2(svg);
    buildAct1(svg);
    buildAct3(svg);
    return svg;
  };

  // ====================================================================== Derived state
  const cumulativeAt = (t) => {
    if (t < ACT1_END) return t < A1_SOLVE_TICK ? ACT1.preCumulative : ACT1.postCumulative;
    if (t < ACT2_END) {
      const { idx, p, leadin } = a2GenAt(t - ACT1_END);
      if (leadin || idx < 0) return 0;
      const prev = idx === 0 ? 0 : TB2_GENS[idx - 1].cumulative;
      return Math.round(prev + ease(p) * (TB2_GENS[idx].cumulative - prev));
    }
    return TB2_GENS[9].cumulative;
  };
  const genIdxAt = (t) => {
    if (t < ACT1_END) return ACT1.featureGen - 1;       // 7 (G8)
    if (t < ACT2_END) { const { idx, leadin } = a2GenAt(t - ACT1_END); return leadin ? 0 : idx; }
    return 9;
  };

  // ====================================================================== Render
  const render = (t) => {
    const inAct1 = t < ACT1_END;
    const inAct2 = t >= ACT1_END && t < ACT2_END;
    const inAct3 = t >= ACT2_END;
    const a2 = inAct2 ? a2GenAt(t - ACT1_END) : null;

    const genIdx = genIdxAt(t);
    const gen    = genIdx + 1;
    const solved = cumulativeAt(t);
    const pct    = (solved / TOTAL_TASKS) * 100;

    // Header
    state.headerGen.textContent    = `Generation ${gen} of 10`;
    state.headerSolved.textContent = `Solved ${solved} / ${TOTAL_TASKS}`;
    state.headerPct.textContent    = `${pct.toFixed(1)}%`;
    state.headerTask.textContent   = inAct1 ? "· compile-compcert" : "";

    // Caption
    let cap = "";
    if (inAct1) {
      if      (inRange(t, A1.TITLE))     cap = "Generation 8. compile-compcert: stuck for seven generations.";
      else if (inRange(t, A1.AGENT))     cap = "Same generic agent. It reads — but does not modify — the bundle.";
      else if (inRange(t, A1.TRACE))     cap = "Tries: read /tests/test.sh, run it locally, verify the binary path.";
      else if (inRange(t, A1.SOLVE))     cap = "Reward 1.0. compile-compcert unlocked after seven failed gens.";
      else if (inRange(t, A1.PERTASK))   cap = "Per-task forum: structure the evidence — what worked, what misled.";
      else if (inRange(t, A1.CROSSTASK)) cap = "Cross-task forum: 3 sibling tasks bring evidence. Concrete claims only.";
      else if (inRange(t, A1.DISTILL))   cap = "Distillation: one typed rule — confidence-tagged, evidence-pointed.";
      else if (inRange(t, A1.BUNDLE))    cap = "Bundle gains an 8th layer. The agent stayed generic; the bundle improved.";
      else if (inRange(t, A1.HANDOFF))   cap = "Now read-only context for every G9 agent.";
    } else if (inAct2) {
      cap = a2.leadin ? "" : "Ten generations. Agents stay generic. The bundle does the work.";
    } else {
      cap = "47.2% on TB2 · 84% SWE-bench Pro at $76/task — same agent, four benchmarks.";
    }
    state.captionText.textContent = cap;
    setClass(state.captionText, "show", !!cap);

    // ---- Act 1 surfaces
    setClass(state.groups.act1, "show", inAct1);
    setClass(state.act1Agent, "show", inAct1 && t >= A1.AGENT[0]);
    setClass(state.act1Read,  "show", inAct1 && t >= A1.AGENT[0] && t < A1.PERTASK[0]);
    setClass(state.act1Trace, "show", inAct1 && t >= A1.TRACE[0] && t < A1.PERTASK[0]);
    for (let i = 0; i < 3; i++) {
      const line = state.act1Trace?.querySelector(`.act1-trace-line[data-i="${i}"]`);
      if (line) {
        setClass(line, "lit", inAct1 && t >= A1.TRACE[0] + i * 400);
        setClass(line, "solved", inAct1 && i === 2 && t >= A1_SOLVE_TICK);
      }
    }
    setClass(state.act1Evidence, "show", inAct1 && t >= A1.PERTASK[0] && t < A1.CROSSTASK[0]);
    for (let i = 0; i < ACT1.perTaskBullets.length; i++) {
      setClass(state.act1Evidence?.querySelector(`.act1-evidence-bullet[data-i="${i}"]`), "show", inAct1 && t >= A1.PERTASK[0] + i * 500);
    }
    setClass(state.act1Forum, "show", inAct1 && t >= A1.CROSSTASK[0] && t < A1.DISTILL[0]);
    for (let i = 0; i < ACT1.forumBubbles.length; i++) {
      setClass(state.act1Forum?.querySelector(`.act1-forum-bubble[data-i="${i}"]`), "show", inAct1 && t >= A1.CROSSTASK[0] + i * 450);
    }
    setClass(state.act1Distilled, "show", inAct1 && t >= A1.DISTILL[0] && t < A1.HANDOFF[0]);
    setClass(state.act1Handoff,   "show", inAct1 && t >= A1.HANDOFF[0]);

    // ---- Bundle layers
    let layersLit;
    if (inAct1) layersLit = t >= A1.BUNDLE[0] ? 8 : 7;
    else if (inAct2) layersLit = a2.leadin ? 0 : Math.min(10, a2.idx + (a2.p >= 0.6 ? 1 : 0));
    else layersLit = 10;
    for (let i = 0; i < 10; i++) {
      setClass(state.bundleLayers[i], "lit", i < layersLit);
      setClass(state.bundleLayers[i], "new", i === 7 && inAct1 && t >= A1.BUNDLE[0] && t < A1.HANDOFF[1]);
    }
    state.bundleCount.textContent = layersLit === 1 ? "BUNDLE · 1 LAYER" : `BUNDLE · ${layersLit} LAYERS`;
    setClass(state.groups.bundle, "hide", inAct3);

    // ---- Task grid
    setClass(state.groups.grid, "show", inAct2);
    setClass(state.groups.grid, "hide", inAct3);
    for (let i = 0; i < TOTAL_TASKS; i++) setClass(state.cells[i], "solved", i < solved);

    // ---- Act 2 milestone cards (one at a time)
    setClass(state.groups.act2, "show", inAct2);
    setClass(state.act2Rewind, "show", inAct2 && a2.leadin);
    for (const gm of MILESTONES) {
      const showCard = inAct2 && !a2.leadin && (a2.idx + 1 === gm);
      setClass(state.act2Cards[gm], "show", showCard);
    }

    // ---- compcert tracker
    setClass(state.groups.compcert, "hide", inAct3);
    const g8Solved =
      (inAct1 && t >= A1_SOLVE_TICK) ||
      (inAct2 && !a2.leadin && a2.idx >= 7) ||
      inAct3;
    for (let i = 0; i < 10; i++) {
      const mark = state.compcertMarks[i];
      setClass(mark, "active", gen === i + 1 && !inAct3);
      setClass(mark, "solved", i === 7 && g8Solved);
      if (i === 7 && mark.glyphNode) mark.glyphNode.textContent = g8Solved ? "✓" : "·";
    }

    // ---- Sparkline: redraw geometry up to the current gen; cursor on the same point.
    setClass(state.groups.footer, "hide", inAct3);
    const ci = (inAct2 && a2.leadin) ? 0 : genIdx;
    const pts = state.sparkPts.slice(0, ci + 1).map((p) => `${p.x},${p.y}`);
    state.sparkPath.setAttribute("d", pts.length > 1 ? "M " + pts.join(" L ") : "");
    state.sparkCursor.setAttribute("cx", String(state.sparkPts[ci].x));
    state.sparkCursor.setAttribute("cy", String(state.sparkPts[ci].y));
    for (let i = 0; i < 10; i++) {
      setClass(state.timelineDots[i], "active", i <= ci && !(inAct2 && a2.leadin));
      setClass(state.timelineDots[i], "current", i === ci && !(inAct2 && a2.leadin));
    }

    // ---- Act 3 surfaces
    setClass(state.groups.act3, "show", inAct3);
    if (inAct3) {
      const local = t - ACT2_END;
      for (let i = 0; i < state.act3Bars.length; i++) {
        const startMs = 200 + i * 650, p = clamp((local - startMs) / 600, 0, 1);
        state.act3Bars[i].fill.setAttribute("width", String(state.act3Bars[i].target * ease(p)));
        setClass(state.act3Bars[i].root, "show", local >= startMs);
      }
      for (let i = 0; i < state.act3Chips.length; i++) setClass(state.act3Chips[i], "show", local >= 2100 + i * 500);
      setClass(state.act3Tagline, "show", local >= 4400);
    } else {
      for (const b of state.act3Bars) { b.fill.setAttribute("width", "0"); setClass(b.root, "show", false); }
      for (const c of state.act3Chips) setClass(c, "show", false);
      setClass(state.act3Tagline, "show", false);
    }
  };

  // ====================================================================== rAF loop
  const loop = (now) => {
    if (state.paused || !state.inView) return;
    if (!state.startedAt) state.startedAt = now;
    const elapsed = (now - state.startedAt + state.pauseOffset) % TOTAL_MS;
    render(elapsed);
    state.rafId = requestAnimationFrame(loop);
  };
  const start = () => { cancelAnimationFrame(state.rafId); state.startedAt = 0; state.rafId = requestAnimationFrame(loop); };
  const pause = () => {
    if (state.paused) return;
    state.paused = true;
    if (state.startedAt) { const now = performance.now(); state.pauseOffset = (now - state.startedAt + state.pauseOffset) % TOTAL_MS; state.startedAt = 0; }
    cancelAnimationFrame(state.rafId);
    state.host?.classList.add("is-paused");
  };
  const resume = () => { if (!state.paused) return; state.paused = false; state.host?.classList.remove("is-paused"); state.rafId = requestAnimationFrame(loop); };
  const togglePause = () => state.paused ? resume() : pause();

  // ====================================================================== Observers
  const setupReducedMotion = () => {
    if (typeof window.matchMedia !== "function") return false;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    state.reducedMotion = mq.matches;
    if (mq.addEventListener) mq.addEventListener("change", (e) => {
      state.reducedMotion = e.matches;
      if (e.matches) { pause(); render(ACT3_END); } else { start(); }
    });
    return mq.matches;
  };
  const setupInView = () => {
    if (typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        state.inView = e.isIntersecting;
        if (state.reducedMotion) return;
        if (e.isIntersecting && !state.paused) state.rafId = requestAnimationFrame(loop);
      }
    }, { threshold: 0.05 });
    io.observe(state.host);
  };

  // ====================================================================== Boot
  const boot = () => {
    state.host = document.getElementById("main-anim");
    if (!state.host) return;
    const svg = buildSVG();
    state.svg = svg;
    state.host.appendChild(svg);

    state.host.addEventListener("mouseenter", pause);
    state.host.addEventListener("mouseleave", resume);
    state.host.addEventListener("click", () => togglePause());
    state.host.setAttribute("tabindex", "0");
    state.host.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); togglePause(); } });

    if (setupReducedMotion()) { render(ACT3_END); state.host.classList.add("reduced-motion"); return; }
    setupInView();
    start();

    window.__MAIN_ANIM = {
      fastForward: (t) => { pause(); render(t); },
      durationMs: TOTAL_MS,
      finalMs: ACT3_END,
      actBounds: { act1End: ACT1_END, act2End: ACT2_END, finalMs: ACT3_END },
      milestones: MILESTONES,
      a2Start: A2_START,
      state,
    };
    console.log("[main-anim] boot complete (three-act controller v2)");
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
