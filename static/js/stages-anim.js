/* Knowledge curation protocol — the loop. (replaces the old 4-stage flywheel)
 *
 * Five steps around a ring, clockwise from the top:
 *     Seed              a generic, stateless agent receives a distilled bundle from the base
 *     Attempt           it attempts one task with standard tools; the outcome is recorded
 *   1 Task-level forum  (Stage 1) agents post task-scoped evidence
 *   2 Cross-task forum  (Stage 2) agents DISCUSS what transfers, grounded,
 *                                 with agree / disagree / synthesize replies
 *   3 Distillation      (Stage 3) surviving claims → typed bundles → the base
 * The arrow from Distillation back to Seed is "the next generation seeds from the improved base".
 *
 * The shared knowledge base lives at the CENTER and visibly improves: insight "spines" fill,
 * the solve-rate counts up with a +N flash, a token flies in at Distillation.
 *
 * Honest data from figures/static/data/tb2_haiku.json (Terminal-Bench 2, Haiku 4.5):
 *   89 tasks · cumulative solved per generation = 19,24,29,33,37,37,40,41,42,42 · final 47.2%.
 *
 * Production: honors prefers-reduced-motion, pauses offscreen (IntersectionObserver),
 * play/pause/restart + 0.5/1/2x speed, keyboard-activatable step tabs, ARIA live caption.
 */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const CX = 235, CY = 208, R = 142;
  const TOTAL = 89;
  // Cumulative tasks solved at each generation (verbatim: tb2_haiku.json generations[].cumulative).
  const CUMULATIVE = [19, 24, 29, 33, 37, 37, 40, 41, 42, 42];
  const NGEN = CUMULATIVE.length;
  // Per-generation distilled insight (short label; full text in tb2_haiku.json highlights.per_gen).
  const INSIGHTS = [
    "Clean exit codes ≠ correctness — debug schemas & artifacts, not logic",
    "Call a domain oracle before submitting",
    "Capture both streams — make 2>&1 | tee build.log",
    "Read the tests as spec — grep /tests/ first",
    "exit 0 with score 0 is a schema mismatch, not a crash",
    "Re-query after you mutate — stale caches lie",
    "Run the verifier yourself before submitting",
    "C89 shared subset for polyglot / cross-compile",
    "Hard-coded fixture paths must match exactly",
    "Same failure for 5 generations = a missing diagnostic step",
  ];

  const el = (t, a = {}, txt) => { const n = document.createElementNS(NS, t); for (const k in a) if (a[k] != null && a[k] !== false) n.setAttribute(k, a[k]); if (txt != null) n.textContent = txt; return n; };
  const polar = (ang, r) => ({ x: CX + r * Math.cos(ang * Math.PI / 180), y: CY + r * Math.sin(ang * Math.PI / 180) });
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pct = (g) => Math.round(CUMULATIVE[g] / TOTAL * 100);

  const sunHTML = () => `<svg viewBox="-16 -16 32 32" aria-hidden="true">` +
    Array.from({ length: 12 }, (_, i) => { const a = i * 30 * Math.PI / 180, h = 7 * Math.PI / 180; const p = (r, x) => `${(r * Math.cos(x)).toFixed(1)},${(r * Math.sin(x)).toFixed(1)}`; return `<path d="M${p(2.6, a - h)} L${p(13, a - h)} L${p(13, a + h)} L${p(2.6, a + h)} Z" fill="var(--color-accent)"/>`; }).join("") + `</svg>`;

  // ---- Steps ----------------------------------------------------------------
  const BEATS = [
    { key: "Seed", short: "Seed", ang: -90, forum: false,
      crumb: "Seed", title: "A fresh agent seeds from the base",
      text: "A fresh, stateless agent reads a distilled bundle — task-level plus cross-task guidance — from the shared base.",
      detail: () => `<div class="kc-seed"><span class="kc-lbl">Seed bundle → fresh agent</span>
        <div class="kc-row"><span class="t">task-level</span><span>Last attempt on this task missed the empty-artifact check.</span></div>
        <div class="kc-row"><span class="t">cross-task</span><span>Clean exit codes ≠ correctness — open the output.</span></div></div>` },
    { key: "Attempt", short: "Attempt", ang: -18, forum: false,
      crumb: "Attempt", title: "It attempts one task with standard tools",
      text: "It works the task once with standard tools. Here the tests pass with exit 0 — but the result is empty.",
      detail: () => `<div class="kc-term"><span class="dim">$</span> pytest tests/ -q<br>....&nbsp;&nbsp;<span class="dim">exit 0</span><br><span class="dim">$</span> cat out/result.json<br><span class="warn">{}</span> <span class="dim"># exit 0 — but empty</span></div>` },
    { key: "Task-level forum", short: "Task-level", ang: 54, forum: true, live: true,
      crumb: "Stage 1 · Task-level forum", title: "A forum on this one task",
      text: "Agents who worked this task post what helped and what misled them — scoped to the task.",
      head: "Task-level forum · path-tracing", grounded: "live · scoped to 1 task",
      thread: [
        { who: "agent · attempt #2", at: 150, tx: "Exit code 0 didn’t mean it worked — <code>result.json</code> was empty." },
        { who: "agent · attempt #5", at: 1150, reply: true, stance: "agree", tx: "Same here — add an “open the artifact” check before trusting exit 0." },
        { who: "agent · attempt #9", at: 2250, reply: true, tx: "Logged: a clean exit code on an empty output." },
      ] },
    { key: "Cross-task forum", short: "Cross-task", ang: 126, forum: true, live: true,
      crumb: "Stage 2 · Cross-task forum", title: "A forum across all the generation’s tasks",
      text: "Agents discuss what transfers across tasks — each claim grounded in a primitive; replies agree, disagree, or synthesize.",
      head: "Cross-task forum · generation 1", grounded: "live · grounded in test-runner behavior",
      thread: [
        { who: "@path-tracing", at: 150, tx: "Run the verifier yourself before submitting." },
        { who: "@pytorch-model-cli", at: 1100, reply: true, stance: "agree", tx: "Confirmed — a clean exit hid an empty result for me too." },
        { who: "@mcmc-sampling-stan", at: 2100, reply: true, stance: "dis", tx: "Not universal — some tasks ship no /tests/ dir." },
        { who: "@kv-store-grpc", at: 3100, reply: true, stance: "syn", tx: "Then generalize: open the artifact, don’t just trust exit 0." },
      ] },
    { key: "Distillation", short: "Distillation", ang: 198, forum: false,
      crumb: "Stage 3 · Distillation", title: "Surviving claims are distilled into the base",
      text: "Surviving claims are distilled into typed bundles and written back to the base; vague advice is dropped.",
      detail: () => `<div class="kc-bundle"><div class="bh">Distilled bundle (typed) → written to base</div>
        <table><tr><td class="k">insight</td><td>Clean exit codes don’t equal correctness.</td></tr>
        <tr><td class="k">check</td><td>Open the produced artifact, not just the exit code.</td></tr>
        <tr><td class="k">pitfall</td><td>Trusting exit 0 on an empty result.</td></tr></table></div>` },
  ];
  const N = BEATS.length;
  const SPINE_N = 10;
  // Per-step dwell (ms); the two forum steps linger so their live thread can play.
  const DUR = [2400, 2600, 4000, 4600, 3000];
  const BOUNDS = []; { let acc = 0; for (const d of DUR) { BOUNDS.push({ start: acc, end: acc + d }); acc += d; } }
  const TOTAL_MS = BOUNDS[N - 1].end;

  // ---- State ----------------------------------------------------------------
  const S = { host: null, detail: null, svg: null, nodes: [], fAgents: [], spines: [],
    pulse: null, glow: null, ftoken: null, halo: null, pctEl: null, genEl: null, insEl: null, deltaEl: null };
  const ctl = { elapsed: 0, last: 0, playing: true, speed: 1, gen: 0, lastIdx: -1, raf: null,
    inView: true, reducedMotion: false, userPaused: false, stepMs: 3000 };
  let tabs = [], speedBtns = [], playBtn = null;

  // ---- Builders -------------------------------------------------------------
  function icon(key) {
    const g = el("g", { class: "kc-ico" }); const add = (n) => g.appendChild(n);
    if (key === "Seed") { add(el("path", { d: "M0,-8 C5,-3 5,3 0,8 C-5,3 -5,-3 0,-8 Z" })); add(el("line", { x1: 0, y1: -8, x2: 0, y2: 8 })); }
    else if (key === "Attempt") { add(el("rect", { x: -8, y: -6, width: 16, height: 12, rx: 2 })); add(el("path", { d: "M-3,-2 L1,1 L-3,4" })); }
    else if (key === "Task-level forum") { add(el("path", { d: "M-8,-6 h16 v9 h-10 l-3,3 v-3 h-3 z" })); }
    else if (key === "Cross-task forum") { add(el("path", { d: "M-9,-5 h11 v7 h-7 l-3,3 v-3 h-1 z" })); add(el("path", { d: "M-1,-1 h10 v7 h-2 v3 l-3,-3 h-5 z" })); }
    else { add(el("rect", { x: -8, y: -7, width: 6, height: 14, rx: 1 })); add(el("rect", { x: 1, y: -7, width: 6, height: 14, rx: 1 })); }
    return g;
  }
  function buildSVG() {
    const svg = el("svg", { class: "kc-svg", viewBox: "0 0 470 410", role: "img", "aria-labelledby": "kc-anim-title kc-anim-desc", preserveAspectRatio: "xMidYMid meet" });
    svg.appendChild(el("title", { id: "kc-anim-title" }, "Knowledge curation protocol — a loop: seed, attempt, task-level forum, cross-task forum, distillation"));
    svg.appendChild(el("circle", { class: "kc-ring", cx: CX, cy: CY, r: R }));

    // central vault (the shared knowledge base)
    const vault = el("g", { class: "kc-vault" });
    vault.appendChild(el("ellipse", { class: "kc-halo", id: "kc-halo", cx: CX, cy: CY, rx: 92, ry: 78 }));
    vault.appendChild(el("rect", { class: "kc-vault-bg", x: 162, y: 150, width: 146, height: 120, rx: 11 }));
    vault.appendChild(el("text", { class: "kc-vault-lbl", x: CX, y: 167, "text-anchor": "middle" }, "SHARED KNOWLEDGE BASE"));
    const spinesG = el("g", { class: "kc-spines" });
    for (let i = 0; i < SPINE_N; i++) { const w = 10, gap = 2, x = CX - (SPINE_N * w + (SPINE_N - 1) * gap) / 2 + i * (w + gap);
      const s = el("rect", { class: "kc-spine", x, y: 176, width: w, height: 18, rx: 2, opacity: 0 });
      s.appendChild(el("title", {}, INSIGHTS[i])); spinesG.appendChild(s); S.spines.push(s); }
    vault.appendChild(spinesG);
    S.pctEl = el("text", { class: "kc-pct", id: "kc-pct", x: CX, y: 232, "text-anchor": "middle" }, "21%");
    vault.appendChild(S.pctEl);
    vault.appendChild(el("text", { class: "kc-pct-lbl", x: CX, y: 244, "text-anchor": "middle" }, "SOLVE RATE"));
    S.genEl = el("text", { class: "kc-vault-gen", id: "kc-gen", x: CX, y: 260, "text-anchor": "middle" }, "Gen 1 · 19 / 89 solved");
    vault.appendChild(S.genEl);
    S.deltaEl = el("text", { class: "kc-delta", id: "kc-delta", x: 290, y: 226, "text-anchor": "middle" }, "+3");
    vault.appendChild(S.deltaEl);
    svg.appendChild(vault);

    // nodes
    const nodesG = el("g", { class: "kc-nodes" });
    S.nodes = BEATS.map((b) => {
      const p = polar(b.ang, R);
      const g = el("g", { class: "kc-node" + (b.forum ? " isforum" : ""), transform: `translate(${p.x},${p.y})` });
      g.appendChild(el("circle", { class: "ring2", r: 27 }));
      g.appendChild(el("circle", { class: "nbg", r: 23 }));
      g.appendChild(icon(b.key));
      const lp = polar(b.ang, R + (Math.abs(Math.sin(b.ang * Math.PI / 180)) > 0.55 ? 38 : 32));
      const dx = lp.x - p.x, dy = lp.y - p.y + (b.ang > 10 ? 4 : 0);
      const anchor = Math.abs(dx) < 8 ? "middle" : (dx > 0 ? "start" : "end");
      const words = b.key.split(" ");
      if (words.length > 1) { g.appendChild(el("text", { class: "lab", x: dx, y: dy - 5, "text-anchor": anchor }, words[0]));
        g.appendChild(el("text", { class: "lab", x: dx, y: dy + 8, "text-anchor": anchor }, words.slice(1).join(" "))); }
      else g.appendChild(el("text", { class: "lab", x: dx, y: dy, "text-anchor": anchor }, b.key));
      nodesG.appendChild(g); return g;
    });
    // forum agents (gather at the active forum node)
    for (let i = 0; i < 4; i++) { const g = el("g", { class: "kc-fagent" }); const inner = el("g", { transform: "scale(0.5)" });
      for (let k = 0; k < 12; k++) { const a = k * 30 * Math.PI / 180, h = 7 * Math.PI / 180; const p = (r, x) => `${(r * Math.cos(x)).toFixed(1)},${(r * Math.sin(x)).toFixed(1)}`;
        inner.appendChild(el("path", { d: `M${p(2.6, a - h)} L${p(13, a - h)} L${p(13, a + h)} L${p(2.6, a + h)} Z`, fill: "var(--color-accent)" })); }
      g.appendChild(inner); nodesG.appendChild(g); S.fAgents.push(g); }
    svg.appendChild(nodesG);

    S.ftoken = el("circle", { class: "kc-ftoken", id: "kc-ftoken", r: 6, cx: CX, cy: CY }); svg.appendChild(S.ftoken);
    S.glow = el("circle", { class: "kc-glow", r: 12, cx: CX, cy: CY - R }); svg.appendChild(S.glow);
    S.pulse = el("circle", { class: "kc-pulse", r: 5.5, cx: CX, cy: CY - R }); svg.appendChild(S.pulse);
    S.halo = svg.querySelector("#kc-halo");
    return svg;
  }

  // ---- Render ---------------------------------------------------------------
  function spinesForGen(g) { return Math.min(SPINE_N, g + 1); }
  function setGen(g, flash) {
    const prev = pct(clamp(ctl.gen, 0, NGEN - 1));
    ctl.gen = g; const p = pct(g);
    S.genEl.textContent = `Gen ${g + 1} · ${CUMULATIVE[g]} / ${TOTAL} solved`;
    S.pctEl.textContent = `${p}%`;
    const lit = spinesForGen(g);
    S.spines.forEach((s, i) => { s.setAttribute("opacity", i < lit ? 1 : 0); s.classList.remove("fresh"); });
    S.halo.setAttribute("opacity", (0.05 + 0.16 * (lit / SPINE_N)).toFixed(3));
    if (flash && p > prev && !ctl.reducedMotion && typeof S.deltaEl.animate === "function") {
      S.deltaEl.textContent = `+${p - prev}`; S.deltaEl.setAttribute("opacity", "1");
      S.deltaEl.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-12px)" }], { duration: 1100, easing: "ease-out" });
    } else { S.deltaEl.setAttribute("opacity", "0"); }
  }
  // Live forum thread (the two forum steps): posts arrive over the step's dwell.
  let liveThread = null;
  function buildThread(b) {
    const lbl = (s) => s === "syn" ? "synthesize" : s === "dis" ? "push back" : "agree";
    const posts = b.thread.map((p) => `<div class="pst${p.reply ? " reply" : ""}"><div class="av">${sunHTML()}</div><div class="pb"><div class="who">${p.who}${p.stance ? ` <span class="stance ${p.stance}">${lbl(p.stance)}</span>` : ""}</div><div class="tx">${p.tx}</div></div></div>`).join("");
    return `<div class="kc-forum livethread"><div class="fh"><span>${b.head}</span><span class="grounded">${b.grounded}</span></div>${posts}<div class="kc-typing"><span></span><span></span><span></span></div></div>`;
  }
  function updateThread(localT) {
    if (!liveThread) return;
    liveThread.posts.forEach((el, i) => el.classList.toggle("show", localT >= liveThread.thread[i].at));
    const next = liveThread.thread.find((p) => localT < p.at);
    if (liveThread.typing) liveThread.typing.classList.toggle("show", !!next && localT > 180);
  }
  function activate(idx) {
    S.nodes.forEach((n, i) => { n.classList.toggle("on", i === idx); n.classList.toggle("dim", i !== idx); });
    tabs.forEach((t, i) => { const on = i === idx; t.classList.toggle("is-active", on); t.setAttribute("aria-pressed", on ? "true" : "false"); });
    const b = BEATS[idx];
    const body = b.live ? buildThread(b) : b.detail();
    S.detail.innerHTML = `<div class="kc-fade"><div class="kc-crumb">${b.crumb}</div>
      <h3 class="kc-dtitle">${b.title}</h3><p class="kc-dtext">${b.text}</p>${body}</div>`;
    liveThread = b.live ? { posts: Array.prototype.slice.call(S.detail.querySelectorAll(".pst")), thread: b.thread, typing: S.detail.querySelector(".kc-typing") } : null;
    if (liveThread && ctl.reducedMotion) updateThread(1e9);   // static: reveal the whole thread
    // forum agents gather at the active forum node
    S.fAgents.forEach((fa, k) => {
      if (b.forum) { const aa = (b.ang + (k - 1.5) * 26) * Math.PI / 180, rr = R - 30;
        fa.setAttribute("transform", `translate(${(CX + rr * Math.cos(aa)).toFixed(1)},${(CY + rr * Math.sin(aa)).toFixed(1)})`); fa.classList.add("on"); }
      else fa.classList.remove("on");
    });
  }
  function distillStrike() {
    if (ctl.reducedMotion) return;
    const src = polar(198, R), lit = spinesForGen(ctl.gen);
    S.ftoken.setAttribute("opacity", "1");
    if (typeof S.ftoken.animate === "function")
      S.ftoken.animate([{ transform: `translate(${(src.x - CX).toFixed(1)}px,${(src.y - CY).toFixed(1)}px)` }, { transform: "translate(0px,0px)" }], { duration: 650, easing: "cubic-bezier(.5,0,.3,1)" });
    setTimeout(() => { S.ftoken.setAttribute("opacity", "0");
      if (lit < SPINE_N) { S.spines[lit].setAttribute("opacity", 1); S.spines[lit].classList.add("fresh");
        S.halo.setAttribute("opacity", (0.05 + 0.16 * ((lit + 1) / SPINE_N)).toFixed(3)); } }, 650);
  }

  function tick(now) {
    if (!ctl.playing || !ctl.inView) { ctl.raf = null; return; }
    const dt = ctl.last ? (now - ctl.last) : 16; ctl.last = now;
    ctl.elapsed += dt * ctl.speed;
    if (ctl.elapsed >= TOTAL_MS) {          // one full loop completed → advance a generation
      ctl.elapsed -= TOTAL_MS;
      const next = ctl.gen + 1;
      if (next >= NGEN) setGen(0, false);   // past gen 10 → loop back to gen 1 (no flash)
      else setGen(next, true);              // advance, flash the +N gain
    }
    let idx = N - 1; for (let i = 0; i < N; i++) { if (ctl.elapsed < BOUNDS[i].end) { idx = i; break; } }
    const localT = ctl.elapsed - BOUNDS[idx].start, frac = localT / DUR[idx];
    const fromAng = BEATS[idx].ang, toAng = BEATS[(idx + 1) % N].ang + (idx === N - 1 ? 360 : 0);
    const ang = fromAng + (toAng - fromAng) * ease(clamp(frac, 0, 1));
    const pp = polar(ang, R);
    S.pulse.setAttribute("cx", pp.x); S.pulse.setAttribute("cy", pp.y);
    S.glow.setAttribute("cx", pp.x); S.glow.setAttribute("cy", pp.y);
    if (ctl.lastIdx !== idx) { activate(idx); if (BEATS[idx].key === "Distillation") distillStrike(); ctl.lastIdx = idx; }
    updateThread(localT);
    ctl.raf = requestAnimationFrame(tick);
  }

  // ---- Controls -------------------------------------------------------------
  function syncPlayBtn() { if (!playBtn) return; playBtn.textContent = ctl.playing ? "⏸" : "▶"; playBtn.setAttribute("aria-label", ctl.playing ? "Pause" : "Play"); S.host.classList.toggle("is-paused", !ctl.playing); }
  function play() { if (ctl.reducedMotion) return; ctl.playing = true; ctl.userPaused = false; ctl.last = 0; if (!ctl.raf && ctl.inView) ctl.raf = requestAnimationFrame(tick); syncPlayBtn(); }
  function pause() { ctl.playing = false; if (ctl.raf) { cancelAnimationFrame(ctl.raf); ctl.raf = null; } syncPlayBtn(); }
  function seekBeat(i) { ctl.elapsed = BOUNDS[i].start; ctl.lastIdx = -1; activate(i); ctl.lastIdx = i; if (!ctl.reducedMotion) play(); }
  function restart() { ctl.elapsed = 0; ctl.lastIdx = -1; setGen(0, false); activate(0); ctl.lastIdx = 0; play(); }
  function setSpeed(s) { ctl.speed = s; speedBtns.forEach((b) => { const on = Number(b.dataset.speed) === s; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }); if (ctl.playing && !ctl.raf && ctl.inView && !ctl.reducedMotion) { ctl.last = 0; ctl.raf = requestAnimationFrame(tick); } }

  function wire(wrap) {
    tabs = Array.prototype.slice.call(wrap.querySelectorAll(".kc-tab"));
    speedBtns = Array.prototype.slice.call(wrap.querySelectorAll(".kc-speed-btn"));
    playBtn = wrap.querySelector('[data-act="playpause"]');
    const restartBtn = wrap.querySelector('[data-act="restart"]');
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => seekBeat(i));
      tab.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); seekBeat(i); } });
    });
    if (playBtn) playBtn.addEventListener("click", () => { if (ctl.playing) { ctl.userPaused = true; pause(); } else play(); });
    if (restartBtn) restartBtn.addEventListener("click", restart);
    speedBtns.forEach((b) => b.addEventListener("click", () => setSpeed(Number(b.dataset.speed))));
  }

  // ---- Observers + boot -----------------------------------------------------
  function setupReducedMotion() {
    if (typeof window.matchMedia !== "function") return false;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    ctl.reducedMotion = mq.matches;
    if (mq.addEventListener) mq.addEventListener("change", (e) => { ctl.reducedMotion = e.matches; if (e.matches) { pause(); setGen(NGEN - 1, false); activate(N - 1); S.host.classList.add("reduced-motion"); } else { S.host.classList.remove("reduced-motion"); restart(); } });
    return mq.matches;
  }
  function setupInView() {
    if (typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver((entries) => { for (const e of entries) { ctl.inView = e.isIntersecting; if (ctl.reducedMotion || ctl.userPaused) continue; if (e.isIntersecting && ctl.playing && !ctl.raf) { ctl.last = 0; ctl.raf = requestAnimationFrame(tick); } } }, { threshold: 0.05 });
    io.observe(S.host);
  }
  function boot() {
    S.host = document.getElementById("stages-anim");
    if (!S.host) return;
    S.detail = document.getElementById("kc-detail");
    S.svg = buildSVG(); S.host.appendChild(S.svg);
    const wrap = S.host.closest(".kc-fig") || S.host.parentNode;
    wire(wrap);
    setGen(0, false); activate(0); ctl.lastIdx = 0;
    if (setupReducedMotion()) { pause(); setGen(NGEN - 1, false); activate(N - 1); S.host.classList.add("reduced-motion"); syncPlayBtn(); }
    else { setupInView(); ctl.raf = requestAnimationFrame(tick); syncPlayBtn(); }
    window.__KC_ANIM = { seekBeat, restart, play, pause, setSpeed, setGen, state: ctl, beats: BEATS };
    console.log("[stages-anim] boot complete (knowledge curation loop v4)");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
