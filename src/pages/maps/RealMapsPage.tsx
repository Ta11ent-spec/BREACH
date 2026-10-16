import {usePlaylist} from '../../data/usePlaylist';
import {MapLinking} from './MapLinking';
import {ManualDataToggle,useManualInclusion} from '../../components/ManualDataToggle';
import {loadOverview} from '../../data/manualOverview';
import {sourceLabel} from '../../data/analyticsSources';
import { useEffect, useMemo, useState } from 'react';
import { Btn, Empty, Icon, Pill, Progress, SectionTitle, StatCard } from '../../components';
import { TrackingScope } from '../../components/TrackingScope';
import { useTrackingScope } from '../../data/useTrackingScope';
import { fetchApi, formatPlayedAt } from '../../data/realApi';
import { analyzeMaps } from '../../data/mapAnalytics';
import type { MapRecord, RoundRecord } from '../../data/mapAnalytics';
import type { OverviewV3 } from '../../data/overviewAnalytics';
import { asPercent } from '../../data/overviewAnalytics';

const players: OverviewV3['players'] = [];
const matches: OverviewV3['matches'] = [];
const rate = (n: number | null) => n == null ? '—' : `${n}%`;
const sideRate = (wins: number, rounds: number) => rate(asPercent(wins, rounds));
const colors = ['#d8a38d', '#72c7c0', '#dfbb79', '#85a6e6', '#da9fae'];
function color(name: string) { return colors[[...name].reduce((v, c) => v + c.charCodeAt(0), 0) % colors.length]; }
function source(map: MapRecord) { return map.source === 'inferred' ? 'NAME INFERRED FROM SITES' : map.source === 'unknown' ? 'UNRESOLVED MAP' : 'RECORDED BATTLEGROUND'; }

