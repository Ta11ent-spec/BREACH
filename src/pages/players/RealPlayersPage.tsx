import {usePlaylist} from '../../data/usePlaylist';
import { useEffect, useMemo, useState } from 'react';
import {ManualDataToggle,useManualInclusion} from '../../components/ManualDataToggle';
import {loadOverview} from '../../data/manualOverview';
import { Btn, Empty, Icon, Monogram, OperatorIcon, Pill, SectionTitle, StatCard } from '../../components';
import { TrackingScope } from '../../components/TrackingScope';
import { fetchApi, formatPlayedAt, mapLabel } from '../../data/realApi';
import type { OverviewV3 } from '../../data/overviewAnalytics';
import { asPercent } from '../../data/overviewAnalytics';
import { useTrackingScope } from '../../data/useTrackingScope';
import { analyzePlayers, sortPlayers } from '../../data/playerAnalytics';
import type { PlayerPeriod, PlayerProfile, PlayerSort } from '../../data/playerAnalytics';

const emptyPlayers: OverviewV3['players'] = [];
const emptyMatches: OverviewV3['matches'] = [];
const value = (n: number | string | null | undefined) => n == null ? '—' : typeof n === 'number' ? n.toLocaleString() : n;
const percent = (n: number | null) => n == null ? '—' : `${n}%`;
const avatar = (name: string) => ({ initials: name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?', color: '#fa9062' });
const playerUrl = (id: string) => '/players/' + encodeURIComponent(id);

function PlayerTable({ players, open }: { players: PlayerProfile[]; open: (id: string) => void }) {
  return <div className="real-player-table"><table className="score-table"><thead><tr><th>PLAYER</th><th>MATCHES</th><th>ROUNDS</th><th>K</th><th>D</th><th>A</th><th>K/D</th><th>HS%</th></tr></thead>
    <tbody>{players.map(p => <tr key={p.playerId}><td><button className="player-table-name" onClick={() => open(p.playerId)}><Monogram player={avatar(p.username)}/><span><strong>{p.username}</strong><small>{p.playerId.slice(0, 8)}</small></span></button></td>
      <td>{p.matchCount}</td><td>{p.rounds}</td><td>{value(p.kills)}</td><td>{value(p.deaths)}</td><td>{value(p.assists)}</td><td>{value(p.kd)}</td><td>{percent(p.hs)}</td></tr>)}</tbody></table></div>;
}

export function RealPlayersPage({ app, id }: { app: any; id?: string }) {
  try{id=id?decodeURIComponent(id):undefined;}catch{/* invalid IDs use the not-found view */}
  const [playlist]=usePlaylist();
  const [includeManual,setIncludeManual]=useManualInclusion();
  const [data, setData] = useState<OverviewV3 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<PlayerSort>('rounds');
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<'overview' | 'history' | 'operators'>('overview');
  const [historyPage, setHistoryPage] = useState(0);
  const period: PlayerPeriod = app.state.period ?? 'ALL';
  const scope = useTrackingScope(data?.players ?? emptyPlayers, data?.matches ?? emptyMatches);
  const sourceToggle=<TrackingScope hideReload scope={scope} players={data?.players??emptyPlayers} advancedSettings={<ManualDataToggle squadScope={scope} included={includeManual} onChange={setIncludeManual} period={period} onPeriodChange={period=>app.setState({period})}/>}/>;
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(null);
    loadOverview(includeManual, controller.signal,playlist).then(next => {
      if (!controller.signal.aborted) setData(next);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load imported players.'); });
    return () => controller.abort();
  }, [revision,includeManual,playlist]);
  useEffect(() => { setPage(0); }, [search, sort, period, scope.mode, scope.selectedSquad, data]);
  useEffect(() => { setTab('overview'); setHistoryPage(0); }, [id]);
  useEffect(() => { setHistoryPage(0); }, [period]);
  const profiles = useMemo(() => data ? analyzePlayers(data, period) : [], [data, period]);
  const members = new Set(scope.activeSquad?.members ?? []);
  const filtered = sortPlayers(profiles.filter(p => (scope.mode !== 'team' || members.has(p.playerId)) &&
    `${p.username} ${p.playerId}`.toLowerCase().includes(search.trim().toLowerCase())), sort);
  const pages = Math.ceil(filtered.length / 12);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const visible = filtered.slice(currentPage * 12, currentPage * 12 + 12);
  const profile = profiles.find(p => p.playerId === id);
  const followMatch = (matchId?: string) => {
    if (!profile) return;
    scope.onMode('player'); scope.onSelectedPlayer(profile.playerId);
    app.go(matchId ? '/matches/' + encodeURIComponent(matchId) : '/matches');
  };
  if (error || !data) return <div className="page real-players">{sourceToggle}{app.headline('PLAYER INTELLIGENCE / IMPORTED REPLAYS', 'Player directory.', 'Individual performance from your recorded matches.')}
    <section className="panel real-notice" role="status"><h3>{error ? 'Player data unavailable' : 'Loading player intelligence'}</h3><p>{error ?? 'Reading your imported replay records…'}</p>{error && <Btn icon="activity" onClick={() => setRevision(v => v + 1)}>RETRY</Btn>}</section></div>;
  if (id && !profile) return <div className="page real-players">{sourceToggle}<button className="back-link" onClick={() => app.go('/players')}><Icon name="arrowleft" size={15}/> ALL PLAYERS</button><section className="panel"><Empty title="Player not found" sub="This player ID is not in your imported replay catalog."/></section></div>;
  if (profile) {
    const historyPages = Math.ceil(profile.history.length / 15);
    const currentHistoryPage = Math.min(historyPage, Math.max(0, historyPages - 1));
    const latest = profile.history.slice(0, 10).reverse();
    const peak = Math.max(1, ...latest.map(h => h.stats.kills ?? 0));
    return <div className="page real-players">{sourceToggle}<div className="player-back-row"><button className="back-link" onClick={() => app.go('/players')}><Icon name="arrowleft" size={15}/> ALL PLAYERS</button></div>
      <div className="profile-hero"><div className="profile-id"><Monogram player={avatar(profile.username)} size="xl"/><div><div className="eyebrow">IMPORTED REPLAY / PLAYER DOSSIER</div><h1>{profile.username}<span className="period">.</span></h1><p className="player-full-id">{profile.playerId}</p><Pill tone="success" dot>RECORDED PLAYER</Pill></div></div>
        <div className="profile-mini"><div><span>MOST PLAYED OPERATOR</span><strong>{profile.operators[0]?.name ?? '—'}</strong></div><div><span>MATCHES</span><strong>{profile.matchCount}</strong></div><div><span>ROUNDS</span><strong>{profile.rounds}</strong></div></div></div>
      <div className="player-profile-actions"><span>{period === 'ALL' ? 'All imported matches' : `Last ${period === '7D' ? '7' : '30'} days`} · Individual statistics · {profile.unverified} unknown results</span><Btn icon="arrow" onClick={() => followMatch()}>VIEW PLAYER MATCHES</Btn></div>
      <div className="stats-grid"><StatCard label="K/D RATIO" value={value(profile.kd)} icon="crosshair" delta={`${value(profile.kills)} KILLS`} sub={`${value(profile.deaths)} deaths`}/><StatCard label="MATCH WIN RATE" value={percent(profile.winRate)} icon="target" delta={`${profile.wins} W / ${profile.losses} L`} sub="completed match results"/><StatCard label="HEADSHOT RATE" value={percent(profile.hs)} icon="bolt" delta={`${value(profile.headshots)} HEADSHOTS`} sub="of recorded eliminations"/><StatCard label="ROUND SURVIVAL" value={percent(profile.survival)} icon="shield" delta={`${profile.rounds} ROUNDS`} sub="with recorded participation"/></div>
      <div className="tabbar" role="tablist" aria-label="Player profile sections">{(['overview', 'history', 'operators'] as const).map(t => <button role="tab" aria-selected={tab === t} key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t === 'overview' ? 'PERFORMANCE' : t === 'history' ? 'MATCH HISTORY' : 'OPERATOR POOL'}</button>)}</div>
      {profile.rounds === 0 && <section className="panel"><Empty title="No rounds in this date range" sub="Choose ALL to see this player's imported history."/></section>}
      {tab === 'overview' && profile.rounds > 0 && <div className="two-grid"><section className="panel"><SectionTitle eyebrow="01 / PERSONAL TELEMETRY" title="Elimination trend" right={<Pill tone="quiet">LATEST {latest.length} MATCHES</Pill>}/><div className="chart-header"><div><strong>{value(profile.kills)}</strong><span>KILLS IN SELECTED RANGE</span></div></div>
        <div className="performance-bars real-player-trend">{latest.map(({ match, stats }) => <button key={match.matchId} onClick={() => followMatch(match.matchId)} aria-label={`${mapLabel(match.mapName, match.mapId)}, ${formatPlayedAt(match.playedAt)}, ${value(stats.kills)} kills`} title={`${mapLabel(match.mapName, match.mapId)} · ${value(stats.kills)} kills`}><strong>{value(stats.kills)}</strong><div className="performance-bar" style={{ height: stats.kills == null ? '0%' : `${stats.kills / peak * 75}%`, background: match.outcome === 'WIN' ? 'var(--accent)' : match.outcome === 'LOSS' ? '#a85c63' : '#607783' }}/><span>{match.playedAt ? new Date(match.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'UNDATED'}</span></button>)}</div><div className="muted-note">Actual kills per match, oldest to newest. Select a bar to open the report.</div></section>
        <section className="panel"><SectionTitle eyebrow="02 / PLAYER BREAKDOWN" title="Contribution profile"/><div className="contrib-list">{[['Eliminations', value(profile.kills)], ['Assists', value(profile.assists)], ['Headshots', value(profile.headshots)], ['Attack round win rate', percent(asPercent(profile.attackWins, profile.attackRounds))], ['Defense round win rate', percent(asPercent(profile.defenseWins, profile.defenseRounds))]].map(([label, n]) => <div className="contrib-row" key={label}><span>{label}</span><strong>{n}</strong></div>)}</div><div className="small-callout"><Icon name="info" size={16}/> Statistics follow this player's participation. Outcomes require a verified team side.</div></section></div>}
      {tab === 'history' && <section className="panel"><SectionTitle eyebrow="01 / RECENT ENGAGEMENTS" title="Individual match results" right={<Pill tone="quiet">{profile.matchCount} MATCHES</Pill>}/>{profile.history.length ? <><div className="profile-matches">{profile.history.slice(currentHistoryPage * 15, currentHistoryPage * 15 + 15).map(({ match, stats }) => <button key={match.matchId} onClick={() => followMatch(match.matchId)}><span className={`result ${match.outcome === 'WIN' ? 'win' : match.outcome === 'LOSS' ? 'loss' : 'unknown'}`}>{match.outcome === 'UNKNOWN' ? 'UNVERIFIED' : match.outcome}</span><div><strong>{mapLabel(match.mapName, match.mapId)}</strong><small>{match.matchId.startsWith('manual:')?'MANUAL / UNVERIFIED · ':''}{match.matchType ?? 'Unknown mode'} · {formatPlayedAt(match.playedAt)} · {stats.rounds} played rounds</small></div><span>{value(stats.kills)} K / {value(stats.deaths)} D / {value(stats.assists)} A</span><Icon name="chevron" size={16}/></button>)}</div><Pagination page={currentHistoryPage} pages={historyPages} total={profile.matchCount} setPage={setHistoryPage}/></> : <Empty title="No matches in this range" sub="Choose a wider date range."/>}</section>}
      {tab === 'operators' && <section className="panel"><SectionTitle eyebrow="01 / RECORDED LOADOUT" title="Operator pool" right={<Pill tone="quiet">{profile.operators.length} OPERATORS</Pill>}/>{profile.operators.length ? <div className="real-player-table"><table className="score-table"><thead><tr><th>OPERATOR</th><th>ROUNDS</th><th>USAGE</th><th>K</th><th>D</th><th>A</th><th>K/D</th><th>HS%</th></tr></thead><tbody>{profile.operators.map(o => <tr key={o.name}><td><div className="player-operator-name"><OperatorIcon name={o.name}/><strong>{o.name}</strong></div></td><td>{o.rounds}</td><td>{percent(asPercent(o.rounds, profile.rounds))}</td><td>{value(o.kills)}</td><td>{value(o.deaths)}</td><td>{value(o.assists)}</td><td>{value(o.kd)}</td><td>{percent(o.hs)}</td></tr>)}</tbody></table></div> : <Empty title="No recorded operator usage" sub="Choose a wider date range."/>}</section>}
      <p className="player-data-note">— indicates missing data or an undefined rate. Rank, KOST, player roles and total damage are unavailable as verified profile metrics.{profile.unknownSideMatches > 0 && ` ${profile.unknownSideMatches} matches have an unresolved team side; their individual stats remain included and their results are unverified.`}</p>
    </div>;
  }
  return <div className="page real-players">{sourceToggle}{app.headline('PLAYER INTELLIGENCE / IMPORTED REPLAYS', 'Player directory.', 'Track every player, operator, and contribution across your recorded matches.', <Pill tone="outline">{data.players.length} KNOWN PLAYERS</Pill>)}
    <div className="player-directory-toolbar"><div className="filter-search"><Icon name="search" size={15}/><input aria-label="Search imported players" placeholder="Username or player ID" value={search} onChange={e => setSearch(e.target.value)}/></div><select aria-label="Sort players" value={sort} onChange={e => setSort(e.target.value as PlayerSort)}><option value="rounds">MOST ROUNDS</option><option value="kills">MOST KILLS</option><option value="kd">HIGHEST K/D</option><option value="name">NAME A–Z</option></select></div>
    <div className="player-directory-caption"><span>{scope.mode === 'team' ? scope.activeSquad?.name ?? 'Select or create a squad' : 'All imported players'} · {filtered.length} matching players</span>{scope.mode === 'player' && <Btn small disabled={!scope.selectedPlayer} onClick={() => app.go(playerUrl(scope.selectedPlayer))}>OPEN SELECTED PROFILE</Btn>}<span>{period === 'ALL' ? 'ALL RECORDED DATES' : `LAST ${period === '7D' ? '7' : '30'} DAYS`}</span></div>
    {visible.length ? <><div className="roster-grid">{visible.map((p, i) => <button className={`player-card ${p.playerId === scope.selectedPlayer ? 'selected-player-card' : ''}`} key={p.playerId} onClick={() => app.go(playerUrl(p.playerId))}><div className="player-card-top"><span>{String(currentPage * 12 + i + 1).padStart(2, '0')} / {members.has(p.playerId) ? 'SQUAD MEMBER' : p.playerId.startsWith('manual-player:')?'MANUAL PROFILE':'RECORDED PLAYER'}</span><Icon name="arrow" size={17}/></div><div className="player-card-person"><Monogram player={avatar(p.username)} size="lg"/><div><small>{p.matchCount} MATCHES · {p.rounds} ROUNDS</small><h2>{p.username}</h2><span>{p.playerId.slice(0, 8)}</span></div></div><div className="player-card-specialty">{p.operators[0] ? `Most played · ${p.operators[0].name}` : 'No rounds in this range'}</div><div className="player-card-metrics"><div><small>K/D</small><strong>{value(p.kd)}</strong></div><div><small>MATCH W/R</small><strong>{percent(p.winRate)}</strong></div><div><small>HS%</small><strong>{percent(p.hs)}</strong></div></div><div className="player-card-bottom">VIEW PLAYER DOSSIER <Icon name="chevron" size={15}/></div></button>)}</div><Pagination page={currentPage} pages={pages} total={filtered.length} setPage={setPage}/><section className="panel"><SectionTitle eyebrow="01 / PLAYER RANKING" title="Performance leaderboard" right={<Pill tone="quiet">CURRENT PAGE · {visible.length} PLAYERS</Pill>}/><PlayerTable players={visible} open={id => app.go(playerUrl(id))}/></section></>
      : <section className="panel"><Empty title={scope.mode === 'team' && !scope.activeSquad ? 'Choose a squad to view its roster' : 'No matching players'} sub="Try another username, player ID, or switch to PLAYER to browse the imported catalog."/></section>}
    <p className="player-data-note">Imported players include teammates and opponents. Team mode shows the selected squad's roster. Each card contains that player's own statistics; win rates exclude incomplete or unresolved match results. — means a value is missing or undefined.</p>
  </div>;
}

function Pagination({ page, pages, total, setPage }: { page: number; pages: number; total: number; setPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return <nav className="player-pagination" aria-label="Results pagination"><Btn small disabled={page === 0} onClick={() => setPage(page - 1)}>PREVIOUS</Btn><span>PAGE {page + 1} / {pages} · {total} RECORDS</span><Btn small disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>NEXT</Btn></nav>;
}
