# Recorded Operator Intel

Real mode `/operators` uses `/api/overview/v3` and shares player/squad preferences, database roster management, and the 7D/30D/ALL range. The original demo page stays in demo mode. This stage adds no database schema or API changes.

The overview highlights the most-used recorded attacker and defender, and the highest measured K/D with a visible sample size. Search, side filters (including unknown side), minimum picks, and sorting apply to the performance table. Expanding a row shows individual totals, selected player contributions and its participating match history. Links open actual player profiles and Match Center using the current shared perspective.

## Calculation definitions

- A pick is one selected player's operator appearance in one imported round.
- Pick share divides that operator's picks by all selected player appearances on the same recorded side. It is player usage share, not a competitive team pick/ban rate. Missing operator names stay in the denominator as Unknown operator.
- Sides come from the selected team's round record. Unknown sides are explicit. The same operator observed on two different sides has separate rows.
- Round win rate divides unique participating rounds won by unique participating rounds with known outcomes. Multiple squad members using the same operator in a round do not multiply the round result. Their individual kills/deaths/assists do sum into that operator's player statistics.
- Incomplete matches can contribute known round outcomes and personal stats. Their match-history result remains UNVERIFIED. Ambiguous squad sides are excluded and counted visibly.
- Missing kills/deaths/assists/headshots keep corresponding totals and derived rates unavailable. Zero kills and deaths is an undefined ratio; positive kills with zero deaths displays infinity. Utility efficiency and assigned player roles are not inferred.

Run `npm run test:operators` for participant isolation, side/share denominators, squad round deduplication, missing data, unknown sides/operators, date ranges, ambiguous membership and sorting. Run `npm run build` for production validation.
