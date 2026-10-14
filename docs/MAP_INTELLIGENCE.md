# Recorded map intelligence

Real mode supports `/maps` and `/maps/:key`. It uses `/api/overview/v3`, extended additively with `site` on round rows. Restart the backend after pulling this change. The view follows the same database squads, player selection and 7D/30D/ALL range as Overview and Match Center.

Map cards include all perspective-resolved matches, including incomplete/unverified results. Match win rate divides verified wins by verified wins plus losses. Unknown results are excluded from that rate. A tracked round requires a selected participant, and multiple selected squad members never multiply the same round. Site and side rates exclude unknown outcomes. Ambiguous team membership is excluded and counted visibly. A detail URL without data for the current selection displays an empty state, never another map's statistics.

The detail view shows recorded objective labels, side filters, sample sizes and match history. It does not invent floor plans, map coordinates or room positions. Different numeric map IDs stay separate so replay versions cannot silently combine.

## Map display names and provenance

`src/data/mapCatalog.ts` makes known parser tokens readable, for example `ClubHouseY10` becomes `Club House`. When the name is absent, known IDs are resolved using the constants in the parser's [header.go](https://github.com/redraskal/r6-dissect/blob/main/dissect/header.go). Unknown IDs stay explicit. Raw imported records remain unchanged.

Two IDs in the current local dataset are not in the checked upstream parser tables. Their labels are **inferences from local replay objective names**, not verified parser-ID mappings:

| Replay map ID | Inferred name | Recorded objective evidence |
| --- | --- | --- |
| 409325881472 | Villa | 2F Aviator Room / Games Room; 2F Trophy Room / Statuary Room |
| 436375283234 | Coastline | 2F Hookah Lounge / Billiards Room; 2F Penthouse / Theater |

All shared match labels append `(site-inferred)` for these IDs. Map cards and detail pages explicitly show the inference status and evidence. If a later parser resolves the ID, its replay name takes precedence. Before treating these aliases as verified, confirm the identity against the replay/game or a parser mapping update.

Verification: `npm run test:maps`, the existing analytics/match/player suites, frontend production build, backend compilation, and a local browser check with imported records.
