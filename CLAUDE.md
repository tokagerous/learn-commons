# Learn Commons — context for future Claude sessions

A self-hostable, browser-based **multi-program learning platform** for professional certifications. Covers the IMA's CMA Part 1 (all six sections per the 2024 CSO) and FMAA (all five sections). The repo is structured to add more programs (CMA Part 2, CPA, etc.) without touching existing code. Static HTML + CSS + JS — no build step, no backend.

## Repository layout

```
/Learning/
  index.html                ← Multi-program hub (root landing page)
  404.html                  ← Pages 404 with redirect table for moved URLs
  README.md
  CLAUDE.md                 ← This file
  .nojekyll
  assets/
    style.css               ← Shared design system (Fraunces + Lora + JetBrains Mono)
    engine.js               ← Shared engine (CMA.init reads window.SECTION_CONFIG)
  resources/                ← Authoritative IMA reference PDFs (linked from program landings)
    2024 CMA Content Specification Outlines Final.pdf
    CMA Handbook 3252026.pdf
    FMAA Content Specification Outlines.pdf
    FMAA_Handbook_2023.pdf
  programs/
    cma-part-1/
      index.html            ← CMA Part 1 program landing
      section-a.html        ← External Financial Reporting (15%) · DEEP
      section-b.html        ← Planning, Budgeting & Forecasting (20%) · DEEP
      section-c.html        ← Performance Management (20%) · DEEP
      section-d.html        ← Cost Management (15%) · CSO-driven scaffold
      section-e.html        ← Internal Controls (15%) · CSO-driven scaffold
      section-f.html        ← Technology and Analytics (15%) · CSO-driven scaffold
    fmaa/
      index.html            ← FMAA program landing
      section-a.html        ← General Accounting & Financial Mgmt (25%) · DEEP
      section-b.html        ← FS Preparation & Analysis (25%) · CSO scaffold
      section-c.html        ← Planning & Budgeting (20%) · CSO scaffold
      section-d.html        ← Cost Mgmt & Performance Metrics (20%) · CSO scaffold
      section-e.html        ← Professional Ethics (10%) · CSO scaffold
```

**Section depth tiers**:
- **DEEP** — 12-34 units, multiple tests, 100+ practice Qs, 7-8 flashcard decks. Full topical coverage with diagrams and interactives.
- **CSO-driven scaffold** — every CSO sub-topic covered as a substantive unit (lead paragraph + 2-3 § sub-sections + 2-3 inline quizzes), one starter test (8-15 questions), 1-2 flashcard decks, complete formula/key-takeaway maps. Built from the IMA's official CSO PDFs in `resources/`.
- Both tiers use the same engine + shared `assets/`.

## CSO mapping

The CSO PDFs in `resources/` are the authoritative source for section structure. Every section file's `navStructure` mirrors the CSO sub-topics (e.g. CMA Section D nav has groups D.1, D.2, D.3, D.4, D.5 matching the 2024 CSO). When a future change to the CSO is published, update the corresponding section file's nav and unit content; do NOT add ad-hoc topics outside the CSO.

CMA Part 1 cognitive level: all sections are **Level C** (knowledge → comprehension → application → analysis → synthesis → evaluation). FMAA is Levels A and B only (no synthesis/evaluation).

### URL paths
- Multi-program hub: `/learn-commons/index.html`
- Program landing: `/learn-commons/programs/<program>/index.html`
- Section/domain pages: `/learn-commons/programs/<program>/section-X.html` or `domain-X.html`

### Old-URL redirects
Pre-reorganization URLs (`/learn-commons/cma-section-a.html` etc.) automatically redirect via the 404 handler's redirect table. The table is in `404.html` — update it when moving more files.

### Asset paths
- Files at root (`index.html`, `404.html`): use `assets/style.css?v=2`
- Files at `programs/<program>/` depth: use `../../assets/style.css?v=2`
- Cache-bust query string `?v=N` — bump on each shared-asset deploy

## Architecture

