# Learn Commons

A growing collection of free, browser-based study platforms for professional certifications. Each program is built around diagrams, drag-drop interactives, calculation playgrounds, hundreds of practice questions, exam timers, flashcards, and a searchable formula reference panel. Vanilla HTML + CSS + JS — no install, no signup, no tracking.

🌐 **Live site:** [tokagerous.github.io/learn-commons](https://tokagerous.github.io/learn-commons/)

## Available programs

| Program | Issuer | Status | Coverage |
|---|---|---|---|
| **CMA Part 1** | IMA | Live | 3 sections, ~75 units, 400+ practice questions, 23 flashcard decks |
| **FMAA** | IMA | Scaffold | 4 domains, starter units in place, expanding |

## Features

- **Visual + interactive** — diagrams over walls of text. Calculators that update live as you slide inputs.
- **Try-again quizzes** — wrong clicks eliminate the option and explain why; keep trying.
- **CMA-pace test timer** (1.8 min/question) with per-question flag and "Replay missed only" mode.
- **Spaced-repetition flashcards** — Again / Hard / Good / Easy grading.
- **Highlight, note, and bookmark** any text — saved per browser, per program.
- **Keyboard-driven** — `←` / `→` between units, `/` content search, `F` formula panel, `B` bookmark, `?` for help.

## Run locally

```bash
git clone https://github.com/tokagerous/learn-commons.git
cd learn-commons
open index.html       # or python3 -m http.server 8080 and visit localhost:8080
```

No dependencies, no build.

## Repository layout

```
/
├── index.html                       multi-program hub
├── 404.html                         with redirect table for moved URLs
├── assets/
│   ├── style.css                    shared design system
│   └── engine.js                    shared engine (nav, quiz, test, flashcards, annotations)
├── programs/
│   ├── cma-part-1/
│   │   ├── index.html               CMA Part 1 program landing
│   │   ├── section-a.html           External Financial Reporting
│   │   ├── section-b.html           Planning, Budgeting & Forecasting
│   │   └── section-c.html           Performance Management
│   └── fmaa/
│       ├── index.html               FMAA program landing
│       ├── domain-1.html            Financial Statements
│       ├── domain-2.html            Cost Management
│       ├── domain-3.html            Planning & Budgeting
│       └── domain-4.html            Performance Management
└── CLAUDE.md                        architecture + handoff doc
```

Each program file imports `../../assets/style.css` and `../../assets/engine.js` and defines its own `window.SECTION_CONFIG`. The shared engine reads the config and wires everything up. See [`CLAUDE.md`](CLAUDE.md) for the schema and adding-a-new-program checklist.

## Hosting

This site is deployed via **GitHub Pages** from the `main` branch root. To self-host:

- **GitHub Pages**: Settings → Pages → Source = `main` / `/ (root)`. Done.
- **Vercel / Netlify**: drop the directory into either — auto-detected as a static site.
- **Any static host**: upload the directory as-is.

Progress, annotations, and flashcard mastery save to the browser's `localStorage` per program — switch devices and you'll start fresh on that device. The per-program isolation means CMA progress doesn't leak into FMAA progress (and vice versa).

## Adding a new program

Copy a `programs/<existing-program>/` directory as a template. Replace the content + `SECTION_CONFIG`. Add a card to the root `index.html`. See [`CLAUDE.md`](CLAUDE.md) "Adding a new program" for the step-by-step.

## License

This is study material drawn from publicly available content specification outlines (IMA CMA CSO, IMA FMAA CSO). Practice questions are written from CMA-style and FMAA-style patterns; no copyrighted question banks are reproduced. Feel free to fork, adapt, and use for personal study.
