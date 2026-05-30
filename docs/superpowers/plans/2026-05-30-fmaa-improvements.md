# FMAA Improvements Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix correctness bugs, close exam-readiness content gaps against the IMA CSO, add interactive learning components (calculators, drag-to-classify, journal-entry builder), and make engine-level accessibility/mobile/test-flow improvements across the FMAA program.

**Architecture:** Static HTML + CSS + JS, no build step. Five section files (`programs/fmaa/section-a..e.html`) each define a `window.SECTION_CONFIG` consumed by the shared `assets/engine.js`; shared design system in `assets/style.css`. Engine changes are content-agnostic and also benefit the CMA program (shared assets). Content changes are bounded strictly by the FMAA CSO (Levels A–B).

**Tech Stack:** Vanilla JS (IIFE module, no framework), CSS custom properties, localStorage. Verification via browser preview + an adversarial content-accuracy agent pass (no unit-test framework exists).

**Scope (confirmed with user):** Fixes + exam-gaps + engine polish + interactivity incl. journal-entry builder. NOT a full DEEP-tier rewrite of B–E. Delivery = phased PRs. Execution = parallel agents orchestrated + verified by the main session.

---

## Constraints & conventions (read before touching anything)

- **No build/test framework.** "Tests" = (1) load the page in a browser/preview and exercise the changed widget; (2) for content, an adversarial agent re-derives every numeric answer key, formula, and rationale before commit.
- **Do not break annotation char-offsets.** Annotations serialize against text-node offsets within an article. Safe: changing element *tags/attributes* (text content unchanged), engine-side behavior. Risky: inserting/removing visible text nodes inside already-annotatable prose. Keyboard-a11y for quiz options must be done by adding attributes/handlers to existing `<li>`s (no text change), NOT by restructuring option markup.
- **Do not auto-shuffle inline quiz options** (CLAUDE.md). Tests may shuffle on restart.
- **CSO-bounded content only.** Every new unit/quiz maps to a CSO sub-topic. FMAA is Levels A–B (no synthesis/evaluation). Trim content that is above-level (CMA-only) rather than adding more of it.
- **Per-distractor rationales** go in `<li data-rationale="...">`.
- **Test questions** need `data-correct` (0-indexed), `data-unit`, `data-topic`.
- **Cache-bust:** bump `?v=N` on `style.css`/`engine.js` links across ALL section files (both programs) whenever shared assets change.
- **Commits:** frequent, conventional messages, end with the Co-Authored-By trailer. Branch per PR; never commit straight to main.

---

## Verification strategy (this project's "tests")

For each engine change:
1. Open the affected section page in a local preview.
2. Exercise the widget (answer a quiz by keyboard, run a test, flip a flashcard, resize to mobile width, etc.).
3. Check the browser console for errors.

For each content change:
1. Adversarial-accuracy agent: re-derive every numeric answer, verify each `data-correct` index points at the genuinely-correct option, check each formula and rationale, confirm CSO-mapping and Level A/B appropriateness. Returns a defect list.
2. Fix defects; re-verify.
3. Spot-check rendering in preview (no broken markup, nav entries resolve, prev/next footers correct, counts reconciled).

---

## File map

| File | Responsibility | PRs touching it |
|---|---|---|
| `assets/engine.js` | Shared engine: nav, quizzes, tests, flashcards, annotations, search, formula panel, NEW journal-entry builder, a11y/mobile/test fixes | PR1 (+ ?v bump everywhere) |
| `assets/style.css` | Shared design system: focus-visible, reduced-motion, mobile sidebar, FAB/panel responsive, contrast, je-builder styles | PR1 |
| `programs/fmaa/section-a.html` | Section A content + fixes + interactivity | PR2 |
| `programs/fmaa/section-b.html` | Section B accuracy fixes + gaps + interactivity | PR3 |
| `programs/fmaa/section-c.html` | Section C accuracy fixes + gaps + interactivity | PR4 |
| `programs/fmaa/section-d.html` | Section D accuracy fixes (incl. mis-keyed quiz) + scope-trim + gaps + interactivity | PR5 |
| `programs/fmaa/section-e.html` | Section E IMA-Statement accuracy rewrite + gaps + interactivity | PR6 |
| `programs/cma-part-1/*.html` | Only the `?v=` cache-bust on shared-asset links | PR1 |
| `CLAUDE.md` | Update notes (engine widgets now used by FMAA; known-issues resolved) | final |