### All three sections use shared assets
Each section file `<link>`s `assets/style.css` and loads `<script src="assets/engine.js">`. Each defines a `window.SECTION_CONFIG` inline that the engine reads. Per-unit calculator/slider `init*` functions stay inline in each section file (the engine auto-discovers and calls them).

### Section A's annotation localStorage key
Section A's annotation storage key is `cma-ann-v2` (matches the original pre-refactor key, so any existing user annotations migrate cleanly). Sections B and C use `cma-section-b-ann-v1` and `cma-section-c-ann-v1` respectively.

### Why three separate section files instead of one SPA
- Smaller initial loads — students study one section at a time
- Each section's localStorage progress is isolated (own `STORAGE_KEY`)
- Simpler to deploy and review per-section content changes
- Annotation char-offsets stay stable per-section

## Engine API (`assets/engine.js`)

The engine exposes one entry point:

```js
window.addEventListener("DOMContentLoaded", () => {
  CMA.init(window.SECTION_CONFIG);
});
```

`SECTION_CONFIG` shape:
```js
{
  sectionId: "B",                    // "A" | "B" | "C"
  sectionTitle: "Planning, Budgeting & Forecasting",
  storageKey: "cma-section-b-progress-v1",
  annotationKey: "cma-section-b-ann-v1",
  navStructure: [{ group: "...", units: [{ id, num, title }] }],
  keyTakeaways: { unitId: ["bullet 1", "bullet 2", ...] },
  flashcardDecks: { deckKey: { title, eyebrow, cards: [[q, a], ...] } },
  formulaReference: [{ section: "...", items: [{ label, formula, unitId }] }],
  totalUnits: 25,
  trackedUnits: 24,                  // excludes cover
}
```

The engine handles:
- Sidebar nav (`buildNav`)
- Search filter (`/` to focus)
- Keyboard shortcuts (← → J K B A F M ?)
- Inline quiz handler (try-again, per-distractor rationales via `data-rationale`)
- Test controller (timer, flag, missed-only replay, full-question review)
- Bucket-sort drag/drop (`.bucket-sort[data-items]`)
- Formula reference panel (ƒx button)
- Key Takeaways injection (read from `keyTakeaways` map)
- Flashcards hub + per-deck study view
- Annotation system (highlights × 4 colors, notes, bookmarks; localStorage-backed)

Each section may also define its own `init*` functions inline for unit-specific calculators/sliders. The engine calls every `window.init*` function with `typeof check` after wiring the generic ones.

## Per-unit content shape

Every content unit follows this template:

```html
<article class="unit" data-id="UNIT_ID">
  <span class="unit-eyebrow">Unit X · Topic group</span>
  <h1>Unit title</h1>
  <p class="unit-lead">One-sentence framing of why this matters.</p>

  <h2><span class="marker">§X.1</span>Sub-section heading</h2>
  <p>Plain-language explanation.</p>

  <!-- Optional: callouts, formula boxes, fin-tables, diagrams -->
  <div class="callout analogy"><span class="callout-label">Analogy</span><p>...</p></div>
  <div class="formula-box">Formula = ...</div>

  <!-- Optional: interactive (calculator/slider or bucket-sort) -->
  <div class="interactive"><span class="interactive-tag">Try it</span> ... </div>

  <!-- 2-3 inline quizzes per unit -->
  <div class="quiz" data-correct="2">
    <h3>Check your understanding</h3>
    <p class="quiz-prompt">Question text…</p>
    <ul class="quiz-options">
      <li data-rationale="Why this is wrong">Distractor A</li>
      <li>Distractor B</li>
      <li>Correct answer</li>
      <li>Distractor D</li>
    </ul>
    <div class="quiz-explanation"><strong>Why:</strong> Full explanation.</div>
  </div>

  <button class="btn done-btn" id="mark-done-UNIT_ID">Mark complete</button>
  <div class="unit-footer">
    <button class="nav-link" onclick="goTo(PREV)"><span class="dir">← Previous</span><span class="ttl">…</span></button>
    <button class="nav-link next" onclick="goTo(NEXT)"><span class="dir">Next →</span><span class="ttl">…</span></button>
  </div>
</article>
```

