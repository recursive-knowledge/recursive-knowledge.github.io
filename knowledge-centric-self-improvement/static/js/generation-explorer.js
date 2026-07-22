/* Main-page generation explorer.
 * Native, lightweight view over the same JSON used by the full dashboards.
 * It shows a generation picker and maps the selected
 * generation onto the paper figure's three artifact types:
 * task-level evidence -> cross-task synthesis -> distilled bundle.
 */
(function () {
  "use strict";

  const CONFIG = {
    tb2: {
      label: "Terminal-Bench 2",
      dataUrl: "static/data/tb2_haiku.json",
      fullUrl: "tb2-haiku/",
      taskNoun: "task",
    },
  };

  const root = document.getElementById("generations");
  if (!root) return;

  const state = {
    bench: root.dataset.defaultBench || "tb2",
    selectedGen: null,
    cache: {},
  };

  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => Array.from(root.querySelectorAll(sel));
  const el = (tag, attrs, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    children.flat().forEach((c) => {
      if (c == null || c === false) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  };
  const clear = (node) => { while (node && node.firstChild) node.removeChild(node.firstChild); };
  const pct = (n) => `${(n || 0).toFixed(1)}%`;

  const cleanText = (s, max) => {
    if (!s) return "";
    const t = String(s).replace(/\s+/g, " ").trim();
    if (!max || t.length <= max) return t;
    const cut = t.slice(0, max + 1);
    const at = Math.max(cut.lastIndexOf("."), cut.lastIndexOf(";"), cut.lastIndexOf(","));
    const end = at > max * 0.55 ? at + 1 : Math.max(cut.lastIndexOf(" "), max);
    return t.slice(0, end).replace(/[ ,;:]+$/, "") + "...";
  };

  const loadBench = async (bench) => {
    if (state.cache[bench]) return state.cache[bench];
    const res = await fetch(CONFIG[bench].dataUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.cache[bench] = data;
    return data;
  };

  const generationFor = (data, gen) => (data.generations || []).find((g) => g.gen === gen) || {};
  const highlightFor = (data, gen) => ((data.highlights || {}).per_gen || []).find((h) => h.gen === gen) || {};
  const taskTags = (tasks) => {
    const chips = el("div", { class: "generation-task-list" });
    tasks.slice(0, 5).forEach((t) => {
      chips.appendChild(el("span", { class: "generation-task-chip", text: t.task_id || "task" }));
    });
    if (tasks.length > 5) chips.appendChild(el("span", { class: "generation-task-chip", text: `+${tasks.length - 5}` }));
    return chips;
  };

  const setActiveTab = () => {
    $$(".generation-tab").forEach((tab) => {
      const on = tab.dataset.bench === state.bench;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    const full = $(".generation-full-link");
    if (full) full.href = CONFIG[state.bench].fullUrl;
  };

  const renderTimeline = (data) => {
    const host = $("#generation-timeline");
    if (!host) return;
    clear(host);

    const gens = data.generations || [];
    if (!gens.length) {
      host.appendChild(el("div", { class: "empty", text: "No generation data." }));
      return;
    }

    const picks = el("div", { class: "generation-picks", role: "group", "aria-label": "Select generation" });
    gens.forEach((g) => {
      picks.appendChild(el("button", {
        class: "generation-pick" + (g.gen === state.selectedGen ? " is-active" : ""),
        type: "button",
        "aria-pressed": g.gen === state.selectedGen ? "true" : "false",
        onclick: () => {
          state.selectedGen = g.gen;
          render(data);
        },
      }, `G${g.gen}`));
    });
    host.appendChild(picks);
  };

  const renderCards = (data) => {
    const cfg = CONFIG[state.bench];
    const gen = generationFor(data, state.selectedGen);
    const entry = highlightFor(data, state.selectedGen);
    const insight = entry.insight || {};
    const featured = entry.featured || [];
    const solved = gen.cumulative || 0;
    const total = data.total_tasks || 1;
    const selectedPct = (solved / total) * 100;
    const nextGen = state.selectedGen < (data.generations || []).length ? `G${state.selectedGen + 1}` : "the final bundle";

    $("#generation-title").textContent = `${cfg.label} - Generation ${state.selectedGen}`;
    $("#generation-score-value").textContent = `${pct(selectedPct)}`;
    $("#generation-score-label").textContent = `${solved} / ${total} cumulative solved`;

    const taskTitle = $("#generation-task-title");
    const taskBody = $("#generation-task-body");
    taskTitle.textContent = "Task context";
    clear(taskBody);
    const sourceTasks = featured.length ? featured : (gen.newly_solved || []).slice(0, 4);
    taskBody.appendChild(el("p", {}, featured.length
      ? `Representative ${cfg.taskNoun}s whose traces anchor this generation's evidence:`
      : sourceTasks.length
        ? `Task traces anchoring this generation's evidence:`
        : "This round consolidates evidence from prior task traces rather than pinning a single task."));
    if (sourceTasks.length) taskBody.appendChild(taskTags(sourceTasks));
    const note = featured.find((t) => t.note)?.note;
    if (note) taskBody.appendChild(el("p", { class: "generation-card-note" }, cleanText(note, 210)));

    $("#generation-cross-title").textContent = "Pattern carried across tasks";
    const crossBody = $("#generation-cross-body");
    clear(crossBody);
    crossBody.appendChild(el("div", { class: "generation-card-meta", text: `Generation ${state.selectedGen} synthesis` }));
    crossBody.appendChild(el("p", {}, cleanText(entry.caption || insight.headline || "Cross-task discussion selects the pattern most likely to transfer.", 280)));

    $("#generation-distilled-title").textContent = `Bundle passed to ${nextGen}`;
    const distilledBody = $("#generation-distilled-body");
    clear(distilledBody);
    distilledBody.appendChild(el("div", { class: "generation-card-meta", text: `${insight.confidence || "derived"} confidence - ${insight.evidence_count || 0} evidence` }));
    distilledBody.appendChild(el("p", {}, cleanText(insight.full_text || insight.headline || "No distilled insight recorded for this generation.", 330)));
    distilledBody.appendChild(sourceTasks.length ? taskTags(sourceTasks) : taskTags([{ task_id: "bundle-wide" }]));
    if (insight.applies_when) {
      distilledBody.appendChild(el("ul", {}, el("li", {}, `Applies when: ${cleanText(insight.applies_when, 180)}`)));
    }
  };

  const render = (data) => {
    setActiveTab();
    renderTimeline(data);
    renderCards(data);
  };

  const activateBench = async (bench) => {
    state.bench = bench;
    setActiveTab();
    const figure = $(".generation-figure");
    if (figure) figure.classList.add("is-loading");
    try {
      const data = await loadBench(bench);
      const gens = data.generations || [];
      if (!gens.some((g) => g.gen === state.selectedGen)) {
        state.selectedGen = gens.length ? gens[0].gen : 1;
      }
      render(data);
    } catch (err) {
      const host = $("#generation-timeline");
      clear(host);
      host.appendChild(el("div", { class: "empty", text: `Could not load generation data: ${err.message}` }));
    } finally {
      if (figure) figure.classList.remove("is-loading");
    }
  };

  activateBench(state.bench);
})();
