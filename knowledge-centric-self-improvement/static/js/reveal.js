// reveal.js — TOC scroll-spy + (Task 7) count-up reveals.
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- TOC scroll-spy ----
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  if (links.length) {
    var sections = links
      .map(function (l) { return document.querySelector(l.getAttribute('href')); })
      .filter(Boolean);
    var setCurrent = function () {
      var y = window.scrollY + 160, cur = sections[0];
      sections.forEach(function (s) { if (s.offsetTop <= y) cur = s; });
      links.forEach(function (l) {
        l.classList.toggle('is-current', l.getAttribute('href') === '#' + cur.id);
      });
    };
    window.addEventListener('scroll', setCurrent, { passive: true });
    setCurrent();
  }

  window.__revealReduce = reduce;

  // ---- count-up on scroll-into-view ----
  var cells = Array.prototype.slice.call(document.querySelectorAll('[data-countup]'));
  if (cells.length && 'IntersectionObserver' in window) {
    var parse = function (txt) {
      var m = txt.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
      return m ? { pre: m[1], val: parseFloat(m[2]), dec: (m[2].split('.')[1] || '').length, post: m[3] } : null;
    };
    var run = function (el) {
      var p = parse(el.textContent.trim());
      if (!p) return;
      if (reduce) return;                 // leave final text as-is
      var start = null, dur = 900;
      var tick = function (t) {
        if (start === null) start = t;
        var k = Math.min((t - start) / dur, 1);
        var eased = 1 - Math.pow(1 - k, 3);
        el.textContent = p.pre + (p.val * eased).toFixed(p.dec) + p.post;
        if (k < 1) requestAnimationFrame(tick);
        else el.textContent = p.pre + p.val.toFixed(p.dec) + p.post;
      };
      requestAnimationFrame(tick);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    cells.forEach(function (c) { io.observe(c); });
  }
})();