Key Takeaways are auto-injected from the `keyTakeaways` map — no markup needed in the unit itself.

## Test markup shape

```html
<article class="unit" data-id="900">
  <span class="unit-eyebrow">Practice Test 1 · …</span>
  <h1>Test 1 — …</h1>
  <p class="unit-lead">…</p>

  <div class="test-intro">
    <h2>Coverage</h2>
    <p>…</p>
    <div class="test-meta">
      <span>Questions<strong>25</strong></span>
      <span>Time target<strong>~45 min</strong></span>
      <span>Pass mark<strong>75%</strong></span>
    </div>
  </div>

  <div class="test">
    <div class="test-progress">
      <span class="answered">0 / 25 answered</span>
      <div class="score-bar"><div class="score-fill"></div></div>
      <span class="score-percent">0 correct</span>
    </div>
    <div class="test-question" data-correct="2" data-unit="3" data-topic="Topic label">
      <div class="q-num"><span class="num-text">Question 1</span><span class="topic">Sub-topic</span></div>
      <p class="quiz-q">Stem…</p>
      <ul class="quiz-options"><li>A</li><li>B</li><li>Correct</li><li>D</li></ul>
      <div class="quiz-explanation"><strong>Why:</strong> …</div>
    </div>
    <!-- … more questions … -->
    <div class="test-summary">
      <h2>Test 1 · Results</h2>
      <div class="score-display">0%</div>
      <div class="score-meta">—</div>
      <div class="missed-list"></div>
      <button class="btn restart-btn">↻ Restart with shuffled order</button>
    </div>
  </div>
</article>
```

The engine auto-injects: timer (1.8 min/q target), per-question flag button, "Replay missed/flagged only" actions in the summary.

## CMA Part 1 weighting (per 2024 CSO; all Level C)

| Section | Topic | Weight | Depth tier |
|---|---|---|---|
| A | External Financial Reporting | 15% | DEEP |
| B | Planning, Budgeting & Forecasting | 20% | DEEP |
| C | Performance Management | 20% | DEEP |
| D | Cost Management | 15% | Scaffold |
| E | Internal Controls | 15% | Scaffold |
| F | Technology & Analytics | 15% | Scaffold |

## FMAA weighting (per 2024 CSO; Levels A and B)

| Section | Topic | Weight | Depth tier |
|---|---|---|---|
| A | General Accounting & Financial Management | 25% | DEEP |
| B | Financial Statement Preparation & Analysis | 25% | Scaffold |
| C | Planning & Budgeting | 20% | Scaffold |
| D | Cost Management & Performance Metrics | 20% | Scaffold |
| E | Professional Ethics | 10% | Scaffold |

## 404 page recovery links

`404.html` lives at the site root. GitHub Pages serves it for any unmatched path under the project, so a request to `/learn-commons/foo/bar/baz` shows the 404 with `location.pathname = "/learn-commons/foo/bar/baz"`. Plain relative `<a href="index.html">` would resolve against the failing URL's base (`/learn-commons/foo/bar/`), keeping users stuck in 404 loops.

The fix uses two layers:
1. **Static fallback**: each recovery link's `href` is an absolute root-relative path with the GitHub Pages project prefix (`/learn-commons/index.html`). Works without JS.
2. **Runtime rewrite**: a small inline script detects the actual project base from `location.pathname` and rewrites each link's `href` accordingly. Falls back to `/` for root-domain or custom-domain deployments. The repo name is hardcoded in the `REPO_NAMES` array — **forks should update this constant**.

## Conventions

