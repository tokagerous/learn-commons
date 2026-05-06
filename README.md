# CMA Part 1 — Visual Field Guide

A free, browser-based study platform for the IMA's **Certified Management Accountant (CMA) Part 1** exam. Built with vanilla HTML + CSS + JS — no build step, no backend, no tracking.

🌐 **Live site:** [tokagerous.github.io/learn-commons](https://tokagerous.github.io/learn-commons/)

## What's covered

| Section | Topic | Units | Test Qs |
|---|---|---:|---:|
| **A** | External Financial Reporting | 34 | 180 |
| **B** | Planning, Budgeting & Forecasting | 16 | 100 |
| **C** | Performance Management | 12 | 95 |

Plus 23 flashcard decks (~250 cards), ~25 hands-on calculators / drag-drop interactives, a global formula reference panel, and a full annotation system (highlights × 4 colours, notes, bookmarks).

## Features

- **Visual + interactive** — diagrams over walls of text. Calculators that update live as you slide inputs.
- **Try-again quizzes** — wrong clicks eliminate the option and explain why; keep trying.
- **CMA-pace test timer** (1.8 min/question) with per-question flag and "Replay missed only" mode.
- **Spaced-repetition flashcards** — Again / Hard / Good / Easy grading.
- **Highlight, note, and bookmark** any text — saved per browser.
- **Keyboard-driven** — `←` / `→` between units, `/` search, `F` formula panel, `B` bookmark, `?` for help.

## Run it locally

```bash
git clone https://github.com/tokagerous/learn-commons.git
cd learn-commons
open index.html       # or python3 -m http.server 8080 and visit localhost:8080
```

No dependencies, no build.

## Repository layout

```
index.html              landing page
cma-section-a.html      External Financial Reporting
cma-section-b.html      Planning, Budgeting & Forecasting
cma-section-c.html      Performance Management
assets/
  style.css             shared design system
  engine.js             shared engine (nav, quiz, test, flashcards, annotations)
CLAUDE.md               architecture + handoff doc
```

Each section file defines a `window.SECTION_CONFIG` object that the engine reads — see [`CLAUDE.md`](CLAUDE.md) for the schema and conventions for adding new sections.

## Hosting

This site is deployed via **GitHub Pages** from the `main` branch root. To self-host:

- **GitHub Pages**: Settings → Pages → Source = `main` / `/ (root)`. Done.
- **Vercel / Netlify**: drop the directory into either — auto-detected as a static site.
- **Any static host**: upload the directory as-is.

Progress, annotations, and flashcard mastery save to the browser's `localStorage` — switch devices and you'll start fresh on that device.

## Adding more sections (D, E, F)

The platform is built to extend. Copy `cma-section-b.html` as a template, swap in the new content + `SECTION_CONFIG`, and add a card in `index.html`. Engine and stylesheet already work. See [`CLAUDE.md`](CLAUDE.md) for the per-unit content shape.

## License

This is study material drawn from the publicly available IMA CMA Content Specification Outline. Practice questions are written from CMA-style patterns; no copyrighted question banks are reproduced. Feel free to fork, adapt, and use for personal study.
