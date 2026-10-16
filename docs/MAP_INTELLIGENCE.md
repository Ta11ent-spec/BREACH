# Recorded map intelligence

Real mode supports `/maps` and `/maps/:key`. It uses `/api/overview/v3`, extended additively with `site` on round rows. Restart the backend after pulling this change. The view follows the same database squads, player selection and 7D/30D/ALL range as Overview and Match Center.

Map cards include all perspective-resolved matches, including incomplete/unverified results. Match win rate divides verified wins by verified wins plus losses. Unknown results are excluded from that rate. A tracked round requires a selected participant, and multiple selected squad members never multiply the same round. Site and side rates exclude unknown outcomes. Ambiguous team membership is excluded and counted visibly. A detail URL without data for the current selection displays an empty state, never another map's statistics.

The detail view shows recorded objective labels, side filters, sample sizes and match history. It does not invent floor plans, map coordinates or room positions. Known, explicitly linked and uniquely site-identified map IDs share canonical map groups; raw replay versions and IDs remain stored unchanged.

## Map display names and provenance

`src/data/mapCatalog.ts` makes known parser tokens readable, for example `ClubHouseY10` becomes `Club House`. When the name is absent, known IDs are resolved using the constants in the parser's [header.go](https://github.com/redraskal/r6-dissect/blob/main/dissect/header.go). Unknown IDs stay explicit. Raw imported records remain unchanged.

Unknown collector IDs are automatically identified using recorded bombsite pairs from the unfiltered shared replay overview. Matching normalizes case, punctuation, comma/slash separators, room order and omitted repeated floors. It does not guess room synonyms or use fuzzy matching. Explicitly approved bombsite aliases also count as evidence.

At least one recognized pair must match, and the intersection of every recognized pair's candidate maps must contain exactly one map. Conflicting or ambiguous evidence stays unresolved; missing/unrecognized labels supply no evidence. All matches sharing that collector ID are considered, before player/team/date filters. The map uses the canonical grouping key so manual and replay stats combine without rewriting or deleting records. This does not deduplicate matches.

Manual map links take priority, followed by catalog IDs and recognized replay names, then automatic evidence. Evidence is recomputed on catalog refresh, not permanently saved as a verified ID. Admin controls default to unresolved IDs; Show all allows review and overrides. Owner and Admin can edit links; only the sole Owner can assign roles.

Verification: `npm run test:maps`, the existing analytics/match/player suites, frontend production build, backend compilation, and a local browser check with imported records.
