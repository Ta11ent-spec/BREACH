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
