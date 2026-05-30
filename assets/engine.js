/* =====================================================================
   CMA LEARNING PLATFORM — SHARED ENGINE
   Reads window.SECTION_CONFIG and wires up nav, quizzes, tests,
   sidebar search, keyboard shortcuts, formula panel, key takeaways,
   flashcards, and the annotation system (highlights / notes / bookmarks).
   See CLAUDE.md for the SECTION_CONFIG schema.
===================================================================== */

(function () {
  'use strict';

  // Will be populated on init
  let CONFIG = null;
  let progress = null;
  let currentUnit = 0;

  // ===== PROGRESS TRACKING =====
  function loadProgress() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return { done: [], last: 0 };
      return JSON.parse(raw);
    } catch (e) { return { done: [], last: 0 }; }
  }
  function saveProgress() {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(progress)); } catch (e) {}
  }

  // ===== NAV =====
  function buildNav() {
    const nav = document.getElementById("nav");
    if (!nav) return;
    nav.innerHTML = "";
    CONFIG.navStructure.forEach(group => {
      const g = document.createElement("div");
      g.className = "nav-group";
      g.innerHTML = `<div class="nav-group-title">${group.group}</div>`;
      const ul = document.createElement("div");
      ul.className = "nav-list";
      group.units.forEach(u => {
        const btn = document.createElement("button");
        btn.className = "nav-item" + (progress.done.includes(u.id) ? " done" : "");
        btn.dataset.id = u.id;
        btn.innerHTML = `<span class="num">${u.num}</span>${u.title}`;
        btn.addEventListener("click", () => goTo(u.id));
        ul.appendChild(btn);
      });
      g.appendChild(ul);
      nav.appendChild(g);
    });
    updateProgressBar();
  }

  function updateProgressBar() {
    const fill = document.getElementById("progress-fill");
    const text = document.getElementById("progress-text");
    if (!fill || !text) return;
    const done = progress.done.length;
    const pct = Math.round((done / CONFIG.trackedUnits) * 100);
    fill.style.width = pct + "%";
    text.textContent = `${done} of ${CONFIG.trackedUnits} units complete`;
  }

  function goTo(id) {
    document.querySelectorAll(".unit").forEach(u => u.classList.remove("active"));
    const target = document.querySelector(`.unit[data-id="${id}"]`);
    if (target) {
      target.classList.add("active");
      currentUnit = id;
      progress.last = id;
      saveProgress();
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      const navBtn = document.querySelector(`.nav-item[data-id="${id}"]`);
      if (navBtn) navBtn.classList.add("active");
      if (window.matchMedia && window.matchMedia("(max-width: 1000px)").matches) {
        // On mobile the sidebar stacks above the content; scroll to the unit
        // itself (page top is the nav) and close the collapsed menu.
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        document.body.classList.remove("nav-open");
        const tgl = document.getElementById("sidebar-toggle");
        if (tgl) tgl.setAttribute("aria-expanded", "false");
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      // For flashcards hub re-render:
      if (id === 800 && typeof window.__renderFcHub === "function") window.__renderFcHub();
    }
  }
  // Expose to inline onclick="goTo(N)" handlers used in unit-footer markup
  window.goTo = goTo;

  function setMarkDoneButton(btn, isDone) {
    if (isDone) {
      btn.textContent = "✓ Marked complete — click to unmark";
      btn.classList.add("done");
    } else {
      btn.textContent = "Mark this unit complete";
      btn.classList.remove("done");
    }
  }
  // Toggle: clicking marks done; clicking again unmarks. Lets users
  // correct an accidental mark, redo a unit, or reset progress per-unit.
  function markDone(id) {
    const wasDone = progress.done.includes(id);
    if (wasDone) {
      progress.done = progress.done.filter(x => x !== id);
    } else {
      progress.done.push(id);
    }
    saveProgress();
    buildNav();
    const btn = document.querySelector(`#mark-done-${id}`);
    if (btn) setMarkDoneButton(btn, !wasDone);
  }
  window.markDone = markDone;

  // ===== A11Y HELPERS =====
  // Make a clickable non-button element (e.g. a quiz <li>) keyboard-operable:
  // adds role/tabindex and fires onChoose on Enter/Space, so quiz and test
  // answer options work for keyboard and screen-reader users.
  function makeOptionInteractive(el, onChoose) {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    if (!el.getAttribute("role")) el.setAttribute("role", "button");
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        onChoose(e);
      }
    });
  }
  // Polite screen-reader announcement via the shared #sr-status live region.
  function srAnnounce(msg) {
    const live = document.getElementById("sr-status");
    if (!live) return;
    // Clear first so a repeated identical message is still re-announced.
    live.textContent = "";
    requestAnimationFrame(() => { live.textContent = msg; });
  }
  // Trap Tab focus within a modal; returns release() that restores focus to opener.
  function trapFocus(modalEl, opener) {
    const sel = 'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(modalEl.querySelectorAll(sel)).filter(el => el.offsetParent !== null);
    function onKey(e) {
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    modalEl.addEventListener("keydown", onKey);
    return function release() {
      modalEl.removeEventListener("keydown", onKey);
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }

  // ===== INLINE QUIZ =====
  function handleQuiz(quizEl, correctIdx) {
    const opts = Array.from(quizEl.querySelectorAll(".quiz-options li"));
    const expl = quizEl.querySelector(".quiz-explanation");
    if (!opts.length) return;

    opts.forEach((o, i) => {
      if (o.querySelector(".opt-rationale")) return;
      const rat = document.createElement("div");
      rat.className = "opt-rationale";
      rat.dataset.for = String(i);
      const text = o.dataset.rationale || "";
      if (text) rat.textContent = text;
      o.parentNode.insertBefore(rat, o.nextSibling);
    });

    let controls = quizEl.querySelector(".quiz-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "quiz-controls";
      controls.innerHTML =
        '<span class="quiz-status">Pick an answer</span>' +
        '<button class="btn quiz-reveal" type="button" style="display:none">Reveal answer</button>' +
        '<button class="btn quiz-reveal quiz-retry" type="button" style="display:none">↻ Try this quiz again</button>';
      if (expl) quizEl.insertBefore(controls, expl);
      else quizEl.appendChild(controls);
    }
    const status = controls.querySelector(".quiz-status");
    const revealBtn = controls.querySelector(".quiz-reveal:not(.quiz-retry)");
    const retryBtn = controls.querySelector(".quiz-retry");

    let tries = 0;
    let locked = false;

    function lock(finalPickIdx) {
      locked = true;
      opts.forEach((x, j) => {
        x.classList.add("locked");
        x.setAttribute("aria-disabled", "true");
        if (j === correctIdx) x.classList.add("correct");
      });
      if (finalPickIdx != null && finalPickIdx !== correctIdx) {
        opts[finalPickIdx].classList.add("wrong");
      }
      revealBtn.style.display = "none";
      retryBtn.style.display = "inline-block";
      if (expl) expl.classList.add("show");
      if (tries === 1 && finalPickIdx === correctIdx) {
        status.textContent = "✓ Correct, first try";
        status.className = "quiz-status right";
      } else if (finalPickIdx === correctIdx) {
        status.textContent = `✓ Correct on try ${tries}`;
        status.className = "quiz-status right";
      } else {
        status.textContent = `Answer revealed · ${tries} ${tries === 1 ? "try" : "tries"}`;
        status.className = "quiz-status miss";
      }
      srAnnounce(status.textContent);
    }

    function reset() {
      tries = 0; locked = false;
      opts.forEach(x => {
        x.classList.remove("disabled","locked","correct","wrong","eliminated");
        x.removeAttribute("aria-disabled");
      });
      quizEl.querySelectorAll(".opt-rationale").forEach(r => r.classList.remove("show"));
      if (expl) expl.classList.remove("show");
      revealBtn.style.display = "none";
      retryBtn.style.display = "none";
      status.textContent = "Pick an answer";
      status.className = "quiz-status";
    }

    opts.forEach((o, i) => {
      function choose() {
        if (locked || o.classList.contains("eliminated")) return;
        tries++;
        if (i === correctIdx) { lock(i); return; }
        o.classList.add("eliminated");
        o.setAttribute("aria-disabled", "true");
        const rat = quizEl.querySelector(`.opt-rationale[data-for="${i}"]`);
        if (rat) {
          if (!rat.textContent) rat.textContent = "Not quite — eliminate this option and try again.";
          rat.classList.add("show");
        }
        const remaining = opts.filter(x => !x.classList.contains("eliminated"));
        if (remaining.length === 1) {
          lock(null);
        } else {
          status.textContent = `Try again · ${remaining.length} options left`;
          status.className = "quiz-status try";
          revealBtn.style.display = "inline-block";
          srAnnounce(`Not quite — ${remaining.length} options left.`);
        }
      }
      makeOptionInteractive(o, choose);
      o.addEventListener("click", choose);
    });

    revealBtn.addEventListener("click", () => { if (!locked) lock(null); });
    retryBtn.addEventListener("click", reset);
  }

  // ===== TEST CONTROLLER =====
  function setupTest(rootEl) {
    const allQuestions = Array.from(rootEl.querySelectorAll(".test-question"));
    if (allQuestions.length === 0) return;
    const progressEl = rootEl.querySelector(".test-progress");
    const answeredSpan = progressEl ? progressEl.querySelector(".answered") : null;
    const scoreFillEl  = progressEl ? progressEl.querySelector(".score-fill") : null;
    const scorePercentEl = progressEl ? progressEl.querySelector(".score-percent") : null;
    const summaryEl = rootEl.querySelector(".test-summary");

    if (progressEl && !progressEl.querySelector(".test-timer")) {
      const timer = document.createElement("button");
      timer.type = "button";
      timer.className = "test-timer";
      timer.title = "Click to pause / resume";
      timer.innerHTML = '<span class="dot"></span><span class="t-elapsed">00:00</span> <span style="color:var(--ink-faint)">/ <span class="t-target">--:--</span></span>';
      progressEl.appendChild(timer);
    }
    allQuestions.forEach((qEl) => {
      if (!qEl.querySelector(".q-flag-btn")) {
        const flag = document.createElement("button");
        flag.type = "button";
        flag.className = "q-flag-btn";
        flag.title = "Flag for review";
        flag.setAttribute("aria-label", "Flag this question for review");
        flag.textContent = "⚑";
        flag.addEventListener("click", e => {
          e.stopPropagation();
          flag.classList.toggle("active");
          qEl.classList.toggle("flagged");
        });
        qEl.appendChild(flag);
      }
    });

    let activeQuestions = allQuestions.slice();
    let total = activeQuestions.length;
    let answered = 0, correct = 0;
    const missed = [];
    let submitHintEl = null;
    let restoring = false;

    // Stable per-question identity (survives shuffles and missed-only replays).
    allQuestions.forEach((q, i) => { if (q.dataset.origIndex == null) q.dataset.origIndex = String(i); });

    // Persist in-progress answers so navigating away / reloading doesn't wipe a test.
    const testUnit = rootEl.closest(".unit[data-id]");
    // Null key when a test isn't inside a .unit[data-id] → persistence disabled
    // for it (avoids two such tests colliding on one localStorage key).
    const testStateKey = testUnit ? (CONFIG.storageKey + "-test-" + testUnit.dataset.id) : null;
    function loadTestState() { if (!testStateKey) return {}; try { return JSON.parse(localStorage.getItem(testStateKey)) || {}; } catch { return {}; } }
    let savedAnswers = loadTestState();
    function persistAnswers() { if (!testStateKey) return; try { localStorage.setItem(testStateKey, JSON.stringify(savedAnswers)); } catch {} }
    function clearTestState() { savedAnswers = {}; if (!testStateKey) return; try { localStorage.removeItem(testStateKey); } catch {} }

    const TARGET_PER_Q_SEC = 108;
    let timerStart = null;
    let timerElapsed = 0;
    let timerInterval = null;
    let timerPaused = false;
    let timerStarted = false;

    function fmtTime(sec) {
      sec = Math.max(0, Math.round(sec));
      const m = Math.floor(sec / 60), s = sec % 60;
      return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    }
    function targetSec() { return total * TARGET_PER_Q_SEC; }
    function tickTimer() {
      if (timerPaused || !timerStart) return;
      const elapsed = timerElapsed + (Date.now() - timerStart) / 1000;
      const tEl = progressEl.querySelector(".t-elapsed");
      if (tEl) tEl.textContent = fmtTime(elapsed);
      const tTar = progressEl.querySelector(".t-target");
      if (tTar) tTar.textContent = fmtTime(targetSec());
      const expectedAtNow = (elapsed / TARGET_PER_Q_SEC);
      const t = progressEl.querySelector(".test-timer");
      if (t) {
        if (answered >= expectedAtNow) { t.classList.add("ahead"); t.classList.remove("behind"); }
        else { t.classList.add("behind"); t.classList.remove("ahead"); }
      }
    }
    function startTimer() {
      if (timerStarted) return;
      timerStarted = true;
      timerStart = Date.now();
      timerInterval = setInterval(tickTimer, 1000);
      tickTimer();
    }
    function pauseTimer() {
      if (!timerStart || timerPaused) return;
      timerElapsed += (Date.now() - timerStart) / 1000;
      timerStart = null;
      timerPaused = true;
      const t = progressEl.querySelector(".test-timer");
      if (t) t.classList.add("paused");
    }
    function resumeTimer() {
      if (!timerPaused) return;
      timerStart = Date.now();
      timerPaused = false;
      const t = progressEl.querySelector(".test-timer");
      if (t) t.classList.remove("paused");
      tickTimer();
    }
    function stopTimer() {
      if (timerInterval) clearInterval(timerInterval);
      if (timerStart && !timerPaused) timerElapsed += (Date.now() - timerStart) / 1000;
      timerStart = null;
      timerInterval = null;
    }
    function resetTimer() {
      stopTimer();
      timerElapsed = 0;
      timerStarted = false;
      timerPaused = false;
      const tEl = progressEl.querySelector(".t-elapsed");
      if (tEl) tEl.textContent = "00:00";
      const t = progressEl.querySelector(".test-timer");
      if (t) { t.classList.remove("paused","ahead","behind"); }
    }
    const timerBtn = progressEl && progressEl.querySelector(".test-timer");
    if (timerBtn) {
      timerBtn.addEventListener("click", () => {
        if (!timerStarted) startTimer();
        else if (timerPaused) resumeTimer();
        else pauseTimer();
      });
    }

    function updateProgress() {
      if (answeredSpan) answeredSpan.textContent = `${answered} / ${total} answered`;
      const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      if (scoreFillEl) scoreFillEl.style.width = (answered / total * 100) + "%";
      if (scorePercentEl) scorePercentEl.textContent = answered > 0 ? `${correct} correct (${pct}%)` : "0 correct";
      if (submitHintEl) {
        const remaining = total - answered;
        submitHintEl.textContent = remaining > 0 ? `${remaining} unanswered` : "All answered — ready to submit";
      }
    }

    function unitLabel(uid) {
      if (!uid) return null;
      // Section A used 91-94 for foundation units. Other sections may use other ranges.
      if (uid >= 91 && uid <= 94) return "Unit F" + (uid - 90);
      return "Unit " + uid;
    }
    function escapeHtml(str) {
      if (str == null) return "";
      return String(str).replace(/[&<>"']/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
      })[c]);
    }

    function showSummary() {
      if (!summaryEl) return;
      stopTimer();
      clearTestState();
      const scoreEl = summaryEl.querySelector(".score-display");
      const metaEl  = summaryEl.querySelector(".score-meta");
      const pct = Math.round((correct / total) * 100);
      if (scoreEl) {
        scoreEl.textContent = pct + "%";
        scoreEl.classList.remove("pass","mid","weak");
        scoreEl.classList.add(pct >= 75 ? "pass" : pct >= 60 ? "mid" : "weak");
      }
      if (metaEl) {
        const totalSecUsed = Math.round(timerElapsed);
        const tgt = targetSec();
        const timeNote = totalSecUsed > 0 ? ` · ${fmtTime(totalSecUsed)} elapsed (target ${fmtTime(tgt)})` : "";
        metaEl.textContent = `${correct} of ${total} correct${timeNote} · ${pct >= 75 ? "Strong — keep it up" : pct >= 60 ? "Pass-zone — review the weak spots" : "Below CMA pass threshold — review the missed topics carefully"}`;
      }
      const missedList = summaryEl.querySelector(".missed-list");
      if (missedList) {
        if (missed.length === 0) {
          missedList.innerHTML = "<h4>Perfect score 🎯</h4><div class='missed-item'>No questions missed.</div>";
        } else {
          const items = missed.map(m => {
            const ulbl = unitLabel(m.unitId);
            const topicHtml = m.unitId
              ? `<span class="topic-link" onclick="goTo(${m.unitId})">→ ${ulbl}</span>`
              : '';
            const yourPick = m.userPickText
              ? `<div class="miss-pick"><span class="lbl">You picked</span>${escapeHtml(m.userPickText)}</div>`
              : '';
            const correctText = m.correctText
              ? `<div class="miss-ans"><span class="lbl">Correct</span>${escapeHtml(m.correctText)}</div>`
              : '';
            const why = m.explanationText
              ? `<div class="miss-why"><span class="lbl">Why</span>${escapeHtml(m.explanationText)}</div>`
              : '';
            return `<div class="missed-item">
              <div><strong>Q${m.num}.</strong> <span style="color:var(--ink-soft)">${escapeHtml(m.topic)}</span> ${topicHtml}</div>
              <div class="miss-q">${escapeHtml(m.questionText)}</div>
              ${yourPick}
              ${correctText}
              ${why}
            </div>`;
          }).join("");
          missedList.innerHTML = `<h4>Review (${missed.length} missed)</h4>${items}`;
        }
      }
      let actions = summaryEl.querySelector(".summary-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "summary-actions";
        summaryEl.appendChild(actions);
      }
      actions.innerHTML = "";
      const oldRestart = summaryEl.querySelector(".restart-btn");
      if (oldRestart) oldRestart.style.display = "none";
      const newRestart = document.createElement("button");
      newRestart.className = "btn";
      newRestart.textContent = "↻ Restart (shuffle order)";
      newRestart.addEventListener("click", () => restart({ shuffle: true, missedOnly: false }));
      actions.appendChild(newRestart);
      if (missed.length > 0) {
        const replayMissed = document.createElement("button");
        replayMissed.className = "btn ghost";
        replayMissed.textContent = `Replay missed only (${missed.length})`;
        replayMissed.addEventListener("click", () => restart({ shuffle: false, missedOnly: true }));
        actions.appendChild(replayMissed);
      }
      const flaggedQs = allQuestions.filter(q => q.classList.contains("flagged"));
      if (flaggedQs.length > 0) {
        const flagBtn = document.createElement("button");
        flagBtn.className = "btn ghost";
        flagBtn.textContent = `Replay flagged (${flaggedQs.length})`;
        flagBtn.addEventListener("click", () => restart({ shuffle: false, missedOnly: false, flaggedOnly: true }));
        actions.appendChild(flagBtn);
      }
      summaryEl.classList.add("show");
      summaryEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function attachQuestionHandlers(qEl, idx) {
      const correctIdx = parseInt(qEl.dataset.correct, 10);
      const unitId = qEl.dataset.unit ? parseInt(qEl.dataset.unit, 10) : null;
      const topicLabel = qEl.dataset.topic || `Question ${idx + 1}`;
      const qTextEl = qEl.querySelector(".quiz-q");
      const questionText = qTextEl ? qTextEl.textContent.trim() : "";
      const opts = qEl.querySelectorAll(".quiz-options li");
      const expl = qEl.querySelector(".quiz-explanation");
      const correctText = opts[correctIdx] ? opts[correctIdx].textContent.trim() : "";
      const explanationText = expl ? expl.textContent.trim().replace(/^Why:\s*/i, "") : "";

      opts.forEach((o, i) => {
        if (!o.hasAttribute("tabindex")) o.setAttribute("tabindex", "0");
        if (!o.getAttribute("role")) o.setAttribute("role", "button");
        o.onclick = () => {
          if (o.classList.contains("disabled")) return;
          if (!restoring && !timerStarted) startTimer();
          opts.forEach(x => { x.classList.add("disabled"); x.setAttribute("aria-disabled", "true"); });
          const isRight = (i === correctIdx);
          const userPickText = o.textContent.trim();
          if (isRight) {
            o.classList.add("correct");
            qEl.classList.add("answered-correct");
            correct++;
          } else {
            o.classList.add("wrong");
            opts[correctIdx].classList.add("correct");
            qEl.classList.add("answered-wrong");
            missed.push({ num: idx + 1, origIndex: parseInt(qEl.dataset.origIndex, 10), topic: topicLabel, unitId, questionText, correctText, userPickText, explanationText });
          }
          // Reveal the explanation regardless of right/wrong outcome.
          if (expl) expl.classList.add("show");
          answered++;
          savedAnswers[qEl.dataset.origIndex] = i;
          persistAnswers();
          updateProgress();
          if (!restoring) srAnnounce(isRight ? "Correct." : `Incorrect. Correct answer: ${correctText}`);
        };
        o.onkeydown = e => {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); o.onclick(); }
        };
      });
    }

    function resetQuestionState(qEl, newNumber) {
      qEl.classList.remove("answered-correct", "answered-wrong");
      qEl.querySelectorAll(".quiz-options li").forEach(li => {
        li.classList.remove("correct","wrong","disabled","eliminated","locked");
        li.removeAttribute("aria-disabled");
      });
      const e = qEl.querySelector(".quiz-explanation"); if (e) e.classList.remove("show");
      if (newNumber != null) {
        const numEl = qEl.querySelector(".q-num .num-text");
        if (numEl) numEl.textContent = "Question " + newNumber;
      }
    }

    function restart({ shuffle = false, missedOnly = false, flaggedOnly = false } = {}) {
      const container = allQuestions[0].parentElement;
      let pool = allQuestions.slice();
      if (missedOnly) {
        // Filter on the stable origIndex, not the current position, so chained
        // "replay missed" passes keep selecting the right questions.
        const missedSet = new Set(missed.map(m => m.origIndex));
        pool = allQuestions.filter(q => missedSet.has(parseInt(q.dataset.origIndex, 10)));
      } else if (flaggedOnly) {
        pool = allQuestions.filter(q => q.classList.contains("flagged"));
      }
      if (shuffle) pool.sort(() => Math.random() - 0.5);
      allQuestions.forEach(q => {
        q.style.display = "none";
        resetQuestionState(q, null);
        q.classList.remove("flagged");
        const f = q.querySelector(".q-flag-btn"); if (f) f.classList.remove("active");
      });
      pool.forEach((q, i) => {
        q.style.display = "";
        resetQuestionState(q, i + 1);
        container.appendChild(q);
      });
      activeQuestions = pool;
      total = pool.length;
      answered = 0; correct = 0; missed.length = 0;
      clearTestState();
      pool.forEach((q, i) => attachQuestionHandlers(q, i));
      if (summaryEl) summaryEl.classList.remove("show");
      resetTimer();
      updateProgress();
      rootEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Explicit submit (replaces the old accidental auto-grade on last answer).
    let submitBar = rootEl.querySelector(".test-submit-bar");
    if (!submitBar) {
      submitBar = document.createElement("div");
      submitBar.className = "test-submit-bar";
      submitBar.innerHTML = '<button type="button" class="btn test-submit-btn">Submit test for grading</button> <span class="test-submit-hint"></span>';
      if (summaryEl) rootEl.insertBefore(submitBar, summaryEl);
      else rootEl.appendChild(submitBar);
    }
    submitHintEl = submitBar.querySelector(".test-submit-hint");
    const submitBtn = submitBar.querySelector(".test-submit-btn");
    if (submitBtn) submitBtn.addEventListener("click", () => {
      const remaining = total - answered;
      if (remaining > 0 && !confirm(`${remaining} question(s) still unanswered. Submit and grade anyway?`)) return;
      showSummary();
    });

    // Replay answers saved from a previous (un-submitted) sitting. We re-click
    // each saved option under the `restoring` guard (so the timer and announcer
    // stay quiet); this faithfully rebuilds the correct/missed counts. Answers
    // map by the stable origIndex onto the original DOM order, so a reload after a
    // shuffle shows the original order with the user's picks reapplied — intended.
    function restoreAnswers() {
      const entries = Object.entries(savedAnswers || {});
      if (!entries.length) return;
      restoring = true;
      try {
        entries.forEach(([oi, chosen]) => {
          const qEl = allQuestions.find(q => q.dataset.origIndex === String(oi));
          if (!qEl) return;
          if (qEl.classList.contains("answered-correct") || qEl.classList.contains("answered-wrong")) return;
          const opts = qEl.querySelectorAll(".quiz-options li");
          if (opts[chosen]) opts[chosen].click();
        });
      } finally {
        restoring = false;
      }
    }

    allQuestions.forEach((qEl, idx) => attachQuestionHandlers(qEl, idx));
    restoreAnswers();
    updateProgress();
    const tTar = progressEl && progressEl.querySelector(".t-target");
    if (tTar) tTar.textContent = fmtTime(targetSec());

    const restartBtn = rootEl.querySelector(".restart-btn");
    if (restartBtn) restartBtn.addEventListener("click", () => restart({ shuffle: true, missedOnly: false }));
  }

  // ===== BUCKET SORT =====
  function setupBucketSort(rootEl) {
    const itemsAttr = rootEl.dataset.items;
    if (!itemsAttr) return;
    let items;
    try { items = JSON.parse(itemsAttr); } catch (e) { console.error("Bad bucket-sort data", e); return; }

    const tray = rootEl.querySelector(".chip-tray");
    const buckets = rootEl.querySelectorAll(".bucket");

    items.forEach((it, idx) => {
      const c = document.createElement("span");
      c.className = "chip";
      c.draggable = true;
      c.dataset.group = it.group;
      c.dataset.label = it.label;
      c.textContent = it.label;
      c.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", idx);
        c.classList.add("dragging");
      });
      c.addEventListener("dragend", () => c.classList.remove("dragging"));
      c.tabIndex = 0;
      c.setAttribute("role", "button");
      // Click / tap / Enter / Space cycle tray → bucket1 → bucket2 → tray.
      // This is the touch- and keyboard-accessible path (HTML5 drag is mouse-only).
      function cycle() {
        const groups = Array.from(buckets).map(b => b.dataset.group);
        const cur = c.parentElement.dataset.group || null;
        let nextIdx = groups.indexOf(cur) + 1;
        if (nextIdx >= groups.length) {
          tray.appendChild(c);
          c.classList.remove("in-bucket", "correct", "incorrect");
          updateCounts();
          return;
        }
        const nextBucket = rootEl.querySelector(`.bucket[data-group="${groups[nextIdx]}"]`);
        nextBucket.appendChild(c);
        c.classList.add("in-bucket");
        c.classList.remove("correct", "incorrect");
        updateCounts();
      }
      c.addEventListener("click", cycle);
      c.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); cycle(); }
      });
      tray.appendChild(c);
    });

    function updateCounts() {
      buckets.forEach(b => {
        const count = b.querySelectorAll(".chip").length;
        const counter = b.querySelector(".b-count");
        if (counter) counter.textContent = `(${count})`;
      });
    }

    buckets.forEach(b => {
      b.addEventListener("dragover", e => { e.preventDefault(); b.classList.add("over"); });
      b.addEventListener("dragleave", () => b.classList.remove("over"));
      b.addEventListener("drop", e => {
        e.preventDefault();
        b.classList.remove("over");
        const dragging = rootEl.querySelector(".chip.dragging");
        if (dragging) {
          b.appendChild(dragging);
          dragging.classList.add("in-bucket");
          dragging.classList.remove("correct", "incorrect");
          updateCounts();
        }
      });
    });
    tray.addEventListener("dragover", e => e.preventDefault());
    tray.addEventListener("drop", e => {
      e.preventDefault();
      const dragging = rootEl.querySelector(".chip.dragging");
      if (dragging) {
        tray.appendChild(dragging);
        dragging.classList.remove("in-bucket", "correct", "incorrect");
        updateCounts();
      }
    });

    const checkBtn = rootEl.querySelector(".bucket-check");
    if (checkBtn) checkBtn.addEventListener("click", () => {
      const chips = rootEl.querySelectorAll(".chip");
      let right = 0, wrong = 0;
      chips.forEach(c => {
        const placed = c.parentElement.dataset.group;
        if (!placed) return;
        if (placed === c.dataset.group) { c.classList.add("correct"); c.classList.remove("incorrect"); right++; }
        else { c.classList.add("incorrect"); c.classList.remove("correct"); wrong++; }
      });
      const fb = rootEl.querySelector(".bucket-feedback");
      if (fb) {
        fb.style.display = "block";
        fb.innerHTML = `<strong>${right}</strong> correct · <strong>${wrong}</strong> misplaced ${wrong === 0 && right === chips.length ? "— ✓ Perfect!" : ""}`;
        fb.style.color = (wrong === 0 && right === chips.length) ? "var(--good)" : "var(--ink)";
      }
    });

    const resetBtn = rootEl.querySelector(".bucket-reset");
    if (resetBtn) resetBtn.addEventListener("click", () => {
      rootEl.querySelectorAll(".chip").forEach(c => {
        tray.appendChild(c);
        c.classList.remove("in-bucket", "correct", "incorrect");
      });
      const fb = rootEl.querySelector(".bucket-feedback");
      if (fb) fb.style.display = "none";
      updateCounts();
    });
  }

  // ===== SIDEBAR SEARCH (titles + content) =====
  function initSidebarSearch() {
    const input = document.getElementById("nav-search");
    const clearBtn = document.getElementById("nav-search-clear");
    if (!input) return;

    // Build a content index from each unit's text-bearing block elements.
    // Lazy: first build deferred until user actually types — keeps initial
    // load fast on long sections (Section A is ~12K lines).
    let searchIndex = null;
    function buildIndex() {
      searchIndex = [];
      document.querySelectorAll(".unit[data-id]").forEach(unitEl => {
        const id = parseInt(unitEl.dataset.id, 10);
        const title = (unitEl.querySelector("h1")?.textContent || "").trim();
        let currentHeading = "";
        const blocks = unitEl.querySelectorAll("h2, h3, p, li, td, .formula-box, .quiz-prompt, .quiz-q, .callout-label");
        blocks.forEach(el => {
          if (el.closest("script, .unit-footer, .quiz-controls, .summary-actions, button")) return;
          const tag = el.tagName.toLowerCase();
          const text = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (tag === "h2" || tag === "h3") {
            currentHeading = text;
            return; // Headings provide context; don't list them as separate hits
          }
          if (text.length < 12) return;
          searchIndex.push({
            unitId: id,
            unitTitle: title,
            heading: currentHeading,
            text: text,
            element: el
          });
        });
      });
    }

    // Results panel goes below the nav.
    const navEl = document.getElementById("nav");
    const resultsEl = document.createElement("div");
    resultsEl.className = "search-results";
    resultsEl.style.display = "none";
    if (navEl && navEl.parentNode) navEl.parentNode.insertBefore(resultsEl, navEl.nextSibling);

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
      })[c]);
    }
    function escapeRegex(s) { return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"); }

    function makeSnippet(text, query, maxLen) {
      maxLen = maxLen || 130;
      const lc = text.toLowerCase();
      const idx = lc.indexOf(query.toLowerCase());
      let start = 0, end = Math.min(text.length, maxLen);
      if (idx >= 0) {
        start = Math.max(0, idx - Math.floor((maxLen - query.length) / 2));
        end = Math.min(text.length, start + maxLen);
      }
      const snippet = text.slice(start, end);
      const safe = escapeHtml(snippet);
      const re = new RegExp(escapeRegex(query), "gi");
      const highlighted = safe.replace(re, m => "<mark>" + m + "</mark>");
      return (start > 0 ? "…" : "") + highlighted + (end < text.length ? "…" : "");
    }

    function applyFilter() {
      const q = input.value.trim();
      clearBtn.classList.toggle("show", q.length > 0);

      // Title filter — keeps the nav usable (existing behaviour)
      const ql = q.toLowerCase();
      let titleMatchCount = 0;
      document.querySelectorAll(".nav-group").forEach(group => {
        let visibleInGroup = 0;
        group.querySelectorAll(".nav-item").forEach(item => {
          const text = item.textContent.toLowerCase();
          const match = ql === "" || text.includes(ql);
          item.classList.toggle("hidden", !match);
          if (match) { visibleInGroup++; titleMatchCount++; }
        });
        group.classList.toggle("hidden", visibleInGroup === 0 && ql.length > 0);
      });

      // Content search results
      if (ql.length < 2) {
        resultsEl.style.display = "none";
        resultsEl.innerHTML = "";
        return;
      }
      if (searchIndex === null) buildIndex();

      const allHits = [];
      const HIT_CAP = 200;
      for (let i = 0; i < searchIndex.length && allHits.length < HIT_CAP; i++) {
        const e = searchIndex[i];
        if (e.text.toLowerCase().includes(ql)) allHits.push(e);
      }

      // Group by unit, max 3 hits per unit, max 12 units shown
      const grouped = new Map();
      for (const h of allHits) {
        if (!grouped.has(h.unitId)) grouped.set(h.unitId, []);
        const arr = grouped.get(h.unitId);
        if (arr.length < 3) arr.push(h);
      }
      const unitGroups = [...grouped.entries()].slice(0, 12);

      let html = `<div class="search-results-header">
        Content matches · <strong>${allHits.length}</strong> hit${allHits.length === 1 ? "" : "s"} in <strong>${grouped.size}</strong> unit${grouped.size === 1 ? "" : "s"}${grouped.size > 12 ? " (showing 12)" : ""}
      </div>`;

      if (unitGroups.length === 0) {
        if (titleMatchCount === 0) {
          html += `<div class="search-result-empty">No matches for "${escapeHtml(q)}".</div>`;
        } else {
          // Title matched but no content hits — keep panel hidden
          resultsEl.style.display = "none";
          resultsEl.innerHTML = "";
          return;
        }
      } else {
        for (const [unitId, items] of unitGroups) {
          const u = items[0];
          html += `<div class="search-result-unit-block">
            <button class="search-result-unit-title" data-unit="${unitId}">${escapeHtml(u.unitTitle || ("Unit " + unitId))}</button>`;
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const idx = searchIndex.indexOf(item);
            html += `<button class="search-result-snippet-btn" data-unit="${unitId}" data-target="${idx}">
              ${item.heading ? `<div class="search-result-heading">${escapeHtml(item.heading)}</div>` : ""}
              <div class="search-result-snippet">${makeSnippet(item.text, q)}</div>
            </button>`;
          }
          html += `</div>`;
        }
      }
      resultsEl.innerHTML = html;
      resultsEl.style.display = "block";

      resultsEl.querySelectorAll(".search-result-unit-title, .search-result-snippet-btn").forEach(el => {
        el.addEventListener("click", () => {
          const unitId = parseInt(el.dataset.unit, 10);
          const targetIdx = el.dataset.target ? parseInt(el.dataset.target, 10) : -1;
          goTo(unitId);
          if (targetIdx >= 0) {
            const target = searchIndex[targetIdx];
            if (target && target.element) {
              setTimeout(() => {
                target.element.scrollIntoView({ behavior: "smooth", block: "center" });
                target.element.classList.add("search-flash");
                setTimeout(() => target.element.classList.remove("search-flash"), 2400);
              }, 250);
            }
          }
        });
      });
    }

    let debounceTimer = null;
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFilter, 80);
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        input.value = ""; applyFilter(); input.blur();
      } else if (e.key === "Enter") {
        // Prefer first content match; else first nav match
        const firstResult = resultsEl.querySelector(".search-result-snippet-btn");
        if (firstResult) firstResult.click();
        else {
          const firstNav = document.querySelector(".nav-item:not(.hidden)");
          if (firstNav) firstNav.click();
        }
      }
    });
    clearBtn.addEventListener("click", () => { input.value = ""; applyFilter(); input.focus(); });
  }

  // ===== KEYBOARD SHORTCUTS =====
  function navAdjacent(delta) {
    const allIds = [];
    CONFIG.navStructure.forEach(g => g.units.forEach(u => allIds.push(u.id)));
    const idx = allIds.indexOf(currentUnit);
    const next = allIds[idx + delta];
    if (next != null) goTo(next);
  }
  function isTypingTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }
  function initKeyboardShortcuts() {
    const helpEl = document.getElementById("kbd-help");
    if (!helpEl) return;
    const showShortcutsBtn = document.getElementById("show-shortcuts");
    let helpRelease = null;
    function openHelp() { helpEl.classList.add("show"); helpRelease = trapFocus(helpEl, showShortcutsBtn); }
    function closeHelp() { helpEl.classList.remove("show"); if (helpRelease) { helpRelease(); helpRelease = null; } }
    if (showShortcutsBtn) showShortcutsBtn.addEventListener("click", openHelp);
    document.getElementById("kbd-help-close")?.addEventListener("click", closeHelp);
    helpEl.addEventListener("click", e => { if (e.target === helpEl) closeHelp(); });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeHelp();
        document.getElementById("formula-panel")?.classList.remove("open");
        const annPanel = document.getElementById("ann-panel");
        if (annPanel && annPanel.classList.contains("open")) annPanel.classList.remove("open");
      }
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowRight": case "j": case "J":
          e.preventDefault(); navAdjacent(1); break;
        case "ArrowLeft": case "k": case "K":
          e.preventDefault(); navAdjacent(-1); break;
        case "/":
          e.preventDefault();
          const search = document.getElementById("nav-search");
          if (search) { search.focus(); search.select(); } break;
        case "?":
          if (helpEl.classList.contains("show")) closeHelp(); else openHelp(); break;
        case "f": case "F": {
          const fp = document.getElementById("formula-panel");
          if (fp) fp.classList.toggle("open"); break;
        }
        case "a": case "A": {
          const tgl = document.getElementById("ann-toggle-btn");
          if (tgl) tgl.click(); break;
        }
        case "b": case "B": {
          const bm = document.querySelector(`.unit.active .unit-bm-btn`);
          if (bm) bm.click(); break;
        }
        case "m": case "M": {
          const md = document.querySelector(`.unit.active [id^='mark-done-']`);
          if (md) md.click(); break;
        }
      }
    });
  }

  // ===== FORMULA PANEL =====
  function initFormulaPanel() {
    const list = document.getElementById("formula-list");
    const search = document.getElementById("formula-search");
    const toggle = document.getElementById("formula-toggle-btn");
    const panel = document.getElementById("formula-panel");
    const closeBtn = document.getElementById("formula-panel-close");
    if (!list || !panel) return;
    const data = CONFIG.formulaReference || [];
    // No formulas for this section → hide the ƒx affordance entirely.
    if (!data.length) { if (toggle) toggle.style.display = "none"; return; }

    function render(filter = "") {
      const q = filter.toLowerCase().trim();
      const html = data.map(sec => {
        const items = sec.items.filter(it =>
          !q || it.label.toLowerCase().includes(q) || it.formula.toLowerCase().includes(q)
        );
        if (items.length === 0) return "";
        const itemsHtml = items.map(it => `
          <div class="fp-item" data-unit="${it.unitId}">
            <div class="label">${it.label}</div>
            <div class="formula">${it.formula}</div>
            <div class="unit-link">→ Open unit ${it.unitId}</div>
          </div>
        `).join("");
        return `<div class="fp-section"><h4>${sec.section}</h4>${itemsHtml}</div>`;
      }).join("");
      list.innerHTML = html || `<div class="fp-empty">No formulas match "${filter}"</div>`;
      list.querySelectorAll(".fp-item").forEach(it => {
        it.addEventListener("click", () => {
          const uid = parseInt(it.dataset.unit, 10);
          if (!isNaN(uid)) { goTo(uid); panel.classList.remove("open"); }
        });
      });
    }
    if (toggle) toggle.addEventListener("click", () => panel.classList.toggle("open"));
    if (closeBtn) closeBtn.addEventListener("click", () => panel.classList.remove("open"));
    if (search) search.addEventListener("input", () => render(search.value));
    render();
  }

  // ===== KEY TAKEAWAYS =====
  function injectKeyTakeaways() {
    const map = CONFIG.keyTakeaways || {};
    document.querySelectorAll(".unit[data-id]").forEach(unitEl => {
      const id = parseInt(unitEl.dataset.id, 10);
      if (!map[id]) return;
      if (unitEl.querySelector(".takeaways")) return;
      const box = document.createElement("aside");
      box.className = "takeaways";
      const items = map[id].map(t => `<li>${t}</li>`).join("");
      box.innerHTML = `<ol>${items}</ol>`;
      const anchor = unitEl.querySelector(".mark-done")
        || unitEl.querySelector("[id^='mark-done-']")
        || unitEl.querySelector(".unit-footer");
      if (anchor) anchor.parentNode.insertBefore(box, anchor);
      else unitEl.appendChild(box);
    });
  }

  // ===== FLASHCARDS =====
  function fcStoreKey() { return CONFIG.storageKey + "-fc"; }
  function fcLoad() {
    try { return JSON.parse(localStorage.getItem(fcStoreKey())) || {}; } catch { return {}; }
  }
  function fcSave(data) { try { localStorage.setItem(fcStoreKey(), JSON.stringify(data)); } catch {} }

  function initFlashcards() {
    const decks = CONFIG.flashcardDecks || {};
    if (Object.keys(decks).length === 0) return;
    const main = document.getElementById("content");
    if (!main || document.querySelector(".unit[data-id='800']")) return;

    const article = document.createElement("article");
    article.className = "unit";
    article.dataset.id = "800";
    article.innerHTML = `
      <span class="unit-eyebrow">Study tools · Memorise on the go</span>
      <h1>Flashcards</h1>
      <p class="unit-lead">Curated decks for high-leverage CMA topics in this section. Tap to flip; grade yourself with Again / Hard / Good / Easy.</p>
      <div id="fc-hub-view"></div>
      <div id="fc-deck-view" style="display:none"></div>
    `;
    const lastUnit = main.querySelector(".unit:last-child");
    if (lastUnit) lastUnit.parentNode.insertBefore(article, lastUnit.nextSibling);
    else main.appendChild(article);

    const studyGroup = CONFIG.navStructure.find(g => g.group === "Study Tools");
    if (!studyGroup) {
      CONFIG.navStructure.push({
        group: "Study Tools",
        units: [{ id: 800, num: "🃏", title: `Flashcards (${Object.keys(decks).length} decks)` }]
      });
      buildNav();
    }
    window.__renderFcHub = renderFcHub;
    renderFcHub();
  }

  function renderFcHub() {
    const decks = CONFIG.flashcardDecks || {};
    const hub = document.getElementById("fc-hub-view");
    const deckView = document.getElementById("fc-deck-view");
    if (!hub || !deckView) return;
    hub.style.display = "";
    deckView.style.display = "none";
    const stats = fcLoad();
    const cards = Object.entries(decks).map(([key, d]) => {
      const ds = stats[key] || { mastered: 0, total: d.cards.length };
      const pct = Math.round((ds.mastered || 0) / d.cards.length * 100);
      return `
        <button class="fc-deck-card" data-key="${key}">
          <div class="fc-deck-eyebrow">${d.eyebrow}</div>
          <div class="fc-deck-title">${d.title}</div>
          <div class="fc-deck-meta">
            ${d.cards.length} cards · ${pct}% mastered
            <div class="fc-deck-progress"><span style="width:${pct}%"></span></div>
          </div>
        </button>`;
    }).join("");
    hub.innerHTML = `
      <h2 style="margin-top: 28px;">Decks</h2>
      <div class="fc-hub">${cards}</div>
      <div class="callout analogy" style="margin-top:32px;">
        <span class="callout-label">How flashcards work here</span>
        <p style="margin-bottom:0">Click a card to flip it; rate your recall <strong>Again / Hard / Good / Easy</strong>. "Again" cycles the card back into the deck immediately; "Easy" retires it for the session. Mastery saves to this browser.</p>
      </div>`;
    hub.querySelectorAll(".fc-deck-card").forEach(c => {
      c.addEventListener("click", () => renderFcDeck(c.dataset.key));
    });
  }

  function renderFcDeck(key) {
    const decks = CONFIG.flashcardDecks || {};
    const deck = decks[key];
    if (!deck) return;
    const hub = document.getElementById("fc-hub-view");
    const view = document.getElementById("fc-deck-view");
    if (!hub || !view) return;
    hub.style.display = "none";
    view.style.display = "";

    const queue = deck.cards.slice().sort(() => Math.random() - 0.5);
    let idx = 0;
    let done = 0;
    const total = queue.length;
    const stats = fcLoad();
    let masteredThisSession = 0;

    function render() {
      if (idx >= queue.length) {
        const prev = stats[key] || { mastered: 0, total };
        stats[key] = { mastered: Math.max(prev.mastered || 0, masteredThisSession), total };
        fcSave(stats);
        view.innerHTML = `
          <div class="fc-summary show">
            <div class="big-num">${masteredThisSession}/${total}</div>
            <div style="font-family:'JetBrains Mono', monospace; font-size:13px; color:var(--ink-soft); letter-spacing:.06em; text-transform:uppercase;">cards mastered this session</div>
            <div style="margin-top: 18px;">
              <button class="btn" id="fc-restart">↻ Run again</button>
              <button class="btn ghost" id="fc-back">← All decks</button>
            </div>
          </div>`;
        document.getElementById("fc-restart").addEventListener("click", () => renderFcDeck(key));
        document.getElementById("fc-back").addEventListener("click", () => renderFcHub());
        return;
      }
      const [q, a] = queue[idx];
      view.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 24px;">
          <button class="btn ghost small" id="fc-back-btn">← All decks</button>
          <span style="font-family:'JetBrains Mono', monospace; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color: var(--ink-faint);">${deck.title}</span>
        </div>
        <div class="fc-stage">
          <div class="fc-card" id="fc-card">
            <div class="fc-face front">
              <div class="fc-eyebrow">Question · ${idx + 1} of ${queue.length}</div>
              <div class="fc-q">${q}</div>
              <div class="fc-flip-hint">Click or press Space to flip</div>
            </div>
            <div class="fc-face back">
              <div class="fc-eyebrow">Answer</div>
              <div class="fc-a">${a}</div>
              <div class="fc-flip-hint">Click to flip back</div>
            </div>
          </div>
        </div>
        <div class="fc-controls">
          <span class="fc-counter">${done} of ${total} graded</span>
          <div class="fc-grade">
            <button class="btn grade-again" data-grade="again">Again</button>
            <button class="btn grade-hard"  data-grade="hard">Hard</button>
            <button class="btn grade-good"  data-grade="good">Good</button>
            <button class="btn grade-easy"  data-grade="easy">Easy</button>
          </div>
        </div>
        <p style="font-size:13px; color:var(--ink-faint); margin-top:12px; font-style:italic;">Tip: <strong>Again</strong> re-queues the card immediately; <strong>Easy</strong> retires it for the session. Press <span class="kbd">Space</span> to flip; <span class="kbd">1-4</span> to grade.</p>`;
      const card = document.getElementById("fc-card");
      function flip() { card.classList.toggle("flipped"); }
      card.addEventListener("click", flip);
      document.getElementById("fc-back-btn").addEventListener("click", () => renderFcHub());

      function grade(g) {
        done++;
        if (g === "again") queue.push(queue[idx]);
        else if (g === "hard") {
          const insertAt = Math.min(queue.length, idx + 3);
          queue.splice(insertAt, 0, queue[idx]);
        } else { masteredThisSession++; }
        idx++;
        render();
      }
      view.querySelectorAll(".fc-grade .btn").forEach(b => {
        b.addEventListener("click", () => grade(b.dataset.grade));
      });
      function keyHandler(e) {
        if (isTypingTarget(e.target)) return;
        if (e.key === " ") { e.preventDefault(); flip(); }
        else if (e.key === "1") grade("again");
        else if (e.key === "2") grade("hard");
        else if (e.key === "3") grade("good");
        else if (e.key === "4") grade("easy");
      }
      if (window._fcKeyHandler) document.removeEventListener("keydown", window._fcKeyHandler);
      window._fcKeyHandler = keyHandler;
      document.addEventListener("keydown", keyHandler);
    }
    render();
  }

  // ===== ANNOTATION SYSTEM =====
  // (Highlights × 4 colours, inline notes, unit bookmarks, undo stack.)
  // Storage key derived from CONFIG.annotationKey.
  function initAnnotations() {
    const STORE_KEY = CONFIG.annotationKey;
    if (!STORE_KEY) return;

    function load() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { highlights: [], bookmarks: [] }; }
      catch { return { highlights: [], bookmarks: [] }; }
    }
    function save(data) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
    }
    let store = load();
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
    }

    const UNIT_LABELS = {};
    document.querySelectorAll('.unit[data-id]').forEach(el => {
      const h1 = el.querySelector('h1');
      const eyebrow = el.querySelector('.unit-eyebrow');
      const id = el.dataset.id;
      UNIT_LABELS[id] = h1 ? h1.textContent.trim() : (eyebrow ? eyebrow.textContent.trim() : `Unit ${id}`);
    });

    function getArticleCharOffset(article, targetNode, nodeOffset) {
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, null);
      let total = 0;
      while (walker.nextNode()) {
        if (walker.currentNode === targetNode) return total + nodeOffset;
        total += walker.currentNode.length;
      }
      return -1;
    }
    function findNodeAtCharOffset(article, charOffset) {
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, null);
      let total = 0;
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (total + n.length > charOffset) return { node: n, offset: charOffset - total };
        total += n.length;
      }
      const w2 = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, null);
      let last;
      while (w2.nextNode()) last = w2.currentNode;
      return last ? { node: last, offset: last.length } : null;
    }
    function serializeRange(range) {
      const startArt = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement?.closest('article[data-id]')
        : range.startContainer.closest?.('article[data-id]');
      if (!startArt) return null;
      const startOff = getArticleCharOffset(startArt, range.startContainer, range.startOffset);
      const endOff   = getArticleCharOffset(startArt, range.endContainer,   range.endOffset);
      if (startOff < 0 || endOff < 0) return null;
      return { articleId: startArt.dataset.id, startOff, endOff, text: range.toString().trim().slice(0, 300) };
    }
    function deserializeRange(data) {
      const article = document.querySelector(`article[data-id="${data.articleId}"]`);
      if (!article) return null;
      const s = findNodeAtCharOffset(article, data.startOff);
      const e = findNodeAtCharOffset(article, data.endOff);
      if (!s || !e) return null;
      try {
        const range = document.createRange();
        range.setStart(s.node, s.offset);
        range.setEnd(e.node, e.offset);
        return range;
      } catch { return null; }
    }
    function applyHighlightRange(range, color, hlId) {
      const ancestor = range.commonAncestorContainer;
      const walker = document.createTreeWalker(
        ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode : ancestor,
        NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (range.intersectsNode(n)) nodes.push(n);
      }
      if (!nodes.length) return;
      nodes.forEach(textNode => {
        const parent = textNode.parentElement;
        if (!parent) return;
        if (parent.closest('button, input, textarea, select')) return;
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(textNode);
        if (textNode === range.startContainer) nodeRange.setStart(textNode, range.startOffset);
        if (textNode === range.endContainer)   nodeRange.setEnd(textNode, range.endOffset);
        if (nodeRange.collapsed) return;
        try {
          const mark = document.createElement('mark');
          mark.className = `ann-hl ann-hl-${color}`;
          mark.dataset.hid = hlId;
          mark.dataset.color = color;
          nodeRange.surroundContents(mark);
        } catch {}
      });
    }
    function restoreAllHighlights() {
      store.highlights.forEach(h => {
        const range = deserializeRange(h);
        if (range) {
          applyHighlightRange(range, h.color, h.id);
          if (h.note) markHasNote(h.id);
        }
      });
    }
    function markHasNote(hlId) {
      document.querySelectorAll(`mark[data-hid="${hlId}"]`).forEach(m => m.classList.add('has-note'));
    }
    function unmarkHasNote(hlId) {
      document.querySelectorAll(`mark[data-hid="${hlId}"]`).forEach(m => m.classList.remove('has-note'));
    }
    function removeHighlightDOM(hlId) {
      document.querySelectorAll(`mark[data-hid="${hlId}"]`).forEach(mark => {
        const parent = mark.parentNode;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      });
    }

    const toolbar = document.getElementById('ann-toolbar');
    const tbNote = document.getElementById('ann-tb-note');
    const tbDelete = document.getElementById('ann-tb-delete');
    if (!toolbar) return;

    let currentSel = null, activeHlId = null, pendingNoteHlId = null, clickedMark = false;
    const undoStack = [], MAX_UNDO = 20;
    let toastTimer = null;
    function showToast(msg, duration = 2000) {
      let toast = document.getElementById('ann-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ann-toast';
        toast.style.cssText = `position:fixed; bottom:90px; right:24px; z-index:9999; background:var(--ink); color:var(--paper); padding:8px 16px; border-radius:8px; font-family:'JetBrains Mono',monospace; font-size:12px; letter-spacing:.04em; box-shadow:0 4px 16px rgba(0,0,0,.25); transition:opacity .2s; pointer-events:none; opacity:0;`;
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, duration);
    }
    function pushUndo(record) {
      undoStack.push(record);
      if (undoStack.length > MAX_UNDO) undoStack.shift();
      showToast('Ctrl+Z to undo', 2000);
    }
    function performUndo() {
      const r = undoStack.pop();
      if (!r) { showToast('Nothing to undo', 1500); return; }
      if (r.type === 'add-hl') {
        removeHighlightDOM(r.payload.id);
        store.highlights = store.highlights.filter(h => h.id !== r.payload.id);
        save(store); renderPanel(); updateBadge();
        showToast('Highlight removed ✓', 1500);
      } else if (r.type === 'del-hl') {
        store.highlights.push(r.payload); save(store);
        const range = deserializeRange(r.payload);
        if (range) {
          applyHighlightRange(range, r.payload.color, r.payload.id);
          if (r.payload.note) markHasNote(r.payload.id);
        }
        renderPanel(); updateBadge();
        showToast('Highlight restored ✓', 1500);
      } else if (r.type === 'add-bm') {
        store.bookmarks = store.bookmarks.filter(b => b !== r.payload);
        save(store); renderBookmarkButtons(); renderPanel(); updateBadge();
        showToast('Bookmark removed ✓', 1500);
      } else if (r.type === 'del-bm') {
        if (!store.bookmarks.includes(r.payload)) store.bookmarks.push(r.payload);
        save(store); renderBookmarkButtons(); renderPanel(); updateBadge();
        showToast('Bookmark restored ✓', 1500);
      }
    }
    function showToolbar(x, y, selData, existingHlId) {
      currentSel = selData;
      activeHlId = existingHlId || null;
      tbDelete.style.display = existingHlId ? 'flex' : 'none';
      tbNote.textContent = existingHlId ? '✎ Edit note' : '✎ Note';
      toolbar.style.left = x + 'px';
      toolbar.style.top = (y - 52) + 'px';
      toolbar.classList.add('show');
    }
    function hideToolbar() {
      toolbar.classList.remove('show');
      currentSel = null; activeHlId = null;
    }

    function onSelectionEnd(e) {
      requestAnimationFrame(() => {
        if (clickedMark) { clickedMark = false; return; }
        if (toolbar.contains(e.target)) return;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) { hideToolbar(); return; }
        const range = sel.getRangeAt(0);
        const text = range.toString().trim();
        if (!text) { hideToolbar(); return; }
        const startNode = range.startContainer;
        const article = (startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode)?.closest('article[data-id]');
        if (!article) { hideToolbar(); return; }
        const selData = serializeRange(range);
        if (!selData) { hideToolbar(); return; }
        const rect = range.getBoundingClientRect();
        const x = rect.left + rect.width / 2 + window.scrollX;
        const y = rect.top + window.scrollY;
        showToolbar(x, y, selData, null);
      });
    }
    // Bind both mouse and touch so text-selection highlighting works on phones.
    document.addEventListener('mouseup', onSelectionEnd);
    document.addEventListener('touchend', onSelectionEnd);
    document.addEventListener('click', e => {
      const mark = e.target.closest('mark.ann-hl');
      if (mark) {
        clickedMark = true;
        const hlId = mark.dataset.hid;
        const hlData = store.highlights.find(h => h.id === hlId);
        if (!hlData) return;
        const rect = mark.getBoundingClientRect();
        const x = rect.left + rect.width / 2 + window.scrollX;
        const y = rect.top + window.scrollY;
        showToolbar(x, y, hlData, hlId);
        window.getSelection()?.removeAllRanges();
        e.stopPropagation();
        return;
      }
      if (!toolbar.contains(e.target)) hideToolbar();
    });

    toolbar.querySelectorAll('.ann-tb-swatch').forEach(sw => {
      sw.addEventListener('click', e => {
        e.stopPropagation();
        const color = sw.dataset.color;
        if (activeHlId) {
          const hlData = store.highlights.find(h => h.id === activeHlId);
          if (hlData) {
            removeHighlightDOM(activeHlId);
            hlData.color = color;
            save(store);
            const range = deserializeRange(hlData);
            if (range) {
              applyHighlightRange(range, color, activeHlId);
              if (hlData.note) markHasNote(activeHlId);
            }
          }
        } else if (currentSel) {
          const sel = window.getSelection();
          if (!sel || !sel.rangeCount) { hideToolbar(); return; }
          const range = sel.getRangeAt(0);
          const hlId = uid();
          applyHighlightRange(range, color, hlId);
          const newHl = { ...currentSel, color, id: hlId, note: '' };
          store.highlights.push(newHl);
          save(store);
          pushUndo({ type: 'add-hl', payload: newHl });
          sel.removeAllRanges();
        }
        hideToolbar(); renderPanel(); updateBadge();
      });
    });

    tbNote.addEventListener('click', e => {
      e.stopPropagation();
      const hlId = activeHlId;
      if (!hlId && !currentSel) { hideToolbar(); return; }
      if (!hlId && currentSel) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { hideToolbar(); return; }
        const range = sel.getRangeAt(0);
        const newId = uid();
        applyHighlightRange(range, 'yellow', newId);
        const newHl = { ...currentSel, color: 'yellow', id: newId, note: '' };
        store.highlights.push(newHl);
        save(store);
        pushUndo({ type: 'add-hl', payload: newHl });
        sel.removeAllRanges();
        pendingNoteHlId = newId;
        renderPanel(); updateBadge();
      } else { pendingNoteHlId = hlId; }
      openNoteModal(pendingNoteHlId);
      hideToolbar();
    });

    tbDelete.addEventListener('click', e => {
      e.stopPropagation();
      if (!activeHlId) return;
      const hlData = store.highlights.find(h => h.id === activeHlId);
      if (!hlData) return;
      removeHighlightDOM(activeHlId);
      store.highlights = store.highlights.filter(h => h.id !== activeHlId);
      save(store);
      pushUndo({ type: 'del-hl', payload: hlData });
      hideToolbar(); renderPanel(); updateBadge();
    });

    // Note modal
    const noteModal = document.getElementById('ann-note-modal');
    const noteInput = document.getElementById('ann-note-input');
    const notePreview = document.getElementById('ann-note-preview');
    const noteSave = noteModal && noteModal.querySelector('.ann-note-save');
    const noteCancel = noteModal && noteModal.querySelector('.ann-note-cancel');

    let noteRelease = null;
    function openNoteModal(hlId) {
      const hl = store.highlights.find(h => h.id === hlId);
      if (!hl) return;
      pendingNoteHlId = hlId;
      notePreview.textContent = hl.text || '(selection)';
      noteInput.value = hl.note || '';
      const opener = document.activeElement;
      noteModal.classList.add('show');
      setTimeout(() => noteInput.focus(), 50);
      noteRelease = trapFocus(noteModal, opener);
    }
    function closeNoteModal() {
      noteModal.classList.remove('show');
      pendingNoteHlId = null;
      if (noteRelease) { noteRelease(); noteRelease = null; }
    }
    if (noteSave) noteSave.addEventListener('click', () => {
      const hl = store.highlights.find(h => h.id === pendingNoteHlId);
      if (!hl) { closeNoteModal(); return; }
      hl.note = noteInput.value.trim();
      save(store);
      if (hl.note) markHasNote(hl.id); else unmarkHasNote(hl.id);
      closeNoteModal(); renderPanel(); updateBadge();
    });
    if (noteCancel) noteCancel.addEventListener('click', closeNoteModal);
    if (noteModal) noteModal.addEventListener('click', e => { if (e.target === noteModal) closeNoteModal(); });
    if (noteModal) noteModal.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeNoteModal(); } });

    // Side panel
    const panel = document.getElementById('ann-panel');
    const panelClose = panel && panel.querySelector('.ann-panel-close');
    const tabsEl = panel && panel.querySelector('.ann-tabs');
    const togglePanel = document.getElementById('ann-toggle-btn');

    if (panelClose) panelClose.addEventListener('click', () => panel.classList.remove('open'));
    if (togglePanel) togglePanel.addEventListener('click', () => panel.classList.toggle('open'));
    if (tabsEl) tabsEl.querySelectorAll('.ann-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabsEl.querySelectorAll('.ann-tab').forEach(t => t.classList.remove('active'));
        panel.querySelectorAll('.ann-tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        panel.querySelector(`.ann-tab-pane[data-tab="${tab.dataset.tab}"]`).classList.add('active');
      });
    });

    function renderPanel() {
      if (!panel) return;
      const bmPane = panel.querySelector('.ann-tab-pane[data-tab="bookmarks"]');
      const hlPane = panel.querySelector('.ann-tab-pane[data-tab="highlights"]');
      const ntPane = panel.querySelector('.ann-tab-pane[data-tab="notes"]');
      if (bmPane) {
        if (store.bookmarks.length === 0) {
          bmPane.innerHTML = '<div class="ann-empty"><span class="big">🔖</span>No bookmarks yet.<br/>Click the bookmark icon at the top of any unit.</div>';
        } else {
          bmPane.innerHTML = store.bookmarks.map(id => {
            return `<div class="bm-item" data-id="${id}">
              <span class="bm-icon">🔖</span>
              <div class="bm-info">
                <div class="bm-unit">Unit ${id}</div>
                <div class="bm-title">${UNIT_LABELS[id] || ''}</div>
              </div>
              <button class="bm-del" data-del="${id}" title="Remove">×</button>
            </div>`;
          }).join('');
          bmPane.querySelectorAll('.bm-item').forEach(it => {
            it.addEventListener('click', () => goTo(parseInt(it.dataset.id, 10)));
          });
          bmPane.querySelectorAll('.bm-del').forEach(b => {
            b.addEventListener('click', e => {
              e.stopPropagation();
              const id = parseInt(b.dataset.del, 10);
              store.bookmarks = store.bookmarks.filter(x => x !== id);
              save(store);
              pushUndo({ type: 'del-bm', payload: id });
              renderBookmarkButtons(); renderPanel(); updateBadge();
            });
          });
        }
      }
      if (hlPane) {
        const hls = store.highlights.filter(h => !h.note);
        if (hls.length === 0) {
          hlPane.innerHTML = '<div class="ann-empty"><span class="big">✎</span>No highlights yet.<br/>Select any text to highlight.</div>';
        } else {
          hlPane.innerHTML = hls.map(h => `
            <div class="hl-item" data-id="${h.id}" data-art="${h.articleId}">
              <div class="hl-item-bar ${h.color}"></div>
              <div class="hl-item-body">
                <div class="hl-unit-label">Unit ${h.articleId} · ${UNIT_LABELS[h.articleId] || ''}</div>
                <div class="hl-text-preview">${esc((h.text || '').slice(0, 200))}</div>
              </div>
              <div class="hl-item-footer">
                <button class="hl-action-btn" data-act="note" data-id="${h.id}">+ Note</button>
                <button class="hl-action-btn danger" data-act="del" data-id="${h.id}">Delete</button>
              </div>
            </div>`).join('');
          wireHlItems(hlPane);
        }
      }
      if (ntPane) {
        const notes = store.highlights.filter(h => h.note);
        if (notes.length === 0) {
          ntPane.innerHTML = '<div class="ann-empty"><span class="big">📝</span>No notes yet.<br/>Highlight then click ✎ Note.</div>';
        } else {
          ntPane.innerHTML = notes.map(h => `
            <div class="hl-item" data-id="${h.id}" data-art="${h.articleId}">
              <div class="hl-item-bar ${h.color}"></div>
              <div class="hl-item-body">
                <div class="hl-unit-label">Unit ${h.articleId} · ${UNIT_LABELS[h.articleId] || ''}</div>
                <div class="hl-text-preview">${esc((h.text || '').slice(0, 160))}</div>
                <div class="hl-note-text">${esc(h.note)}</div>
              </div>
              <div class="hl-item-footer">
                <button class="hl-action-btn" data-act="note" data-id="${h.id}">Edit</button>
                <button class="hl-action-btn danger" data-act="del" data-id="${h.id}">Delete</button>
              </div>
            </div>`).join('');
          wireHlItems(ntPane);
        }
      }
    }
    function wireHlItems(pane) {
      pane.querySelectorAll('.hl-item').forEach(it => {
        it.addEventListener('click', e => {
          if (e.target.closest('.hl-action-btn')) return;
          const id = it.dataset.id;
          const hl = store.highlights.find(h => h.id === id);
          if (!hl) return;
          goTo(parseInt(hl.articleId, 10));
          setTimeout(() => {
            const m = document.querySelector(`mark[data-hid="${id}"]`);
            if (m) m.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 250);
        });
      });
      pane.querySelectorAll('.hl-action-btn').forEach(b => {
        b.addEventListener('click', e => {
          e.stopPropagation();
          const id = b.dataset.id;
          const act = b.dataset.act;
          if (act === 'del') {
            const hl = store.highlights.find(h => h.id === id);
            if (!hl) return;
            removeHighlightDOM(id);
            store.highlights = store.highlights.filter(h => h.id !== id);
            save(store);
            pushUndo({ type: 'del-hl', payload: hl });
            renderPanel(); updateBadge();
          } else if (act === 'note') {
            openNoteModal(id);
          }
        });
      });
    }
    function updateBadge() {
      const badge = togglePanel && togglePanel.querySelector('.badge');
      if (!badge) return;
      const total = store.highlights.length + store.bookmarks.length;
      badge.textContent = total;
      badge.classList.toggle('show', total > 0);
    }

    // Bookmark buttons per unit
    function ensureBookmarkButtons() {
      document.querySelectorAll('.unit[data-id]').forEach(u => {
        if (u.querySelector('.unit-bm-btn')) return;
        const id = parseInt(u.dataset.id, 10);
        const btn = document.createElement('button');
        btn.className = 'unit-bm-btn' + (store.bookmarks.includes(id) ? ' active' : '');
        btn.title = 'Bookmark this unit';
        btn.textContent = store.bookmarks.includes(id) ? '🔖' : '🔖';
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (store.bookmarks.includes(id)) {
            store.bookmarks = store.bookmarks.filter(x => x !== id);
            btn.classList.remove('active');
            pushUndo({ type: 'del-bm', payload: id });
          } else {
            store.bookmarks.push(id);
            btn.classList.add('active');
            pushUndo({ type: 'add-bm', payload: id });
          }
          save(store); renderPanel(); updateBadge();
        });
        u.appendChild(btn);
      });
    }
    function renderBookmarkButtons() {
      document.querySelectorAll('.unit-bm-btn').forEach(b => {
        const u = b.closest('.unit[data-id]');
        if (!u) return;
        const id = parseInt(u.dataset.id, 10);
        b.classList.toggle('active', store.bookmarks.includes(id));
      });
    }
    ensureBookmarkButtons();
    renderPanel();
    updateBadge();
    restoreAllHighlights();

    // Ctrl+Z undo
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isTypingTarget(e.target)) {
        e.preventDefault();
        performUndo();
      }
    });
  }

  // ===== SCREEN-READER LIVE REGION =====
  function ensureLiveRegion() {
    if (document.getElementById("sr-status")) return;
    const live = document.createElement("div");
    live.id = "sr-status";
    live.className = "sr-only";
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    document.body.appendChild(live);
  }

  // ===== MOBILE SIDEBAR =====
  // On narrow screens the sidebar stacks above content; a hamburger collapses
  // the nav so the unit content is reachable without scrolling the whole menu.
  function initMobileSidebar() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    let toggle = document.getElementById("sidebar-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.id = "sidebar-toggle";
      toggle.type = "button";
      toggle.setAttribute("aria-label", "Toggle section menu");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", "nav");
      toggle.innerHTML = '<span class="sb-bars" aria-hidden="true"></span><span class="sb-label">Menu</span>';
      document.body.appendChild(toggle);
    }
    toggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // ===== JOURNAL-ENTRY BUILDER =====
  // <div class="je-builder" data-prompt="…"
  //      data-accounts='["Cash","Service Revenue", …]'
  //      data-solution='[{"account":"Cash","side":"debit","amount":1000}, …]'></div>
  // Renders account/side/amount rows, a live debit=credit balance check, and
  // grades against the model entry (order-independent). Fully keyboard-operable.
  function setupJournalBuilder(rootEl) {
    let accounts, solution;
    try {
      accounts = JSON.parse(rootEl.dataset.accounts || "[]");
      solution = JSON.parse(rootEl.dataset.solution || "[]");
    } catch (e) { console.error("Bad je-builder data", e); return; }
    if (!accounts.length || !solution.length) return;
    const prompt = rootEl.dataset.prompt || "Record the transaction.";
    const startRows = Math.max(2, solution.length);

    function acctOptions() {
      return '<option value="">— account —</option>' +
        accounts.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join("");
    }
    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
    }
    function rowHtml() {
      return `<div class="je-row">
        <select class="je-acct" aria-label="Account">${acctOptions()}</select>
        <select class="je-side" aria-label="Debit or credit"><option value="debit">Debit</option><option value="credit">Credit</option></select>
        <input class="je-amt" type="number" min="0" step="0.01" placeholder="Amount" aria-label="Amount" />
        <button type="button" class="je-del" aria-label="Remove line">×</button>
      </div>`;
    }
    rootEl.innerHTML = `
      <div class="je-tag">Journal entry</div>
      <p class="je-prompt">${esc(prompt)}</p>
      <div class="je-rows">${Array.from({ length: startRows }).map(rowHtml).join("")}</div>
      <div class="je-actions">
        <button type="button" class="btn ghost small je-add">+ Add line</button>
        <button type="button" class="btn small je-check">Check entry</button>
        <button type="button" class="btn ghost small je-reset">Reset</button>
      </div>
      <div class="je-balance" aria-live="polite"></div>
      <div class="je-feedback" style="display:none"></div>`;

    const rowsEl = rootEl.querySelector(".je-rows");
    const balanceEl = rootEl.querySelector(".je-balance");
    const feedbackEl = rootEl.querySelector(".je-feedback");

    function readRows() {
      return Array.from(rowsEl.querySelectorAll(".je-row")).map(r => ({
        account: r.querySelector(".je-acct").value,
        side: r.querySelector(".je-side").value,
        amount: parseFloat(r.querySelector(".je-amt").value) || 0
      })).filter(x => x.account && x.amount > 0);
    }
    function fmt(n) { return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function updateBalance() {
      const rows = readRows();
      const dr = rows.filter(r => r.side === "debit").reduce((s, r) => s + r.amount, 0);
      const cr = rows.filter(r => r.side === "credit").reduce((s, r) => s + r.amount, 0);
      const bal = Math.abs(dr - cr) < 0.005 && (dr > 0);
      balanceEl.innerHTML = `Debits ${fmt(dr)} · Credits ${fmt(cr)} — <strong class="${bal ? "je-bal-ok" : "je-bal-no"}">${bal ? "balanced" : "out of balance"}</strong>`;
    }
    function wireRow(r) {
      r.querySelectorAll("select, input").forEach(el => el.addEventListener("input", updateBalance));
      const del = r.querySelector(".je-del");
      if (del) del.addEventListener("click", () => {
        if (rowsEl.querySelectorAll(".je-row").length <= 2) return;
        r.remove(); updateBalance();
      });
    }
    rowsEl.querySelectorAll(".je-row").forEach(wireRow);

    rootEl.querySelector(".je-add").addEventListener("click", () => {
      const tmp = document.createElement("div");
      tmp.innerHTML = rowHtml();
      const r = tmp.firstElementChild;
      rowsEl.appendChild(r); wireRow(r);
    });
    rootEl.querySelector(".je-reset").addEventListener("click", () => {
      rowsEl.querySelectorAll(".je-row").forEach((r, i) => {
        if (i >= startRows) { r.remove(); return; }
        r.querySelector(".je-acct").value = "";
        r.querySelector(".je-side").value = "debit";
        r.querySelector(".je-amt").value = "";
      });
      feedbackEl.style.display = "none";
      updateBalance();
    });
    rootEl.querySelector(".je-check").addEventListener("click", () => {
      const rows = readRows();
      const dr = rows.filter(r => r.side === "debit").reduce((s, r) => s + r.amount, 0);
      const cr = rows.filter(r => r.side === "credit").reduce((s, r) => s + r.amount, 0);
      feedbackEl.style.display = "block";
      if (rows.length < 2) {
        feedbackEl.className = "je-feedback miss";
        feedbackEl.textContent = "Enter at least one debit and one credit line.";
        return;
      }
      if (Math.abs(dr - cr) >= 0.005) {
        feedbackEl.className = "je-feedback miss";
        feedbackEl.innerHTML = `Not balanced — debits (${fmt(dr)}) must equal credits (${fmt(cr)}).`;
        srAnnounce("Entry is out of balance.");
        return;
      }
      const norm = arr => arr.map(x => `${x.account}|${x.side}|${Math.round(x.amount * 100)}`).sort();
      const got = norm(rows), want = norm(solution);
      const match = got.length === want.length && got.every((v, i) => v === want[i]);
      if (match) {
        feedbackEl.className = "je-feedback ok";
        feedbackEl.innerHTML = "✓ Correct — balanced and matches the model entry.";
        srAnnounce("Correct journal entry.");
      } else {
        const model = solution.map(s => `${s.side === "debit" ? "Dr" : "&nbsp;&nbsp;&nbsp;Cr"} ${esc(s.account)} ${fmt(s.amount)}`).join("<br/>");
        feedbackEl.className = "je-feedback miss";
        feedbackEl.innerHTML = `It balances, but doesn't match the model entry. Model answer:<div class="je-model">${model}</div>`;
        srAnnounce("Balances, but does not match the model entry.");
      }
    });
    updateBalance();
  }

  // ===== INITIALIZE EVERYTHING =====
  function initAll() {
    progress = loadProgress();
    ensureLiveRegion();
    buildNav();
    initMobileSidebar();
    document.querySelectorAll(".quiz[data-correct]").forEach(q => handleQuiz(q, parseInt(q.dataset.correct, 10)));
    document.querySelectorAll(".test").forEach(t => setupTest(t));
    document.querySelectorAll(".bucket-sort").forEach(b => setupBucketSort(b));
    document.querySelectorAll(".je-builder").forEach(j => setupJournalBuilder(j));
    document.querySelectorAll("[id^='mark-done-']").forEach(btn => {
      const id = parseInt(btn.id.replace("mark-done-", ""), 10);
      setMarkDoneButton(btn, progress.done.includes(id));
      btn.addEventListener("click", () => markDone(id));
    });
    initSidebarSearch();
    initKeyboardShortcuts();
    initFormulaPanel();
    injectKeyTakeaways();
    initFlashcards();
    initAnnotations();

    // Run any window.init* functions defined inline by section files
    Object.keys(window).filter(k => k.startsWith("init") && typeof window[k] === "function").forEach(fn => {
      // Skip our own engine functions
      if (["initAll"].includes(fn)) return;
      try { window[fn](); } catch (e) { /* ignore — function may have already run */ }
    });

    document.getElementById("reset-progress")?.addEventListener("click", () => {
      if (confirm("Clear all progress and reset to start?")) {
        progress = { done: [], last: 0 };
        saveProgress();
        buildNav();
        goTo(0);
      }
    });

    if (progress.last) goTo(progress.last);
  }

  window.CMA = {
    init(config) {
      CONFIG = config;
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAll);
      } else {
        initAll();
      }
    },
  };
})();