- **Don't add emojis** to user-facing content unless asked. The current cover and section headers use a few, mirroring Section A's existing style — keep it minimal.
- **Don't auto-shuffle inline quiz options** (would invalidate annotations stored against character offsets). Tests are allowed to shuffle on restart because users see them as "exam mode" and don't expect annotations to survive shuffles.
- **Per-distractor rationales** go in `<li data-rationale="...">`. The engine reveals them when that wrong option is clicked.
- **Test questions** must include `data-correct` (zero-indexed), `data-unit` (the source unit ID), and `data-topic` (short label shown in the missed-list).
- **All `id="mark-done-NNN"` buttons** are auto-wired by the engine via the `mark-done-` prefix.
- **Flashcard cards** are `[question, answer]` tuples; HTML allowed in both.

## Known issues / not-yet-done

- Section A is not yet using shared assets (will require localStorage migration if moved)
- No service worker for offline use yet
- No printable PDF export of units (could be a future enhancement)
- Tests don't yet support marking "I'm not sure" mid-test for review (only post-grade flag works)
- The annotation char-offset approach drifts when DOM is mutated mid-session (e.g., quiz rationales appearing after a wrong click). Acceptable trade-off for now.

## Deploying

Any static host works. Examples:

```bash
# Vercel
npx vercel --prod

# Netlify drag-and-drop
zip -r build.zip *.html assets/
# Drop the zip into Netlify's deploy form.

# GitHub Pages
# Push to a repo's main branch; enable Pages from Settings → Pages → Branch=main, Folder=/
```

No environment variables, no DB, no auth. All progress is per-browser via `localStorage`.

## Adding a new program

1. Create `programs/<new-program>/` directory
2. Add `index.html` (program landing) using `programs/cma-part-1/index.html` or `programs/fmaa/index.html` as template
3. Add `section-X.html` / `domain-X.html` files for content. Each:
   - `<link rel="stylesheet" href="../../assets/style.css?v=2" />`
   - Sidebar with nav + "← All sections" (program landing) and "All programs" (root) links
   - All annotation markup (toolbar/panel/modal/toggle button)
   - Formula panel and keyboard help markup
   - `window.SECTION_CONFIG = { sectionId, sectionTitle, storageKey, annotationKey, totalUnits, trackedUnits, navStructure, keyTakeaways, flashcardDecks, formulaReference }`
   - `<script src="../../assets/engine.js?v=2"></script>` then `<script>CMA.init(window.SECTION_CONFIG);</script>`
4. Add a card on root `index.html` linking to the new program
5. Each program uses its own `storageKey` and `annotationKey` so progress and annotations are isolated

## Roadmap

1. **Done**: CMA Part 1 — Section A (34 units, 6 tests, 198 inline quizzes after A.1 expansion, 230 test Qs, 8 flashcard decks); Section B (16 units, 3 tests + final, 48 inline quizzes, 100 test Qs, 8 decks); Section C (12 units, 3 tests + final, 36 inline quizzes, 95 test Qs, 7 decks).
2. **Done**: Multi-program reorganization. Files under `programs/<program>/`. Shared `assets/` at root. 404 redirects for old URLs.
3. **Done**: FMAA Section A — full content (20 units, 4 tests, 130+ Qs, 8 decks).
4. **Done**: A.1 Units 1-8 expanded to 15 inline quizzes each.
5. **Done**: CSO-driven scaffolds for CMA D, E, F and FMAA B, C, D, E. Every CSO sub-topic has at least one substantive unit + a starter test + flashcards.
6. **In progress**: A.2 (Units 9-30), B (16 units), C (12 units) still at 3 inline quizzes each — expand to 15 each (same pattern as A.1 expansion).
7. **Future**: Deepen the scaffolded sections (CMA D/E/F, FMAA B-E) — more units per CSO sub-topic, more inline quizzes, multi-test sections, additional flashcard decks. Pattern: replicate Section A's depth.
8. **Future**: CMA Part 2 (Strategic Financial Management) — six sections per CSO.
9. **Future**: A unified "Exam mode" final spanning all sections of a program.
10. **Future**: Optional cloud sync for progress (Supabase or similar).
11. **Future**: Service worker for offline use; printable PDF export of units.
