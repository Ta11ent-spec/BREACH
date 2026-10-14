# BREACH / INTEL

**BREACH website — local replay analytics with a preserved investor demo.**

React + TypeScript + Vite frontend with an ASP.NET Core API and SQL Server LocalDB. Real Data mode provides recorded match/player/map/operator analytics, squads, comparisons, insights, persistent reviews, diagnostics and exports. Demo mode preserves the original fictional preview.

> **Local development:** Real Data uses imported replay records. A [Windows collector private preview](collector/README.md) now provides local collection and JSON export. Account authentication, hosted ownership, collector uploads and live telemetry are not implemented. See [local workflows and review migration](docs/REAL_WORKFLOWS.md), [collector contract](docs/COLLECTOR_DATA_CONTRACT.md) and [development roadmap](docs/ROADMAP.md). The frontend needs the local backend to use Real Data.

## Run in VS Code (Windows)

Open your existing `breach-intel-website` folder in VS Code, then run:

```powershell
npm install
npm run dev
```

Visit **http://localhost:5173/#/overview**. Vite automatically reloads changes.

```powershell
npm run build       # type-check + production build
npm run preview     # preview the production build
npm run typecheck   # TypeScript check
```

**Editable source:** each screen lives in `src/pages/`, shared UI is in `src/components/`, navigation and app state are in `src/app/`, mock stats live in `src/data/`, and split styling is in `src/styles/`. `src/App.tsx` and `src/styles.css` are intentionally tiny compatibility entry points.

## Project layout

```text
breach-intel-website/
├── src/
│   ├── app/                # app controller, page routing, navigation
│   ├── components/         # icons, cards, charts, tables, sidebar, topbar
│   ├── pages/              # overview, matches/rounds, live, players,
│   │                       # maps, operators, compare, insights, entry, settings
│   ├── data/               # deterministic fictional fixtures and selectors
│   ├── lib/                # formatting and exports
│   ├── styles/             # screen-by-screen CSS, original cascade preserved
│   ├── types/              # preliminary domain contracts
│   ├── App.tsx             # compatibility entry
│   ├── styles.css          # CSS import entry
│   └── main.tsx            # React browser entry
├── standalone-demo/        # frozen, offline investor demo (not source of truth)
├── docs/                   # architecture, roadmap, demo guide, refactor guide
├── .github/workflows/      # build checks on commits and pull requests
└── package.json
```

The refactor preserves all existing `#/...` page URLs and local storage keys. We intentionally kept the existing class-backed state controller during Stage 1 to minimize breakage; view types and state architecture still need incremental modernization. See [the Stage 1 guide](docs/REFACTOR_GUIDE.md) and [architecture notes](docs/ARCHITECTURE.md).

## GitHub workflow

Existing GitHub remote: [Ta11ent-spec/BREACH](https://github.com/Ta11ent-spec/BREACH). **Don't reinitialize Git or add `origin` again.**

For new features, work in a branch:

```powershell
git switch main
git pull
git switch -c feature/frontend-foundation
# edit and test...
npm run build
git add .
git commit -m "Refactor frontend into feature modules"
git push -u origin feature/frontend-foundation
```

Open a pull request on GitHub to merge your feature branch into `main` after reviewing the changes. The Stage 1 ZIP is an **update overlay for the existing repository**—it does not include or replace `.git`, `node_modules`, or `package-lock.json`.

## Product roadmap

- **Stage 0:** Vite/TypeScript website + GitHub connection — complete.
- **Stage 1:** Separate pages, shared UI, mock data and CSS into modules — delivered in this update; screen typing/tests remain.
- **Stage 2:** Polish public pages, authentication concept, workflows and data interfaces.
- **Stage 3:** Backend, database and only the game data sources we can validate and legally use.

This is an independent project, not affiliated with or endorsed by Ubisoft. Consult platform terms, privacy requirements and IP obligations before launch.