---

## PR 1 — Engine / UX foundation (shared `engine.js` + `style.css`)

Branch: `fmaa/engine-ux-foundation`. Content-agnostic; benefits FMAA + CMA. Each task = edit + browser-verify + commit.

### Task 1.1 — Keyboard + screen-reader operable quiz/test options
**Files:** `assets/engine.js` (`handleQuiz`, test `attachQuestionHandlers`), `assets/style.css` (focus ring).
Approach: in the engine, where options get click handlers, ALSO set `tabindex="0"`, `role="button"`, `aria-label` (optional), and a `keydown` handler firing the same logic on Enter/Space. No markup change in section files (preserves annotation offsets). Add `aria-disabled="true"` instead of only `pointerEvents="none"` after answer.
- [ ] Add a `makeOptionInteractive(opt, onChoose)` helper; call it from both `handleQuiz` and the test handler.
- [ ] Verify: tab to an option in a quiz, press Enter → it grades; same in a test.
- [ ] Commit.

### Task 1.2 — Global focus-visible + reduced-motion
**Files:** `assets/style.css`.
- [ ] Add `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` for `.nav-item, .quiz-options li, .test-question .quiz-options li, button, .fc-card, [tabindex]`.
- [ ] Add `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.001ms!important; transition-duration:.001ms!important; scroll-behavior:auto!important } }`.
- [ ] Verify: keyboard focus now visible; OS reduce-motion disables unit fade / card flip.
- [ ] Commit.

### Task 1.3 — aria-live announcements
**Files:** `assets/engine.js`, `assets/style.css`.
- [ ] Add a visually-hidden `<div aria-live="polite" id="sr-status">` injected once; announce quiz correct/incorrect, "X of Y answered", and final score.
- [ ] Verify: screen reader (or inspect `#sr-status` text) updates on quiz answer + test progress.
- [ ] Commit.

### Task 1.4 — Modal focus management + Esc for note modal
**Files:** `assets/engine.js`.
- [ ] On opening `#kbd-help` / `#ann-note-modal`: store trigger, focus first control, trap Tab within; on close (incl. Esc) restore focus to trigger. Wire Esc for the note modal (currently unhandled).
- [ ] Verify: open kbd-help via `?`, Tab stays inside, Esc closes + returns focus.
- [ ] Commit.

### Task 1.5 — Contrast fix
**Files:** `assets/style.css`.
- [ ] Darken `--ink-faint` from `#8a8377` to ≥4.5:1 on `--paper #f6f1e8` (e.g. `#6b6456`); spot-check eyebrows/muted text still read as "secondary".
- [ ] Commit.

### Task 1.6 — Mobile sidebar collapse + correct scroll target
**Files:** `assets/style.css`, `assets/engine.js`.
- [ ] CSS: under `@media (max-width:1000px)`, collapse `#section-nav` group list behind a disclosure; add a `#sidebar-toggle` button (hamburger) with `aria-expanded`. Engine injects the toggle if absent and wires it.
- [ ] Engine: in `goTo`, on small screens scroll to the active `.unit` heading (not `window.top`); collapse the nav after selecting.
- [ ] Verify at 375px width: nav collapses, choosing a unit scrolls to content, toggle has aria-expanded.
- [ ] Commit.

### Task 1.7 — FAB + side-panel responsive
**Files:** `assets/style.css`.
- [ ] Add `max-width:90vw` to `#ann-panel` (match formula panel). Under mobile, reposition `#ann-toggle-btn`/`#formula-toggle-btn` so they don't overlap `.unit-footer`/test controls (e.g. raise bottom offset or dock to a row).
- [ ] Verify at 375px: panels fit, FABs don't cover nav buttons.
- [ ] Commit.

### Task 1.8 — Test flow: explicit submit + no accidental auto-grade
**Files:** `assets/engine.js`, `assets/style.css`.
- [ ] Replace the 600ms auto-grade on last answer with an always-visible "Submit test" button enabled once all answered (still allow submit-with-unanswered after confirm). Keep a "review answers" scroll-to-flagged action.
- [ ] Verify: answering the last question does NOT auto-grade; Submit grades; misclick can't end the test.
- [ ] Commit.

