# BREACH / INTEL — Overview v0.3 (local development)

## Scope and limits

- Existing investor-demo design remains available in DEMO mode.
- REAL Overview now has TEAM / PLAYER selector, up to five stable player IDs per squad,
  multiple saved squad names, replaceable members, and a searchable imported-player picker.
- Squad definitions **currently live in localStorage on this browser**, not SQL Server.
  They are not accounts, have no cloud sync, and are not shared across devices or users.
- There is no automatic Ubisoft account verification. Manual IDs must be verified by the user.
- The new read-only endpoint `/api/overview/v3` returns both replay team slots and individual
  player-round appearances, so the dashboard can resolve the selected side per match.
- The other REAL pages, including Match Center, still show replay slot 0 and await the
  same selection-context upgrade. Do not treat their team results as filtered squad stats yet.
- Completed/unambiguous matches only contribute match wins; verified known round results
  may be included even if the source match isn't independently declared complete.
- Stats exclude members on opposing sides of the same match instead of guessing a team.
- Headshot rate is based on kills with known headshot data. The card explicitly shows
  the coverage denominator; partial samples are not represented as fully complete.
- Damage/score snapshots are intentionally not summed across rounds.
- The side ring shows `(attack wins + defense wins) / (attack rounds + defense rounds)`.
  Each bar separately shows its own win rate, with actual numerators and denominators.
- The performance chart uses a correctly labeled 0%–100% axis.

## Install

Apply `breach-squads-analytics-v0.3.patch` to the existing **v0.2 real Overview dashboard**.
Check `git status` before applying. From project root:

```powershell
$patch = "$env:USERPROFILE\Downloads\breach-squads-analytics-v0.3\breach-squads-analytics-v0.3.patch"
git apply --check "$patch"
git apply "$patch"
npm run build
dotnet build .\backend\Breach.Intel.Api\Breach.Intel.Api.csproj
npm run test:analytics
```

Make sure you are running the API and Vite servers after the build. Refresh the REAL Overview page.
Switch TEAM and PLAYER at the top. TEAM > Manage squads allows create, rename, delete,
search imported players by name/ID, add manual IDs, and remove/replace squad members.

## Important caveats before public deployment

The local API still has no authentication or per-user authorization. The V3 endpoint is
intended solely for loopback development with a locally trusted database. **Do not expose
it to the public internet**. Before deploying: add user accounts and permissions, migrate
squads to server-side ownership, validate identifier control, and review data privacy and
replay-parser redistribution / Ubisoft permissions.

## QA checklist

- TEAM squad A with one player: match perspective follows their team slot (0 or 1).
- TEAM squad B with two different members: stats and matches change.
- Swap a member: stats change and roster persists after refresh.
- PLAYER mode: only the selected individual's round statistics are counted.
- Unknown or conflicting sides: results excluded, with count in disclaimer.
- Ring matches combined wins / combined side rounds; bars use independent denominators.
- Win-rate trend chart Y-axis is 0–100%.
- API is running; browser network requests to `/api/overview/v3` return 200.
- DEMO mode is unchanged.
