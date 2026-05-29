/* Interactive per-generation timeline switcher.
 * Each .bench-switch has benchmark tabs (.bench-tab, with data-summary-src +
 * data-full-src). Picking a benchmark loads its compact Summary into the lazy
 * iframe and points the "Open full view" link at that benchmark's full-width
 * standalone dashboard page (which opens in a new tab). The full view is no
 * longer iframed — it lives on its own page. Disabled benchmarks are inert.
 */
(function () {
  "use strict";
  const switches = Array.prototype.slice.call(document.querySelectorAll(".bench-switch"));
  if (!switches.length) return;

  switches.forEach(function (root) {
    const benchTabs = Array.prototype.slice.call(root.querySelectorAll(".bench-tab"));
    const frame = root.querySelector(".fig-iframe");
    const fullLink = root.querySelector(".bench-full-link");
    if (!benchTabs.length || !frame) return;

    const activeOr = (tabs, fallback) => { const a = tabs.find(function (t) { return t.classList.contains("is-active"); }); return a || fallback; };
    let bench = (root.dataset.defaultBench) || (activeOr(benchTabs, benchTabs[0]) || {}).dataset.bench;

    const benchTab = () => benchTabs.find(function (t) { return t.dataset.bench === bench; });
    const load = (src) => { if (src && frame.getAttribute("src") !== src) frame.setAttribute("src", src); };

    // Auto-size the iframe to its content so nothing scrolls inside — show everything.
    // The embedded summary is same-origin; its D3 charts render async and the
    // centerpiece changes height on click, so we re-measure via ResizeObserver
    // plus a few delayed fallbacks.
    const wrap = frame.parentElement;
    let ro = null;
    const measure = () => {
      let doc;
      try { doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document); } catch (e) { return; }
      if (!doc || !doc.body) return;
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
      if (h > 0) { frame.style.height = h + "px"; if (wrap) wrap.style.height = h + "px"; }
    };
    const observeContent = () => {
      let doc;
      try { doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document); } catch (e) { return; }
      if (!doc || !doc.body) return;
      if (ro) ro.disconnect();
      if (typeof ResizeObserver === "function") { ro = new ResizeObserver(measure); ro.observe(doc.body); }
      [50, 250, 600, 1200].forEach(function (d) { setTimeout(measure, d); });
    };
    frame.addEventListener("load", function () { measure(); observeContent(); });
    window.addEventListener("resize", measure);

    const apply = () => {
      benchTabs.forEach(function (t) { const on = t.dataset.bench === bench; t.classList.toggle("is-active", on); t.setAttribute("aria-selected", on ? "true" : "false"); });
      const bt = benchTab();
      if (!bt) return;
      load(bt.dataset.summarySrc);
      if (fullLink && bt.dataset.fullSrc) fullLink.setAttribute("href", bt.dataset.fullSrc);
    };

    // Lazy: load the default benchmark's summary when the widget scrolls into view.
    let loaded = false;
    const initLoad = () => { if (loaded) return; loaded = true; apply(); };
    if (typeof IntersectionObserver === "function") {
      const io = new IntersectionObserver(function (entries, obs) { entries.forEach(function (e) { if (e.isIntersecting) { initLoad(); obs.disconnect(); } }); }, { threshold: 0.1 });
      io.observe(frame);
    } else { initLoad(); }
    // If arriving via the #generations anchor, load immediately.
    if (root.id && location.hash === "#" + root.id) initLoad();

    const selectable = benchTabs.filter(function (t) { return !(t.disabled || t.classList.contains("is-disabled")); });
    benchTabs.forEach(function (t) {
      t.addEventListener("click", function () { if (t.disabled || t.classList.contains("is-disabled")) return; bench = t.dataset.bench; loaded = true; apply(); });
      t.addEventListener("keydown", function (e) {
        var i = selectable.indexOf(t);
        if (i < 0) return; // disabled tab: leave default behavior
        var n = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % selectable.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + selectable.length) % selectable.length;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = selectable.length - 1;
        if (n < 0) return;
        e.preventDefault();
        var next = selectable[n];
        next.focus();
        bench = next.dataset.bench; loaded = true; apply();
      });
    });
  });
})();