### Task 1.9 — Persist in-progress test answers
**Files:** `assets/engine.js`.
- [ ] Save per-test chosen-answer state to `localStorage` (key `storageKey + "-test-" + testId`); restore on load; clear on submit/restart.
- [ ] Verify: answer 3 Qs, switch units, return → answers retained.
- [ ] Commit.

### Task 1.10 — Fix chained "replay missed/flagged" index bug
**Files:** `assets/engine.js` (`restart`/`attachQuestionHandlers`).
- [ ] Stamp each question element once with a stable `dataset.origIndex`; filter replays on `origIndex` instead of positional `i+1` so a second consecutive replay-missed pulls the right questions.
- [ ] Verify: take test → miss some → replay missed → miss some of those → replay missed again pulls the correct subset.
- [ ] Commit.

### Task 1.11 — Touch support: highlight + drag
**Files:** `assets/engine.js`.
- [ ] Highlight toolbar: add a `selectionchange`/`touchend` path so text selection works on touch.
- [ ] Bucket-sort: add Pointer Events (pointerdown/move/up) so drag-to-classify works on touch (keep HTML5 dnd for mouse; keep the click-to-cycle fallback and make chips focusable buttons).
- [ ] Verify in a touch-emulated preview: can select text → highlight; can move a chip into a bucket.
- [ ] Commit.

### Task 1.12 — escapeHtml annotation note + highlight text
**Files:** `assets/engine.js`.
- [ ] Wrap user note + highlighted-text rendering in `escapeHtml(...)` (matches test/search paths).
- [ ] Verify: a note containing `<b>x</b>` renders literally.
- [ ] Commit.

### Task 1.13 — Hide ƒx FAB when no formulas
**Files:** `assets/engine.js`.
- [ ] In `initFormulaPanel`, if `formulaReference` is empty/absent, don't show `#formula-toggle-btn`.
- [ ] Commit.

### Task 1.14 — Journal-entry builder widget (NEW)
**Files:** `assets/engine.js` (`setupJournalBuilders`, called in `init`), `assets/style.css` (`.je-builder`).
Markup contract (authored later in section files):
```html
<div class="je-builder"
     data-prompt="Record $1,000 cash received for services performed."
     data-accounts='["Cash","Accounts Receivable","Service Revenue","Unearned Revenue"]'
     data-solution='[{"account":"Cash","side":"debit","amount":1000},{"account":"Service Revenue","side":"credit","amount":1000}]'>
</div>
```
Behavior: renders the prompt; rows of (account `<select>` + side debit/credit + amount input); add/remove row buttons; live ΣDebits / ΣCredits with balanced indicator; "Check entry" validates order-independently against `data-solution` AND that ΣDR=ΣCR; shows correct/incorrect feedback + reveals the model answer. Fully keyboard-operable; uses `aria-live` for the balance.
- [ ] Implement `setupJournalBuilders()`; guard for absent widgets (no-op so CMA pages unaffected).
- [ ] Add styles consistent with `.interactive`/`.result-tile`.
- [ ] Verify with a temporary test widget on a scratch page (balanced correct entry → pass; unbalanced → blocked; wrong account → fail with model answer).
- [ ] Commit.

### Task 1.15 — Cache-bust + smoke test all pages
**Files:** every `programs/**/section-*.html` + landings linking shared assets.
- [ ] Bump `?v=2` → `?v=3` on `style.css` and `engine.js` links across FMAA + CMA files.
- [ ] Load each FMAA section + one CMA section in preview; confirm no console errors and existing widgets still work (regression guard for shared-asset changes).
- [ ] Commit. Open PR 1.

---

## PR 2 — Section A (`section-a.html`)

Branch: `fmaa/section-a`. Close A's CSO gaps, fix defects, add interactivity. Draft content via agent → adversarial-verify → integrate → preview.

### Task 2.1 — Defect fixes (fast wins)
- [ ] Cover weighting "~30%" → "25%" (line ~100).
- [ ] Reconcile counts across cover, sidebar static text, `SECTION_CONFIG` (totalUnits/trackedUnits) and actual articles.
- [ ] Commit.

