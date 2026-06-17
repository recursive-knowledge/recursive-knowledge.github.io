/* Shared D3 charts for the KCSI dashboards (replaces Plotly).
 * Exposes window.KCSICharts.{ timeline, heatmap }. Each chart is responsive
 * (re-renders on container resize) and theme-aware (re-renders on data-theme
 * change), reading colors from the page's --color-* tokens. Honest data only.
 */
(function () {
  "use strict";
  const NS = (window.KCSICharts = window.KCSICharts || {});
  const cssVar = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);

  // Registry + shared observers so every chart re-renders on resize / theme flip.
  const registry = new Set();
  const rerender = () => registry.forEach((h) => {
    if (h.isConnected && typeof h.__kcsiRender === "function") h.__kcsiRender();
    else registry.delete(h);
  });
  if (!NS._obs) {
    NS._obs = true;
    if (typeof ResizeObserver === "function") NS._ro = new ResizeObserver(() => rerender());
    if (typeof MutationObserver === "function") {
      new MutationObserver(rerender).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
    if (typeof window.addEventListener === "function") window.addEventListener("resize", rerender);
  }
  const register = (host, draw) => {
    host.__kcsiRender = draw;
    registry.add(host);
    if (NS._ro) { try { NS._ro.observe(host); } catch (e) {} }
    draw();
  };
  const haveD3 = () => typeof window.d3 !== "undefined";

  // ============================================================ Timeline (bars + cumulative line)
  NS.timeline = function (host, gens, opts) {
    opts = opts || {};
    const draw = () => {
      if (!haveD3()) { host.innerHTML = '<div class="empty">chart unavailable</div>'; return; }
      const d3 = window.d3;
      if (!gens || gens.length < 2) { host.innerHTML = '<div class="empty">Single-generation run — no timeline.</div>'; return; }
      const W = Math.max(280, host.clientWidth || 640), H = opts.height || 260;
      const m = { l: 48, r: 50, t: 26, b: 38 };
      const iw = Math.max(20, W - m.l - m.r), ih = Math.max(20, H - m.t - m.b);
      const total = opts.total || d3.max(gens, (g) => g.cumulative) || 1;
      const sel = opts.selectedGen;
      const accent = cssVar("--color-accent", "#DA7800");
      const accentLight = cssVar("--color-accent-light", "#fbeede");
      const warmHigh = cssVar("--color-warm-high", "#b10026");
      const ink = cssVar("--color-text", "#1a1a1c");
      const cool = cssVar("--color-cool", "#0e7490");
      const muted = cssVar("--color-text-secondary", "#71717a");
      const lineC = cssVar("--color-border", "#e4e1db");

      host.innerHTML = "";
      const svg = d3.select(host).append("svg")
        .attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("height", H)
        .attr("font-family", "Inter, -apple-system, sans-serif");
      const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
      const xs = d3.scaleBand().domain(gens.map((d) => d.gen)).range([0, iw]).padding(0.34);
      const maxDelta = Math.max(1, d3.max(gens, (d) => d.delta) || 1);
      const yL = d3.scaleLinear().domain([0, maxDelta]).nice().range([ih, 0]);
      const yR = d3.scaleLinear().domain([0, total]).range([ih, 0]);
      const colorD = d3.scaleLinear().domain([0, maxDelta]).range([accentLight, warmHigh]);

      // left gridlines
      g.append("g").call(d3.axisLeft(yL).ticks(4).tickSize(-iw)).call((s) => {
        s.select(".domain").remove();
        s.selectAll("line").attr("stroke", lineC).attr("stroke-opacity", 0.55);
        s.selectAll("text").attr("fill", muted).attr("font-size", 11);
      });
      // bars
      g.selectAll("rect.kc-bar").data(gens).enter().append("rect").attr("class", "kc-bar")
        .attr("x", (d) => xs(d.gen)).attr("y", (d) => yL(d.delta)).attr("width", xs.bandwidth())
        .attr("height", (d) => ih - yL(d.delta)).attr("rx", 3)
        .attr("fill", (d) => (opts.flatBars ? accent : colorD(d.delta))).attr("stroke", accent).attr("stroke-width", 1)
        .attr("opacity", (d) => (sel == null ? 1 : d.gen === sel ? 1 : 0.45))
        .style("cursor", "pointer")
        .on("click", (e, d) => { if (typeof opts.onSelect === "function") opts.onSelect(d.gen); })
        .append("title").text((d) => `G${d.gen}\nnew solves: ${d.delta}\nclick to dive in`);
      // bar value labels
      g.selectAll("text.kc-barlbl").data(gens).enter().append("text").attr("class", "kc-barlbl")
        .attr("x", (d) => xs(d.gen) + xs.bandwidth() / 2).attr("y", (d) => yL(d.delta) - 5)
        .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", ink).text((d) => d.delta);
      // cumulative line + dots + labels
      const lineGen = d3.line().x((d) => xs(d.gen) + xs.bandwidth() / 2).y((d) => yR(d.cumulative));
      g.append("path").datum(gens).attr("fill", "none").attr("stroke", cool).attr("stroke-width", 2)
        .attr("stroke-dasharray", "3,3").attr("d", lineGen);
      g.selectAll("circle.kc-cdot").data(gens).enter().append("circle").attr("class", "kc-cdot")
        .attr("cx", (d) => xs(d.gen) + xs.bandwidth() / 2).attr("cy", (d) => yR(d.cumulative)).attr("r", 4).attr("fill", cool)
        .append("title").text((d) => `G${d.gen}\ncumulative: ${d.cumulative}`);
      g.selectAll("text.kc-clbl").data(gens).enter().append("text").attr("class", "kc-clbl")
        .attr("x", (d) => xs(d.gen) + xs.bandwidth() / 2).attr("y", (d) => yR(d.cumulative) - 8)
        .attr("text-anchor", "middle").attr("font-size", 10).attr("fill", cool).text((d) => d.cumulative);
      // x axis
      g.append("g").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(xs).tickFormat((d) => `G${d}`)).call((s) => {
        s.selectAll(".domain,line").attr("stroke", lineC);
        s.selectAll("text").attr("fill", muted).attr("font-size", 11);
      });
      // right (cumulative) axis
      g.append("g").attr("transform", `translate(${iw},0)`).call(d3.axisRight(yR).ticks(4)).call((s) => {
        s.selectAll(".domain,line").attr("stroke", lineC).attr("stroke-opacity", 0.4);
        s.selectAll("text").attr("fill", muted).attr("font-size", 10);
      });
      // axis titles
      svg.append("text").attr("x", m.l).attr("y", 13).attr("font-size", 10).attr("fill", muted).text("New solves (Δ) · click a bar");
      svg.append("text").attr("x", W - m.r).attr("y", 13).attr("text-anchor", "end").attr("font-size", 10).attr("fill", cool).text(`Cumulative / ${total}`);
    };
    register(host, draw);
  };

  // ============================================================ Lineage heatmap
  NS.heatmap = function (host, data) {
    const draw = () => {
      if (!haveD3()) { host.innerHTML = '<div class="empty">chart unavailable</div>'; return; }
      const d3 = window.d3;
      const taskIds = data.taskIds || [], gens = data.gens || [], z = data.z || [];
      if (!gens.length || !taskIds.length) { host.innerHTML = '<div class="empty">No generation data.</div>'; return; }
      const labelW = 210, top = 28, cell = 13, gap = 1, botPad = 12;
      const W = Math.max(320, host.clientWidth || 720);
      const plotW = Math.max(60, W - labelW - 14);
      const cw = plotW / gens.length;
      const H = top + taskIds.length * cell + botPad;
      const warmLow = cssVar("--color-warm-low", "#fff8e6");
      const accentLight = cssVar("--color-accent-light", "#e3f1f4");
      const resolved = cssVar("--status-resolved", "#356859");
      const muted = cssVar("--color-text-secondary", "#71717a");
      const lineC = cssVar("--color-border-light", "#edebe6");
      const color = (v) => (v <= 0.5 ? d3.interpolateRgb(warmLow, accentLight)(v / 0.5) : d3.interpolateRgb(accentLight, resolved)((v - 0.5) / 0.5));

      host.innerHTML = "";
      const svg = d3.select(host).append("svg")
        .attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("height", H)
        .attr("font-family", "Inter, -apple-system, sans-serif");
      gens.forEach((gn, ci) => svg.append("text")
        .attr("x", labelW + ci * cw + cw / 2).attr("y", top - 9).attr("text-anchor", "middle")
        .attr("font-size", 10).attr("fill", muted).text("G" + gn));
      taskIds.forEach((tid, ri) => {
        svg.append("text").attr("x", labelW - 8).attr("y", top + ri * cell + cell - 3).attr("text-anchor", "end")
          .attr("font-size", 9).attr("fill", muted).attr("font-family", "var(--font-mono, monospace)")
          .text(tid.length > 34 ? tid.slice(0, 33) + "…" : tid);
        gens.forEach((gn, ci) => {
          const v = (z[ri] && z[ri][ci]) || 0;
          svg.append("rect").attr("x", labelW + ci * cw).attr("y", top + ri * cell)
            .attr("width", Math.max(1, cw - gap)).attr("height", cell - gap)
            .attr("fill", color(v)).attr("stroke", lineC).attr("stroke-width", 0.5)
            .append("title").text(`${tid} @ G${gn}\nbest-so-far reward: ${v.toFixed(2)}`);
        });
      });
    };
    register(host, draw);
  };
})();
