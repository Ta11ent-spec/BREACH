import { analyzeOverview, asPercent } from './overviewAnalytics';
import type { OverviewV3, Perspective, ResolvedMatch, V3Round } from './overviewAnalytics';
import { resolveMap } from './mapCatalog';
import type { MapIdentity } from './mapCatalog';
export type RoundRecord = { rounds: number; wins: number; losses: number; unknown: number; winRate: number | null; attackRounds: number; attackWins: number; defenseRounds: number; defenseWins: number };
export type MapRecord = MapIdentity & RoundRecord & {
  mapId: number | string | null; rawName: string | null; matches: ResolvedMatch[];
  matchWins: number; matchLosses: number; unverifiedMatches: number; matchWinRate: number | null;
  sites: (RoundRecord & { name: string })[];
};
export function summarizeMapRounds(rounds: V3Round[]): RoundRecord {
  const wins = rounds.filter(r => r.won === true).length;
  const losses = rounds.filter(r => r.won === false).length;
  const known = rounds.filter(r => typeof r.won === 'boolean');
  const side = (r: V3Round) => (r.side ?? '').toLowerCase();
  const attack = known.filter(r => ['attack', 'attacker', 'atk'].includes(side(r)));
  const defense = known.filter(r => ['defense', 'defence', 'defender', 'def'].includes(side(r)));
  return { rounds: rounds.length, wins, losses, unknown: rounds.length - wins - losses,
    winRate: asPercent(wins, wins + losses), attackRounds: attack.length, attackWins: attack.filter(r => r.won).length,
    defenseRounds: defense.length, defenseWins: defense.filter(r => r.won).length };
}

/** One participating squad round counts once, irrespective of how many roster members played. */
export function analyzeMaps(data: OverviewV3, perspective: Perspective, period: '7D' | '30D' | 'ALL', now = Date.now()) {
  const analysis = analyzeOverview(data, perspective, period, now);
  const selected = new Set(perspective.members);
  const participation = new Map<string, Set<string>>();
  for (const a of data.appearances) {
    if (!selected.has(a.playerId)) continue;
    const ids = participation.get(a.matchId) ?? new Set<string>();
    ids.add(a.roundId); participation.set(a.matchId, ids);
  }
  const groups = new Map<string, { identity: MapIdentity; matches: ResolvedMatch[]; rounds: V3Round[] }>();
  const roundsByMatch = new Map<string, V3Round[]>();
  for (const r of data.rounds) { const rows = roundsByMatch.get(r.matchId) ?? []; rows.push(r); roundsByMatch.set(r.matchId, rows); }
  for (const match of analysis.matches) {
    const identity = resolveMap(match.mapName, match.mapId);
    const group = groups.get(identity.key) ?? { identity, matches: [], rounds: [] };
    group.matches.push(match);
    group.rounds.push(...(roundsByMatch.get(match.matchId) ?? []).filter(r => r.teamSlot === match.slot && participation.get(match.matchId)?.has(r.roundId)));
    groups.set(identity.key, group);
  }
  const maps: MapRecord[] = [...groups.values()].map(group => {
    const wins = group.matches.filter(m => m.outcome === 'WIN').length;
    const losses = group.matches.filter(m => m.outcome === 'LOSS').length;
    const sites = new Map<string, V3Round[]>();
    for (const r of group.rounds) {
      const name = r.site?.trim() || 'Site not recorded';
      const rounds = sites.get(name) ?? []; rounds.push(r); sites.set(name, rounds);
    }
    return { ...group.identity, ...summarizeMapRounds(group.rounds), mapId: group.matches[0].mapId, rawName: group.matches[0].mapName,
      matches: group.matches, matchWins: wins, matchLosses: losses, unverifiedMatches: group.matches.length - wins - losses,
      matchWinRate: asPercent(wins, wins + losses),
      sites: [...sites].map(([name, rounds]) => ({ name, ...summarizeMapRounds(rounds) })).sort((a, b) => b.rounds - a.rounds || a.name.localeCompare(b.name)) };
  }).sort((a, b) => b.matches.length - a.matches.length || a.name.localeCompare(b.name));
  return { maps, ambiguousMatches: analysis.ambiguousMatches };
}
