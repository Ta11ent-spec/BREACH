import { analyzePlayers, playerTotals } from './playerAnalytics';
import type { PlayerPeriod } from './playerAnalytics';
import { analyzeOverview, asPercent } from './overviewAnalytics';
import type { OverviewV3, Perspective } from './overviewAnalytics';
import { analyzeMaps } from './mapAnalytics';
import { analyzeOperators } from './operatorAnalytics';

export function comparePlayers(data: OverviewV3, aId: string, bId: string, period: PlayerPeriod, commonOnly: boolean, now = Date.now()) {
  if (!aId || !bId || aId === bId || !data.players.some(p => p.playerId === aId) || !data.players.some(p => p.playerId === bId)) return null;
  const profiles = analyzePlayers(data, period, now);
  const a = profiles.find(p => p.playerId === aId)!;
  const b = profiles.find(p => p.playerId === bId)!;
  const bMatches = new Set(b.history.map(h => h.match.matchId));
  const shared = new Set(a.history.filter(h => bMatches.has(h.match.matchId)).map(h => h.match.matchId));
  const commonProfiles = commonOnly ? analyzePlayers({ ...data, matches: data.matches.filter(m => shared.has(m.matchId)) }, 'ALL', now) : profiles;
  return { a: commonProfiles.find(p => p.playerId === aId)!, b: commonProfiles.find(p => p.playerId === bId)!, sharedMatches: shared.size, commonOnly, period };
}

/** Higher is better only for rates; volume is descriptive, and null/undefined never wins. */
export function compareRate(a: number | null, b: number | null): 'a' | 'b' | 'equal' | 'unavailable' {
  return a == null || b == null ? 'unavailable' : a === b ? 'equal' : a > b ? 'a' : 'b';
}
export function ratioValue(kd: string | null): number | null {
  return kd === '∞' ? Infinity : kd == null || kd === '—' ? null : Number(kd);
}

export function buildInsights(data: OverviewV3, perspective: Perspective, period: PlayerPeriod, minimumMatches = 3, now = Date.now()) {
  const overview = analyzeOverview(data, perspective, period, now);
  const selected = new Set(perspective.members);
  const matchIds = new Set(overview.matches.map(m => m.matchId));
  const rows = data.appearances.filter(a => selected.has(a.playerId) && matchIds.has(a.matchId));
  const totals = playerTotals(rows);
  const maps = analyzeMaps(data, perspective, period, now).maps;
  const operators = analyzeOperators(data, perspective, period, now).operators;
  const participants = analyzePlayers({ ...data, matches: data.matches.filter(m => matchIds.has(m.matchId)) }, 'ALL', now)
    .filter(p => selected.has(p.playerId) && p.rounds > 0);
  const measured = rows.filter(r => r.kills != null && r.died != null && r.assists != null && r.headshots != null).length;
  const completeCoverage = asPercent(measured, rows.length);
  const eligibleMaps = maps.filter(m => m.matchWins + m.matchLosses >= minimumMatches && m.matchWinRate != null);
  const weakestMap = [...eligibleMaps].sort((a, b) => a.matchWinRate! - b.matchWinRate! || b.matches.length - a.matches.length || a.key.localeCompare(b.key))[0] ?? null;
  const mostUsed = operators.filter(o => o.name !== 'Unknown operator').sort((a, b) => b.picks - a.picks || a.name.localeCompare(b.name))[0] ?? null;
  const recent = overview.decided.slice(0, 5), prior = overview.decided.slice(5, 10);
  const trend = recent.length === 5 && prior.length === 5 ? {
    recentRate: asPercent(recent.filter(m => m.outcome === 'WIN').length, 5)!,
    priorRate: asPercent(prior.filter(m => m.outcome === 'WIN').length, 5)!,
    delta: 20 * (recent.filter(m => m.outcome === 'WIN').length - prior.filter(m => m.outcome === 'WIN').length),
    recentIds: recent.map(m => m.matchId), priorIds: prior.map(m => m.matchId),
  } : null;
  return { perspective, period, minimumMatches, overview, totals, maps, operators, participants,
    coverage: { completeCoverage, measured, samples: rows.length }, weakestMap, mostUsed, trend,
    unknownMatches: overview.matches.length - overview.decided.length,
    roundCount: maps.reduce((sum, m) => sum + m.rounds, 0),
    unknownRounds: maps.reduce((sum, m) => sum + m.unknown, 0) };
}
export type InsightReport = ReturnType<typeof buildInsights>;

export function insightsCsv(report: InsightReport): string {
  const cell = (raw: unknown) => {
    const value = raw == null ? '' : String(raw);
    const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const rows: unknown[][] = [['Section', 'ID', 'Label', 'Metric', 'Value', 'Sample size']];
  const add = (section: string, id: string, label: string, metric: string, value: unknown, samples: number) => rows.push([section, id, label, metric, value, samples]);
  add('Scope', report.perspective.members.join('|'), report.perspective.mode, 'Date range', report.period, report.overview.matches.length);
  add('Summary', '', 'Selected players', 'Kills', report.totals.kills, report.coverage.samples);
  add('Summary', '', 'Selected players', 'Deaths', report.totals.deaths, report.coverage.samples);
  add('Summary', '', 'Selected players', 'K/D', report.totals.kd, report.coverage.samples);
  add('Summary', '', 'Selected side', 'Match win rate %', asPercent(report.overview.wins, report.overview.decided.length), report.overview.decided.length);
  add('Coverage', '', 'Kill/death/assist/headshot completeness', 'Complete rows %', report.coverage.completeCoverage, report.coverage.samples);
  for (const m of report.maps) add('Maps', m.key, m.label, 'Verified match win rate %', m.matchWinRate, m.matchWins + m.matchLosses);
  for (const p of report.participants) {
    add('Players', p.playerId, p.username, 'Kills', p.kills, p.rounds);
    add('Players', p.playerId, p.username, 'K/D', p.kd, p.rounds);
  }
  for (const o of report.operators) {
    add('Operators', o.key, o.name, 'Pick share %', o.pickShare, o.picks);
    add('Operators', o.key, o.name, 'Round win rate %', o.winRate, o.wins + o.losses);
  }
  return rows.map(row => row.map(cell).join(',')).join('\r\n');
}
