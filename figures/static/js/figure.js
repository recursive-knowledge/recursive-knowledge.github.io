/* KCSI scrollytelling main figure.
 *
 * Mounts on /figure/index.html. Six visualisations across seven scenes:
 *   scene-1  thesis (static framework figure)
 *   scene-2  headline stats (cards animate in by step)
 *   scene-3  mechanism (3-stage overlay highlights by step)
 *   scene-4  TB2 evolving bundle (Plotly timeline + curated card, by gen)
 *   scene-5  ARC grids (train → test → G1 → G2 → G3 attempts)
 *   scene-6  knowledge transfer (heatmap cells fill by donor)
 *   scene-7  inspect-it-yourself CTAs (static)
 *
 * Sticky-vis-scrolling-text pattern via IntersectionObserver. Steps fire
 * setStep(sceneId, stepNum) when crossing the viewport midline. On mobile
 * (< 900px) sticky is disabled by CSS; the JS still renders each scene's
 * terminal state at first paint so mobile gets a complete read.
 */
(function () {
  "use strict";

  const TB2_URL = "../static/data/tb2_haiku.json";
  const ARC_URL = "../static/data/arc1_haiku.json";

  // Hand-picked ARC task for scene 5 (G1 wrong → G2 wrong → G3 correct, 5×5)
  const ARC_SCENE_TASK = "f76d97a5";

  const state = {
    tb2: null,
    arc: null,
    activeStep: { scene: 1, step: 1 },
  };

  // ====================================================================== DOM
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  };
  const clear = (host) => { while (host && host.firstChild) host.removeChild(host.firstChild); };

  const fmtInt = (n) => (n ?? 0).toLocaleString("en-US");
  const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // ====================================================================== Scene 1 — thesis (static, no per-step state)
  // Nothing to do — the image is already in the HTML.
  const renderScene1 = () => {};

  // ====================================================================== Scene 2 — headline stats
  const HEADLINE_STATS = [
    { value: "82%",  label: "ARC-AGI-1",        sub: "Haiku 4.5 · $46/task", primary: true },
    { value: "84%",  label: "SWE-bench Pro",    sub: "Haiku 4.5 · $76/task", primary: true },
    { value: "80%",  label: "Polyglot",         sub: "Haiku 4.5 · $92/task" },
    { value: "47.2%",label: "Terminal-Bench 2", sub: "leads prior agents" },
  ];
  const renderScene2Cards = (litCount) => {
    const host = $("#figure-hero-stats");
    if (!host) return;
    clear(host);
    HEADLINE_STATS.forEach((s, i) => {
      const lit = i < litCount;
      host.appendChild(el("div", { class: "hero-stat" + (s.primary ? " primary" : "") + (lit ? " lit" : "") },
        el("div", { class: "hero-stat-value" }, s.value),
        el("div", { class: "hero-stat-label" }, s.label),
        el("div", { class: "hero-stat-sub" },   s.sub),
      ));
    });
  };
  const renderScene2Vs = (lit) => {
    const host = $("#figure-hero-vs");
    if (!host) return;
    clear(host);
    if (!lit) return;
    const lines = [
      "Ours @ SWE-bench Pro: ", el("strong", {}, "84% · $76/task"),
      el("br", {}),
      "DGM (Haiku 4.5): 66% · ", el("strong", {}, "$456/task"),
      el("br", {}),
      "HyperAgents (Haiku 4.5): 42% · ", el("strong", {}, "$276/task"),
    ];
    const row = el("div", { class: "vs-row" });
    lines.forEach((p) => row.appendChild(typeof p === "string" ? document.createTextNode(p) : p));
    host.appendChild(row);
    host.classList.add("lit");
  };
  const renderScene2 = (step) => {
    // step 1 → 2 cards visible; step 2 → all 4; step 3 → vs strip appears
    const litCount = step >= 2 ? 4 : 2;
    renderScene2Cards(litCount);
    renderScene2Vs(step >= 3);
  };

  // ====================================================================== Scene 3 — 3-stage mechanism overlay
  const renderScene3 = (step) => {
    const fig = $("#mechanism-figure");
    if (!fig) return;
    fig.setAttribute("data-active-stage", String(step));
  };

  // ====================================================================== Scene 4 — TB2 evolving bundle (timeline + card)
  const plotlyLayout = (extra = {}) => {
    const ink   = cssVar("--color-text") || "#1a1612";
    const muted = cssVar("--color-text-secondary") || "#6b6259";
    const line  = cssVar("--color-border") || "#ebe6dd";
    const bg    = cssVar("--color-bg") || "#ffffff";
    return Object.assign({
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: bg,
      font: { family: "Inter, -apple-system, sans-serif", size: 11, color: ink },
      margin: { l: 44, r: 26, t: 8, b: 32 },
      xaxis:  { gridcolor: line, zerolinecolor: line, tickfont: { color: muted, size: 10 }, titlefont: { color: muted, size: 11 } },
      yaxis:  { gridcolor: line, zerolinecolor: line, tickfont: { color: muted, size: 10 }, titlefont: { color: muted, size: 11 } },
      legend: { font: { color: muted, size: 10 }, bgcolor: "rgba(0,0,0,0)" },
      hoverlabel: { bgcolor: bg, bordercolor: line, font: { color: ink, family: "Inter, sans-serif", size: 11 } },
    }, extra);
  };

  const renderScene4Timeline = (selGen) => {
    const host = $("#scene4-timeline");
    if (!host || typeof Plotly === "undefined" || !state.tb2) return;
    const gens = state.tb2.generations || [];
    if (gens.length < 2) return;
    const accent      = cssVar("--color-accent") || "#DA7800";
    const accentLight = cssVar("--color-accent-light") || "#fcefdb";
    const warmHigh    = cssVar("--color-warm-high") || "#b10026";
    const total       = state.tb2.total_tasks || 1;
    const x = gens.map((g) => g.gen);
    const delta = gens.map((g) => g.delta);
    const cumulative = gens.map((g) => g.cumulative);
    const opacities = x.map((g) => (g === selGen ? 1.0 : 0.4));
    const traces = [
      { type: "bar", name: "new solves", x, y: delta,
        text: delta.map(String), textposition: "outside",
        marker: { color: delta, colorscale: [[0, accentLight], [1, warmHigh]],
                  cmin: 0, cmax: Math.max(...delta, 1),
                  opacity: opacities,
                  line: { color: accent, width: 1 } },
        hovertemplate: "<b>G%{x}</b><br>new solves: %{y}<extra></extra>" },
      { type: "scatter", mode: "lines+markers", name: "cumulative",
        x, y: cumulative,
        line: { color: accent, width: 1.5, dash: "dot" },
        marker: { size: 6, color: accent },
        yaxis: "y2",
        hovertemplate: "<b>G%{x}</b><br>cumulative: %{y}<extra></extra>" },
    ];
    const base = plotlyLayout();
    Plotly.react(host, traces, Object.assign(base, {
      barmode: "group", bargap: 0.32, height: 200,
      showlegend: false,
      xaxis: Object.assign(base.xaxis, { title: "", dtick: 1 }),
      yaxis: Object.assign(base.yaxis, { title: "Δ", rangemode: "tozero" }),
      yaxis2: { title: `/${total}`, overlaying: "y", side: "right",
                showgrid: false, rangemode: "tozero", range: [0, total],
                tickfont: { color: cssVar("--color-text-secondary"), size: 10 },
                titlefont: { color: cssVar("--color-text-secondary"), size: 11 } },
    }), { responsive: true, displaylogo: false, displayModeBar: false });

    if (typeof host.on === "function" && !host.dataset.clickWired) {
      host.on("plotly_click", (evt) => {
        const pt = (evt.points || [])[0];
        if (!pt || pt.x == null) return;
        setStep(4, Number(pt.x));
      });
      host.dataset.clickWired = "1";
    }
    host.style.cursor = "pointer";
  };

  const renderScene4Card = (gen) => {
    const host = $("#scene4-card");
    if (!host || !state.tb2) return;
    const per_gen = (state.tb2.highlights || {}).per_gen || [];
    const entry = per_gen.find((e) => e.gen === gen);
    clear(host);
    if (!entry) {
      host.appendChild(el("div", { class: "scene4-card-text" }, "Select a generation."));
      return;
    }
    const ins = entry.insight || {};
    host.appendChild(el("div", { class: "scene4-card-head" },
      el("span", { class: "scene4-card-gen" }, `Generation ${entry.gen}`),
      el("span", { class: "scene4-card-meta" },
        entry.n_newly_solved > 0
          ? `+${entry.n_newly_solved} tasks newly solved`
          : "no new solves · bundle consolidating"),
    ));
    if (ins.full_text || ins.headline) {
      host.appendChild(el("p", { class: "scene4-card-text" },
        "“", (ins.headline || ins.full_text || ""), "”"));
    }
    const featured = entry.featured || [];
    if (featured.length) {
      const f = featured[0];
      host.appendChild(el("div", { class: "scene4-card-featured" },
        el("span", { class: "featured-id" }, f.task_id),
        document.createTextNode(" — "),
        f.first_solved_gen != null
          ? el("span", { class: "featured-arc" }, `solved at G${f.first_solved_gen}`)
          : el("span", {}, "never solved"),
        f.n_failed_before_solve > 0
          ? el("span", {}, ` after ${f.n_failed_before_solve} failed gens`)
          : null,
      ));
    }
  };

  const renderScene4 = (step) => {
    // step N → gen N
    const gen = step;
    renderScene4Timeline(gen);
    renderScene4Card(gen);
  };

  // ====================================================================== Scene 5 — ARC stack
  const renderGrid = (grid) => {
    const wrap = el("div", { class: "grid-canvas" });
    if (!Array.isArray(grid) || !grid.length) return wrap;
    const cols = Array.isArray(grid[0]) ? grid[0].length : 0;
    const rows = grid.length;
    const dim  = Math.max(rows, cols);
    const px = dim <= 10 ? 22 : dim <= 20 ? 14 : 10;
    wrap.style.setProperty("--cell-size", `${px}px`);
    wrap.style.setProperty("--cols", String(cols));
    wrap.style.setProperty("--rows", String(rows));
    for (const row of grid) {
      if (!Array.isArray(row)) continue;
      for (const v of row) {
        const safe = Math.max(0, Math.min(9, Number.isInteger(v) ? v : 0));
        wrap.appendChild(el("div", { class: `cell-${safe}` }));
      }
    }
    return wrap;
  };

  const renderGridBlock = (grid, label, opts = {}) => {
    const cls = "grid-block" + (opts.correct === true ? " grid-correct" : opts.correct === false ? " grid-wrong" : "");
    const block = el("div", { class: cls });
    if (label) block.appendChild(el("div", { class: "grid-label" }, label));
    block.appendChild(renderGrid(grid));
    return block;
  };

  const renderScene5 = (step) => {
    const host = $("#arc-stack");
    if (!host || !state.arc) return;
    const t = state.arc.tasks[ARC_SCENE_TASK];
    if (!t) {
      host.innerHTML = `<div class="empty">ARC task ${ARC_SCENE_TASK} not found.</div>`;
      return;
    }
    clear(host);

    // Train pairs row — always visible from step 1
    const train = el("div", { class: "arc-stack-row lit" });
    train.appendChild(el("div", { class: "arc-stack-label" }, "Training examples (input → output)"));
    t.train_pairs.forEach((p, i) => {
      train.appendChild(renderGridBlock(p.input,  `train ${i + 1} · in`));
      train.appendChild(renderGridBlock(p.output, `train ${i + 1} · out`));
    });
    host.appendChild(train);

    // Test row — appears at step 2
    const test = el("div", { class: "arc-stack-row" + (step >= 2 ? " lit" : "") });
    test.appendChild(el("div", { class: "arc-stack-label" }, "Test input"));
    t.test_inputs.forEach((g, i) => {
      test.appendChild(renderGridBlock(g, `test ${i + 1} · in`));
    });
    host.appendChild(test);

    // Attempts per generation — appear at steps 3, 4, 5
    const stepByGen = { 1: 3, 2: 4, 3: 5 };
    (t.per_gen || []).slice().sort((a, b) => a.gen - b.gen).forEach((pg) => {
      const stepTrigger = stepByGen[pg.gen];
      if (stepTrigger == null) return;
      const lit = step >= stepTrigger;
      const row = el("div", { class: "arc-stack-row attempt" + (lit ? " lit" : "") });
      const correctOverall = (pg.attempts || []).some((a) => a.correct);
      row.appendChild(el("div", { class: "arc-stack-label" },
        `G${pg.gen} · ${correctOverall ? "solved" : "still wrong"}`));
      (pg.attempts || []).forEach((a, i) => {
        row.appendChild(renderGridBlock(a.grid,
          `attempt ${i + 1}${a.correct === true ? " ✓" : a.correct === false ? " ✗" : ""}`,
          { correct: a.correct }));
      });
      host.appendChild(row);
    });
  };

  // ====================================================================== Scene 6 — transfer heatmap
  // Numbers from the landing page's existing two heatmaps.
  const TRANSFER_DATA = {
    polyglot: {
      title: "Coding (Polyglot)",
      rows: [
        { receiver: "GPT-5.4-mini", none: 18, gpt: 48, haiku: 62 },
        { receiver: "Haiku 4.5",    none: 12, gpt: 56, haiku: 50 },
      ],
    },
    arc: {
      title: "Abstract reasoning (ARC-AGI-1)",
      rows: [
        { receiver: "GPT-5.4-mini", none: 32, gpt: 42, haiku: 38 },
        { receiver: "Haiku 4.5",    none: 18, gpt: 24, haiku: 20 },
      ],
    },
  };
  const heatLitClass = (pct) => {
    if (pct >= 60) return "lit-top";
    if (pct >= 45) return "lit-high";
    if (pct >= 30) return "lit-mid";
    if (pct >= 20) return "lit-low";
    return "lit-none";
  };

  // step 1 — intro, no cells lit (all dim)
  // step 2 — donor=none lit, others dim
  // step 3 — donor=gpt also lit
  // step 4 — donor=haiku also lit
  const renderScene6 = (step) => {
    const host = $("#transfer-host");
    if (!host) return;
    clear(host);
    const showCol = { none: step >= 2, gpt: step >= 3, haiku: step >= 4 };
    for (const key of ["polyglot", "arc"]) {
      const data = TRANSFER_DATA[key];
      const block = el("div", { class: "transfer-block" });
      block.appendChild(el("h4", {}, data.title));
      const table = el("table", { class: "transfer-table" });
      const thead = el("thead");
      thead.appendChild(el("tr", {},
        el("th", {}, "Receiver \\ Donor"),
        el("th", {}, "None"),
        el("th", {}, "GPT"),
        el("th", {}, "Haiku"),
      ));
      table.appendChild(thead);
      const tbody = el("tbody");
      for (const r of data.rows) {
        const tr = el("tr");
        tr.appendChild(el("td", { class: "row-h" }, r.receiver));
        for (const donor of ["none", "gpt", "haiku"]) {
          const v = r[donor];
          const litClass = showCol[donor] ? heatLitClass(v) : "dim";
          tr.appendChild(el("td", { class: `cell ${litClass}` }, showCol[donor] ? `${v}%` : "—"));
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      block.appendChild(table);
      host.appendChild(block);
    }
  };

  // ====================================================================== Scene 7 — static (no per-step state)
  const renderScene7 = () => {};

  // ====================================================================== Scene dispatcher
  const SCENE_RENDERERS = {
    1: renderScene1,
    2: renderScene2,
    3: renderScene3,
    4: renderScene4,
    5: renderScene5,
    6: renderScene6,
    7: renderScene7,
  };
  const SCENE_MAX_STEP = { 1: 1, 2: 3, 3: 3, 4: 10, 5: 5, 6: 4, 7: 1 };

  const setStep = (scene, step) => {
    const max = SCENE_MAX_STEP[scene] || 1;
    const clamped = Math.max(1, Math.min(max, step));
    state.activeStep = { scene, step: clamped };
    SCENE_RENDERERS[scene]?.(clamped);
  };

  // ====================================================================== Theme observer
  const onThemeChange = () => {
    // Plotly chart needs to redraw because we use CSS var colors
    if (state.activeStep.scene === 4 && state.tb2) {
      renderScene4Timeline(state.activeStep.step);
    }
  };
  new MutationObserver(onThemeChange)
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ====================================================================== IntersectionObserver wiring
  const wireScrollObserver = () => {
    // Root margin biases the trigger to the viewport midline rather than top
    // (i.e. fire when the step's top crosses 50% of the viewport).
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const t = entry.target;
        const scene = parseInt(t.dataset.scene, 10);
        const step  = parseInt(t.dataset.step, 10);
        if (Number.isFinite(scene) && Number.isFinite(step)) {
          setStep(scene, step);
        }
      }
    }, {
      // Top boundary is 40% from top; bottom is 50% from bottom — narrow band in middle.
      rootMargin: "-40% 0px -50% 0px",
      threshold: 0,
    });
    $$(".scene-step").forEach((s) => io.observe(s));
  };

  // ====================================================================== Boot
  const showError = (msg) => {
    $(".figure-shell").prepend(el("div", { class: "error-banner" }, msg));
  };

  const boot = async () => {
    console.log("[figure] boot starting…");
    try {
      const [tb2Resp, arcResp] = await Promise.all([
        fetch(TB2_URL, { cache: "no-store" }),
        fetch(ARC_URL, { cache: "no-store" }),
      ]);
      if (!tb2Resp.ok) throw new Error(`tb2 HTTP ${tb2Resp.status}`);
      if (!arcResp.ok) throw new Error(`arc HTTP ${arcResp.status}`);
      state.tb2 = await tb2Resp.json();
      state.arc = await arcResp.json();
      console.log(`[figure] loaded tb2 ${state.tb2.total_tasks} tasks, arc ${state.arc.total_tasks} tasks`);
    } catch (err) {
      showError(`Could not load run data: ${err.message}.`);
      return;
    }

    // First paint: render each scene at its first step so the page reads
    // even before any scroll has happened.
    for (let s = 1; s <= 7; s++) SCENE_RENDERERS[s]?.(1);

    wireScrollObserver();
    console.log("[figure] boot complete");
  };

  // Expose for headless smoke testing
  window.__FIGURE = { setStep, state };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