### Task 2.2 — Add "Types of Businesses" (A.1.c) — new unit
- [ ] New unit covering legal forms (sole proprietorship, partnership, corporation, LLC) + their equity-section differences (Owner's Capital/Drawings vs. Common Stock/RE — resolving the existing inconsistent usage), and operating types (service vs. merchandising vs. manufacturing, incl. how COGS/inventory differ). 6 inline quizzes w/ per-distractor rationales. Add nav entry, keyTakeaways, flashcards, renumber footers.
- [ ] Adversarial-verify; preview; commit.

### Task 2.3 — Strengthen A.4 internal controls
- [ ] Add internal-control-*risk* taxonomy (inherent/control/detection; preventive/detective/corrective; reasonable-not-absolute assurance) and a standalone org-structure/management-philosophy block (board, audit committee, internal audit, operating style/risk appetite). Label COSO as the 2013 framework; name the 17 principles. Add quizzes.
- [ ] Adversarial-verify; preview; commit.

### Task 2.4 — Broaden A.3.d statement of changes in equity
- [ ] Add a true statement of changes in equity (Common Stock / APIC / RE / Treasury columns) and name comprehensive income / OCI. Add quiz(es).
- [ ] Adversarial-verify; preview; commit.

### Task 2.5 — Add worked computations: bank reconciliation + inventory costing + ratios
- [ ] Worked bank-rec to an adjusted balance + a compute quiz. Worked FIFO/LIFO/weighted-average ending-inventory & COGS computation + quizzes. Add quick (acid-test) ratio and inventory/receivables turnover to Unit 17 + formula reference.
- [ ] Adversarial-verify; preview; commit.

### Task 2.6 — Populate the Final exam (id 999)
- [ ] Replace the empty placeholder with a real comprehensive test (≥30 Qs sampling A.1–A.5; `data-correct/-unit/-topic` on each; summary/restart markup). Reconcile cover's test count.
- [ ] Adversarial-verify EVERY answer key; preview the timed test; commit.

### Task 2.7 — Interactivity for Section A
- [ ] Calculators (inline `init*`): EOQ (Unit 20), cash-conversion-cycle (Unit 17), depreciation schedule (Unit 9), effective-rate of trade credit/discount loans. Bucket-sort classifiers: cash-flow activity (Unit 15), current vs long-term (Unit 14), temp vs permanent accounts (Unit 11/12), normal debit/credit balances (Unit 2), COSO components (Unit 16). Journal-entry builders in the JE units (4–13).
- [ ] Verify each widget in preview; commit. Open PR 2.

---

## PR 3 — Section B (`section-b.html`)

Branch: `fmaa/section-b`. Coverage is already complete; this closes computational + metadata + interactivity gaps.
- [ ] Task 3.1: Reconcile counts (cover "~75" → actual; totalUnits/trackedUnits vs sidebar). Commit.
- [ ] Task 3.2: Add missing computational drills — bond interest expense (carrying × market), revenue Step-4 SSP allocation, units-of-production depreciation, "compute the average balance first" ratio item; isolate AR-turnover & AP-turnover/DPO computations. Adversarial-verify; commit.
- [ ] Task 3.3: Fix LCM-for-LIFO inconsistency (teach the carve-out in Unit 2 OR soften the Test 1 Q1 rationale); de-duplicate Unit 5 Practice 3's two identical "$1,500,000" options. Commit.
- [ ] Task 3.4: Add dividend ratios (payout, yield, retention) to Unit 13 + formula reference. Rebalance Unit 9 toward common-base-year indexing (the CSO term) over CAGR. Commit.
- [ ] Task 3.5: Interactivity — ratio calculators (liquidity/leverage/activity/profitability + DuPont), inventory-costing calculator, "current vs quick vs cash numerator" bucket-sort. Verify; commit. Open PR 3.

## PR 4 — Section C (`section-c.html`)

Branch: `fmaa/section-c`.
- [ ] Task 4.1: Add per-distractor `data-rationale` to the quizzes/tests (none currently use them). Commit.
- [ ] Task 4.2: Add cash-budget-with-uncollectibles variant + multi-month AP-disbursements schedule; add DM-budget-in-dollars and budgeted-COGS/COGM schedule. Adversarial-verify; commit.
- [ ] Task 4.3: Add operating-income variance framing (static-budget variance = sales-volume + flexible-budget variance, on contribution margin); fix Unit 9 §9.1 absorption-vs-variable-costing "gross profit" inconsistency. Adversarial-verify; commit.
- [ ] Task 4.4: Add a 3rd practice test (financial budgets + methodology comparison) + 1–2 more flashcard decks. Commit.
- [ ] Task 4.5: Interactivity — flexible-budget calculator, production/purchases-budget calculator, cash-budget calculator. Verify; commit. Open PR 4.

## PR 5 — Section D (`section-d.html`)

Branch: `fmaa/section-d`.
- [ ] Task 5.1 (correctness, do first): Fix mis-keyed Unit 12 Practice 3 (`data-correct="3"`→`"2"`) and rewrite its self-contradicting explanation. Commit.
- [ ] Task 5.2: Trim scope creep above FMAA Levels A/B — demote/remove residual income, EVA, DuPont, ROI-dilution, deep responsibility-center content (keep plain ROI = operating income / average operating assets). Commit.
- [ ] Task 5.3: Add flexible-budget mechanics (D.3.b) with a static-vs-flexible worked example; define marginal cost / marginal revenue (D.5.c) with the MR>MC rule; add breakeven-in-dollars (Fixed/CM ratio) + target-profit-in-dollars drills; add a business-unit/segment-margin worked example (D.4.b); add absorption-vs-variable costing + contribution-format income statement. Adversarial-verify; commit.
- [ ] Task 5.4: Interactivity — CVP/breakeven calculator, DM/DL/overhead variance calculator, high-low splitter, ROI calculator. Verify; commit.
- [ ] Task 5.5: Refresh stale cover count + "AAU/AAO" mnemonic label. Commit. Open PR 5.

## PR 6 — Section E (`section-e.html`)

Branch: `fmaa/section-e`. Accuracy here is highest-yield (IMA Statement is verbatim-testable).
- [ ] Task 6.1: Rewrite Unit 5 §5.2 to enumerate each IMA standard's full obligations verbatim (Competence/Confidentiality/Integrity/Credibility), fixing the misfilings: add Competence "accurate, clear, concise, timely"; add Integrity "abstain from activity that might discredit the profession"; move "comply with laws/regulations/standards" to Competence; add Credibility "communicate professional limitations/constraints". Adversarial-verify against the IMA Statement text; commit.
- [ ] Task 6.2: Add the IMA Statement's actual FIRST resolution step ("follow your organization's established policies") ahead of "discuss with supervisor" in Unit 7; label the ladder the IMA "Resolving Ethical Issues" process; reconcile the two test items that key "supervisor" as first step. Commit.
- [ ] Task 6.3: Add "EXCEPT/NOT an obligation" test items (one per standard) + a 3rd test; expand the `ima-standards` flashcard deck to the enumerated obligations. Adversarial-verify; commit.
- [ ] Task 6.4: Soften the two overstated ACFE stats ("more than triple"); reconcile the §5.3 "(or Integrity)" hedge with the Credibility-keyed tests. Commit.
- [ ] Task 6.5: Interactivity — bucket-sort classifiers (schemes → 3 ACFE families; scenarios → 4 standards; facts → fraud-triangle sides). Verify; commit. Open PR 6.

## Finalization
- [ ] Update `CLAUDE.md`: note FMAA now uses calculators/bucket-sort/JE-builder; mark resolved known-issues (a11y of options, mobile, touch, escaping); update roadmap.
- [ ] Update `404.html` redirect table only if any file moved (none planned).

---

## Self-review
- **Spec coverage:** every 🔴 must-fix maps to a task (D mis-key→5.1; empty Final→2.6; weighting→2.1; a11y options→1.1). Every 🟠 content gap maps (A.1.c→2.2; A.4→2.3; A.3.d→2.4; bank-rec/FIFO/quick→2.5; E IMA Statement→6.1/6.2; B drills/dividends→3.2/3.4; C rationales/cash-budget/variance→4.1/4.2/4.3; D scope/flex/marginal→5.2/5.3). UI findings map to PR1. Interactivity (calculators/classifiers/JE builder) → 1.14 + each section's last task.
- **No placeholders:** engine tasks have approach + verification; content tasks specify exact additions + adversarial-verify gate. Final content prose is authored during execution (drafted by agents, verified) — intentional for a content project, not a placeholder.
- **Consistency:** JE-builder data-attributes (`data-prompt/-accounts/-solution`) are referenced identically in 1.14 and PR2/Task 2.7. Cache-bust bump (1.15) precedes section PRs.
