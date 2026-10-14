# Recorded player directory and profiles

Real mode uses `/api/overview/v3` for player cards, profiles, match history and operator usage. Demo mode keeps the original investor preview.

The directory browses all imported players in PLAYER mode and the selected database squad's members in TEAM mode. Search accepts usernames or internal player IDs. Sort by rounds, kills, K/D or name. Cards and the leaderboard share the search, roster and 7D/30D/ALL date range, with twelve players per page. The selected player's profile is available through OPEN SELECTED PROFILE.

Profiles show individual round statistics, verified match win rate, survival and operator usage. The performance chart displays actual kills in the latest ten matches, oldest to newest. History includes every participating match in the selected range, with fifteen per page. Selecting a history row or chart bar, or VIEW PLAYER MATCHES, saves that player as the shared player perspective before opening Match Center.

Missing round kills, deaths, assists or headshots make the corresponding aggregate unavailable rather than replacing missing values with zero. K/D requires complete kill/death measurements, survival requires complete death measurements, and headshot rate requires complete kills/headshots with a valid numerator. Zero kills with zero deaths has an undefined K/D, while positive kills with zero deaths displays infinity.

Individual totals include the player's participation even if their team side cannot be resolved. Such matches stay in history as UNVERIFIED and cannot contribute to match win rate. Verified match results use the same team-resolution rules as Overview and Match Center. Rank, KOST, assigned team roles and cumulative damage totals are not supplied as profile metrics.

Verification: `npm run test:players` exercises side resolution, date ranges, operator partitioning, missing measurements, ambiguous membership, incomplete imports and sorting. Run `npm run build` to validate the production UI.
