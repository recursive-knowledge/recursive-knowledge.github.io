/* TB2 Haiku — Summary / "main figure" view, interactive.
 *
 * Structure mirrors the detail dashboard (timeline → evolution strip →
 * centerpiece) but each per-gen view is HAND-CURATED in the build script
 * (highlights.per_gen) so a 2-minute reader sees a tight, intellectually
 * compelling slice instead of the firehose of 60+ insights and 89 tasks.
 *
 * Click any timeline bar OR any evolution-strip card → state updates →
 * timeline bar bolds → strip card highlights → centerpiece swaps content.
 * No scroll/jump (the layout's compact enough to keep stable in view).
 */
(function () {
  "use strict";

  // Data URL is overridable so the same renderer drives other benchmarks
  // (e.g. the auto-derived ARC summary sets window.__SUMMARY_DATA_URL).
  const DATA_URL = (typeof window !== "undefined" && window.__SUMMARY_DATA_URL) || "../../static/data/tb2_haiku.json";

  const state = {
    payload: null,
    selectedGen: null,
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

  const _firstSentence = (s, max = 120) => {
    if (!s) return "";
    const cleaned = s.trim().replace(/\s+/g, " ");
    if (cleaned.length <= max) return cleaned;
    const seg = cleaned.slice(0, max + 1);
    let cut = Math.max(seg.lastIndexOf(" "), seg.lastIndexOf(","), seg.lastIndexOf(";"));
    if (cut < 40) cut = max;
    return cleaned.slice(0, cut).replace(/[ ,;]+$/, "") + "…";
  };

  // ====================================================================== Stats
  // The headline numbers (solve rate / resolved / rounds) are folded into the main
  // chart panel header rather than shown as separate stat boxes.
  const renderStats = () => {
    const p = state.payload;
    const k = p.kpis || {};
    const gens = (p.generations || []).length;
    const oldBox = $("#summary-stats");
    if (oldBox) oldBox.remove();
    const head = $(".summary-panel-head");
    if (head) {
      let strip = head.querySelector(".summary-headline");
      if (!strip) { strip = el("div", { class: "summary-headline" }); head.appendChild(strip); }
      clear(strip);
      strip.appendChild(el("span", { class: "summary-headline-main" }, fmtPct(k.solved_pct)));
      strip.appendChild(el("span", { class: "summary-headline-sub" },
        `${k.solved} / ${p.total_tasks} solved · ${gens} curation rounds`));
    }
    // Subtitle arc updated from real data
    const grows = p.generations || [];
    if (grows.length >= 2) {
      const first = grows[0]?.macro_pass_ratio;
      const last  = grows[grows.length - 1]?.macro_pass_ratio;
      if (first != null && last != null) {
        const arc = $("#summary-arc");
        if (arc) arc.textContent = `${(first * 100).toFixed(1)}% → ${(last * 100).toFixed(1)}%`;
      }
    }
  };

  // ====================================================================== Plotly helpers
  const plotlyLayout = (extra = {}) => {
    const ink   = cssVar("--color-text") || "#1a1612";
    const muted = cssVar("--color-text-secondary") || "#6b6259";
    const line  = cssVar("--color-border") || "#ebe6dd";
    const bg    = cssVar("--color-bg") || "#ffffff";
    return Object.assign({
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: bg,
      font: { family: "Inter, -apple-system, sans-serif", size: 12, color: ink },
      margin: { l: 50, r: 30, t: 12, b: 36 },
      xaxis:  { gridcolor: line, zerolinecolor: line, tickfont: { color: muted, size: 11 }, titlefont: { color: muted, size: 12 } },
      yaxis:  { gridcolor: line, zerolinecolor: line, tickfont: { color: muted, size: 11 }, titlefont: { color: muted, size: 12 } },
      legend: { font: { color: muted, size: 11 }, bgcolor: "rgba(0,0,0,0)" },
      hoverlabel: { bgcolor: bg, bordercolor: line, font: { color: ink, family: "Inter, sans-serif", size: 12 } },
    }, extra);
  };

  // ====================================================================== Timeline
  const renderTimeline = () => {
    const host = $("#summary-timeline");
    if (!host) return;
    const p = state.payload;
    const gens = p.generations || [];
    if (gens.length < 2) { host.innerHTML = `<div class="empty">Single-generation run.</div>`; return; }
    if (window.KCSICharts) {
      KCSICharts.timeline(host, gens, {
        total: p.total_tasks || 1, height: 220,
        selectedGen: state.selectedGen,
        flatBars: true,  // generation-by-generation summary: don't colorize bars by count
        onSelect: (g) => setSelectedGen(g),
      });
    }
    host.style.cursor = "pointer";
  };

  // ====================================================================== Evolution strip
  const renderEvolutionStrip = () => {
    const host = $("#evolution-strip-host");
    if (!host) return;
    clear(host);
    const per_gen = (state.payload.highlights || {}).per_gen || [];
    if (!per_gen.length) {
      host.appendChild(el("div", { class: "ek-empty" }, "No curated picks (rebuild with --knowledge-db)."));
      return;
    }
    for (const entry of per_gen) {
      const gen = entry.gen;
      const ins = entry.insight;
      const headline = ins ? _firstSentence(ins.headline || ins.full_text || "", 120) : "(no new insight)";
      const card = el("article", {
        class: "evo-card" + (gen === state.selectedGen ? " selected" : ""),
        role: "button",
        tabindex: "0",
        title: `Open generation ${gen}`,
        onclick: () => setSelectedGen(gen),
        onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedGen(gen); } },
      });
      const dCount = entry.n_newly_solved;
      card.appendChild(el("div", { class: "evo-card-top" },
        el("span", { class: "evo-gen" }, `G${gen}`),
        el("span", { class: "evo-delta" }, dCount > 0 ? `+${dCount} solved` : "—"),
      ));
      card.appendChild(el("div", { class: "evo-section" }, "Curated insight"));
      card.appendChild(el("div", { class: "evo-headline" + (ins ? "" : " empty") }, headline));
      host.appendChild(card);
    }
  };

  // ====================================================================== Centerpiece
  const renderCenterpiece = () => {
    const host = $("#summary-centerpiece");
    if (!host) return;
    clear(host);
    const per_gen = (state.payload.highlights || {}).per_gen || [];
    const entry = per_gen.find((e) => e.gen === state.selectedGen);
    if (!entry) {
      host.appendChild(el("div", { class: "summary-panel-head" },
        el("h2", {}, "Pick a generation"),
        el("span", { class: "summary-panel-sub" }, "click any bar above or any card in the strip"),
      ));
      return;
    }

    // Panel header
    host.appendChild(el("div", { class: "summary-panel-head" },
      el("h2", {}, `Generation ${entry.gen}`),
      el("span", { class: "summary-panel-sub" },
        entry.n_newly_solved > 0
          ? `${entry.n_newly_solved} new tasks solved this generation`
          : "no new tasks solved this generation (bundle was consolidating)"),
    ));

    // Caption — the editorial framing of why this gen matters
    if (entry.caption) {
      host.appendChild(el("p", { class: "centerpiece-caption" }, entry.caption));
    }

    // The pinned insight
    const ins = entry.insight;
    if (ins) {
      const insBlock = el("article", { class: "centerpiece-insight" });
      insBlock.appendChild(el("div", { class: "centerpiece-insight-head" },
        el("span", { class: "centerpiece-tag" }, "Curated insight"),
        el("span", { class: "centerpiece-meta" }, `${ins.confidence || "?"} confidence · ${ins.evidence_count} evidence`),
      ));
      insBlock.appendChild(el("blockquote", { class: "centerpiece-insight-text" },
        ins.full_text || ins.headline || ""));
      if (ins.applies_when) {
        insBlock.appendChild(el("div", { class: "centerpiece-insight-applies" }, `applies when: ${ins.applies_when}`));
      }
      host.appendChild(insBlock);
    } else {
      host.appendChild(el("div", { class: "ek-empty" }, "No insight pinned for this generation."));
    }

    // Featured tasks
    if (entry.featured && entry.featured.length) {
      const tasks = el("div", { class: "centerpiece-featured" });
      tasks.appendChild(el("div", { class: "centerpiece-tag" }, "Featured task" + (entry.featured.length > 1 ? "s" : "")));
      const list = el("div", { class: "centerpiece-task-list" });
      for (const t of entry.featured) {
        const card = el("article", { class: "centerpiece-task" });
        card.appendChild(el("div", { class: "centerpiece-task-head" },
          el("span", { class: "centerpiece-task-id" }, t.task_id),
          el("span", { class: "centerpiece-task-arc" },
            t.first_solved_gen != null
              ? `solved at G${t.first_solved_gen}`
              : "never solved"),
        ));
        const tagrow = el("div", { class: "centerpiece-task-tags" });
        if (t.category)   tagrow.appendChild(el("span", { class: "centerpiece-task-tag" }, t.category));
        if (t.difficulty) tagrow.appendChild(el("span", { class: "centerpiece-task-tag" }, t.difficulty));
        if (t.n_failed_before_solve > 0) {
          tagrow.appendChild(el("span", { class: "centerpiece-task-tag centerpiece-task-tag--quiet" },
            `${t.n_failed_before_solve} prior failed attempts`));
        }
        card.appendChild(tagrow);
        if (t.note) card.appendChild(el("p", { class: "centerpiece-task-note" }, t.note));
        list.appendChild(card);
      }
      tasks.appendChild(list);
      host.appendChild(tasks);
    } else if (entry.n_newly_solved === 0) {
      host.appendChild(el("p", { class: "centerpiece-no-solves" },
        "No new solves this generation — but the curated bundle was still being refined."));
    }
  };

  // ====================================================================== Unified gen-selection
  const setSelectedGen = (gen) => {
    if (!Number.isFinite(gen)) return;
    state.selectedGen = gen;
    renderTimeline();
    renderEvolutionStrip();
    renderCenterpiece();
  };

  // ====================================================================== Theme
  const onThemeChange = () => {
    if (!state.payload) return;
    renderTimeline();
  };
  new MutationObserver(onThemeChange)
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ====================================================================== Boot
  const boot = async () => {
    console.log("[summary] boot starting…");
    try {
      const r = await fetch(DATA_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      state.payload = await r.json();
      console.log(`[summary] loaded ${state.payload.total_tasks} tasks, ${state.payload.total_traces} trials, per_gen=${(state.payload.highlights?.per_gen || []).length}`);
    } catch (err) {
      $(".summary-shell").prepend(el("div", { class: "error-banner" },
        `Could not load tb2_haiku.json: ${err.message}. Rebuild with scripts/build_tb2_dashboard.py.`));
      return;
    }
    // Default selected gen: G1 (the cold-start moment is often the most striking)
    const per_gen = (state.payload.highlights || {}).per_gen || [];
    state.selectedGen = per_gen.length ? per_gen[0].gen : 1;

    renderStats();
    renderTimeline();
    renderEvolutionStrip();
    renderCenterpiece();
    console.log("[summary] boot complete");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
