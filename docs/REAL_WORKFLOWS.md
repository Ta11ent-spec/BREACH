# Real settings, review and collection activity

Real Data mode now has implementations for Settings (`/settings`), Manual Entry/Review (`/entry`), Live Operations as post-match collection activity (`/live`) and Collector Setup (`/collector`). Demo mode preserves its existing screens. These local development workflows do not implement hosted accounts or distribute the future PC collector.

## Database migration and startup

Review notes use the additive `backend/Breach.Intel.Api/Sql/002_review_notes.sql` migration. Imported tables and statistics are not modified. For a new checkout, run the migration once in Development:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project backend/Breach.Intel.Api -- --apply-review-schema true
dotnet run --project backend/Breach.Intel.Api
```

The schema-inspection helper `--inspect-review-schema true` prints existing match/player ID types. The current development schema stores IDs as nvarchar(100). The migration is idempotent and creates only review storage/indexes.

## Review provenance

`GET /api/workflows/notes` returns the latest 500 records including withdrawals. `POST` stores a match-linked observation, optionally linked to a recorded round and participating player. Categories include correction proposals, not direct scoreboard edits. Author label and creation time are server-generated. `DELETE /notes/:id` marks a withdrawal and retains the original record for audit/export. IDs are parameterized and references validated.

Mutations require the workflow header; the endpoints are Development-only and loopback-only, matching the local squad model. Production account ownership and permissions must be implemented before hosting these routes. UI records persist in SQL Server, not demo localStorage.

## Settings and activity

Settings shows real database/API diagnostics and supports the existing persisted compact-layout preference. Match exports follow selected player/squad scope across all recorded dates. Review exports preserve audit provenance. Fictional workspace/season details and demo archive/reset actions are absent from Real Data settings.

`GET /api/workflows/status` supplies counts, latest successful import, latest 30 committed batch records and latest 100 saved issues. Refresh rechecks the API. If a refresh fails, any previously loaded status is labeled stale. Current responses explicitly report no connected collector, no authenticated sync and no live telemetry. Held/failed parser attempts that never entered committed database batches are not claimed as monitored jobs.

Collector Setup downloads the draft schema/example and validates a chosen JSON file locally. Validation does not upload, store or import it. See [collector contract](COLLECTOR_DATA_CONTRACT.md) for the future pairing/ingestion protocol and remaining implementation gates.

## Checks

- `npm test`: analytics plus collector contract validation.
- `npm run build`: TypeScript and production frontend build.
- `dotnet build backend/Breach.Intel.Api`: API compilation.
- `pwsh -File tests/workflowApi.ps1 -BaseUrl http://127.0.0.1:5088`: creates and withdraws one disposable test annotation, checks persisted audit, rejects invalid rounds/missing headers and confirms imported record counts remain unchanged. The withdrawn test row stays in the audit history.

GitHub CI now runs analytics/contract tests, the frontend production build and backend compilation. LocalDB integration checks remain local because CI does not provision the developer database.
