# Architecture (UI-first version)

## What is working today

- Modern Vite entry point (`src/main.tsx`) creates the React root.
- The original investor demo's interactive UI lives in `src/App.tsx`.
- Existing styling is imported in `src/styles.css`.
- Mock match + round + player fixtures are generated inside `src/App.tsx`.
- Hash navigation supports static hosts (`#/overview`, `#/matches`, `#/players`, etc.).
- Manual annotations/preferences live in browser `localStorage` only.
- `standalone-demo/` is an immutable offline backup for investor meetings.

## Migration targets (not implemented yet)

```text
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── layout/
├── components/             Reusable UI controls, charts, tables, filters
├── features/
│   ├── dashboard/
│   ├── matches/
│   ├── rounds/
│   ├── players/
│   ├── operators/
│   ├── maps/
│   ├── reports/
│   └── annotations/
├── data/                   Fixtures and future data-source adapters
├── domain/                 Strict types: player, match, round, event
└── styles/
```

Prefer an API abstraction instead of binding screens directly to backend details:

```text
UI components -> typed selectors/hooks -> data repository interface
  ├── MockRepository (current UI fixture equivalent)
  └── ApiRepository (future server adapter)
```

**For real Siege data:** track provenance (replay/live/manual), importer version, event deduplication keys, and a complete round timeline. The current UI does not claim full game telemetry access. Console capture will need a separate path.

## Deployment

`npm run build` emits a static site into `dist/`. Deploy `dist/` to a static provider like Netlify, Cloudflare Pages, Vercel or GitHub Pages. `netlify.toml` is included. Keep GitHub Source Control separate from hosting. Hash routes require no server-side rewrite.
