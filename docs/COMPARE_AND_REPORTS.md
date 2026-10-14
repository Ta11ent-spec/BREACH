# Recorded comparison and reporting

Real mode `/compare` and `/insights` share the read-only `/api/overview/v3` source. This stage adds no API or database schema changes. Both pages retain the original demo screens in demo mode.

## Compare Players

Choose two different imported players. Both profiles use the shared 7D/30D/ALL date range. Shared matches only restricts both profiles to the intersection of participating match IDs within that range. Played rounds can still differ, and shared matches can include teammates or opponents. Zero shared matches displays an explicit empty state.

Rates include K/D, verified match win rate, headshots, survival and kills per played round. Missing or undefined rates are not ranked. Equal rates are never highlighted in favor of either player. Total kills, assists and rounds describe sample volume and are not ranked as player quality. Both cards show match/sample counts, recorded operator usage and profile links. Swap exchanges the current pair; JSON export preserves the pair, period, shared-match flag and calculated profile data.

## Insights & Reports

The report follows database squad/player selection and the shared date range. Match, map and operator analysis use the existing perspective resolver. Ambiguous squad matches are excluded consistently from statistics, distributions and exports. Missing measurements remain unavailable rather than becoming zero or partial measured totals.

Measurement coverage is the percentage of selected appearance rows with kills, death, assists and headshots present. It is not confidence in the replay parser or damage coverage. The map review threshold defaults to three verified matches; lower-sample maps remain in the matrix with sample labels. Side-gap comparisons require at least ten known rounds on both sides. Operator usage is descriptive and does not establish causation.

The recent trend compares the latest five verified match results against the previous five, within the selected date range. It requires ten verified matches and reports the difference in percentage points. Unverified matches do not enter either five-match sample. JSON includes the source match IDs for those samples.

JSON export includes generation time, identity, calculation definitions and the full computed report. CSV includes selection, summary, coverage, map, participant and operator records with sample sizes. Missing values are blank; imported strings starting with spreadsheet formula characters are escaped. All exports download locally.

## Validation

`npm run test:reports` covers player isolation, common-match filtering, invalid/self comparisons, unknown and tied rates, missing measurement coverage, sample thresholds, ambiguous squads, verified result trends, CSV escaping and date filtering. The production build and browser checks validate both pages and real downloads. The current imported sample produced 15 matches, 98 participating rounds, 44 selected-player kills and eight map records in the report export.
