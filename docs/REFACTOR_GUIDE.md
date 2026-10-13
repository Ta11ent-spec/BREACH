# BREACH / INTEL — Frontend foundation (Stage 1)

This release reorganizes the **existing investor demo**. It deliberately does not redesign screens, invent real Siege data integrations, or change stored demo records.

## Update an EXISTING GitHub clone (recommended)

Do **not** replace your `.git`, `package-lock.json`, or `node_modules` directories.

1. In VS Code's terminal, make sure you're in the `breach-intel-website` repository and run:

   ```powershell
   git status
   git switch -c feature/frontend-foundation
   ```

   If you have uncommitted changes, commit or stash those before copying the update.
2. Extract **breach-intel-stage1-update.zip**. Copy the **`src`** and **`docs`** folders and **`README.md`** from the ZIP into the **root** of your existing project, choosing **Merge / Replace** when prompted. Keep your own `.git` folder and `package-lock.json` (and back up your README if you have customized it).
3. Run:

   ```powershell
   npm run dev
   npm run build
   git status
   git add src docs README.md
   git commit -m "Refactor frontend into feature modules"
   git push -u origin feature/frontend-foundation
   ```
4. Create and merge a pull request into `main` on GitHub after checking the demo screens.

### URLs to smoke-test

- `#/overview` — Command overview, period switcher
- `#/live` — simulated live operation timeline
- `#/matches` — filters, exports, match detail and round detail navigation
- `#/players` — directory, player detail and profile tabs
- `#/operators` — side filter and sorting
- `#/maps` — map details
- `#/insights` — report screen
- `#/compare` — player picker
- `#/entry` — save/delete local notes and export JSON
- `#/settings` — toggles and demo reset

Check desktop and mobile-width sidebar, Ctrl+K search, and page refresh on a detail hash URL.

## Architecture

```text
src/
├── App.tsx                     # small compatibility entry point
├── app/
│   ├── App.tsx                 # state controller, exports, browser persistence
│   ├── RouteView.tsx           # existing hash-based routing
│   └── navigation.ts           # navigation names and destinations
├── components/
│   ├── common/                 # buttons, cards, icons, badges
│   ├── charts/                 # analytics and schematic visuals
│   ├── layout/                 # sidebar and top toolbar
│   └── matches/                # round chips, match rows, score table
├── data/
│   ├── demoData.ts             # mock fixture generator; NEVER real player data
│   └── selectors.ts            # aggregations, player and match selectors
├── lib/                        # formatting and file download helpers
├── pages/                      # independent screen files organized by feature
├── styles/                     # split CSS with identical cascade order
├── styles.css                  # CSS import entry point
└── types/domain.ts             # future API shape definitions
```

## Scope and engineering notes

- Routes stay in the existing `#/...` format, so old links still work.
- No React Router or other new packages were introduced.
- Manual entry browser storage keys are unchanged (`breach_entries`, `breach_settings`).
- Source fixture values and styling are preserved; this is a behavior-preserving extraction.
- The original standalone investor demo remains untouched in `standalone-demo/`.
- The refactor is **transitional**: screen components call a class-backed controller (`app`) and still contain prototype-era `any` annotations / `@ts-nocheck`. Follow-on work should adopt typed props, hooks, and feature-level state. Do not confuse file splitting with complete modernization.
- `npm run build` should be run in the user's local installation before merging. This packaging environment could not reach the npm registry for a full install/build.
- UI is fictional and independent; no real Ubisoft account, replay parser or live integration exists.
