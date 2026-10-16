import { analyzeOverview, asPercent } from './overviewAnalytics';
import type { OverviewV3, Perspective, V3Appearance, ResolvedMatch } from './overviewAnalytics';
import { playerTotals } from './playerAnalytics';
import type { PlayerTotals } from './playerAnalytics';

export type OperatorSide = 'ATK' | 'DEF' | 'UNKNOWN';
export type OperatorRecord = {
  key: string; name: string; side: OperatorSide; picks: number; pickShare: number | null;
  rounds: number; wins: number; losses: number; unknown: number; winRate: number | null;
  totals: PlayerTotals; matches: ResolvedMatch[];
  players: (PlayerTotals & { playerId: string; username: string })[];
};
const classifySide = (raw: string | null | undefined): OperatorSide => {
  const value = (raw ?? '').toLowerCase();
  return ['attack', 'attacker', 'atk'].includes(value) ? 'ATK'
    : ['defense', 'defence', 'defender', 'def'].includes(value) ? 'DEF' : 'UNKNOWN';
};

/** Pick share is selected player appearances on the same recorded side, not a competitive ban/pick rate. */
export function analyzeOperators(data: OverviewV3, perspective: Perspective, period: '7D' | '30D' | 'ALL', now = Date.now()) {
  const overview = analyzeOverview(data, perspective, period, now);
  const matches = new Map(overview.matches.map(m => [m.matchId, m]));
  const selected = new Set(perspective.members);
  const teamRows = new Map(data.rounds.map(r => [`${r.roundId}|${r.teamSlot}`, r]));
  const names = new Map(data.players.map(p => [p.playerId, p.username]));
  const sideSamples: Record<OperatorSide, number> = { ATK: 0, DEF: 0, UNKNOWN: 0 };
  const groups = new Map<string, { name: string; side: OperatorSide; rows: V3Appearance[] }>();
  for (const row of data.appearances) {
    const match = matches.get(row.matchId);
    if (row.roundsRepresented!=null || !selected.has(row.playerId) || !match || row.teamIndex !== match.slot) continue;
    const side = classifySide(teamRows.get(`${row.roundId}|${match.slot}`)?.side);
    const name = row.operatorName?.trim() || 'Unknown operator';
    const key = `${name}|${side}`;
    const group = groups.get(key) ?? { name, side, rows: [] };
    group.rows.push(row); groups.set(key, group); sideSamples[side]++;
  }
  const operators: OperatorRecord[] = [...groups].map(([key, group]) => {
    const roundIds = new Set(group.rows.map(row => row.roundId));
    const matchIds = new Set(group.rows.map(row => row.matchId));
    const outcomes = [...roundIds].map(id => {
      const appearance = group.rows.find(row => row.roundId === id)!;
      return teamRows.get(`${id}|${matches.get(appearance.matchId)!.slot}`)?.won;
    });
    const wins = outcomes.filter(won => won === true).length;
    const losses = outcomes.filter(won => won === false).length;
    const perPlayer = new Map<string, V3Appearance[]>();
    for (const row of group.rows) { const rows = perPlayer.get(row.playerId) ?? []; rows.push(row); perPlayer.set(row.playerId, rows); }
    return { key, name: group.name, side: group.side, picks: group.rows.length,
      pickShare: asPercent(group.rows.length, sideSamples[group.side]), rounds: roundIds.size,
      wins, losses, unknown: roundIds.size - wins - losses, winRate: asPercent(wins, wins + losses),
      totals: playerTotals(group.rows), matches: overview.matches.filter(m => matchIds.has(m.matchId)),
      players: [...perPlayer].map(([playerId, rows]) => ({ playerId, username: names.get(playerId) ?? playerId, ...playerTotals(rows) }))
        .sort((a, b) => b.rounds - a.rounds || a.username.localeCompare(b.username)) };
  });
  return { operators: sortOperators(operators, 'pick'), sideSamples, ambiguousMatches: overview.ambiguousMatches };
}

export type OperatorSort = 'pick' | 'win' | 'kd' | 'kills' | 'name';
export function sortOperators(operators: OperatorRecord[], sort: OperatorSort) {
  const metric = (o: OperatorRecord): number | null => sort === 'pick' ? o.picks : sort === 'win' ? o.winRate : sort === 'kills' ? o.totals.kills
    : o.totals.kd === '∞' ? Infinity : o.totals.kd == null || o.totals.kd === '—' ? null : Number(o.totals.kd);
  return [...operators].sort((a, b) => {
    if (sort !== 'name') {
      const left = metric(a), right = metric(b);
      if (left == null && right != null) return 1;
      if (right == null && left != null) return -1;
      if (left != null && right != null && left !== right) return left > right ? -1 : 1;
    }
    if (sort !== 'name' && a.picks !== b.picks) return b.picks - a.picks;
    return a.name.localeCompare(b.name) || a.side.localeCompare(b.side);
  });
}