export function RealMapsPage({ app, id }: { app: any; id?: string }) {
  const [playlist]=usePlaylist();
  const [includeManual,setIncludeManual]=useManualInclusion();
  const [data, setData] = useState<OverviewV3 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('played');
  const [siteSide, setSiteSide] = useState<'ALL' | 'ATK' | 'DEF'>('ALL');
  const [historyLimit, setHistoryLimit] = useState(20);
  const scope = useTrackingScope(data?.players ?? players, data?.matches ?? matches);
  const period: '7D' | '30D' | 'ALL' = app.state.period ?? 'ALL';
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(null);
    loadOverview(includeManual, controller.signal,playlist).then(next => { if (!controller.signal.aborted) setData(next); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to read imported map data.'); });
    return () => controller.abort();
  }, [revision,includeManual,playlist]);
  useEffect(() => { setSiteSide('ALL'); setHistoryLimit(20); }, [id, period, scope.selectedPlayer, scope.selectedSquad, scope.mode]);
  const view = useMemo(() => data ? analyzeMaps(data, { mode: scope.mode, members: scope.chosen }, period) : { maps: [], ambiguousMatches: 0 }, [data, scope.mode, scope.chosen, period]);
  let mapKey: string | undefined;
  try { mapKey = id ? decodeURIComponent(id) : undefined; } catch { mapKey = id; }
  const map = view.maps.find(m => m.key === mapKey || m.matches.some(match=>match.mapId!=null&&String(match.mapId)===mapKey));
  const filtered = view.maps.filter(m => `${m.name} ${m.rawName ?? ''} ${m.key}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'rate'
      ? (b.matchWinRate ?? -1) - (a.matchWinRate ?? -1) || b.matches.length - a.matches.length : b.matches.length - a.matches.length || a.name.localeCompare(b.name));
  const periods = <div className="period-switch" aria-label="Map statistics date range">{(['7D', '30D', 'ALL'] as const).map(p => <button key={p} aria-pressed={period === p} className={period === p ? 'active' : ''} onClick={() => app.setState({ period: p })}>{p}</button>)}</div>;
  if (error || !data) return <div className="page real-maps"><ManualDataToggle included={includeManual} onChange={setIncludeManual}/>{app.headline('BATTLEGROUND ANALYTICS / RECORDED REPLAYS', 'Map intelligence.', 'Map and objective performance from your imported matches.')}<section className="panel real-notice" role="status"><h3>{error ? 'Map data unavailable' : 'Loading map intelligence'}</h3><p>{error ?? 'Reading your imported replay records…'}</p>{error && <Btn onClick={() => setRevision(v => v + 1)}>RETRY</Btn>}</section></div>;
  return <div className="page real-maps"><ManualDataToggle included={includeManual} onChange={setIncludeManual}/>{id ? <div className="map-back-row"><button className="back-link" onClick={() => app.go('/maps')}><Icon name="arrowleft" size={15}/> ALL MAPS</button>{periods}</div>
    : <>{app.headline('BATTLEGROUND ANALYTICS / RECORDED REPLAYS', 'Map intelligence.', 'Find your advantages across maps, attack, defense, and recorded objective sites.')}<div className="real-map-toolbar"><div className="filter-search"><Icon name="search" size={15}/><input aria-label="Search recorded maps" placeholder="Map name or replay ID" value={search} onChange={e => setSearch(e.target.value)}/></div><select aria-label="Sort maps" value={sort} onChange={e => setSort(e.target.value)}><option value="played">MOST PLAYED</option><option value="rate">HIGHEST WIN RATE</option><option value="name">NAME A–Z</option></select>{periods}</div></>}
    <MapLinking onSaved={()=>setRevision(n=>n+1)}/>
    <TrackingScope scope={scope} players={data.players}/>
    <div className="map-scope-caption"><span>{scope.identity} · {period === 'ALL' ? 'All imported dates' : `Last ${period === '7D' ? '7' : '30'} days`}</span><span>{view.ambiguousMatches} matches excluded for unresolved team membership</span></div>
    {id && !map ? <section className="panel"><Empty title="No map record for this selection" sub="Check the player, squad and date range, or return to ALL MAPS. Unknown map URLs never open another map's statistics."/></section>
      : map ? <>
        <div className="map-detail-hero"><div className="eyebrow">MAP DOSSIER / {source(map)}</div><h1>{map.name}<span className="period">.</span></h1><p>{scope.identity} · Replay map IDs {[...new Set(map.matches.map(m=>m.mapId).filter(id=>id!=null))].join(', ') || 'manual entries'} · {map.matches.length} recorded matches</p><div className="map-detail-numbers"><div><strong>{rate(map.matchWinRate)}</strong><span>RECORDED MATCH WIN RATE</span></div><div><strong>{map.matches.length}</strong><span>MATCHES · {map.unverifiedMatches} UNVERIFIED</span></div><div><strong>{sideRate(map.attackWins, map.attackRounds)}</strong><span>ATTACK W/R · {map.attackRounds} KNOWN ROUNDS</span></div><div><strong>{sideRate(map.defenseWins, map.defenseRounds)}</strong><span>DEFENSE W/R · {map.defenseRounds} KNOWN ROUNDS</span></div></div></div>
        {map.source === 'inferred' && <div className="map-identity-note"><Icon name="info" size={16}/><p>{map.name} is inferred from objective labels: {map.evidence} The parser reports {map.rawName ?? 'no map name'}; this ID is not confirmed by its map table.</p></div>}
        <div className="two-grid"><section className="panel"><SectionTitle eyebrow="01 / SIDE PERFORMANCE" title="Attack & defense" right={<Pill tone="quiet">{map.rounds} TRACKED ROUNDS</Pill>}/><RoundSides record={map}/><div className="map-record-summary"><div><strong>{map.wins}</strong><small>ROUND WINS</small></div><div><strong>{map.losses}</strong><small>ROUND LOSSES</small></div><div><strong>{map.unknown}</strong><small>UNKNOWN RESULTS</small></div></div><div className="panel-insight"><Icon name="info" size={14}/> A tracked round requires at least one selected player to participate. Each squad round counts once.</div></section>
          <section className="panel"><SectionTitle eyebrow="02 / SITE INTELLIGENCE" title="Objective site performance" right={<div className="segmented" aria-label="Site side filter">{(['ALL', 'ATK', 'DEF'] as const).map(side => <button key={side} aria-pressed={siteSide === side} className={siteSide === side ? 'active' : ''} onClick={() => setSiteSide(side)}>{side}</button>)}</div>}/>{map.sites.filter(s => siteSide === 'ALL' || (siteSide === 'ATK' ? s.attackRounds : s.defenseRounds) > 0).map(site => {
            const count = siteSide === 'ALL' ? site.rounds : siteSide === 'ATK' ? site.attackRounds : site.defenseRounds;
            const denominator = siteSide === 'ALL' ? site.wins + site.losses : count;
            const wins = siteSide === 'ALL' ? site.wins : siteSide === 'ATK' ? site.attackWins : site.defenseWins;
            const percentage = asPercent(wins, denominator);
            return <div className="site-row" key={site.name}><div><strong>{site.name}</strong><span>{count} {siteSide === 'ALL' ? 'TRACKED' : 'KNOWN'} ROUNDS · {wins}/{denominator} WON{siteSide === 'ALL' && site.unknown ? ` · ${site.unknown} UNKNOWN` : ''}</span></div><div><strong>{rate(percentage)}</strong>{percentage != null && <Progress value={percentage} thin/>}</div></div>;
          })}{!map.sites.some(s => siteSide === 'ALL' || (siteSide === 'ATK' ? s.attackRounds : s.defenseRounds) > 0) && <Empty title="No site rounds for this side" sub="Try ALL or another date range."/>}<div className="panel-insight"><Icon name="info" size={14}/> Site labels come from the replay. Missing labels appear as “Site not recorded”.</div></section></div>
        <section className="panel"><SectionTitle eyebrow="03 / MAP HISTORY" title="Recent engagements" right={<Pill tone="quiet">{map.matchWins} W / {map.matchLosses} L</Pill>}/><div className="profile-matches">{map.matches.slice(0, historyLimit).map(m => <button key={m.matchId} onClick={() => app.go('/matches/' + encodeURIComponent(m.matchId))}><span className={`result ${m.outcome === 'WIN' ? 'win' : m.outcome === 'LOSS' ? 'loss' : 'unknown'}`}>{m.outcome === 'UNKNOWN' ? 'UNVERIFIED' : m.outcome}</span><div><strong>{m.matchType ?? 'Unknown mode'} · {m.gameMode ?? 'Unknown objective'}</strong><small>{sourceLabel(m)} · {formatPlayedAt(m.playedAt)} · #{m.matchId.slice(0, 8)} · {m.present} selected players</small></div><span>{m.outcome === 'UNKNOWN' ? 'SCORE UNVERIFIED' : `${m.wins} : ${m.losses}`} · {m.scopedRounds.length} known tracked rounds</span><Icon name="chevron" size={16}/></button>)}</div>{map.matches.length > historyLimit && <Btn small onClick={() => setHistoryLimit(v => v + 20)}>LOAD MORE MATCHES</Btn>}</section>
      </> : <>
        <div className="stats-grid three"><StatCard label="RECORDED MAPS" value={filtered.length} icon="map" delta="CURRENT SEARCH" sub={scope.identity}/><StatCard label="RECORDED MATCH RECORD" value={`${filtered.reduce((n, m) => n + m.matchWins, 0)} – ${filtered.reduce((n, m) => n + m.matchLosses, 0)}`} icon="target" delta="WINS / LOSSES" sub={`${filtered.reduce((n, m) => n + m.unverifiedMatches, 0)} unknown results`}/><StatCard label="TRACKED ROUNDS" value={filtered.reduce((n, m) => n + m.rounds, 0)} icon="activity" delta="PLAYER PARTICIPATION" sub="squad rounds counted once"/></div>
        {filtered.length ? <div className="map-card-grid">{filtered.map((m, index) => <button className="map-card" key={m.key} onClick={() => app.go('/maps/' + encodeURIComponent(m.key))}><div className="map-card-art" style={{ '--map-accent': color(m.name) } as React.CSSProperties}><div className="map-card-gridlines"/><span className="map-card-code">{m.source === 'inferred' ? 'SITE INFERENCE' : m.source === 'unknown' ? 'UNRESOLVED' : m.name.slice(0, 3).toUpperCase()}</span><Icon name="map" size={66}/><div className="map-card-art-bottom">REPLAY MAP ID <span>{m.mapId ?? String(index + 1).padStart(2, '0')}</span></div></div><div className="map-card-body"><div><small>{source(m)}</small><h3>{m.name}</h3></div><div className="map-win"><strong>{rate(m.matchWinRate)}</strong><small>WIN RATE</small></div></div>{m.matchWinRate != null && <Progress value={m.matchWinRate} color={m.matchWinRate >= 60 ? 'var(--accent)' : 'var(--blue)'} thin/>}<div className="map-card-bottom"><span>{m.matches.length} MATCHES · {m.unverifiedMatches} UNVERIFIED</span><span>ATK {sideRate(m.attackWins, m.attackRounds)} / DEF {sideRate(m.defenseWins, m.defenseRounds)}</span><Icon name="arrow" size={16}/></div></button>)}</div>
          : <section className="panel"><Empty title="No recorded maps for this selection" sub="Try another player, a saved squad, a wider date range, or clear the search."/></section>}
      </>}
    <p className="real-map-footnote">Win rates describe your imported sample. Match rates use completed results results; round and site rates use known outcomes. Map IDs keep different replay versions separate. Movement coordinates and verified floor plans are unavailable in this dataset.</p>
  </div>;
}

function RoundSides({ record }: { record: RoundRecord }) {
  return <div className="recorded-map-sides">{[{ label: 'ATTACK', wins: record.attackWins, rounds: record.attackRounds, color: 'var(--accent)' }, { label: 'DEFENSE', wins: record.defenseWins, rounds: record.defenseRounds, color: 'var(--blue)' }].map(side => <div key={side.label}><div className="side-row"><span>{side.label} · {side.wins}/{side.rounds} WON</span><strong>{sideRate(side.wins, side.rounds)}</strong></div>{side.rounds > 0 && <Progress value={asPercent(side.wins, side.rounds) ?? 0} color={side.color}/>}</div>)}</div>;
}
