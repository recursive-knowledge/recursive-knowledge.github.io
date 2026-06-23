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

  // ---- count-up reveals added in Task 7 ----
  window.__revealReduce = reduce;
})();
