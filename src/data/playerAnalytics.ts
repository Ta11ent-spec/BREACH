import {impactTotals} from './impact';
import { analyzeOverview, asPercent } from './overviewAnalytics';
import type { OverviewV3, V3Appearance, V3Player, ResolvedMatch } from './overviewAnalytics';

export type PlayerPeriod = '7D' | '30D' | 'ALL';
export type PlayerTotals = {
  impact:ReturnType<typeof impactTotals>;
  rounds: number; kills: number | null; deaths: number | null; assists: number | null;
  headshots: number | null; kd: string | null; hs: number | null; survival: number | null;
};
export type PlayerHistory = { match: ResolvedMatch; stats: PlayerTotals };
export type PlayerProfile = V3Player & PlayerTotals & {
  matchCount: number; wins: number; losses: number; unverified: number; winRate: number | null;
  history: PlayerHistory[]; operators: (PlayerTotals & { name: string })[];
  attackRounds: number; attackWins: number; defenseRounds: number; defenseWins: number;
  unknownSideMatches: number;
};

/** A partial sum is not a measured total. Preserve missing data throughout the profile. */
export function playerTotals(rows: V3Appearance[]): PlayerTotals {
  const sum = (field: 'kills' | 'assists' | 'headshots') => rows.length && rows.every(r => r[field] != null)
    ? rows.reduce((value, r) => value + r[field]!, 0) : null;
  const kills = sum('kills'), assists = sum('assists'), headshots = sum('headshots');
  const deaths = rows.length && rows.every(r => r.deaths != null || r.died != null) ? rows.reduce((n,r)=>n+(r.deaths??Number(r.died)),0) : null;
  const rounds=rows.reduce((n,r)=>n+(r.roundsRepresented??1),0);
  return { rounds, kills, deaths, assists, headshots, impact:impactTotals(rows),
    kd: kills == null || deaths == null ? null : deaths ? (kills / deaths).toFixed(2) : kills ? '∞' : '—',
    hs: kills != null && headshots != null && headshots <= kills ? asPercent(headshots, kills) : null,
    survival: deaths == null ? null : asPercent(rounds - deaths, rounds) };
}

export function analyzePlayers(data: OverviewV3, period: PlayerPeriod, now = Date.now()): PlayerProfile[] {
  const matches = data.matches.filter(m => {
    if (period === 'ALL') return true;
    const at = Date.parse(m.playedAt ?? '');
    return Number.isFinite(at) && at <= now && at >= now - (period === '7D' ? 7 : 30) * 86400000;
  });
  const matchIds = new Set(matches.map(m => m.matchId));
  const byPlayer = new Map<string, V3Appearance[]>();
  for (const row of data.appearances) {
    if (!matchIds.has(row.matchId)) continue;
    const bucket = byPlayer.get(row.playerId) ?? [];
    bucket.push(row); byPlayer.set(row.playerId, bucket);
  }
  return data.players.map(player => {
    const rows = byPlayer.get(player.playerId) ?? [];
    // Resolve outcomes using the participant's actual side, including either replay team index.
    const scoped = { ...data, matches, appearances: rows };
    const results = analyzeOverview(scoped, { mode: 'player', members: [player.playerId] }, 'ALL', now);
    const perMatch = new Map<string, V3Appearance[]>();
    const perOperator = new Map<string, V3Appearance[]>();
    for (const row of rows) {
      const matchRows = perMatch.get(row.matchId) ?? [];
      matchRows.push(row); perMatch.set(row.matchId, matchRows);
      if(row.roundsRepresented!=null)continue;
      const name = row.operatorName || 'Unknown operator';
      const operatorRows = perOperator.get(name) ?? [];
      operatorRows.push(row); perOperator.set(name, operatorRows);
    }
    const resolvedIds = new Set(results.matches.map(m => m.matchId));
    // Keep ambiguous-side replays in history and personal totals, but never invent their result.
    const unresolved: ResolvedMatch[] = matches.filter(m => perMatch.has(m.matchId) && !resolvedIds.has(m.matchId))
      .map(m => ({ ...m, slot: -1, present: 1, wins: 0, losses: 0, outcome: 'UNKNOWN', scopedRounds: [] }));
    const history = [...results.matches, ...unresolved].sort((a, b) =>
      (Date.parse(b.playedAt ?? '') || 0) - (Date.parse(a.playedAt ?? '') || 0) || a.matchId.localeCompare(b.matchId))
      .map(match => ({ match, stats: playerTotals(perMatch.get(match.matchId) ?? []) }));
    return { ...player, ...playerTotals(rows), matchCount: perMatch.size,
      wins: results.wins, losses: results.losses, unverified: history.length - results.decided.length,
      winRate: asPercent(results.wins, results.decided.length), history,
      operators: [...perOperator].map(([name, values]) => ({ name, ...playerTotals(values) }))
        .sort((a, b) => b.rounds - a.rounds || a.name.localeCompare(b.name)),
      attackRounds: results.attackRounds, attackWins: results.attackWins,
      defenseRounds: results.defenseRounds, defenseWins: results.defenseWins,
      unknownSideMatches: unresolved.length };
  });
}

export type PlayerSort = 'rounds' | 'kills' | 'kd' | 'name';
export function sortPlayers(players: PlayerProfile[], sort: PlayerSort) {
  const numeric = (value: PlayerProfile) => sort === 'rounds' ? value.rounds : sort === 'kills' ? value.kills
    : value.kd === '∞' ? Infinity : value.kd == null || value.kd === '—' ? null : Number(value.kd);
  return [...players].sort((a, b) => {
    if (sort !== 'name') {
      const left = numeric(a), right = numeric(b);
      if (left == null && right != null) return 1;
      if (right == null && left != null) return -1;
      if (left != null && right != null && left !== right) return left > right ? -1 : 1;
    }
    return a.username.localeCompare(b.username) || a.playerId.localeCompare(b.playerId);
  });
}
