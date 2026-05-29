# Copy, Grammar & Consistency — Deep Review

## Severity counts
HIGH 2 · MEDIUM 4 · LOW 6

---

### "three-stage protocol" vs "four stages" — self-contradiction on one page
**Severity:** HIGH (cross-flagged: claims)
**Location:** `index.html:113` ("a three-stage protocol") vs `index.html:147` ("One bank, four stages");
`stage-anim/index.html:6,29,53` consistently say "three stages"
**Evidence:** Method prose + the 3 stage-cards say three; the animation figcaption + its 4-tab bar say four.
**Recommendation:** "Results" is a results view, not a protocol stage. Reframe as "three curation stages + results".

### Live placeholder "Correspondence details to be added." behind a nav link
**Severity:** HIGH (cross-flagged: seo-meta, links-nav)
**Location:** `index.html:432-433`
**Recommendation:** Fill in or remove the section + nav link until ready.

---

## MEDIUM
- `<!-- COPY: ... removed -->` editorial comments shipped: `index.html:59,175,425`.
- README layout is wrong: describes a `website/` dir and `cd website` that don't exist; actual tree is
  root `index.html` + `stage-anim/` + `figures/...`. Preview command fails. (`README.md:9-23`; cross-flagged: assets)
- Benchmark name "ARC-2" (`index.html:411,419`) vs "ARC-AGI-2" everywhere else.
- "knowledge bank" (sr-only `index.html:141`, `stages-anim.js` labels) vs "knowledge base" (abstract/method prose).

## LOW
- `stage-anim/index.html:53` figcaption "play through all three" but 4 tabs exist.
- "Task forum" (tab `index.html:119`) vs "Task-level forum" (card `index.html:153`).
- British spellings in `figures/figure/index.html:162,168,274` ("synthesise", "summarisation") in an otherwise US-English site.
- "21% → 47.2%" elides the denominator/gen context (`index.html:102`; stages-anim.js:12 shows 19→42/89).
- `figures/figure/index.html:445` GitHub org differs from the rest of the site (anonymized vs `xuefei-wang`).
- footer `simple-agent-opt` personal link contradicts the anonymity banner (`index.html:443`).
- Minor: "ten generations" (`:102`) vs "10 generations" (`:231`) number-format inconsistency.

## Verified-clean
Oxford comma consistent; `&mdash;` spacing consistent; h2 sentence-case consistent on the main pages;
no double-word/typo clusters found in headline/hero text.

**Top:** the three-vs-four-stages contradiction confuses the core method framing.
