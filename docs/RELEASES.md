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
