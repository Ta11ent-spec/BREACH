# BREACH / INTEL — first real-data integration (Stage 4)

This is **not** a replacement project. Apply the update to your existing BREACH repository. The patch adds a separate ASP.NET Core API under `backend/` and read-only React views. It does not modify your LocalDB schema, match data, importer, Git configuration, or npm dependencies.

## 0. Before starting

- Your `BREACH_INTEL_DEV` LocalDB already contains 1 match, 6 rounds, 10 players, 60 player-rounds, 42 events, and 3 import issues.
- Install the **.NET 10 SDK** from https://dotnet.microsoft.com/download/dotnet/10.0 (not just the runtime). Confirm `dotnet --version` prints `10.x` or later SDK supporting `net10.0`.
- Keep SQL Server LocalDB running under your normal Windows account. **Do not** run the API as administrator.
- Do not commit original `.rec`/JSON match files or actual player identifiers to your public repository. This update includes **no player data**.

## 1. Create a feature branch

In VS Code's terminal, from your existing `C:\projects\breach-intel-website` folder:

```powershell
git status
git switch main
git pull origin main
git switch -c feature/real-data-api
```

Run this only with a clean worktree. Extract the update ZIP, and copy **`backend`, `src`, `docs`, `vite.config.ts`, `.gitignore`** into the existing project root, agreeing to merge/overwrite. **Never** replace `.git`, `node_modules`, or `package-lock.json`.

## 2. Run the backend (Terminal #1)

```powershell
dotnet --version
dotnet restore .\backend\Breach.Intel.Api\Breach.Intel.Api.csproj
dotnet run --project .\backend\Breach.Intel.Api\Breach.Intel.Api.csproj
```

Expected output: `Now listening on: http://127.0.0.1:5087`.

Open http://127.0.0.1:5087/api/health in your browser. Expected JSON resembles:

```json
{"status":"ok","database":"BREACH_INTEL_DEV","matches":1}
```

This is a local read-only API that uses Windows Authentication to open `(localdb)\MSSQLLocalDB`. It listens on loopback only. No Ubisoft endpoint or replay file is accessed by the API.

## 3. Run the frontend (Terminal #2)

```powershell
npm install
npm run build
npm run dev
```

Open http://localhost:5173/#/matches. Select **REAL DATA** on the top bar. You should see your single imported match; click through to inspect all six rounds and individual player totals. **DEMO** restores every original investor-prototype screen.

The Vite dev server proxies `/api` requests to the local ASP.NET backend on port 5087. You do not need CORS or a direct browser connection to SQL Server.

## 4. Confirm the API routes

| Route | Use |
| --- | --- |
| `/api/health` | SQL Server connectivity and match count |
| `/api/matches` | Imported match list |
| `/api/matches/{matchId}` | Match metadata, rounds, player scoreboard |
| `/api/matches/{matchId}/rounds` | Round summary list |
| `/api/matches/{matchId}/rounds/{number}` | Individual round players and event timeline |
| `/api/players` | All imported players |
| `/api/players/{playerId}/stats` | Aggregated player stats and operator picks |

All endpoints are GET and **read-only**. Paths are parameterized SQL queries. No auth has been built yet because this service is meant for local testing only. **Never publish the API publicly without authentication, authorization, and privacy/security review.**

## 5. Known data limitations

- The parser returned a map ID but not its label; the UI displays **Unresolved map** rather than guessing.
- The raw parser score is cumulative and isn't summed.
- `damageDealt` and `damageTaken` may be null/missing. Aggregation preserves null if no recorded damage exists, but sums over recorded values are not complete damage estimates.
- Some kills are timestamped `0:00`, with suspicious event ordering. Events are preserved and marked as subject to validation.
- Actual rank, MMR, positional heat maps, drones, utility, and comprehensive KOST aren't provided.
- Real-data mode only implements Overview, Matches/Rounds, and Players. Other pages show an explicit unavailable notice. Demo mode still displays the original investor UI.
- Manual entries remain **demo-local only**; no write endpoint is exposed in this first API.
- `TeamSlot=0` is treated as the recorded player's side per importer conventions. A wider match set will need verification for edge cases.

## 6. Troubleshooting

- **`dotnet` not recognized:** Install .NET **10 SDK**, restart VS Code, then `dotnet --version`.
- **Missing target framework or package restore failure:** Confirm .NET 10 SDK, internet access for the initial NuGet restore, and rerun `dotnet restore`.
- **Port 5087 in use:** Close the other instance of the API before starting another; don't change ports without also updating `vite.config.ts`.
- **`/api/health` returns 503:** Open SSMS and verify you're connected to `(localdb)\MSSQLLocalDB`, `BREACH_INTEL_DEV` contains tables, and the API runs under the same Windows user.
- **Frontend says API unavailable:** Keep Terminal #1 running while running Terminal #2. Test the health URL directly.
- **Browser shows old pages:** Select REAL DATA; reload, and confirm the Vite server was restarted after updating `vite.config.ts`.
- **`npm run build` fails:** Send the exact error text; don't merge the feature branch.

## 7. Commit safely

Once the **API health check**, **React build**, and **screen navigation** work locally:

```powershell
git add backend src docs vite.config.ts .gitignore
git commit -m "Add local SQL Server API and real replay dashboards"
git push -u origin feature/real-data-api
```

Open a pull request against `main` and merge only after the checks pass. The SQL Server data remains in your local Windows profile; it is not pushed to GitHub.
