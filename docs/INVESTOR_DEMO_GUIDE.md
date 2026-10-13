# BREACH / INTEL — Investor Demo Walkthrough

## What you're showing

An interactive, **UI-only** vision for a tactical analytics platform built around a canonical **match → round → player → event** data model. Every outcome and metric is demonstration data, with clear labels.

## Suggested five-minute walkthrough

1. **Command Overview (45 seconds):** Lead with win rate, K/D, KOST, attack/defense splits, top players, and map records. Use the **7D / 30D / ALL** controls to illustrate flexible analytics.
2. **Match Center (45 seconds):** Search opponents or maps, filter wins versus losses, and open the newest match. Point out that each match stores individual rounds.
3. **Match Detail → Round Explorer (60 seconds):** Review the scoreboard, select a numbered round, and show round events, operator assignments, timeline, and a conceptual tactical schematic.
4. **Player Directory → Compare Players (60 seconds):** Open a player dossier, switch profile tabs, then compare two players across eliminations, damage, KOST, and other metrics.
5. **Live Operations (45 seconds):** Explicitly describe it as a simulation. Click **Advance Event** several times so new events appear.
6. **Manual Entry + Insights (45 seconds):** Add a VOD-review note, show it persisted in the browser, then open the executive insights page. Export CSV or JSON to demonstrate future reporting workflows.

## What is functional today

Navigation, filters, search, drill-downs, tabs, comparisons, simulation controls, CSV/JSON exports, responsive layout, saved manual records, and UI settings. The demo opens directly via `index.html`.

## What is intentionally not implemented

Real game data ingestion, console replay extraction, Overwolf integration, login, a database, multi-user collaboration, reliable map coordinates, video analysis, and production-grade statistical verification. The UI should not be represented as a deployed stats collection platform.

## Next engineering milestone

Replace demo event generation with an import adapter and normalized backend models; verify available replay fields against the current Siege build. Use explicit provenance and de-duplication when merging live telemetry, replay files, and manual entries.
