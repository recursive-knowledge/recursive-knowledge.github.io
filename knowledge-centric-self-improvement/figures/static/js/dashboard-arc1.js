/* ARC-AGI-1 Haiku Dashboard — narrative-focused vanilla JS + D3 (window.KCSICharts)
 *
 * Forked from dashboard.js (the TB2 dashboard). Diffs:
 *   - DATA_URL / KNOWLEDGE_URL point to arc1_*.json instead of tb2_*.json.
 *   - renderTaskBody renders ARC grids (train pairs, test input, per-gen
 *     attempt grids) instead of TB2 narrative-only blocks.
 *   - Task-row header chip uses grid_shape + n_train_pairs instead of
 *     category / difficulty.
 */
(function () {
  "use strict";

  const DATA_URL      = "../../static/data/arc1_haiku.json";
  const KNOWLEDGE_URL = "../../static/data/arc1_knowledge.json";
  const DATA_DIR      = "../../static/data";

  const KNOWLEDGE_SECTIONS = [
    { key: "transferable_insights", title: "Transferable insights" },
    { key: "confirmed_constraints", title: "Confirmed constraints" },
    { key: "rejected_hypotheses",   title: "Rejected hypotheses" },
    { key: "pitfalls",              title: "Pitfalls" },
    { key: "checks",                title: "Checks" },
    { key: "next_steps",            title: "Next steps" },
  ];

  const state = {
    payload: null,
    knowledge: null,
    activeTab: "solved",
    statusFilter: "all",      // all | resolved | failed | infra
    search: "",
    selectedGen: null,
    selectedEvolvingGen: null,
  };

  // ====================================================================== DOM helpers
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  };
  const clear = (host) => { while (host && host.firstChild) host.removeChild(host.firstChild); };

  const fmtInt    = (n) => (n ?? 0).toLocaleString("en-US");
  const fmtPct    = (n) => `${(n ?? 0).toFixed(1)}%`;
  const fmtReward = (r) => (r == null ? "—" : Number(r).toFixed(2));
  const cssVar    = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // ====================================================================== Status
  const classifyStatus = (task) => {
    if (task.resolved) return "resolved";
    const v = task.verifier_exit_code, a = task.agent_exit_code;
    const hasExitCodes = ("verifier_exit_code" in task) || ("agent_exit_code" in task);
    const s = (task.trial_status || task.status || "").toLowerCase();
    // Only treat a missing exit code as "infra" when the dataset carries exit
    // codes at all — ARC traces don't, so a null there is not an infra signal.
    if (s.includes("error") || s.includes("infra") || s.includes("verifier_did_not_produce") || (hasExitCodes && (v == null || a == null))) return "infra";
    return "failed";
  };
  const statusLabel = (s) =>
    ({ resolved: "Resolved", failed: "Failed", infra: "Infra issue" }[s] || "Unknown");

  // ====================================================================== Timeline
  const renderTimeline = (host) => {
    const gens = state.payload.generations || [];
    if (gens.length < 2) {
      host.innerHTML = `<div class="empty">Single-generation run — no timeline.</div>`;
      return;
    }
    const total = state.payload.total_tasks || 1;
    if (window.KCSICharts) {
      KCSICharts.timeline(host, gens, {
        total, height: 260,
        selectedGen: state.selectedEvolvingGen,
        onSelect: (g) => setSelectedEvolvingGen(g),
      });
    }
    host.style.cursor = "pointer";
  };

  // ====================================================================== Lineage heatmap
  const renderGraph = (host) => {
    const p = state.payload;
    const tasks = p.tasks || {};
    const gens = (p.generations || []).map((g) => g.gen);
    if (!gens.length) {
      host.innerHTML = `<div class="empty">No generation data.</div>`;
      return;
    }
    const taskIds = Object.keys(tasks).sort((a, b) => {
      const fa = tasks[a].first_solved_gen ?? Infinity;
      const fb = tasks[b].first_solved_gen ?? Infinity;
      if (fa !== fb) return fa - fb;
      return a.localeCompare(b);
    });
    const z = [];
    for (const tid of taskIds) {
      const seenByGen = {};
      for (const g of tasks[tid].per_gen || []) seenByGen[g.gen] = g;
      let best = 0;
      const row = [];
      for (const g of gens) {
        const trial = seenByGen[g];
        if (trial && trial.reward != null) best = Math.max(best, trial.reward);
        row.push(best);
      }
      z.push(row);
    }
    if (window.KCSICharts) KCSICharts.heatmap(host, { taskIds, gens, z });
    $("#tab-count-lineage").textContent = taskIds.length;
  };

  // ====================================================================== KPI strip
  const renderKpis = (host) => {
    const k = state.payload.kpis || {};
    const p = state.payload;
    const totalTok = (k.total_input_tokens || 0) + (k.total_output_tokens || 0);
    const cards = [
      { label: "Solve rate", value: fmtPct(k.solved_pct),
        sub: `${k.solved} / ${p.total_tasks} tasks`, primary: true },
      { label: "Generations", value: String((p.generations || []).length),
        sub: `${fmtInt(p.total_traces || 0)} trials run` },
      { label: "Total tokens", value: fmtInt(totalTok),
        sub: `${fmtInt(k.total_input_tokens || 0)} in · ${fmtInt(k.total_output_tokens || 0)} out` },
    ];
    clear(host);
    for (const c of cards) {
      host.appendChild(el("div", { class: "kpi-card" + (c.primary ? " kpi-card--ours" : "") },
        el("div", { class: "kpi-label" }, c.label),
        el("div", { class: "kpi-value" }, c.value),
        el("div", { class: "kpi-sub" }, c.sub),
      ));
    }
  };

  // ====================================================================== Run at a glance
  const renderRunGlance = (host) => {
    const rs = state.payload.run_summary;
    clear(host);
    if (!rs || !rs.total_actions) {
      host.appendChild(el("span", { class: "glance-pill" }, "No tool-trace data."));
      return;
    }
    const pill = (label, valueNode) => {
      const p = el("span", { class: "glance-pill" });
      p.appendChild(el("strong", {}, valueNode));
      p.appendChild(document.createTextNode(` ${label}`));
      return p;
    };
    host.appendChild(pill("avg shell actions / trial", String(rs.avg_actions_per_task)));
    host.appendChild(el("span", { class: "glance-sep" }));
    host.appendChild(pill("trials with a trace", fmtInt(rs.n_trials_with_trace)));
    host.appendChild(el("span", { class: "glance-sep" }));
    const topBits = (rs.top_kinds || []).slice(0, 4).map(
      (t) => `${t.kind} (${Math.round((t.pct || 0) * 100)}%)`
    );
    const p = el("span", { class: "glance-pill" });
    p.appendChild(el("strong", {}, "top actions:"));
    p.appendChild(document.createTextNode(" " + topBits.join(" · ")));
    host.appendChild(p);
  };

  // ====================================================================== Headline-insight picker
  const KNOWLEDGE_HEADLINE_SECTIONS = [
    "transferable_insights",
    "confirmed_constraints",
    "pitfalls",
    "checks",
    "rejected_hypotheses",
    "next_steps",
  ];

  /** Pick the single most-important newly-added insight for a gen.
   * Heuristic: first high-confidence item in transferable_insights, else
   * first item in transferable_insights, else first added item in any
   * other section. Returns {section, item, text} or null. */
  const pickHeadlineInsight = (delta) => {
    if (!delta) return null;
    const ti = delta.transferable_insights?.added || [];
    const highConf = ti.find((it) => (it.confidence || "").toLowerCase() === "high");
    const first = highConf || ti[0] || null;
    if (first) {
      return { section: "transferable_insights", item: first, text: _itemText(first) };
    }
    for (const sec of KNOWLEDGE_HEADLINE_SECTIONS) {
      const arr = delta[sec]?.added || [];
      if (arr.length) return { section: sec, item: arr[0], text: _itemText(arr[0]) };
    }
    return null;
  };

  const _itemText = (item) => {
    if (!item) return "";
    if (typeof item === "string") return item;
    return item.text || item.insight || item.statement || "";
  };

  /** First clause of a multi-sentence text, ≤ `max` chars, ending on a word
   * boundary. Period-only sentence-splitting was tried and rejected because
   * the insight text routinely contains numeric decimals (`native_score=0.0`),
   * file names (`/tests/test.sh`), and abbreviations — splitting on `.` cut
   * useful prefixes mid-token. */
  const _firstSentence = (s, max = 140) => {
    if (!s) return "";
    const cleaned = s.trim().replace(/\s+/g, " ");
    if (cleaned.length <= max) return cleaned;
    // Trim to max, then back up to the last space (or comma/semicolon) so we
    // don't cut a word in half.
    const seg = cleaned.slice(0, max + 1);
    let cut = Math.max(
      seg.lastIndexOf(" "),
      seg.lastIndexOf(","),
      seg.lastIndexOf(";"),
    );
    if (cut < 40) cut = max;  // very long single word — just hard-cut.
    return cleaned.slice(0, cut).replace(/[ ,;]+$/, "") + "…";
  };

  const SECTION_LABEL = {
    transferable_insights: "Transferable insight",
    confirmed_constraints: "Confirmed constraint",
    pitfalls:              "Pitfall",
    checks:                "Check",
    rejected_hypotheses:   "Rejected hypothesis",
    next_steps:            "Next step",
  };

  // ====================================================================== Evolution-at-a-glance strip
  const renderEvolutionStrip = () => {
    const host = $("#evolution-strip-host");
    if (!host) return;
    clear(host);

    const k = state.knowledge;
    const gens = (state.payload?.generations || []).map((g) => g.gen);
    if (!gens.length) {
      host.appendChild(el("div", { class: "ek-empty" }, "No generation data."));
      return;
    }
    if (!k || k.error) {
      host.appendChild(el("div", { class: "ek-empty" },
        k?.error ? `Knowledge data unavailable: ${k.error}` : "Loading…"));
      return;
    }
    const knowledgeByGen = new Map((k.generations || []).map((g) => [g.gen, g]));
    const deltasByGen    = new Map((state.payload.generations || []).map((g) => [g.gen, g]));

    for (const gen of gens) {
      const kSlot = knowledgeByGen.get(gen);
      const dRow  = deltasByGen.get(gen);
      const headline = pickHeadlineInsight(kSlot?.cross_task_distill_delta);
      const card = el("article", {
        class: "evo-card" + (gen === state.selectedEvolvingGen ? " selected" : ""),
        role: "button",
        tabindex: "0",
        title: `Open generation ${gen}`,
        onclick: () => setSelectedEvolvingGen(gen),
        onkeydown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedEvolvingGen(gen);
          }
        },
      });
      const dCount = dRow?.delta ?? 0;
      card.appendChild(el("div", { class: "evo-card-top" },
        el("span", { class: "evo-gen" }, `G${gen}`),
        el("span", { class: "evo-delta" },
          dCount > 0 ? `+${dCount} solved` : "—"),
      ));
      if (headline) {
        card.appendChild(el("div", { class: "evo-section" }, SECTION_LABEL[headline.section] || headline.section));
        card.appendChild(el("div", { class: "evo-headline" }, _firstSentence(headline.text)));
      } else {
        card.appendChild(el("div", { class: "evo-section" }, "Bundle held steady"));
        card.appendChild(el("div", { class: "evo-headline empty" }, "no new insight added this generation"));
      }
      host.appendChild(card);
    }
  };

  // ====================================================================== Unified gen-selection
  const setSelectedEvolvingGen = (gen) => {
    if (!Number.isFinite(gen)) return;
    state.selectedEvolvingGen = gen;
    if (state.payload) renderTimeline($("#chart-timeline"));  // refresh bar bold
    renderEvolutionStrip();
    renderEvolvingKnowledge();
  };

  // ====================================================================== Evolving knowledge centerpiece
  const ensureKnowledgeLoaded = async () => {
    if (state.knowledge !== null) return state.knowledge;
    try {
      const r = await fetch(KNOWLEDGE_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      state.knowledge = await r.json();
    } catch (err) {
      state.knowledge = { error: err.message, generations: [] };
    }
    return state.knowledge;
  };

  const renderEvolvingKnowledge = async () => {
    const chooser  = $("#ek-gen-chooser");
    const metaHost = $("#ek-meta");
    const addedHost  = $("#ek-added-body");
    const solvesHost = $("#ek-solves-body");
    if (!chooser || !addedHost || !solvesHost) return;

    clear(chooser); clear(metaHost); clear(addedHost); clear(solvesHost);
    addedHost.appendChild(el("div", { class: "loading" }, "Loading curated knowledge…"));

    const k = await ensureKnowledgeLoaded();
    clear(addedHost);
    if (k.error || !k.generations?.length) {
      addedHost.appendChild(el("div", { class: "ek-empty" },
        k.error
          ? `No knowledge.json available (${k.error}). Re-run the builder with --knowledge-db.`
          : "No distilled knowledge in this run."));
      return;
    }

    // Gen chooser
    const gens = k.generations.map((g) => g.gen);
    if (state.selectedEvolvingGen == null || !gens.includes(state.selectedEvolvingGen)) {
      // default: first gen that has any newly solved tasks (most informative starting point)
      const firstWithSolves = (state.payload.generations || []).find((g) => (g.newly_solved || []).length > 0);
      state.selectedEvolvingGen = firstWithSolves ? firstWithSolves.gen : gens[0];
    }
    chooser.appendChild(el("span", { class: "gen-chooser-label" }, "Generation:"));
    for (const g of gens) {
      const isActive = g === state.selectedEvolvingGen;
      chooser.appendChild(el("button", {
        class: "pill" + (isActive ? " active" : ""),
        onclick: () => setSelectedEvolvingGen(g),
      }, `G${g}`));
    }

    const slot = k.generations.find((x) => x.gen === state.selectedEvolvingGen);
    const delta = slot?.cross_task_distill_delta || {};

    // Meta: counts summary
    const totalAdded   = KNOWLEDGE_SECTIONS.reduce((s, sec) => s + (delta[sec.key]?.added?.length || 0), 0);
    const totalRemoved = KNOWLEDGE_SECTIONS.reduce((s, sec) => s + (delta[sec.key]?.removed?.length || 0), 0);
    metaHost.appendChild(el("span", {},
      `+${totalAdded} added`));
    metaHost.appendChild(el("span", {},
      `−${totalRemoved} dropped from G${state.selectedEvolvingGen - 1 || "-"}`));
    metaHost.appendChild(el("span", {},
      `${slot?.per_task_distill_count || 0} per-task bundles fed this distillation`));

    // Added column: typed sections
    for (const sec of KNOWLEDGE_SECTIONS) {
      const items = delta[sec.key]?.added || [];
      if (!items.length) continue;
      const group = el("div", { class: "ek-group" });
      group.appendChild(el("div", { class: "ek-group-head" },
        sec.title,
        el("span", { class: "ek-count" }, String(items.length)),
      ));
      for (const it of items) {
        const card = el("article", { class: "ek-card" });
        const text = it.text || it.insight || (typeof it === "string" ? it : "");
        card.appendChild(el("p", { class: "ek-card-text" }, text));
        if (it.applies_when || it.confidence || (it.evidence && it.evidence.length)) {
          const meta = el("div", { class: "ek-card-meta" });
          const bits = [];
          if (it.applies_when) bits.push(`applies when: ${it.applies_when}`);
          if (it.confidence)   bits.push(`confidence: ${it.confidence}`);
          if (Array.isArray(it.evidence) && it.evidence.length) bits.push(`${it.evidence.length} evidence`);
          meta.textContent = bits.join(" · ");
          card.appendChild(meta);
        }
        group.appendChild(card);
      }
      addedHost.appendChild(group);
    }
    if (!addedHost.children.length) {
      addedHost.appendChild(el("div", { class: "ek-empty" },
        `No new insights added at G${state.selectedEvolvingGen} — the bundle held steady.`));
    }

    // Solves column: this gen's first-solved tasks
    const genRow = (state.payload.generations || []).find((g) => g.gen === state.selectedEvolvingGen);
    const solves = genRow?.newly_solved || [];
    const list = el("div", { class: "solves-list" });
    if (!solves.length) {
      list.appendChild(el("div", { class: "ek-empty" },
        `No new solves at G${state.selectedEvolvingGen}.`));
    } else {
      for (const s of solves) {
        const chip = el("div", { class: "solve-chip" });
        chip.appendChild(el("span", { class: "solve-task" }, s.task_id));
        const tags = el("span", { class: "solve-tags" });
        if (s.category)   tags.appendChild(el("span", { class: "solve-tag" }, s.category));
        if (s.difficulty) tags.appendChild(el("span", { class: "solve-tag" }, s.difficulty));
        chip.appendChild(tags);
        list.appendChild(chip);
      }
    }
    solvesHost.appendChild(list);
  };

  // ====================================================================== Filtering
  const filteredTasks = () => {
    const tasks = state.payload.tasks || {};
    const q = state.search.trim().toLowerCase();
    const out = [];
    for (const [tid, t] of Object.entries(tasks)) {
      if (state.statusFilter !== "all" && classifyStatus(t) !== state.statusFilter) continue;
      if (q && !tid.toLowerCase().includes(q)) continue;
      if (state.selectedGen != null) {
        const here = (t.per_gen || []).some((g) => g.gen === state.selectedGen);
        if (!here) continue;
      }
      out.push(Object.assign({ task_id: tid }, t));
    }
    out.sort((a, b) => {
      if (a.resolved !== b.resolved) return a.resolved ? -1 : 1;
      const fa = a.first_solved_gen ?? 99, fb = b.first_solved_gen ?? 99;
      if (fa !== fb) return fa - fb;
      const ra = a.best_reward ?? -1, rb = b.best_reward ?? -1;
      if (ra !== rb) return rb - ra;
      return a.task_id.localeCompare(b.task_id);
    });
    return out;
  };

  // ====================================================================== Task rows (slimmer)
  const renderTaskList = (host, predicate, emptyMessage) => {
    const items = filteredTasks().filter(predicate);
    clear(host);
    if (!items.length) {
      host.appendChild(el("div", { class: "empty" }, emptyMessage));
      return;
    }
    for (const t of items) host.appendChild(renderTaskRow(t));
  };

  // ====================================================================== Grid renderer
  /** Render a 2D int grid as a CSS-Grid of <div>s with .cell-N background
   * classes. Uses divs rather than <td> because empty table cells collapse to
   * zero height in most browsers, even with explicit width/height set. */
  const renderGrid = (grid) => {
    if (!Array.isArray(grid) || !grid.length) return el("div", { class: "grid-empty" }, "(no grid)");
    const rows = grid.length;
    const cols = Array.isArray(grid[0]) ? grid[0].length : 0;
    // Choose cell size: 16 px for ≤10 cols, scale down to 8 px at 30 cols.
    const dim = Math.max(rows, cols);
    const px = dim <= 10 ? 16 : dim <= 20 ? 12 : 8;
    const wrap = el("div", { class: "grid-canvas", "data-rows": String(rows), "data-cols": String(cols) });
    wrap.style.setProperty("--cell-size", `${px}px`);
    wrap.style.setProperty("--cols", String(cols));
    wrap.style.setProperty("--rows", String(rows));
    for (const row of grid) {
      if (!Array.isArray(row)) continue;
      for (const v of row) {
        const n = Number.isInteger(v) ? v : 0;
        const safe = Math.max(0, Math.min(9, n));
        wrap.appendChild(el("div", { class: `cell-${safe}` }));
      }
    }
    return wrap;
  };

  /** A labeled grid block (label on top, grid below). */
  const renderGridBlock = (grid, label, opts = {}) => {
    const block = el("div", { class: "grid-block" + (opts.correct === true ? " grid-correct" : opts.correct === false ? " grid-wrong" : "") });
    if (label) block.appendChild(el("div", { class: "grid-label" }, label));
    block.appendChild(renderGrid(grid));
    return block;
  };

  /** A row of grid blocks (horizontally flowing, wraps as needed). */
  const renderGridRow = (blocks) => {
    const row = el("div", { class: "grid-row" });
    for (const b of blocks) row.appendChild(b);
    return row;
  };

  // ====================================================================== Task row + drill-down
  const renderTaskRow = (t) => {
    const status = classifyStatus(t);
    const head = el("div", { class: "task-row-head" },
      el("div", { class: "task-id" }, t.task_id),
      el("div", { class: `task-status ${status}` }, statusLabel(status)),
      el("div", { class: "task-reward" }, fmtReward(t.best_reward)),
      el("div", { class: "task-tokens" },
        t.first_solved_gen != null ? `solved G${t.first_solved_gen}` : "—"),
      el("div", { class: "task-cost" }, t.grid_shape ? `${t.grid_shape} · ${t.n_train_pairs || 0} train` : ""),
      el("button", { class: "task-toggle", title: "Expand" }, "▸"),
    );
    const body = el("div", { class: "task-body" });
    const row  = el("div", { class: "task-row" }, head, body);
    head.addEventListener("click", () => {
      const open = row.classList.toggle("open");
      head.querySelector(".task-toggle").textContent = open ? "▾" : "▸";
      if (open && !body.dataset.rendered) {
        renderTaskBody(t, body);
        body.dataset.rendered = "1";
      }
    });
    return row;
  };

  const renderTaskBody = (t, body) => {
    // 1) Meta header
    body.appendChild(el("div", { class: "gen-head" },
      t.grid_shape    && el("span", {}, `test grid: ${t.grid_shape}`),
      t.n_train_pairs && el("span", {}, `${t.n_train_pairs} train pairs`),
      t.first_solved_gen != null
        ? el("span", {}, `first solved at G${t.first_solved_gen}`)
        : el("span", {}, "never solved"),
    ));

    // 2) Train pairs row (input → output for each pair)
    if (Array.isArray(t.train_pairs) && t.train_pairs.length) {
      const trainLabel = el("div", { class: "grid-section-label" }, "Train examples (input → output)");
      body.appendChild(trainLabel);
      const trainBlocks = [];
      t.train_pairs.forEach((p, i) => {
        trainBlocks.push(renderGridBlock(p.input,  `train ${i + 1} · input`));
        trainBlocks.push(renderGridBlock(p.output, `train ${i + 1} · output`));
      });
      body.appendChild(renderGridRow(trainBlocks));
    }

    // 3) Test input row(s)
    if (Array.isArray(t.test_inputs) && t.test_inputs.length) {
      body.appendChild(el("div", { class: "grid-section-label" }, "Test input(s)"));
      body.appendChild(renderGridRow(
        t.test_inputs.map((g, i) => renderGridBlock(g, `test ${i + 1} · input`))
      ));
    }

    // 4) Per-gen attempts. Each gen shows the agent's predicted grid(s).
    const gens = (t.per_gen || []).slice().sort((a, b) => a.gen - b.gen);
    for (const g of gens) {
      const mark = g.resolved ? "✓" : "✗";
      const block = el("div", { class: "gen-narrative" });
      block.appendChild(el("div", { class: "gen-narrative-head" },
        el("span", { class: "gen-label" }, `${mark} Gen ${g.gen}`),
        el("span", {}, `reward ${fmtReward(g.reward)}`),
        g.n_actions != null && el("span", { class: "gen-action-count" }, `${g.n_actions} tool actions`),
      ));
      if (g.error) {
        block.appendChild(el("div", { class: "error-note" }, g.error));
      }

      const attempts = Array.isArray(g.attempts) ? g.attempts : [];
      if (attempts.length) {
        const attemptBlocks = attempts.map((a, i) => renderGridBlock(
          a.grid,
          `attempt ${i + 1}${a.correct === true ? " ✓" : a.correct === false ? " ✗" : ""}`,
          { correct: a.correct },
        ));
        block.appendChild(renderGridRow(attemptBlocks));
      } else if (!g.error) {
        block.appendChild(el("div", { class: "narrative-empty" },
          "(agent submitted no grid this generation)"));
      }

      const steps = Array.isArray(g.step_summaries) ? g.step_summaries : [];
      if (steps.length) {
        const ul = el("ul", { class: "steps" });
        for (const s of steps) ul.appendChild(el("li", {}, s));
        block.appendChild(ul);
      }

      if (g.has_transcript) {
        const actions = el("div", { class: "action-row" });
        const hostT = el("div", { class: "transcript-host" });
        actions.appendChild(el("button", {
          class: "btn-mini",
          onclick: async () => {
            if (hostT.classList.contains("open")) { hostT.classList.remove("open"); return; }
            if (!hostT.dataset.loaded) {
              try {
                const r = await fetch(`${DATA_DIR}/${g.transcript_path}`);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                hostT.appendChild(el("pre", {}, await r.text()));
              } catch (err) {
                hostT.appendChild(el("pre", {}, `(failed to load transcript: ${err.message})`));
              }
              hostT.dataset.loaded = "1";
            }
            hostT.classList.add("open");
          },
        }, "Open full transcript"));
        block.appendChild(actions);
        block.appendChild(hostT);
      }
      body.appendChild(block);
    }
  };

  // ====================================================================== Pill / tab counts
  const updatePillCounts = () => {
    const counts = { resolved: 0, failed: 0, infra: 0 };
    for (const t of Object.values(state.payload.tasks || {})) counts[classifyStatus(t)]++;
    const setCount = (sel, v) => { const e = $(sel); if (e) e.textContent = v; };
    setCount("[data-status='all'] .pill-count",      state.payload.total_tasks || 0);
    setCount("[data-status='resolved'] .pill-count", counts.resolved);
    setCount("[data-status='failed'] .pill-count",   counts.failed);
    setCount("[data-status='infra'] .pill-count",    counts.infra);

    const filtered = filteredTasks();
    setCount("#tab-count-solved",   filtered.filter((t) => t.resolved).length);
    setCount("#tab-count-unsolved", filtered.filter((t) => !t.resolved).length);
  };

  // ====================================================================== Tab switching
  const renderActiveTaskTab = () => {
    if (state.activeTab === "solved") {
      renderTaskList($("#tab-solved"), (t) => t.resolved, "No tasks match these filters.");
    } else if (state.activeTab === "unsolved") {
      renderTaskList($("#tab-unsolved"), (t) => !t.resolved, "No unsolved tasks match these filters.");
    } else if (state.activeTab === "lineage") {
      renderGraph($("#chart-graph"));
    }
  };

  const setActiveTab = (id) => {
    state.activeTab = id;
    for (const btn of $$(".tab-btn")) {
      const on = btn.dataset.tab === id;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    }
    for (const p of $$(".tab-panel")) p.classList.toggle("active", p.dataset.tab === id);
    renderActiveTaskTab();
  };

  const onFiltersChanged = () => {
    updatePillCounts();
    if (state.activeTab === "solved" || state.activeTab === "unsolved") renderActiveTaskTab();
  };

  // ====================================================================== Theme
  const onThemeChange = () => {
    if (!state.payload) return;
    renderTimeline($("#chart-timeline"));
    if (state.activeTab === "lineage") renderGraph($("#chart-graph"));
  };
  new MutationObserver(onThemeChange)
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ====================================================================== Boot
  const wireFilters = () => {
    const searchInput = $("#search-input");
    if (searchInput) searchInput.addEventListener("input", (e) => {
      state.search = e.target.value; onFiltersChanged();
    });
    for (const pill of $$(".pill[data-status]")) {
      pill.addEventListener("click", () => {
        state.statusFilter = pill.dataset.status;
        for (const p of $$(".pill[data-status]")) p.classList.toggle("active", p === pill);
        onFiltersChanged();
      });
    }
    const tabBtns = $$(".tab-btn");
    tabBtns.forEach((b, i) => {
      b.addEventListener("click", () => setActiveTab(b.dataset.tab));
      b.addEventListener("keydown", (e) => {
        let n = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % tabBtns.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + tabBtns.length) % tabBtns.length;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = tabBtns.length - 1;
        if (n < 0) return;
        e.preventDefault();
        tabBtns[n].focus();
        setActiveTab(tabBtns[n].dataset.tab);
      });
    });
    const slider = $("#gen-slider");
    if (slider) {
      slider.addEventListener("input", () => {
        const v = parseInt(slider.value, 10);
        state.selectedGen = isNaN(v) || v === 0 ? null : v;
        $("#gen-slider-label").textContent = state.selectedGen == null ? "all" : `G${state.selectedGen}`;
        onFiltersChanged();
      });
    }
  };

  const renderMeta = () => {
    const p = state.payload;
    const host = $("#meta-row");
    clear(host);
    const pill = (label, value) => host.appendChild(el("span", { class: "meta-pill" }, `${label}: ${value}`));
    pill("Experiment", p.experiment);
    pill("Model", p.model);
    pill("Tasks", p.total_tasks);
    if ((p.generations || []).length) pill("Generations", p.generations.length);
  };

  const setupGenSlider = () => {
    const slider = $("#gen-slider");
    const wrap = $("#gen-slider-wrap");
    const gens = state.payload.generations || [];
    if (!slider || gens.length < 2) { if (wrap) wrap.style.display = "none"; return; }
    wrap.style.display = "inline-flex";
    slider.min = 0; slider.max = gens.length; slider.value = 0;
    $("#gen-slider-label").textContent = "all";
  };

  const showError = (msg) => {
    $(".dashboard-shell").prepend(el("div", { class: "error-banner" }, msg));
  };

  const safely = (label, fn) => {
    try { fn(); }
    catch (err) {
      console.error(`[dashboard] ${label} failed:`, err);
      showError(`${label} failed: ${err.message}. Open DevTools console for stack.`);
    }
  };

  // Defer the heavy knowledge.json fetch until the knowledge UI is approached,
  // so the multi-MB payload never blocks first paint. Memoised + one-shot.
  let _knowledgeLazyStarted = false;
  const loadKnowledgeAndRender = () => {
    if (_knowledgeLazyStarted) return;
    _knowledgeLazyStarted = true;
    ensureKnowledgeLoaded().then(() => {
      safely("renderEvolutionStrip",    () => renderEvolutionStrip());
      safely("renderEvolvingKnowledge", () => { renderEvolvingKnowledge(); });
    });
  };
  const setupKnowledgeLazyLoad = () => {
    renderEvolutionStrip();  // placeholder ("Loading…") — does not fetch
    const added = $("#ek-added-body");
    if (added) { clear(added); added.appendChild(el("div", { class: "loading" }, "Loading curated knowledge…")); }
    const targets = ["#evolution-strip", "#evolving-knowledge"].map((s) => $(s)).filter(Boolean);
    if (!("IntersectionObserver" in window) || !targets.length) { loadKnowledgeAndRender(); return; }
    const io = new IntersectionObserver((entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); loadKnowledgeAndRender(); }
    }, { rootMargin: "600px 0px" });
    targets.forEach((t) => io.observe(t));
  };

  const boot = async () => {
    console.log("[dashboard] boot starting…");
    try {
      const r = await fetch(DATA_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      state.payload = await r.json();
      console.log(`[dashboard] loaded ${state.payload.total_tasks} tasks, ${state.payload.total_traces} trials`);
    } catch (err) {
      showError(`Could not load ${DATA_URL}: ${err.message}. Did you run scripts/build_arc_dashboard.py yet?`);
      return;
    }
    safely("renderMeta",              () => renderMeta());
    safely("renderKpis",              () => renderKpis($("#kpi-strip")));
    // Default selected gen for the centerpiece / strip / timeline highlight.
    if (state.selectedEvolvingGen == null) {
      const firstWithSolves = (state.payload.generations || []).find((g) => (g.newly_solved || []).length > 0);
      state.selectedEvolvingGen = firstWithSolves
        ? firstWithSolves.gen
        : (state.payload.generations?.[0]?.gen ?? 1);
    }
    safely("renderTimeline",          () => renderTimeline($("#chart-timeline")));
    // Lazily load knowledge.json only when the evolution strip /
    // evolving-knowledge centerpiece nears the viewport, so it never blocks
    // first paint. (Memoised; clicking a generation also triggers the load.)
    safely("setupKnowledgeLazyLoad",  () => setupKnowledgeLazyLoad());
    safely("renderRunGlance",         () => renderRunGlance($("#run-glance")));
    safely("setupGenSlider",          () => setupGenSlider());
    safely("wireFilters",             () => wireFilters());
    safely("updatePillCounts",        () => updatePillCounts());
    safely("setActiveTab",            () => setActiveTab("solved"));
    safely("tab-count-lineage",       () => { $("#tab-count-lineage").textContent = state.payload.total_tasks || 0; });
    console.log("[dashboard] boot complete");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
