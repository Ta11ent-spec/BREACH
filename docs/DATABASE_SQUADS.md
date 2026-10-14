# Database-backed squads (local development)

The Overview uses SQL Server for named squads and their ordered rosters. Player,
mode and selected-squad preferences remain in browser storage. This supersedes
the storage description in `SQUADS_AND_ANALYTICS_V3.md`.

## Setup

From the website directory, apply the idempotent, additive migration:

```powershell
sqlcmd -S '(localdb)\MSSQLLocalDB' -d BREACH_INTEL_DEV -E -b -i backend/Breach.Intel.Api/Sql/001_squads.sql
dotnet run --project backend/Breach.Intel.Api/Breach.Intel.Api.csproj
# In a second terminal:
npm run dev
```

The migration only adds `Squads` and `SquadMembers`; it does not update or delete
players, imported matches, rounds or telemetry. No automatic schema changes run
at API startup. A missing schema/database produces a visible storage error.

## Existing browser squads

Open REAL Overview in the browser that has the old squads and choose **Import
browser squads**. This imports up to 100 rosters atomically, preserving IDs and
member order. Existing server IDs are kept rather than overwritten. Retrying
the import is safe. The original localStorage data remains as a recovery copy;
a separate marker hides the prompt after success. Do not clear browser storage
before importing. A different browser connected to the same API can then load
the saved squads.

## Data rules

- A squad has a stable ID, name, ordered list of zero to five IDs, and version.
- A member may belong to multiple squads, but only once within each roster.
- SQL constraints enforce five unique slots and unique player IDs per squad.
- Unrecorded manual IDs remain valid. `SquadMembers.PlayerId` deliberately has
  no `Players` foreign key: it resolves to replay players when their data is
  imported, without inserting placeholder players or modifying importer records.
- Each roster replacement uses one transaction. Saves and deletes compare the
  previously loaded version; a stale tab gets a conflict and must reload squads.
- The UI changes saved rosters only after a successful response. Editing is
  disabled while loading/saving; errors retain the last loaded roster.
- Roster edits change the selection used to analyze historical replays. These
  tables do not model historical membership periods; actual participation still
  comes from player-round appearances.

## API

- `GET /api/squads`: current rosters, including version.
- `PUT /api/squads/{id}`: `{id,name,members,version}`; omit version to create.
- `DELETE /api/squads/{id}?version=N`: delete the roster only.
- `POST /api/squads/import`: array of legacy rosters; insert missing IDs only.

Mutations require `X-Breach-Request: squads`. No CORS access is granted. Endpoints
are available only in Development over loopback. This is one trusted local
workspace, with no user accounts, ownership or cloud synchronization. Add account
ownership and authorization before exposing squad management beyond local development.

## Verification

```powershell
npm run test:analytics
npm run build
dotnet build backend/Breach.Intel.Api/Breach.Intel.Api.csproj
# With the development API running, PowerShell 7:
pwsh -File tests/squadsApi.ps1
```

The API test creates uniquely identified test squads, verifies validation,
persistence, concurrent edit protection and import retries, then removes only
its own records. Replay counts are compared before/after.
