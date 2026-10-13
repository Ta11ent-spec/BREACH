# BREACH / INTEL — Frontend architecture

## Current implementation (Stage 1)

- `src/main.tsx` mounts the React app using Vite.
- `src/App.tsx` is a backward-compatible entry point that forwards to `src/app/App.tsx`.
- `src/app/App.tsx` retains demo state, hash-navigation listeners, browser-local preferences, and export actions.
- `src/app/RouteView.tsx` selects feature pages using the existing `#/...` URLs.
- `src/components/layout/` contains the sidebar and top toolbar.
- `src/components/common/`, `charts/`, and `matches/` contain shared presentation components.
- `src/pages/` contains per-feature screens: overview, live, matches and rounds, players, operators, maps, insights, compare, manual entries and settings.
- `src/data/demoData.ts` contains the deterministic fictional dataset; `src/data/selectors.ts` houses basic statistics and lookup utilities.
- `src/lib/` contains formatting and download utilities; `src/types/domain.ts` defines preliminary domain contracts for the future backend.
- `src/styles.css` imports smaller CSS files in the original stylesheet's order. The resulting selectors and rule content have not been altered.
- `standalone-demo/` remains the original offline investor presentation and is intentionally untouched.

## Future improvements

This is a **behavior-preserving extraction**, not a completed rewrite. Some screens still use legacy `any` typings and a class-backed controller, and localStorage has not been replaced with a proper repository abstraction.

The next technical steps are to migrate the controller to typed feature-level hooks/state, introduce selectors with tested typed interfaces, and add automated component and interaction tests. Keep the existing routes working during migration.

Data ownership should eventually look like:

```text
feature page -> feature hooks -> typed selectors -> repository adapter
                                          |-> MockRepository (today)
                                          |-> API / replay / authorized telemetry source (future)
```

For real Siege data, retain provenance (replay/live/manual), importer version, data corrections, event deduplication identifiers, and detailed round timelines. The UI currently makes **no real telemetry connection**. Console capture is a separate future workflow.

## Deployment

`npm run build` emits static files into `dist/`. Hosting is a separate step from pushing code to GitHub. Hash-based URLs do not require a server-side router. See [REFACTOR_GUIDE.md](REFACTOR_GUIDE.md) for integration and smoke-test instructions.
