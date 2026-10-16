# BREACH releases

## V1.1.0 — October 15, 2026

- Orange/red brand accent and persistent light/dark themes.
- Ten-player manual entries with five players per team. Select recorded players or create reusable manual player identities. Existing replay names are canonical; new entries never overwrite old match facts.
- Round entry supports individual player operators, kills, deaths, assists and headshots. Match totals are calculated from the entered rounds.
- Final-scoreboard mode accepts both teams’ final score and all ten players’ totals. It contributes to Combined match/player/map/insight statistics without inventing operators, sites or round order. Unknown measurements stay unknown.
- Map selector and map-dependent bombsite dropdown with a custom fallback. Presets are drawn from [R6 Prep’s in-game site references](https://www.r6prep.com/defender/site-setups); imported replay site labels are also offered. Historical map versions may differ.
- K/D ascending/descending arrows for Match Center history and player scoreboards. Unknown ratios stay last; zero-death ratios sort as infinity.
- Version and expandable patch notes at the bottom of the sidebar.

Existing single-player entries remain readable. Submitted match statistics are shared with signed-in users; drafts, notes and account details remain private. Manual data remains self-reported and unverified. Duplicate manual and replay records can still count twice.

Validation: 77 isolated SQL integration checks, existing analytics regression suite, and new ten-player/scoreboard/KD tests. Local UI preview uses synthetic in-memory data and is excluded from release packages.

## V1.1.1 — Shared map linking and full-team matches

- Canonical map identities combine manual names and known collector aliases/IDs for overall analytics. Original replay IDs, names, versions, sites and gameplay facts are retained.
- Map Intelligence includes an owner-only map/bombsite linking panel. Links are shared across authenticated accounts, apply to past and future imports, and can be removed. Unknown and site-inferred IDs remain separate until linked; no fuzzy room-name guessing.
- Safe site spelling/floor variants resolve to shared presets. Explicit site aliases are scoped to their map. Custom linked site targets are available in manual entry.
- The server enforces the existing legacy owner's identity through its resolved workspace, validates links and uses optimistic revisions/SQL transactions to prevent lost edits. Gameplay tables are never updated by linking.
- Team perspectives now include only matches where all selected teammates appeared on the same side. Personal perspectives remain unchanged. Round metrics within eligible matches still count observed participation.
- Linking map/site identities does not deduplicate a manually entered match against a later replay of that same game.
- Validation: 80 frontend checks and 83 isolated SQL integration checks; synthetic browser verification of mapping controls.

## V1.1.2 — Collector beta download

- My Workspace and Collector Setup offer the Windows x64 v0.3.1 beta installer with setup steps, release notes and SHA-256 metadata.
- Packaging checks the installer hash and size before copying only the executable into wwwroot/downloads. Build intermediates, private sessions, local queues and developer settings are not distributed.
- Installer and collector messaging now describe hosted synchronization accurately. Website footer and sidebar use one version constant.
- Verified 38 collector tests, packaged runtime self-test, hosted Auth0 login, an existing real replay acknowledgement, lost-response duplicate retry and restart receipt retention. The existing replay's original gameplay stats were preserved.
- Unsigned beta: fresh-match insertion on the hosted service and second-PC installation remain unverified. New-match transactions are covered by isolated API integration checks.

## V1.1.3 — account permissions
- A single deployment-configured Owner can grant/revoke Admin access in My account. New accounts default to Player; Admins cannot assign roles or access private workspaces.
- Owner and Admin can correct shared map/bombsite links. Permission changes and catalog revisions are audited; prior recorded link revisions can be restored without changing gameplay records.
- My account displays the sign-in identity and account ID for unambiguous access requests.
- Owner is configured by Security__OwnerAccountKey (the exact authenticated workspace/account hash), not by email, player name, or legacy dbo schema. There is no public bootstrap or ownership-transfer endpoint.
- Validation: 98 isolated SQL checks, 80 frontend analytics tests, TypeScript/build checks. Original LocalDB instance failed to start; tests ran on a separate BREACH_Permissions_Test instance.

## V1.1.4 — secret arcade
- Invisible 64px entrance at the bottom-right of My account opens PEG / BREAK, an original peg-bouncing game. No sidebar entry or visible entrance button.
- Mouse, touch and keyboard aiming; ten balls, orange objectives, blue scoring pegs, moving free-ball bucket, replay/next board, pause and local best score. No API calls or match-stat writes.
- Fixed-step physics, bounded shot duration, background-tab pause and animation cleanup. Four physics tests cover shot resolution, scoring, catch, win/loss and next boards.

## V0.1.5 — passive collector and account polish
The website version resets from V1.1.4 to V0.1.5 at the user's request. Future published updates advance the patch number by two (V0.1.7, V0.1.9, V0.1.11).
- Collector v0.3.3 adds automatic watching of the saved replay folder, optional Windows sign-in startup, and system-tray Open/Resume/Pause/Quit controls. Closing to tray keeps collection running; explicit Quit preserves sync/watch preferences. Explicit Pause remains paused across restarts.
- Startup never bypasses initial folder selection, account authentication or the one-time Enable Sync action. The PC must be awake; Windows Startup Apps settings can disable startup.
- Sign Out is in My account beside the email. The hidden arcade entrance is aligned with Remove Picture on the far-right inside edge of the profile box.
- Existing role permissions, map linking and all stored match data are unchanged.

## V0.1.7 — collector instructions
- Updated download notes, Collector Setup and My Workspace to explain that uploads run in the system tray with Sync enabled and the PC awake. Closing the window requires background mode enabled; Pause or Quit stops uploads. Collector binary remains v0.3.3.

## V0.1.9 — automatic map identification
- Unresolved collector IDs use unique recorded bombsite-pair evidence across the shared replay dataset. Conflicting or ambiguous evidence stays unresolved. Known maps and explicit admin links take priority; raw stats stay unchanged. Identified maps group with manual and known replay maps.
- Admin map linking defaults to unresolved IDs, with Show all for review/override. Owner/Admin editing permissions unchanged.

## V0.1.11 — collector folder detection
- Collector v0.3.5 discovers registered Steam installations, custom libraries and manifest install folders plus registered Ubisoft/game locations. Multiple matches offer a chooser; Browse and saved folders remain available.
- Clarified that only completed Ranked Bomb matches upload. Other modes are held locally, not combined into Ranked collector stats.

## V0.1.13 — separated playlist statistics
- Collector v0.3.7 supports completed Unranked/Standard Bomb and Casual/Quick Match replays in supported recorded formats. Server validates playlist/score rules; missing format metadata is not guessed for new modes. Existing Ranked uploads remain compatible.
- Shared Ranked (default), Unranked/Standard, Casual/Quick Match and Other/Unknown filters apply before analytics, histories and exports. Manual entries support matching Bomb formats.
- Unsupported-mode holds retry once after collector upgrade. Parser crashes remain local with clearer diagnostics; affected original replays are needed to diagnose these separately.

## V0.1.15 — Shared statistics filter bar

- Moved 7D / 30D / ALL into the Playlist and Replay / Manual / Combined bar across Overview, Match Center, Players, Maps, Operators, Compare and Insights.
- Date selection and filtering behavior are unchanged; controls wrap on narrow screens.

## V0.1.17 — Squad reload in the filter bar

- Moved Reload squads beside playlist, source and date controls on squad-tracking statistics pages. Player Comparison has no squad reload control.
- Preserved loading/saving disabled states, roster status, errors and import controls. Settings retains its existing reload control.

## V0.1.19 — Advanced statistics settings

- Moved playlist, source, date and squad reload controls into a popout opened by a green Advanced settings button beside the player/squad selector.
- Player Comparison retains its existing filter bar. Popout closes on outside click, Escape or its close button; selections remain in existing page state.

## V0.1.21 — Operator headshot percentages

- Added HS% beside K/D in Operator Intel and the individual operator summaries in Player Comparison.
- Uses existing filtered operator totals, preserving unavailable values (—) when headshots or kills are incomplete or there are no kills.
